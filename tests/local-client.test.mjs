import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { setInterval }; // Top-level, non-embedded browser.
const client = await import('../src/lib/local.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
const user = { uid: 'one', displayName: 'Student', role: 'student' };

test('restored auth session notifies each active listener exactly once', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ user }));
  const seen = [];
  const stop = client.onAuthStateChanged(client.auth, v => seen.push(v));
  client.onAuthStateChanged(client.auth, () => assert.fail('Unsubscribed callback'))();
  await tick(); stop();
  assert.deepEqual(seen, [user]);
});

test('writes during a pending snapshot trigger one fresh read, not stale output', async t => {
  let finish, reads = 0;
  const row = n => Response.json({ id: 'one', path: 'users/one', data: { xp: n } });
  t.mock.method(globalThis, 'fetch', async path => {
    if (path === '/api/data/write') return Response.json({});
    if (++reads === 1) return new Promise(resolve => { finish = resolve; });
    return row(2);
  });
  const values = [], ref = client.doc(client.db, 'users', 'one');
  const stop = client.onSnapshot(ref, s => values.push(s.data().xp));
  t.after(stop);
  await client.updateDoc(ref, { xp: 1 });
  await client.updateDoc(ref, { xp: 2 });
  finish(row(0)); await tick();
  assert.equal(reads, 2); assert.deepEqual(values, [2]);
});

test('new document IDs work on a LAN without crypto.randomUUID', t => {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
  t.after(() => descriptor ? Object.defineProperty(crypto, 'randomUUID', descriptor) : delete crypto.randomUUID);
  const events = client.collection(client.db, 'events');
  const ids = Array.from({ length: 4 }, () => client.doc(events).path);
  assert.ok(ids.every(id => /^events\/[a-f0-9]{32}$/.test(id)));
  assert.equal(new Set(ids).size, ids.length);
});
