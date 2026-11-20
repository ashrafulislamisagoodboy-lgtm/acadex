import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import { createApp } from '../server/index.ts';

async function serve(databasePath = ':memory:', previewOrigin) {
  const { app, store } = createApp({ databasePath, previewOrigin });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  let closed = false;
  return {
    store,
    async call(path, body, cookie, headers = {}) {
      const response = await fetch(url + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
    },
    async close() { if (!closed) { closed = true; await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); store.close(); } },
  };
}
async function fixture(t) {
  const app = await serve(); t.after(() => app.close());
  const setup = await app.call('/auth/setup', { username: 'principal', name: 'School Admin', password: 'local-test-password' });
  assert.equal(setup.status, 200);
  return { ...app, admin: setup.cookie, adminId: setup.data.user.uid };
}
function put(path, data) { return { type: 'set', path, data }; }
function question(number) { return put(`questions/q${number}`, { subject: 'Math', chapter: 'Numbers', question: `Question ${number}`, options: ['A', 'B', 'C', 'D'], correctIndex: 1 }); }
async function student(app, id = 'ST-001', phone = '12345678') {
  assert.equal((await app.call('/data/write', { operations: [put(`admin_students/${id}`, { studentId: id, phone, name: 'Student One', roll: '1', grade: '7' })] }, app.admin)).status, 200);
  const login = await app.call('/auth/login', { method: 'student', studentId: id.toLowerCase(), phone });
  assert.equal(login.status, 200);
  return { cookie: login.cookie, uid: login.data.user.uid };
}

test('first-run setup, hashed passwords, login and logout', async t => {
  const app = await serve(); t.after(() => app.close());
  assert.equal((await app.call('/status')).data.needsSetup, true);
  assert.equal((await app.call('/auth/setup', { username: 'principal', name: 'Admin', password: 'short' })).status, 400);
  const setup = await app.call('/auth/setup', { username: 'principal', name: 'Admin', password: 'local-test-password' });
  assert.equal(setup.data.user.role, 'admin');
  assert.match(setup.headers.get('set-cookie'), /HttpOnly/);
  assert.match(setup.headers.get('set-cookie'), /SameSite=Strict/);
  assert.equal((await app.call('/status')).data.needsSetup, false);
  assert.equal((await app.call('/auth/setup', { username: 'other', name: 'Other', password: 'local-test-password' })).status, 409);
  const account = app.store.db.prepare('SELECT * FROM accounts').get();
  assert.notEqual(account.password_hash, 'local-test-password');
  assert.equal(account.password_hash.length, 128);
  assert.equal((await app.call('/auth/login', { username: 'principal', password: 'incorrect' })).status, 401);
  const login = await app.call('/auth/login', { username: 'PRINCIPAL', password: 'local-test-password' });
  assert.equal(login.status, 200);
  assert.equal((await app.call('/auth/me', undefined, login.cookie)).data.user.uid, setup.data.user.uid);
  await app.call('/auth/logout', {}, login.cookie);
  assert.equal((await app.call('/auth/me', undefined, login.cookie)).data.user, null);
  assert.equal((await app.call('/data/read', { path: 'users', kind: 'collection' })).status, 401);
});

test('administrator password recovery rotates credentials and revokes older sessions', async t => {
  const app = await fixture(t);
  const originalAccount = app.store.db.prepare('SELECT password_hash, salt FROM accounts WHERE uid = ?').get(app.adminId);
  assert.equal((await app.call('/auth/password', { password: 'new-local-password' })).status, 401);
  assert.equal((await app.call('/auth/password', { password: 'short' }, app.admin)).status, 400);

  const player = await student(app);
  assert.equal((await app.call('/auth/password', { password: 'student-password' }, player.cookie)).status, 403);

  const changed = await app.call('/auth/password', { password: 'new-local-password' }, app.admin);
  assert.equal(changed.status, 200);
  assert.ok(changed.cookie);
  assert.equal((await app.call('/auth/me', undefined, app.admin)).data.user, null);
  assert.equal((await app.call('/auth/me', undefined, changed.cookie)).data.user.uid, app.adminId);
  assert.equal((await app.call('/auth/login', { username: 'principal', password: 'local-test-password' })).status, 401);
  assert.equal((await app.call('/auth/login', { username: 'principal', password: 'new-local-password' })).status, 200);

  const updatedAccount = app.store.db.prepare('SELECT password_hash, salt FROM accounts WHERE uid = ?').get(app.adminId);
  assert.notEqual(updatedAccount.password_hash, originalAccount.password_hash);
  assert.notEqual(updatedAccount.salt, originalAccount.salt);
  assert.notEqual(updatedAccount.password_hash, 'new-local-password');
});

