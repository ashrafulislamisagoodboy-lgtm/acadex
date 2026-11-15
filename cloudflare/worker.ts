import { ApiError, CloudStore } from './store.ts';

type DurableObjectStorage = ConstructorParameters<typeof CloudStore>[0];
type DurableObjectState = { storage: DurableObjectStorage };
type DurableObjectStub = { fetch(request: Request): Promise<Response> };
type DurableObjectNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStub;
};
type AssetsBinding = { fetch(request: Request): Promise<Response> };

interface Env {
  ACADEX_DATABASE: DurableObjectNamespace;
  ASSETS: AssetsBinding;
}

type User = { uid: string; role: string };
const cookieName = 'acadex_session';
const attempts = new Map<string, { count: number; reset: number }>();

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function sessionToken(request: Request) {
  return request.headers.get('Cookie')?.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

function sessionCookie(token: string, secure: boolean) {
  return `${cookieName}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Strict; Max-Age=604800; Path=/`;
}

async function body(request: Request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 8 * 1024 * 1024) throw new ApiError(413, 'The upload is too large.');
  try { return await request.json() as Record<string, any>; }
  catch { throw new ApiError(400, 'Send a valid JSON request.'); }
}

export class AcadexDatabase {
  private store: CloudStore;

  constructor(state: DurableObjectState, _env: Env) {
    this.store = new CloudStore(state.storage);
  }

  private currentUser(request: Request) {
    return this.store.currentUser(sessionToken(request));
  }

  private requireUser(request: Request): User {
    const user = this.currentUser(request);
    if (!user) throw new ApiError(401, 'Please sign in.');
    return user as User;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) {
        return json({ error: 'Use Acadex from its own web address.' }, 403);
      }

      const path = url.pathname;
      if (request.method === 'GET' && path === '/api/status') {
        return json({ needsSetup: this.store.needsSetup(), storage: 'cloudflare-sqlite' });
      }
      if (request.method === 'GET' && path === '/api/auth/me') {
        const user = this.currentUser(request);
        return json({ user: user ? this.store.userInfo(user) : null });
      }
      if (request.method === 'POST' && path === '/api/auth/setup') {
        const result = this.store.setup(await body(request));
        return json({ user: result.user }, 200, { 'Set-Cookie': sessionCookie(result.token, url.protocol === 'https:') });
      }
      if (request.method === 'POST' && path === '/api/auth/login') {
        const key = request.headers.get('CF-Connecting-IP') || 'unknown';
        const now = Date.now();
        let attempt = attempts.get(key);
        if (!attempt || attempt.reset < now) {
          attempt = { count: 0, reset: now + 60_000 };
          attempts.set(key, attempt);
        }
        if (attempt.count >= 20) throw new ApiError(429, 'Too many login attempts. Try again in a minute.');
        attempt.count++;
        const result = this.store.login(await body(request));
        attempts.delete(key);
        return json({ user: result.user }, 200, { 'Set-Cookie': sessionCookie(result.token, url.protocol === 'https:') });
      }
      if (request.method === 'POST' && path === '/api/auth/password') {
        const result = this.store.changePassword(this.requireUser(request), await body(request));
        return json({ user: result.user }, 200, { 'Set-Cookie': sessionCookie(result.token, url.protocol === 'https:') });
      }
      if (request.method === 'POST' && path === '/api/auth/logout') {
        this.store.logout(sessionToken(request));
        return json({ ok: true }, 200, {
          'Set-Cookie': `${cookieName}=; HttpOnly;${url.protocol === 'https:' ? ' Secure;' : ''} SameSite=Strict; Max-Age=0; Path=/`,
        });
      }
      if (request.method === 'POST' && path === '/api/data/read') {
        return json(this.store.read(this.requireUser(request), await body(request)));
      }
      if (request.method === 'POST' && path === '/api/data/write') {
        const input = await body(request);
        this.store.write(this.requireUser(request), input.operations);
        return json({ ok: true });
      }
      if (request.method === 'POST' && path === '/api/quizzes') {
        return json(this.store.startQuiz(this.requireUser(request), await body(request)));
      }
      const answer = path.match(/^\/api\/quizzes\/([^/]+)\/answer$/);
      if (request.method === 'POST' && answer) {
        return json(this.store.answer(this.requireUser(request), decodeURIComponent(answer[1]), await body(request)));
      }
      if (request.method === 'POST' && path.startsWith('/api/ai/')) {
        const user = this.requireUser(request);
        if (user.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
        throw new ApiError(503, 'AI imports are optional and are not configured on this Cloudflare deployment. You can add records manually.');
      }
      return json({ error: 'API endpoint not found.' }, 404);
    } catch (error: any) {
      const status = error instanceof ApiError ? error.status : 500;
      if (status === 500) console.error(error);
      return json({ error: status === 500 ? 'The Acadex cloud server could not complete this request.' : error.message }, status);
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.ACADEX_DATABASE.idFromName('primary');
      return env.ACADEX_DATABASE.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
