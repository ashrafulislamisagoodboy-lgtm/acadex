import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

type Data = Record<string, any>;
type Actor = { uid: string; role: string };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
function text(value: unknown, label: string, max = 100) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `Enter a valid ${label}.`);
  return value.trim();
}
function accountName(value: unknown) {
  const result = text(value, 'username', 50);
  requireValue(result.length >= 3 && !/[\u0000-\u001F\u007F]/.test(result), 'Use a username with 3–50 visible characters.');
  return result;
}
function hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }
function validDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export class LocalStore {
  db: DatabaseSync;
  private sessionLifetime: number;
  constructor(filename: string, sessionLifetime = 7 * 86400000) {
    this.sessionLifetime = sessionLifetime;
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS documents (path TEXT PRIMARY KEY, collection TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS documents_collection ON documents(collection);
      CREATE TABLE IF NOT EXISTS accounts (uid TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, password_hash TEXT, salt TEXT, student_id TEXT UNIQUE COLLATE NOCASE);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, uid TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL);
    `);
  }
  close() { this.db.close(); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  get(path: string): Data | undefined {
    const row = this.db.prepare('SELECT data FROM documents WHERE path = ?').get(path) as any;
    return row ? JSON.parse(row.data) : undefined;
  }
  list(collection: string): { id: string; path: string; data: Data }[] {
    return (this.db.prepare('SELECT path, data FROM documents WHERE collection = ? ORDER BY path').all(collection) as any[])
      .map(row => ({ id: row.path.split('/').pop(), path: row.path, data: JSON.parse(row.data) }));
  }
  put(path: string, data: Data) {
    const collection = path.split('/').slice(0, -1).join('/');
    this.db.prepare('INSERT INTO documents(path, collection, data) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET data = excluded.data').run(path, collection, JSON.stringify(data));
  }
  needsSetup() { return !(this.db.prepare('SELECT uid FROM accounts LIMIT 1').get()); }
  userInfo(data: Data) { return { uid: data.uid, email: data.email || null, displayName: data.name, role: data.role }; }
  createSession(uid: string) {
    const token = randomBytes(32).toString('hex');
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hashToken(token), uid, Date.now() + this.sessionLifetime);
    return { token, user: this.userInfo(this.get(`users/${uid}`)!) };
  }
  currentUser(token: string | undefined): Data | null {
    if (!token) return null;
    const session = this.db.prepare('SELECT uid FROM sessions WHERE token = ? AND expires > ?').get(hashToken(token), Date.now()) as any;
    const data = session && this.get(`users/${session.uid}`);
    return data && !data.isBanned ? data : null;
  }
  logout(token: string | undefined) { if (token) this.db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token)); }
  newProfile(uid: string, fields: Data) {
    return { uid, username: `student_${uid.slice(0, 8)}`, name: 'Student', email: '', role: 'student', studentId: '', phone: '', roll: '', grade: '', photoUrl: null, bannerUrl: null, xp: 0, achievements: [], consecutiveWrongAnswers: 0, totalQuizzesPlayed: 0, totalQuestionsAttended: 0, cycleScore: 0, isBanned: false, lastUsernameChange: null, createdAt: new Date().toISOString(), ...fields };
  }
  setup(input: Data) {
    const username = accountName(input.username);
    const name = text(input.name, 'name', 50);
    const password = text(input.password, 'password', 200);
    requireValue(password.length >= 8, 'Use a password with at least 8 characters.');
    return this.transaction(() => {
      requireValue(this.needsSetup(), 'The administrator account has already been set up.', 409);
      const uid = randomUUID();
      const salt = randomBytes(16).toString('hex');
      const passwordHash = scryptSync(password, salt, 64).toString('hex');
      this.put(`users/${uid}`, this.newProfile(uid, { username, name, role: 'admin' }));
      this.db.prepare('INSERT INTO accounts(uid, username, password_hash, salt) VALUES (?, ?, ?, ?)').run(uid, username, passwordHash, salt);
      return this.createSession(uid);
    });
  }
  login(input: Data) {
    if (input.method === 'student') {
      const studentId = text(input.studentId, 'student ID');
      const phone = text(input.phone, 'phone number');
      const entry = this.list('admin_students').find(row => String(row.data.studentId).toLowerCase() === studentId.toLowerCase());
      requireValue(entry && entry.data.phone === phone, 'Invalid Student ID or phone number.', 401);
      return this.transaction(() => {
        let account = this.db.prepare('SELECT uid FROM accounts WHERE student_id = ?').get(studentId) as any;
        if (!account) {
          const uid = randomUUID();
          const data = entry.data;
          this.put(`users/${uid}`, this.newProfile(uid, { studentId: data.studentId, name: data.name, phone: data.phone, roll: data.roll || '', grade: data.grade || '' }));
          this.db.prepare('INSERT INTO accounts(uid, student_id) VALUES (?, ?)').run(uid, studentId);
          account = { uid };
        }
        requireValue(!this.get(`users/${account.uid}`)?.isBanned, 'Your account has been banned. Contact the administrator.', 403);
        return this.createSession(account.uid);
      });
    }
    const username = accountName(input.username);
    const password = text(input.password, 'password', 200);
    const account = this.db.prepare('SELECT * FROM accounts WHERE username = ?').get(username) as any;
    const candidate = scryptSync(password, account?.salt || 'invalid-account', 64);
    requireValue(account?.password_hash && timingSafeEqual(candidate, Buffer.from(account.password_hash, 'hex')), 'Incorrect username or password.', 401);
    const data = this.get(`users/${account.uid}`);
    requireValue(data && !data.isBanned, 'Your account is unavailable. Contact the administrator.', 403);
    return this.createSession(account.uid);
  }
  changePassword(actor: Actor, input: Data) {
    requireValue(actor.role === 'admin', 'Administrator access required.', 403);
    const password = text(input.password, 'password', 200);
    requireValue(password.length >= 8, 'Use a password with at least 8 characters.');
    return this.transaction(() => {
      const account = this.db.prepare('SELECT password_hash FROM accounts WHERE uid = ?').get(actor.uid) as any;
      requireValue(account?.password_hash, 'This account does not use a password.', 400);
      const salt = randomBytes(16).toString('hex');
      const passwordHash = scryptSync(password, salt, 64).toString('hex');
      this.db.prepare('UPDATE accounts SET password_hash = ?, salt = ? WHERE uid = ?').run(passwordHash, salt, actor.uid);
      this.db.prepare('DELETE FROM sessions WHERE uid = ?').run(actor.uid);
      return this.createSession(actor.uid);
    });
  }
  pathInfo(path: unknown, kind: string) {
    requireValue(typeof path === 'string' && path.length < 400, 'Invalid record path.');
    const parts = path.split('/');
    requireValue(parts.every(p => /^[a-zA-Z0-9_. @-]+$/.test(p) && p !== '.' && p !== '..'), 'Invalid record path.');
    const nested = parts[0] === 'users' && parts[2] === 'quizAttempts';
    const valid = ['users', 'questions', 'admin_students', 'events'].includes(parts[0]);
    requireValue(valid && (kind === 'document' ? parts.length === 2 || (nested && parts.length === 4) : parts.length === 1 || (nested && parts.length === 3)), 'Unknown collection.');
    return parts;
  }
  canRead(actor: Actor, parts: string[]) {
    requireValue(parts[0] !== 'admin_students' || actor.role === 'admin', 'Administrator access required.', 403);
  }
  visible(actor: Actor, path: string, data: Data) {
    const result = { ...data };
    if (path.startsWith('users/') && path.split('/').length === 2 && actor.role !== 'admin' && actor.uid !== data.uid) {
      for (const key of ['phone', 'studentId', 'email']) delete result[key];
    }
    if (path.startsWith('questions/') && actor.role !== 'admin') delete result.correctIndex;
    return result;
  }
  read(actor: Actor, input: Data) {
    const { path, kind } = input;
    const parts = this.pathInfo(path, kind);
    this.canRead(actor, parts);
    if (kind === 'document') {
      const data = this.get(path);
      return { id: parts.at(-1), path, data: data ? this.visible(actor, path, data) : null };
    }
    let rows = this.list(path).map(row => ({ ...row, data: this.visible(actor, row.path, row.data) }));
    const constraints = input.constraints || [];
    requireValue(Array.isArray(constraints) && constraints.length <= 10, 'Invalid filters.');
    for (const filter of constraints.filter((c: Data) => c.type === 'where')) {
      requireValue(filter.operator === '==', 'Unsupported filter.');
      rows = rows.filter(row => row.data[filter.field] === filter.value);
    }
    const ordering = constraints.filter((c: Data) => c.type === 'orderBy');
    if (ordering.length) {
      rows = rows.filter(row => ordering.every((o: Data) => row.data[o.field] !== undefined));
      rows.sort((a, b) => {
        for (const o of ordering) {
          const av = a.data[o.field], bv = b.data[o.field];
          const order = av < bv ? -1 : av > bv ? 1 : 0;
          if (order) return o.direction === 'desc' ? -order : order;
        }
        return a.id.localeCompare(b.id);
      });
    }
    const take = constraints.find((c: Data) => c.type === 'limit');
    if (take) { requireValue(Number.isInteger(take.count) && take.count > 0, 'Invalid limit.'); rows = rows.slice(0, take.count); }
    return { docs: rows };
  }
  validateImage(value: unknown) {
    if (value === null || value === undefined || value === '') return;
    requireValue(typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) && Buffer.from(value.split(',')[1], 'base64').length <= 1024 * 1024, 'Use a PNG, JPEG, WebP, or GIF image under 1MB.');
  }
  write(actor: Actor, operations: Data[]) {
    requireValue(Array.isArray(operations) && operations.length > 0 && operations.length <= 2000, 'Invalid batch.');
    this.transaction(() => {
      for (const operation of operations) {
        const { path, type, data = {}, merge } = operation;
        const parts = this.pathInfo(path, 'document');
        const collection = parts[0];
        requireValue(parts.length === 2, 'Quiz history is managed by the quiz server.', 403);
        const before = this.get(path);
        const ownProfile = collection === 'users' && parts[1] === actor.uid;
        requireValue(actor.role === 'admin' || (ownProfile && type !== 'delete'), 'Administrator access required.', 403);
        requireValue(['set', 'update', 'delete'].includes(type), 'Invalid operation.');
        if (type === 'delete') {
          if (collection === 'users' && before?.role === 'admin') this.requireOtherAdmin(parts[1]);
          this.db.prepare('DELETE FROM documents WHERE path = ?').run(path);
          if (collection === 'users') {
            this.db.prepare('DELETE FROM documents WHERE collection = ?').run(`${path}/quizAttempts`);
            this.db.prepare('DELETE FROM accounts WHERE uid = ?').run(parts[1]);
            this.db.prepare('DELETE FROM sessions WHERE uid = ?').run(parts[1]);
            this.db.prepare('DELETE FROM quizzes WHERE uid = ?').run(parts[1]);
          }
          continue;
        }
        requireValue(data && typeof data === 'object' && !Array.isArray(data), 'Invalid record.');
        if (type === 'update') requireValue(before, 'Record not found.', 404);
        if (collection === 'users') {
          requireValue(before, 'Create users through the login screen.', 400);
          if (actor.role !== 'admin') {
            const allowed = ['username', 'studentId', 'roll', 'grade', 'phone', 'photoUrl', 'bannerUrl'];
            requireValue(Object.keys(data).every(key => allowed.includes(key)), 'This field is managed by the server.', 403);
          }
        }
        const after: Data = type === 'update' || merge ? { ...before } : {};
        for (const [key, value] of Object.entries(data)) {
          requireValue(!['__proto__', 'prototype', 'constructor'].includes(key), 'Invalid field.');
          const transform = value as Data;
          if (value && typeof value === 'object' && transform.__op === 'increment') {
            requireValue(Number.isFinite(transform.amount), 'Invalid increment.');
            after[key] = (Number(after[key]) || 0) + transform.amount;
          } else if (value && typeof value === 'object' && transform.__op === 'arrayUnion') {
            requireValue(Array.isArray(transform.values), 'Invalid list.');
            after[key] = [...new Set([...(after[key] || []), ...transform.values])];
          } else after[key] = value;
        }
        if (collection === 'users') {
          requireValue(after.uid === parts[1] && ['admin', 'student'].includes(after.role), 'Invalid user.');
          text(after.name, 'name', 50);
          const username = accountName(after.username);
          after.username = username;
          requireValue(Number.isFinite(after.xp) && after.xp >= 0, 'Invalid username or XP.');
          requireValue(typeof after.isBanned === 'boolean' && ['studentId', 'roll', 'grade', 'phone'].every(key => typeof after[key] === 'string' && after[key].length <= 100), 'Invalid student information.');
          if (before?.role === 'admin' && after.role !== 'admin') this.requireOtherAdmin(parts[1]);
          if (before?.role === 'admin' && !before.isBanned && after.isBanned) this.requireOtherAdmin(parts[1]);
          if (before?.username !== after.username) {
            requireValue(!this.list('users').some(row => row.id !== parts[1] && row.data.username.trim().toLowerCase() === username.toLowerCase()), 'Username already taken.', 409);
            requireValue(actor.role === 'admin' || !before?.lastUsernameChange || Date.now() - Date.parse(before.lastUsernameChange) >= 14 * 86400000, 'You can change your username once every 14 days.');
            after.lastUsernameChange = new Date().toISOString();
            const account = this.db.prepare('SELECT username FROM accounts WHERE uid = ?').get(parts[1]) as any;
            if (account?.username) {
              requireValue(!this.db.prepare('SELECT uid FROM accounts WHERE username = ? AND uid != ?').get(username, parts[1]), 'Username already taken.', 409);
              this.db.prepare('UPDATE accounts SET username = ? WHERE uid = ?').run(username, parts[1]);
            }
          }
          this.validateImage(after.photoUrl); this.validateImage(after.bannerUrl);
        } else if (collection === 'questions') {
          text(after.question, 'question', 5000); text(after.chapter, 'chapter', 200); text(after.subject, 'subject', 200);
          requireValue(Array.isArray(after.options) && after.options.length === 4 && after.options.every((v: unknown) => typeof v === 'string' && v.trim().length > 0) && Number.isInteger(after.correctIndex) && after.correctIndex >= 0 && after.correctIndex < 4, 'Questions need four options and a valid correct answer.');
        } else if (collection === 'admin_students') {
          text(after.studentId, 'student ID'); text(after.name, 'name', 50); text(after.phone, 'phone number');
          requireValue(after.studentId === parts[1], 'The student ID must match the record ID.');
          requireValue(!this.list('admin_students').some(row => row.id !== parts[1] && row.data.studentId.toLowerCase() === after.studentId.toLowerCase()), 'Student ID already exists.', 409);
        } else if (collection === 'events') {
          text(after.title, 'event title', 99);
          requireValue(validDate(after.startDate) && (!after.endDate || validDate(after.endDate)) && (!after.endDate || after.endDate >= after.startDate), 'Enter a valid date range.');
          requireValue(typeof after.time === 'string' && typeof after.location === 'string', 'Enter an event time and location.');
        }
        this.put(path, after);
      }
    });
  }
  requireOtherAdmin(uid: string) {
    requireValue(this.list('users').some(row => row.id !== uid && row.data.role === 'admin' && !row.data.isBanned), 'Keep at least one active administrator.', 409);
  }
  startQuiz(actor: Actor, input: Data) {
    const subject = text(input.subject, 'subject', 200), chapter = text(input.chapter, 'chapter', 200);
    const questions = this.list('questions').filter(row => row.data.subject?.trim() === subject && row.data.chapter?.trim() === chapter);
    requireValue(questions.length, 'No questions are available for this chapter.', 404);
    for (let i = questions.length - 1; i > 0; i--) { const j = randomInt(i + 1); [questions[i], questions[j]] = [questions[j], questions[i]]; }
    const selected: Data[] = questions.slice(0, 20).map(row => ({ id: row.id, ...row.data }));
    const id = randomUUID();
    this.db.prepare('INSERT INTO quizzes VALUES (?, ?, ?)').run(id, actor.uid, JSON.stringify({ subject, chapter, questions: selected, answers: [], score: 0, xpLost: 0, wrong: 0 }));
    return { id, questions: selected.map(({ correctIndex, ...question }) => question) };
  }
  answer(actor: Actor, quizId: string, input: Data) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT data FROM quizzes WHERE id = ? AND uid = ?').get(quizId, actor.uid) as any;
      requireValue(row, 'Quiz not found.', 404);
      const quiz = JSON.parse(row.data);
      const index = input.index, optionIndex = input.optionIndex;
      requireValue(Number.isInteger(index) && index >= 0 && index < quiz.questions.length && Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < 4, 'Invalid answer.');
      if (index < quiz.answers.length) {
        requireValue(quiz.answers[index].optionIndex === optionIndex, 'This question has already been answered.', 409);
        return quiz.answers[index].result;
      }
      requireValue(index === quiz.answers.length, 'Answer the questions in order.', 409);
      const user = this.get(`users/${actor.uid}`)!;
      const correctIndex = quiz.questions[index].correctIndex;
      const correct = optionIndex === correctIndex;
      let change = correct ? 1 : 0;
      quiz.wrong = correct ? 0 : quiz.wrong + 1;
      if (quiz.wrong >= 10) { change = -Math.min(2, user.xp); quiz.wrong = 0; }
      if (correct) quiz.score++;
      quiz.xpLost += Math.max(0, -change);
      user.xp += change;
      user.totalQuestionsAttended = (user.totalQuestionsAttended || 0) + 1;
      const cycleScore = (user.cycleScore || 0) + (correct ? 1 : 0);
      const milestone = user.totalQuestionsAttended % 15 === 0;
      user.cycleScore = milestone ? 0 : cycleScore;
      user.lastActive = new Date().toISOString();
      const completed = index === quiz.questions.length - 1;
      user.consecutiveWrongAnswers = completed ? 0 : quiz.wrong;
      if (completed) {
        user.totalQuizzesPlayed = (user.totalQuizzesPlayed || 0) + 1;
        user.lastQuizCompleted = user.lastActive;
        this.put(`users/${actor.uid}/quizAttempts/${quizId}`, { subject: quiz.subject, chapter: quiz.chapter, score: quiz.score, xpLost: quiz.xpLost, netGains: quiz.score - quiz.xpLost, totalQuestions: quiz.questions.length, timestamp: user.lastActive, accuracy: Math.round(quiz.score / quiz.questions.length * 100) });
      }
      this.put(`users/${actor.uid}`, user);
      const result = { correct, correctIndex, change, xp: user.xp, score: quiz.score, xpLost: quiz.xpLost, consecutiveWrong: quiz.wrong, totalQuestionsAttended: user.totalQuestionsAttended, totalQuizzesPlayed: user.totalQuizzesPlayed, milestone, milestonePoints: cycleScore, completed };
      quiz.answers.push({ optionIndex, result });
      this.db.prepare('UPDATE quizzes SET data = ? WHERE id = ?').run(JSON.stringify(quiz), quizId);
      return result;
    });
  }
}