test('student authorization, private records, role and score permissions', async t => {
  const app = await fixture(t);
  assert.equal((await app.call('/auth/login', { method: 'student', studentId: 'missing', phone: '12345678' })).status, 401);
  const first = await student(app);
  const second = await student(app, 'ST-002', '87654321');
  assert.equal((await app.call('/data/read', { path: 'admin_students/ST-001', kind: 'document' }, first.cookie)).status, 403);
  const publicProfile = await app.call('/data/read', { path: `users/${first.uid}`, kind: 'document' }, second.cookie);
  assert.equal(publicProfile.data.data.phone, undefined);
  assert.equal(publicProfile.data.data.studentId, undefined);
  assert.equal((await app.call('/data/read', { path: `users/${first.uid}`, kind: 'document' }, first.cookie)).data.data.phone, '12345678');
  for (const data of [{ xp: 999 }, { role: 'admin' }, { isBanned: false }, { totalQuestionsAttended: 50 }]) {
    assert.equal((await app.call('/data/write', { operations: [{ type: 'update', path: `users/${first.uid}`, data }] }, first.cookie)).status, 403);
  }
  assert.equal((await app.call('/data/write', { operations: [question(1)] }, first.cookie)).status, 403);
  assert.equal((await app.call('/data/read', { path: 'users/../accounts', kind: 'document' }, app.admin)).status, 400);
  assert.equal((await app.call('/data/write', { operations: [{ type: 'update', path: `users/${first.uid}`, data: { isBanned: true } }] }, app.admin)).status, 200);
  assert.equal((await app.call('/data/read', { path: 'questions', kind: 'collection' }, first.cookie)).status, 401);
  assert.equal((await app.call('/auth/login', { method: 'student', studentId: 'ST-001', phone: '12345678' })).status, 403);
});

test('transactional imports, dates, images, category queries and deletions', async t => {
  const app = await fixture(t);
  const invalid = await app.call('/data/write', { operations: [question(1), put('events/invalid', { title: 'Exam', startDate: '2026-99-99', time: '', location: '' })] }, app.admin);
  assert.equal(invalid.status, 400);
  assert.equal(app.store.list('questions').length, 0);
  const operations = [question(1), question(2), put('events/exam', { title: 'Exam', startDate: '2026-10-20', endDate: '2026-10-22', time: '09:00', location: 'Hall' })];
  assert.equal((await app.call('/data/write', { operations }, app.admin)).status, 200);
  const read = await app.call('/data/read', { path: 'questions', kind: 'collection', constraints: [{ type: 'where', field: 'subject', operator: '==', value: 'Math' }, { type: 'orderBy', field: 'question', direction: 'desc' }, { type: 'limit', count: 1 }] }, app.admin);
  assert.equal(read.data.docs[0].id, 'q2');
  const image = 'data:image/png;base64,' + Buffer.alloc(2048).toString('base64');
  assert.equal((await app.call('/data/write', { operations: [{ type: 'update', path: `users/${app.adminId}`, data: { photoUrl: image } }] }, app.admin)).status, 200);
  assert.equal(app.store.get(`users/${app.adminId}`).photoUrl, image);
  assert.equal((await app.call('/data/write', { operations: [{ type: 'delete', path: 'questions/q1' }, { type: 'delete', path: 'events/exam' }] }, app.admin)).status, 200);
  assert.equal(app.store.list('questions').length, 1);
  assert.equal(app.store.list('events').length, 0);
});

