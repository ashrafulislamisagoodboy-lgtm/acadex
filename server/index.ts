import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { LocalStore, ApiError } from './store.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cookieName = 'acadex_session';
const sessionToken = (req: Request) => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);

export function createApp({ databasePath = resolve(root, 'data/acadex.sqlite') } = {}) {
  const store = new LocalStore(databasePath);
  const app = express();
  const secureCookies = process.env.SECURE_COOKIES === 'true';
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Requests from a different website must not modify the local database.
    if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.get('host')}`) {
      res.status(403).json({ error: 'Use Acadex from its own web address.' }); return;
    }
    next();
  });
  app.use(express.json({ limit: '8mb' }));
  const protect = (req: Request, res: Response, next: NextFunction) => {
    const user = store.currentUser(sessionToken(req));
    if (!user) { res.status(401).json({ error: 'Please sign in.' }); return; }
    res.locals.user = user;
    next();
  };
  const setSession = (res: Response, result: ReturnType<LocalStore['createSession']>) => {
    res.cookie(cookieName, result.token, { httpOnly: true, sameSite: 'strict', secure: secureCookies, maxAge: 7 * 86400000, path: '/' });
    res.json({ user: result.user });
  };
  app.get('/api/status', (_req, res) => res.json({ needsSetup: store.needsSetup(), storage: 'sqlite' }));
  app.get('/api/auth/me', (req, res) => {
    const user = store.currentUser(sessionToken(req));
    res.json({ user: user ? store.userInfo(user) : null });
  });
  app.post('/api/auth/setup', (req, res) => setSession(res, store.setup(req.body)));
  const attempts = new Map<string, { count: number; reset: number }>();
  app.post('/api/auth/login', (req, res) => {
    const key = req.ip || 'local';
    const now = Date.now();
    let attempt = attempts.get(key);
    if (!attempt || attempt.reset < now) { attempt = { count: 0, reset: now + 60000 }; attempts.set(key, attempt); }
    if (attempt.count >= 20) throw new ApiError(429, 'Too many login attempts. Try again in a minute.');
    attempt.count++;
    const result = store.login(req.body);
    attempts.delete(key);
    setSession(res, result);
  });
  app.post('/api/auth/password', protect, (req, res) => {
    setSession(res, store.changePassword(res.locals.user, req.body));
  });
  app.post('/api/auth/logout', (req, res) => {
    store.logout(sessionToken(req));
    res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: secureCookies, path: '/' });
    res.json({ ok: true });
  });
  app.post('/api/data/read', protect, (req, res) => res.json(store.read(res.locals.user, req.body)));
  app.post('/api/data/write', protect, (req, res) => { store.write(res.locals.user, req.body.operations); res.json({ ok: true }); });
  app.post('/api/quizzes', protect, (req, res) => res.json(store.startQuiz(res.locals.user, req.body)));
  app.post('/api/quizzes/:id/answer', protect, (req, res) => res.json(store.answer(res.locals.user, String(req.params.id), req.body)));
  app.post('/api/ai/:task', protect, async (req, res, next) => {
    try {
      if (res.locals.user.role !== 'admin') throw new ApiError(403, 'Administrator access required.');
      if (!process.env.GEMINI_API_KEY) throw new ApiError(503, 'AI imports are optional. Set GEMINI_API_KEY in .env to enable them. You can add records manually without it.');
      const { generateQuizFromBook, extractStudentsFromIDCards, extractEventsFromCalendar } = await import('./ai.ts');
      const { content, bookTitle } = req.body;
      if (!content || typeof content.data !== 'string' || !['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(content.mimeType)) throw new ApiError(400, 'Upload a PDF, PNG, JPEG, WebP, or GIF.');
      let result;
      if (req.params.task === 'quiz') result = await generateQuizFromBook(String(bookTitle || 'Book'), content);
      else if (req.params.task === 'students') result = await extractStudentsFromIDCards(content);
      else if (req.params.task === 'calendar') result = await extractEventsFromCalendar(content);
      else throw new ApiError(404, 'Unknown AI task.');
      res.json({ result });
    } catch (error) { next(error); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = error instanceof ApiError ? error.status : error.status === 413 ? 413 : error instanceof SyntaxError ? 400 : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'The Acadex server could not complete this request.' : error.message });
  });
  return { app, store };
}

export async function startServer() {
  const databasePath = process.env.ACADEX_DATA_DIR ? resolve(process.env.ACADEX_DATA_DIR, 'acadex.sqlite') : resolve(root, 'data/acadex.sqlite');
  const { app, store } = createApp({ databasePath });
  let vite: any;
  if (process.argv.includes('--dev')) {
    const { createServer } = await import('vite');
    vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = resolve(root, 'dist');
    if (!existsSync(resolve(dist, 'index.html'))) { store.close(); throw new Error('Build the app first with npm run build, or use npm run dev.'); }
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST?.trim() || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    store.close();
    throw new Error('PORT must be a number from 1 to 65535.');
  }
  const server = app.listen(port, host, () => {
    const localHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
    console.log(`Acadex is running at http://${localHost}:${port}`);
    if (host === '0.0.0.0' || host === '::') {
      const addresses = Object.values(networkInterfaces()).flat()
        .filter(address => address && address.family === 'IPv4' && !address.internal)
        .map(address => `http://${address!.address}:${port}`);
      for (const address of [...new Set(addresses)]) console.log(`Network address: ${address}`);
    }
    console.log(`Local database: ${databasePath}`);
  });
  server.on('error', async error => { console.error(error.message); await vite?.close(); store.close(); process.exitCode = 1; });
  const shutdown = () => server.close(async () => { await vite?.close(); store.close(); process.exit(0); });
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer().catch(error => { console.error(error.message); process.exitCode = 1; });
}
