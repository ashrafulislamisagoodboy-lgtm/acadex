// Local HTTP client. All records and sessions are persisted by the SQLite server.
export type LocalUser = { uid: string; email: string | null; displayName: string; role: string };
type Ref = { path: string; kind: 'document' | 'collection'; constraints?: any[] };
const listeners = new Set<(user: LocalUser | null) => void>();
const changes = new EventTarget();
let initialized: Promise<void> | undefined;

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'include', headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('Cannot reach the Acadex server. Check that it is running, then reload this page.'); }
  const raw = await response.text();
  let result: any;
  try { result = raw ? JSON.parse(raw) : {}; }
  catch { throw new Error(response.ok ? 'The server returned an unreadable response.' : `The server returned an error (${response.status}). Try again.`); }
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) acceptUser(null);
    throw new Error(result.error || 'The request failed.');
  }
  return result;
}
function acceptUser(user: LocalUser | null) {
  const changed = JSON.stringify(auth.currentUser) !== JSON.stringify(user);
  auth.currentUser = user;
  if (changed) listeners.forEach(callback => callback(user));
}
export const auth = {
  currentUser: null as LocalUser | null,
  onAuthStateChanged(callback: (user: LocalUser | null) => void) { return onAuthStateChanged(auth, callback); },
  async signOut() { return signOut(auth); },
};
export function onAuthStateChanged(_auth: typeof auth, callback: (user: LocalUser | null) => void) {
  listeners.add(callback);
  initialized ??= api('/auth/me').then(result => { acceptUser(result.user); }).catch(() => { acceptUser(null); });
  initialized.then(() => { if (listeners.has(callback)) callback(auth.currentUser); });
  return () => { listeners.delete(callback); };
}
export async function login(input: unknown, setup = false) {
  const result = await api(setup ? '/auth/setup' : '/auth/login', input);
  acceptUser(result.user); changes.dispatchEvent(new Event('change'));
}
export async function signOut(_auth: typeof auth) {
  await api('/auth/logout', {}); acceptUser(null); changes.dispatchEvent(new Event('change'));
}
export const db = { path: '' };
function reference(kind: Ref['kind'], parent: { path: string }, segments: string[]): Ref {
  if (segments.some(value => typeof value !== 'string' || !value)) throw new Error('Invalid record ID.');
  return { kind, path: [parent.path, ...segments].filter(Boolean).join('/') };
}
export function collection(parent: { path: string }, ...segments: string[]) { return reference('collection', parent, segments); }
export function doc(parent: { path: string }, ...segments: string[]) { return reference('document', parent, segments.length ? segments : [crypto.randomUUID()]); }
export function where(field: string, operator: string, value: unknown) { return { type: 'where', field, operator, value }; }
export function orderBy(field: string, direction = 'asc') { return { type: 'orderBy', field, direction }; }
export function limit(count: number) { return { type: 'limit', count }; }
export function query(ref: Ref, ...constraints: any[]): Ref { return { ...ref, constraints }; }
export function increment(amount: number) { return { __op: 'increment', amount }; }
export function arrayUnion(...values: unknown[]) { return { __op: 'arrayUnion', values }; }
export function serverTimestamp() { return new Date().toISOString(); }
function snapshot(row: any) {
  return { id: row.id, ref: { path: row.path, kind: 'document' } as Ref, exists: () => row.data !== null, data: (): any => row.data };
}
export async function getDoc(ref: Ref) { return snapshot(await api('/data/read', ref)); }
export async function getDocs(ref: Ref) {
  const result = await api('/data/read', ref);
  const docs = result.docs.map(snapshot);
  return { docs, empty: docs.length === 0, size: docs.length };
}
export const getDocsFromServer = getDocs;
export async function commit(operations: unknown[]) { await api('/data/write', { operations }); changes.dispatchEvent(new Event('change')); }
export async function setDoc(ref: Ref, data: unknown, options?: { merge: boolean }) { await commit([{ type: 'set', path: ref.path, data, merge: options?.merge }]); }
export async function updateDoc(ref: Ref, data: unknown) { await commit([{ type: 'update', path: ref.path, data }]); }
export async function deleteDoc(ref: Ref) { await commit([{ type: 'delete', path: ref.path }]); }
export async function addDoc(ref: Ref, data: unknown) { const created = doc(ref); await setDoc(created, data); return created; }
export function writeBatch(_db: typeof db) {
  const operations: unknown[] = [];
  return {
    set(ref: Ref, data: unknown) { operations.push({ type: 'set', path: ref.path, data }); },
    update(ref: Ref, data: unknown) { operations.push({ type: 'update', path: ref.path, data }); },
    delete(ref: Ref) { operations.push({ type: 'delete', path: ref.path }); },
    async commit() { if (operations.length) await commit(operations); },
  };
}
export function onSnapshot(ref: Ref, callback: (value: any) => void, onError: (error: Error) => void = console.error) {
  let active = true, pending = false, previous: string | undefined;
  async function refresh() {
    if (!active || pending) return;
    pending = true;
    try {
      const raw = await api('/data/read', ref);
      const serialized = JSON.stringify(raw);
      if (active && serialized !== previous) {
        previous = serialized;
        callback(ref.kind === 'document' ? snapshot(raw) : { docs: raw.docs.map(snapshot), empty: raw.docs.length === 0, size: raw.docs.length });
      }
    } catch (error) { if (active) onError(error as Error); }
    finally { pending = false; }
  }
  refresh();
  const timer = window.setInterval(refresh, 3000);
  changes.addEventListener('change', refresh);
  return () => { active = false; clearInterval(timer); changes.removeEventListener('change', refresh); };
}
export async function startLocalQuiz(subject: string, chapter: string) { return api('/quizzes', { subject, chapter }); }
export async function answerLocalQuiz(id: string, index: number, optionIndex: number) {
  const result = await api(`/quizzes/${encodeURIComponent(id)}/answer`, { index, optionIndex });
  changes.dispatchEvent(new Event('change')); return result;
}