test('quiz scoring, penalties, milestones, answer replay and complete history', async t => {
  const app = await fixture(t);
  const player = await student(app);
  await app.call('/data/write', { operations: Array.from({ length: 25 }, (_, n) => question(n)) }, app.admin);
  const list = await app.call('/data/read', { path: 'questions', kind: 'collection' }, player.cookie);
  assert.ok(list.data.docs.every(row => row.data.correctIndex === undefined));
  for (let round = 0; round < 2; round++) {
    const quiz = await app.call('/quizzes', { subject: 'Math', chapter: 'Numbers' }, player.cookie);
    assert.equal(quiz.data.questions.length, 20);
    assert.equal(new Set(quiz.data.questions.map(q => q.id)).size, 20);
    assert.ok(quiz.data.questions.every(q => q.correctIndex === undefined));
    assert.equal((await app.call(`/quizzes/${quiz.data.id}/answer`, { index: 1, optionIndex: 1 }, player.cookie)).status, 409);
    let last;
    for (let index = 0; index < 20; index++) {
      const response = await app.call(`/quizzes/${quiz.data.id}/answer`, { index, optionIndex: index < 10 ? 0 : 1 }, player.cookie);
      assert.equal(response.status, 200);
      last = response.data;
      assert.equal(last.correct, index >= 10);
      assert.ok(last.xp >= 0);
      if (round === 0 && index === 14) { assert.equal(last.milestone, true); assert.equal(last.milestonePoints, 5); }
    }
    assert.equal(last.score, 10); assert.equal(last.completed, true);
    assert.equal(last.xp, round === 0 ? 10 : 18);
    assert.equal(last.xpLost, round === 0 ? 0 : 2);
    const replay = await app.call(`/quizzes/${quiz.data.id}/answer`, { index: 19, optionIndex: 1 }, player.cookie);
    assert.deepEqual(replay.data, last);
    assert.equal((await app.call(`/quizzes/${quiz.data.id}/answer`, { index: 19, optionIndex: 0 }, player.cookie)).status, 409);
  }
  const user = app.store.get(`users/${player.uid}`);
  assert.equal(user.xp, 18); assert.equal(user.totalQuestionsAttended, 40); assert.equal(user.totalQuizzesPlayed, 2);
  assert.equal(app.store.list(`users/${player.uid}/quizAttempts`).length, 2);
});

test('last-admin protection and username changes keep login in sync', async t => {
  const app = await fixture(t);
  for (const operation of [{ type: 'delete' }, { type: 'update', data: { role: 'student' } }, { type: 'update', data: { isBanned: true } }]) {
    assert.equal((await app.call('/data/write', { operations: [{ ...operation, path: `users/${app.adminId}` }] }, app.admin)).status, 409);
  }
  assert.equal((await app.call('/data/write', { operations: [{ type: 'update', path: `users/${app.adminId}`, data: { username: ' newprincipal ' } }] }, app.admin)).status, 200);
  assert.equal(app.store.get(`users/${app.adminId}`).username, 'newprincipal');
  assert.equal((await app.call('/auth/login', { username: 'newprincipal', password: 'local-test-password' })).status, 200);
});

test('records, credentials and sessions survive a server restart', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'acadex-test-'));
  const filename = join(folder, 'acadex.sqlite');
  let app = await serve(filename);
  t.after(async () => {
    await app.close();
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep) && basename(folder).startsWith('acadex-test-'));
    rmSync(folder, { recursive: true, force: true });
  });
  const setup = await app.call('/auth/setup', { username: 'principal', name: 'Admin', password: 'local-test-password' });
  await app.call('/data/write', { operations: [question(1)] }, setup.cookie);
  await app.close();
  app = await serve(filename);
  assert.equal((await app.call('/status')).data.needsSetup, false);
  assert.equal((await app.call('/auth/me', undefined, setup.cookie)).data.user.uid, setup.data.user.uid);
  assert.equal((await app.call('/data/read', { path: 'questions', kind: 'collection' }, setup.cookie)).data.docs.length, 1);
  assert.equal((await app.call('/auth/login', { username: 'principal', password: 'local-test-password' })).status, 200);
});

test('cross-site requests are blocked and AI is optional', async t => {
  const app = await fixture(t);
  assert.equal((await app.call('/data/write', { operations: [question(1)] }, app.admin, { Origin: 'https://unrelated.example' })).status, 403);
  const original = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await app.call('/ai/quiz', { bookTitle: 'Book', content: { data: 'test', mimeType: 'application/pdf' } }, app.admin);
    assert.equal(response.status, 503); assert.match(response.data.error, /optional/);
    assert.equal((await app.call('/status')).status, 200);
  } finally { if (original !== undefined) process.env.GEMINI_API_KEY = original; }
});

test('embedded preview uses its public origin and partitioned HTTPS session cookie', async t => {
  const origin = 'https://preview.example.test';
  const app = await serve(':memory:', origin); t.after(() => app.close());
  const setup = await app.call('/auth/setup', { username: 'principal', name: 'Admin', password: 'preview-password' }, undefined, { Origin: origin });
  assert.equal(setup.status, 200);
  for (const flag of ['Secure', 'Partitioned', 'SameSite=None', 'HttpOnly']) assert.ok(setup.headers.get('set-cookie').includes(flag));
  assert.equal((await app.call('/auth/me', undefined, setup.cookie)).data.user.role, 'admin');
  assert.equal((await app.call('/auth/logout', {}, setup.cookie, { Origin: 'https://other.example.test' })).status, 403);
  assert.match((await app.call('/auth/logout', {}, setup.cookie, { Origin: origin })).headers.get('set-cookie'), /Partitioned/);
});
