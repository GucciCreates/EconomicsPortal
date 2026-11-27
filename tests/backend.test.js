/**
 * Backend tests: runs backend/Code.gs under Node's vm with in-memory fakes.
 * Run with: npm test
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBackend } = require('./gasFakes');

const PINS = {
  'Dr. Numan': '0100',
  Shehroz: '1201',
  Sajal: '1202',
  Amina: '2101',
  Ramesh: '2102',
  Mamoon: '2103',
  'Ayesha (Quetta)': '3101',
  Minal: '3102',
  Lareb: '4101',
  Shaiman: '4102',
};

function freshBackend() {
  const b = createBackend();
  b.api.setup();
  Object.entries(PINS).forEach(([name, pin]) => b.api.setPinForUser(name, pin));
  b.login = (name, pin = PINS[name]) => b.post({ action: 'login', name, pin });
  b.tokenFor = (name) => {
    const res = b.login(name);
    assert.equal(res.ok, true, `login failed for ${name}: ${res.error}`);
    return res.token;
  };
  b.sheetRows = (name) => {
    const data = b.ss.getSheetByName(name).data.filter((r) => r.some((c) => c !== ''));
    const [headers, ...rows] = data;
    return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  };
  return b;
}

function deepHasKey(value, key) {
  if (Array.isArray(value)) return value.some((v) => deepHasKey(v, key));
  if (value && typeof value === 'object') {
    return Object.keys(value).some((k) => k === key || deepHasKey(value[k], key));
  }
  return false;
}

const SAMPLE_MARK = {
  member: 'Ramesh',
  cycle: 'Unit 3: Trade',
  quizScore: 77,
  submission: 'Yes',
  attendance: '95%',
  previewDone: 'Yes',
  peerRating: 4,
  punctual: 'Yes',
  notes: 'Good work',
};

// ── Setup & storage ──────────────────────────────────────────────────────

test('setup creates every tab and stores no plaintext PINs', () => {
  const b = freshBackend();
  for (const name of ['Users', 'Marks', 'Tasks', 'Submissions', 'Escalations', 'EscalationReplies', 'Announcements', 'QuizSchedule', 'Goals', 'TeamMessages', 'Mentorship', 'AuditLog']) {
    assert.ok(b.ss.getSheetByName(name), `missing sheet ${name}`);
  }
  const users = b.sheetRows('Users');
  assert.equal(users.length, 17);
  users.forEach((u) => {
    assert.ok(String(u.pinHash).startsWith('v1$'));
    assert.ok(!('pin' in u));
    assert.ok(String(u.salt).length > 10);
  });
  assert.ok(b.logs.some((l) => l.includes('Hand out these PINs')));
});

test('migratePins converts an old plaintext pin column, including numbers Sheets stripped', () => {
  const b = createBackend();
  const users = b.ss.insertSheet('Users');
  users.data = [
    ['name', 'role', 'team', 'pin'],
    ['Dr. Numan', 'instructor', '-', 0], // "0000" saved as a number by Sheets
    ['Ramesh', 'member', 'Amina', '2002'],
  ];
  b.api.migratePins();
  const [headers, ...rows] = users.data;
  assert.deepEqual(headers.slice(0, 5), ['name', 'role', 'team', 'pinHash', 'salt']);
  rows.forEach((r) => assert.ok(String(r[3]).startsWith('v1$')));
  assert.equal(b.post({ action: 'login', name: 'Dr. Numan', pin: '0000' }).ok, true);
  assert.equal(b.post({ action: 'login', name: 'Ramesh', pin: '2002' }).ok, true);
});

// ── Login & tokens ───────────────────────────────────────────────────────

test('valid login returns a token and the user from the sheet', () => {
  const b = freshBackend();
  const res = b.login('Shehroz');
  assert.equal(res.ok, true);
  assert.match(res.token, /^[\w-]+=*\.[\w-]+=*$/);
  assert.deepEqual(res.user, { name: 'Shehroz', role: 'group_leader', team: 'Shehroz' });
});

test('wrong PIN fails and loose PIN matching is gone', () => {
  const b = freshBackend();
  assert.equal(b.login('Shehroz', '9999').code, 'LOGIN_FAILED');
  assert.equal(b.login('Dr. Numan', '100').code, 'VALIDATION'); // under 4 digits
  assert.equal(b.login('Dr. Numan', '123456789').code, 'VALIDATION'); // over 8 digits
  const guess = b.login('Ayesha', '3101'); // first name only: suggestion, not a sign-in
  assert.equal(guess.ok, false);
  assert.equal(guess.code, 'DID_YOU_MEAN');
  assert.equal(guess.suggestion, 'Ayesha (Quetta)');
  assert.equal(guess.token, undefined);
  assert.equal(b.login('  ayesha (QUETTA) ', '3101').ok, true); // normalized exact name
});

test('login locks escalate 1, 5, 15, 60 minutes and are logged', () => {
  const b = freshBackend();
  const fail5 = () => {
    for (let i = 0; i < 4; i++) assert.equal(b.login('Ramesh', '0000').code, 'LOGIN_FAILED');
    const res = b.login('Ramesh', '0000');
    assert.equal(res.code, 'LOCKED');
    return res.error;
  };
  assert.match(fail5(), /1 minute/);
  assert.equal(b.login('Ramesh').code, 'LOCKED', 'correct PIN is refused while locked');
  assert.equal(b.login('Mamoon').ok, true, 'other names are not affected');
  b.advance(61 * 1000);
  assert.match(fail5(), /5 minutes/);
  b.advance(5 * 60 * 1000 + 1000);
  assert.match(fail5(), /15 minutes/);
  b.advance(15 * 60 * 1000 + 1000);
  assert.match(fail5(), /60 minutes/);
  b.advance(60 * 60 * 1000 + 1000);
  assert.equal(b.login('Ramesh').ok, true);
  const locks = b.sheetRows('AuditLog').filter((r) => r.action === 'loginLocked');
  assert.equal(locks.length, 4);
  assert.equal(locks[0].targetId, 'Ramesh');
});

test('a device that signed in before cannot be locked out by guesses from elsewhere', () => {
  const b = freshBackend();
  const myPhone = 'device-abcdefghijklmnop1234';
  assert.equal(b.post({ action: 'login', name: 'Shehroz', pin: PINS.Shehroz, device: myPhone }).ok, true);
  for (let i = 0; i < 5; i++) b.post({ action: 'login', name: 'Shehroz', pin: '0000', device: 'attacker-zzzzzzzzzzzzzzzz' });
  assert.equal(b.post({ action: 'login', name: 'Shehroz', pin: PINS.Shehroz, device: 'attacker-zzzzzzzzzzzzzzzz' }).code, 'LOCKED');
  assert.equal(b.post({ action: 'login', name: 'Shehroz', pin: PINS.Shehroz }).code, 'LOCKED', 'no device = unknown device');
  assert.equal(b.post({ action: 'login', name: 'Shehroz', pin: PINS.Shehroz, device: myPhone }).ok, true);
});

test('locking a leader account emails the owner at most once a day', () => {
  const b = freshBackend();
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 5; i++) b.login('Shehroz', '0000');
    b.advance(61 * 1000);
  }
  assert.equal(b.mail.sent.length, 1);
  assert.equal(b.mail.sent[0].to, 'owner@example.com');
  assert.match(b.mail.sent[0].subject, /Shehroz/);
  for (let i = 0; i < 5; i++) b.login('Ramesh', '0000');
  assert.equal(b.mail.sent.length, 1, 'students being locked does not email');
});

test('missing, forged, tampered and expired tokens are rejected with code AUTH', () => {
  const b = freshBackend();
  const token = b.tokenFor('Ramesh');
  assert.equal(b.post({ action: 'dashboard' }).code, 'AUTH');
  assert.equal(b.post({ action: 'dashboard', token: 'abc.def' }).code, 'AUTH');

  const [body, sig] = token.split('.');
  const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  payload.n = 'Shehroz';
  const forgedBody = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(b.post({ action: 'dashboard', token: `${forgedBody}.${sig}` }).code, 'AUTH');

  // Same user and PIN fingerprint, but a stretched expiry: only the signature catches this.
  const stretched = { ...JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()), exp: Date.now() + 1e12 };
  const stretchedBody = Buffer.from(JSON.stringify(stretched)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(b.post({ action: 'dashboard', token: `${stretchedBody}.${sig}` }).code, 'AUTH');

  assert.equal(b.post({ action: 'dashboard', token }).ok, true);
  b.advance(8 * 24 * 60 * 60 * 1000);
  assert.equal(b.post({ action: 'dashboard', token }).code, 'AUTH');
});

test('GET requests go through the same token check', () => {
  const b = freshBackend();
  assert.equal(b.get({ action: 'users', role: 'group_leader' }).code, 'AUTH');
  assert.equal(b.get({ action: 'dashboard', role: 'instructor' }).code, 'AUTH');
});

// ── Authorization ────────────────────────────────────────────────────────

test('a member claiming role instructor still cannot add, edit or delete marks', () => {
  const b = freshBackend();
  const leader = b.tokenFor('Shehroz');
  const added = b.post({ action: 'addMark', token: leader, ...SAMPLE_MARK });
  assert.equal(added.ok, true);

  const member = b.tokenFor('Ramesh');
  const spoof = { token: member, role: 'instructor', name: 'Dr. Numan' };
  assert.equal(b.post({ action: 'addMark', ...spoof, ...SAMPLE_MARK }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'editMark', ...spoof, id: added.id, fields: { quizScore: 100 } }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'deleteMark', ...spoof, id: added.id }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'users', ...spoof }).code, 'FORBIDDEN');
  assert.equal(b.sheetRows('Marks')[0].quizScore, 77);
});

test('only the instructor can delete marks', () => {
  const b = freshBackend();
  const id = b.post({ action: 'addMark', token: b.tokenFor('Shehroz'), ...SAMPLE_MARK }).id;
  assert.equal(b.post({ action: 'deleteMark', token: b.tokenFor('Shehroz'), id }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'deleteMark', token: b.tokenFor('Dr. Numan'), id }).ok, true);
  assert.equal(b.sheetRows('Marks').length, 0);
});

test('a team leader cannot add marks for another team, and team comes from the roster', () => {
  const b = freshBackend();
  const amina = b.tokenFor('Amina');
  assert.equal(b.post({ action: 'addMark', token: amina, ...SAMPLE_MARK, member: 'Minal' }).code, 'FORBIDDEN');
  const ok = b.post({ action: 'addMark', token: amina, ...SAMPLE_MARK, member: 'Ramesh', team: 'Lareb' });
  assert.equal(ok.ok, true);
  assert.equal(b.sheetRows('Marks')[0].team, 'Amina');
});

test('team leaders are scoped to their own team for tasks, grading and notices', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  const amina = b.tokenFor('Amina');
  const lareb = b.tokenFor('Lareb');
  const aminaTask = b.post({ action: 'addTask', token: gl, title: 'A', team: 'Amina', dueDate: '2026-12-01' }).id;
  const allTask = b.post({ action: 'addTask', token: gl, title: 'B', team: 'ALL', dueDate: '2026-12-01' }).id;

  assert.equal(b.post({ action: 'updateTaskStatus', token: lareb, id: aminaTask, status: 'done' }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'updateTaskStatus', token: amina, id: allTask, status: 'done' }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'updateTaskStatus', token: amina, id: aminaTask, status: 'done' }).ok, true);

  const sub = b.post({ action: 'addSubmission', token: b.tokenFor('Ramesh'), taskId: aminaTask, content: 'Done' }).id;
  assert.equal(b.post({ action: 'requestGrading', token: lareb, submissionId: sub }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'requestGrading', token: amina, submissionId: sub }).ok, true);

  assert.equal(b.post({ action: 'addTeamMessage', token: amina, team: 'Lareb', message: 'hi' }).code, 'FORBIDDEN');
  const msg = b.post({ action: 'addTeamMessage', token: amina, message: 'hi team' }).id;
  assert.equal(b.post({ action: 'deleteTeamMessage', token: lareb, id: msg }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'deleteTeamMessage', token: amina, id: msg }).ok, true);
});

test('members can only submit to tasks for their team', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  const laribTask = b.post({ action: 'addTask', token: gl, title: 'Lareb only', team: 'Lareb' }).id;
  assert.equal(b.post({ action: 'addSubmission', token: b.tokenFor('Ramesh'), taskId: laribTask, content: 'x' }).code, 'FORBIDDEN');
});

// ── Identity comes from the session ──────────────────────────────────────

test('who-did-this fields come from the session, not the request', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  const ramesh = b.tokenFor('Ramesh');
  const task = b.post({ action: 'addTask', token: gl, title: 'T', team: 'ALL', createdBy: 'Dr. Numan' }).id;
  b.post({ action: 'addSubmission', token: ramesh, taskId: task, content: 'mine', member: 'Minal', team: 'Ayesha' });
  b.post({ action: 'addEscalation', token: ramesh, topic: 'Q', details: 'D', raisedBy: 'Dr. Numan', team: 'Lareb' });
  b.post({ action: 'setGoal', token: ramesh, target: 80, name: 'Minal', team: 'Ayesha' });
  b.post({ action: 'addAnnouncement', token: gl, title: 'A', body: 'B', postedBy: 'Dr. Numan' });
  b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK, editedBy: 'Dr. Numan' });

  assert.equal(b.sheetRows('Tasks')[0].createdBy, 'Shehroz');
  assert.deepEqual([b.sheetRows('Submissions')[0].member, b.sheetRows('Submissions')[0].team], ['Ramesh', 'Amina']);
  assert.deepEqual([b.sheetRows('Escalations')[0].raisedBy, b.sheetRows('Escalations')[0].team], ['Ramesh', 'Amina']);
  assert.deepEqual([b.sheetRows('Goals')[0].name, b.sheetRows('Goals')[0].team], ['Ramesh', 'Amina']);
  assert.equal(b.sheetRows('Announcements')[0].postedBy, 'Shehroz');
  assert.equal(b.sheetRows('Marks')[0].editedBy, 'Shehroz');
});

// ── PIN privacy ──────────────────────────────────────────────────────────

test('no response anywhere contains a pin, pinHash or salt field', () => {
  const b = freshBackend();
  const responses = [];
  for (const name of ['Dr. Numan', 'Shehroz', 'Sajal', 'Amina', 'Ramesh']) {
    const login = b.login(name);
    responses.push(login);
    responses.push(b.post({ action: 'dashboard', token: login.token }));
    responses.push(b.post({ action: 'users', token: login.token }));
    responses.push(b.post({ action: 'auditLog', token: login.token }));
  }
  responses.forEach((r) => {
    ['pin', 'pinHash', 'salt'].forEach((k) => assert.equal(deepHasKey(r, k), false, `found ${k}`));
  });
  const users = b.post({ action: 'users', token: b.tokenFor('Shehroz') }).users;
  assert.equal(users.length, 17);
  assert.equal(users[0].hasPin, true);
});

test('changing a PIN invalidates old tokens; changeMyPin returns a fresh one', () => {
  const b = freshBackend();
  const oldRamesh = b.tokenFor('Ramesh');
  const gl = b.tokenFor('Shehroz');
  assert.equal(b.post({ action: 'updatePin', token: gl, targetMember: 'Ramesh', newPin: '5555' }).ok, true);
  assert.equal(b.post({ action: 'dashboard', token: oldRamesh }).code, 'AUTH');
  assert.equal(b.login('Ramesh', '5555').ok, true);

  const deviceA = b.login('Minal').token;
  const deviceB = b.login('Minal').token;
  assert.equal(b.post({ action: 'changeMyPin', token: deviceA, currentPin: '0000', newPin: '7777' }).code, 'VALIDATION');
  const changed = b.post({ action: 'changeMyPin', token: deviceA, currentPin: PINS.Minal, newPin: '7777' });
  assert.equal(changed.ok, true);
  assert.equal(b.post({ action: 'dashboard', token: deviceB }).code, 'AUTH');
  assert.equal(b.post({ action: 'dashboard', token: deviceA }).code, 'AUTH');
  assert.equal(b.post({ action: 'dashboard', token: changed.token }).ok, true);
});

// ── Data correctness & validation ────────────────────────────────────────

test('submission rows land in the correct columns', () => {
  const b = freshBackend();
  const task = b.post({ action: 'addTask', token: b.tokenFor('Shehroz'), title: 'T', team: 'ALL' }).id;
  b.post({ action: 'addSubmission', token: b.tokenFor('Ramesh'), taskId: task, content: 'Answers', fileUrl: 'https://drive.google.com/x' });
  const row = b.sheetRows('Submissions')[0];
  assert.equal(row.taskId, task);
  assert.equal(row.content, 'Answers');
  assert.equal(row.fileUrl, 'https://drive.google.com/x');
  assert.equal(row.gradingRequested, false);
  assert.ok(row.timestamp instanceof Date || !isNaN(new Date(row.timestamp)));
});

test('migrateSubmissions repairs rows written by the old 7-column bug', () => {
  const b = freshBackend();
  const sheet = b.ss.getSheetByName('Submissions');
  const when = new Date('2026-10-01T10:00:00Z');
  sheet.data.push(['id-old', 'tsk-1', 'Ramesh', 'Amina', 'notes', '', when, '', '', '']);
  assert.equal(b.api.migrateSubmissions(), 1);
  const row = b.sheetRows('Submissions')[0];
  assert.equal(row.gradingRequested, false);
  assert.equal(new Date(row.timestamp).getTime(), when.getTime());
});

test('server-side validation rejects bad input', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  assert.equal(b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK, quizScore: 101 }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK, peerRating: 6 }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK, member: 'Nobody' }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addTask', token: gl, title: '', team: 'ALL' }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addTask', token: gl, title: 'x'.repeat(201), team: 'ALL' }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addTask', token: gl, title: 'T', team: 'Mars' }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addTask', token: gl, title: 'T', team: 'ALL', fileUrl: 'javascript:alert(1)' }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'addAnnouncement', token: gl, title: 'T', body: 'b'.repeat(5001) }).code, 'VALIDATION');
});

test('text that looks like a formula or a date is stored as plain text', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  b.post({ action: 'addAnnouncement', token: gl, title: '=IMPORTXML("http://x")', body: 'b' });
  b.post({ action: 'addTask', token: gl, title: 'T', team: 'ALL', dueDate: '2026-11-05' });
  assert.equal(b.sheetRows('Announcements')[0].title, '=IMPORTXML("http://x")');
  assert.equal(b.sheetRows('Tasks')[0].dueDate, '2026-11-05');
});

// ── Dashboard privacy ────────────────────────────────────────────────────

test("members only see their own marks and a summary of classmates' metrics", () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK, member: 'Ramesh', notes: 'ramesh private' });
  b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK, member: 'Mamoon', notes: 'mamoon private' });
  const data = b.post({ action: 'dashboard', token: b.tokenFor('Ramesh') }).data;
  assert.ok(data.marks.every((m) => m.member === 'Ramesh'));
  assert.ok(data.myMarks.every((m) => m.member === 'Ramesh'));
  assert.ok(!JSON.stringify(data).includes('mamoon private'));
  assert.deepEqual(Object.keys(data.memberMetrics.Mamoon).sort(), ['avgScore', 'delta', 'member', 'streak', 'team']);
  assert.ok('avgPeerRating' in data.memberMetrics.Ramesh);
  assert.equal(data.submissions, undefined);
  assert.equal(data.escalations, undefined);
});

// ── Audit log & replies ──────────────────────────────────────────────────

test('writes are recorded in the audit log with before/after for mark edits', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  const id = b.post({ action: 'addMark', token: gl, ...SAMPLE_MARK }).id;
  b.post({ action: 'editMark', token: b.tokenFor('Sajal'), id, fields: { quizScore: 80, member: 'Hacker' } });
  const entries = b.post({ action: 'auditLog', token: gl }).entries;
  const edit = entries.find((e) => e.action === 'editMark');
  assert.equal(edit.actor, 'Sajal');
  assert.equal(edit.details.before.quizScore, 77);
  assert.equal(edit.details.after.quizScore, 80);
  assert.equal(edit.details.after.member, undefined, 'non-editable fields are ignored');
  assert.equal(b.post({ action: 'auditLog', token: b.tokenFor('Amina') }).code, 'FORBIDDEN');
});

test('leaders can reply to doubts and the student sees the reply', () => {
  const b = freshBackend();
  const ramesh = b.tokenFor('Ramesh');
  const esc = b.post({ action: 'addEscalation', token: ramesh, topic: 'IS-LM', details: 'Why?' }).id;
  assert.equal(b.post({ action: 'addEscalationReply', token: b.tokenFor('Lareb'), escalationId: esc, message: 'x' }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'addEscalationReply', token: ramesh, escalationId: esc, message: 'x' }).code, 'FORBIDDEN');
  assert.equal(b.post({ action: 'addEscalationReply', token: b.tokenFor('Shehroz'), escalationId: esc, message: 'Because.' }).ok, true);
  b.post({ action: 'updateEscalationStatus', token: b.tokenFor('Dr. Numan'), id: esc, status: 'closed' });
  const mine = b.post({ action: 'dashboard', token: ramesh }).data.myEscalations;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, 'closed');
  assert.equal(mine[0].closedBy, 'Dr. Numan');
  assert.equal(mine[0].replies[0].message, 'Because.');
});

// ── Backups ──────────────────────────────────────────────────────────────

test('installBackupTrigger installs one weekly trigger and backups keep the newest 8', () => {
  const b = freshBackend();
  b.api.installBackupTrigger();
  b.api.installBackupTrigger(); // re-running replaces, not duplicates
  assert.equal(b.triggers.list.filter((t) => t.getHandlerFunction() === 'runBackup').length, 1);
  for (let i = 0; i < 10; i++) {
    b.advance(7 * 24 * 60 * 60 * 1000);
    b.api.runBackup();
  }
  const folder = b.drive.folders.find((f) => f.name === 'EconomicsPortal Backups');
  const kept = folder.files.filter((f) => !f.trashed);
  assert.equal(b.drive.folders.length, 1);
  assert.equal(kept.length, 8);
  const newest = Math.max(...folder.files.map((f) => f.getDateCreated().getTime()));
  assert.ok(kept.some((f) => f.getDateCreated().getTime() === newest));
});

test('resetAllPins gives everyone a new PIN, logs it once, and signs everyone out', () => {
  const b = freshBackend();
  const oldToken = b.tokenFor('Dr. Numan');
  assert.equal(b.api.resetAllPins(), 17);
  assert.equal(b.post({ action: 'dashboard', token: oldToken }).code, 'AUTH');
  const line = b.logs.at(-1).split('\n').find((l) => l.startsWith('Dr. Numan → '));
  const pin = line.split('→ ')[1].trim();
  assert.match(pin, /^\d{6}$/);
  assert.equal(b.login('Dr. Numan', pin).ok, true);
});

// ── v6: sign-in, PINs, sessions ──────────────────────────────────────────

test('login returns the dashboard, so signing in is one request', () => {
  const b = freshBackend();
  const res = b.login('Ramesh');
  assert.equal(res.ok, true);
  assert.ok(res.data && Array.isArray(res.data.myMarks), 'dashboard included');
  assert.equal(res.pinUpgrade, true, '4-digit PIN gets the upgrade prompt');
  assert.equal(res.pinMinLength, 4);
  assert.equal(b.login('Shehroz').pinMinLength, 6);
  b.api.setPinForUser('Ramesh', '24681357');
  assert.equal(b.login('Ramesh', '24681357').pinUpgrade, false);
});

test('names lists first names only, with no token needed', () => {
  const b = freshBackend();
  const res = b.post({ action: 'names' });
  assert.equal(res.ok, true);
  assert.ok(res.names.includes('Ayesha'));
  assert.ok(res.names.includes('Numan'));
  assert.ok(res.names.includes('Ahmed'));
  assert.ok(!res.names.some((n) => /\(|\s/.test(n)));
  assert.ok(!JSON.stringify(res).includes('team_leader'));
});

test('PIN rules: 4–8 digits; leaders need 6+ for a new PIN; resets accept the target role', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  let r = b.post({ action: 'changeMyPin', token: gl, currentPin: PINS.Shehroz, newPin: '5555' });
  assert.equal(r.code, 'VALIDATION');
  assert.match(r.error, /6 to 8 digits/);
  r = b.post({ action: 'changeMyPin', token: gl, currentPin: PINS.Shehroz, newPin: '555123' });
  assert.equal(r.ok, true);
  const mem = b.tokenFor('Ramesh');
  assert.equal(b.post({ action: 'changeMyPin', token: mem, currentPin: PINS.Ramesh, newPin: '4321' }).ok, true, 'members may keep 4 digits');
  const gl2 = r.token;
  assert.equal(b.post({ action: 'updatePin', token: gl2, targetMember: 'Sajal', newPin: '1234' }).code, 'VALIDATION');
  assert.equal(b.post({ action: 'updatePin', token: gl2, targetMember: 'Sajal', newPin: '123456' }).ok, true);
  assert.equal(b.post({ action: 'updatePin', token: gl2, targetMember: 'Mamoon', newPin: '123456789' }).code, 'VALIDATION');
});

test('tokens in their last 2 days are renewed; idle tokens still expire after 7 days', () => {
  const b = freshBackend();
  const token = b.tokenFor('Ramesh');
  assert.equal(b.post({ action: 'dashboard', token }).token, undefined, 'fresh token not renewed');
  b.advance(5.5 * 24 * 60 * 60 * 1000);
  const res = b.post({ action: 'dashboard', token });
  assert.equal(res.ok, true);
  assert.ok(res.token && res.token !== token, 'renewed');
  b.advance(2 * 24 * 60 * 60 * 1000);
  assert.equal(b.post({ action: 'dashboard', token }).code, 'AUTH', 'old token expired');
  assert.equal(b.post({ action: 'dashboard', token: res.token }).ok, true, 'renewed token still valid');
  b.advance(7 * 24 * 60 * 60 * 1000 + 1000);
  assert.equal(b.post({ action: 'dashboard', token: res.token }).code, 'AUTH', 'idle for 7 days');
});

// ── v6: caching & one-request writes ─────────────────────────────────────

function countReads(b) {
  const proto = Object.getPrototypeOf(b.ss.getSheetByName('Users'));
  if (!proto.__counted) {
    const orig = proto.getDataRange;
    proto.getDataRange = function () {
      proto.__reads = (proto.__reads || 0) + 1;
      return orig.call(this);
    };
    proto.__counted = true;
  }
  return {
    reset: () => (proto.__reads = 0),
    get: () => proto.__reads || 0,
  };
}

test('dashboard reads are cached and every write invalidates what it touched', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  const reads = countReads(b);
  b.post({ action: 'dashboard', token: gl });
  reads.reset();
  const again = b.post({ action: 'dashboard', token: gl });
  assert.equal(reads.get(), 0, 'second dashboard comes entirely from cache');
  const before = again.data.announcements.length;
  const write = b.post({ action: 'addAnnouncement', token: gl, title: 'Fresh', body: 'News' });
  assert.equal(write.ok, true);
  assert.equal(write.data.announcements.length, before + 1, 'write returns the updated dashboard');
  const after = b.post({ action: 'dashboard', token: gl });
  assert.ok(after.data.announcements.some((a) => a.title === 'Fresh'), 'no stale cache after a write');
});

test('cached rows keep dates as dates (due dates stay yyyy-MM-dd)', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  b.post({ action: 'addTask', token: gl, title: 'Essay', team: 'ALL', dueDate: '2026-12-05' });
  // Simulate Sheets turning the text into a real Date cell.
  const sheet = b.ss.getSheetByName('Tasks');
  const col = sheet.data[0].indexOf('dueDate');
  sheet.data[1][col] = new Date('2026-12-05T00:00:00Z');
  b.api.clearCache();
  const first = b.post({ action: 'dashboard', token: gl }).data.tasks[0].dueDate;
  const cached = b.post({ action: 'dashboard', token: gl }).data.tasks[0].dueDate;
  assert.equal(first, '2026-12-05');
  assert.equal(cached, '2026-12-05');
});

test('large tables are split across cache entries under 100 KB each', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  for (let i = 0; i < 60; i++) b.post({ action: 'addAnnouncement', token: gl, title: 'Long ' + i, body: 'x'.repeat(4000), withDashboard: false });
  b.post({ action: 'dashboard', token: gl });
  const chunks = Object.keys(b.cache).filter((k) => k.startsWith('T:Announcements:') && /:\d+$/.test(k));
  assert.ok(chunks.length >= 3, 'split into several chunks');
  assert.equal(b.post({ action: 'dashboard', token: gl }).data.announcements.length, 60);
});

// ── v6: email ────────────────────────────────────────────────────────────

test('setReminders stores my own email; dashboard shows only mine', () => {
  const b = freshBackend();
  const t = b.tokenFor('Ramesh');
  assert.equal(b.post({ action: 'setReminders', token: t, reminders: true, email: 'not-an-email' }).code, 'VALIDATION');
  const r = b.post({ action: 'setReminders', token: t, reminders: true, email: 'ramesh@example.com' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.me, { email: 'ramesh@example.com', reminders: true, googleEmail: '' });
  const gl = b.post({ action: 'dashboard', token: b.tokenFor('Shehroz') });
  assert.ok(!JSON.stringify(gl).includes('ramesh@example.com'), "nobody else sees Ramesh's email");
});

test('deadline reminders go only to opted-in students with unsubmitted work due within 24 hours', () => {
  const b = freshBackend();
  const gl = b.tokenFor('Shehroz');
  const d = new Date();
  const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // due end of today
  const task = b.post({ action: 'addTask', token: gl, title: 'Problem set 4', team: 'Amina', dueDate: tomorrow }).id;
  b.post({ action: 'setReminders', token: b.tokenFor('Ramesh'), reminders: true, email: 'ramesh@example.com' });
  b.post({ action: 'setReminders', token: b.tokenFor('Mamoon'), reminders: true, email: 'mamoon@example.com' });
  b.post({ action: 'setReminders', token: b.tokenFor('Minal'), reminders: true, email: 'minal@example.com' }); // other team
  b.post({ action: 'addSubmission', token: b.tokenFor('Mamoon'), taskId: task, content: 'done' });
  const sent = b.api.sendDeadlineReminders();
  assert.equal(sent, 1);
  assert.equal(b.mail.sent.at(-1).to, 'ramesh@example.com');
  assert.match(b.mail.sent.at(-1).body, /Problem set 4/);
});

test('weekly summary needs INSTRUCTOR_EMAIL and lists support and missing work', () => {
  const b = freshBackend();
  assert.equal(b.api.sendWeeklySummary(), false);
  b.props.INSTRUCTOR_EMAIL = 'numan@example.com';
  const gl = b.tokenFor('Shehroz');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  b.post({ action: 'addTask', token: gl, title: 'Essay 2', team: 'Lareb', dueDate: yesterday });
  assert.equal(b.api.sendWeeklySummary(), true);
  const mail = b.mail.sent.at(-1);
  assert.equal(mail.to, 'numan@example.com');
  assert.match(mail.body, /Class average/);
  assert.match(mail.body, /Shaiman — Essay 2/);
});

test('installEmailTriggers installs exactly one of each', () => {
  const b = freshBackend();
  b.api.installEmailTriggers();
  b.api.installEmailTriggers();
  const handlers = b.triggers.list.map((t) => t.getHandlerFunction()).sort();
  assert.deepEqual(handlers, ['sendDeadlineReminders', 'sendWeeklySummary']);
});

test('health answers without a token', () => {
  const b = freshBackend();
  const r = b.post({ action: 'health' });
  assert.equal(r.ok, true);
  assert.ok(r.time);
});

// ── Sign in with Google ──────────────────────────────────────────────────

const CLIENT_ID = '123-test.apps.googleusercontent.com';
function googleBackend() {
  const b = freshBackend();
  b.props.GOOGLE_CLIENT_ID = CLIENT_ID;
  b.googleToken = (email, extra = {}) => {
    const credential = `h.${Buffer.from(email + JSON.stringify(extra)).toString('base64url')}.s`;
    b.google.tokens[credential] = {
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      email,
      email_verified: 'true',
      exp: String(Math.floor(Date.now() / 1000) + 3600),
      ...extra,
    };
    return credential;
  };
  return b;
}

test('names publishes the Google client ID only once it is set', () => {
  const b = freshBackend();
  assert.equal(b.post({ action: 'names' }).googleClientId, '');
  b.props.GOOGLE_CLIENT_ID = CLIENT_ID;
  assert.equal(b.post({ action: 'names' }).googleClientId, CLIENT_ID);
});

test('Google sign-in is refused until GOOGLE_CLIENT_ID is set', () => {
  const b = freshBackend();
  const res = b.post({ action: 'googleLogin', credential: 'a.b.c' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NOT_CONFIGURED');
});

test('linking a Google account, then signing in with it in one request', () => {
  const b = googleBackend();
  const token = b.tokenFor('Ramesh');
  const notLinked = b.post({ action: 'googleLogin', credential: b.googleToken('ramesh@gmail.com') });
  assert.equal(notLinked.code, 'GOOGLE_NOT_LINKED');

  const link = b.post({ action: 'linkGoogle', token, credential: b.googleToken('Ramesh@Gmail.com') });
  assert.equal(link.ok, true, link.error);
  assert.equal(link.googleEmail, 'ramesh@gmail.com');
  assert.equal(link.data.me.googleEmail, 'ramesh@gmail.com');

  const res = b.post({ action: 'googleLogin', credential: b.googleToken('ramesh@gmail.com') });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.user.name, 'Ramesh');
  assert.equal(res.user.role, 'member');
  assert.ok(res.data, 'dashboard comes back with the sign-in');
  assert.equal(b.post({ action: 'dashboard', token: res.token }).ok, true);
  assert.ok(b.sheetRows('AuditLog').some((r) => r.action === 'linkGoogle' && !String(r.details).includes('@')));
});

test('an address the owner typed into googleEmail works too, case-insensitively', () => {
  const b = googleBackend();
  const sheet = b.ss.getSheetByName('Users');
  const headers = sheet.data[0];
  const row = sheet.data.findIndex((r) => r[0] === 'Shehroz');
  sheet.data[row][headers.indexOf('googleEmail')] = ' Shehroz.Leader@Gmail.com ';
  b.api.clearCache();
  const res = b.post({ action: 'googleLogin', credential: b.googleToken('shehroz.leader@gmail.com') });
  assert.equal(res.ok, true, res.error);
  assert.equal(res.user.name, 'Shehroz');
});

test('Google tokens for another app, unverified, expired, forged or from another issuer are refused', () => {
  const b = googleBackend();
  const token = b.tokenFor('Amina');
  b.post({ action: 'linkGoogle', token, credential: b.googleToken('amina@gmail.com') });
  const bad = [
    b.googleToken('amina@gmail.com', { aud: 'someone-else.apps.googleusercontent.com' }),
    b.googleToken('amina@gmail.com', { email_verified: 'false' }),
    b.googleToken('amina@gmail.com', { exp: String(Math.floor(Date.now() / 1000) - 5) }),
    b.googleToken('amina@gmail.com', { iss: 'evil.example.com' }),
    'h.not-issued-by-google.s',
    'not a token',
  ];
  bad.forEach((credential) => {
    const res = b.post({ action: 'googleLogin', credential });
    assert.equal(res.ok, false, credential);
    assert.equal(res.code, 'GOOGLE_FAILED', credential);
  });
});

test('one Google account cannot be linked to two people; unlinking frees it', () => {
  const b = googleBackend();
  const amina = b.tokenFor('Amina');
  const ramesh = b.tokenFor('Ramesh');
  assert.equal(b.post({ action: 'linkGoogle', token: amina, credential: b.googleToken('shared@gmail.com') }).ok, true);
  const clash = b.post({ action: 'linkGoogle', token: ramesh, credential: b.googleToken('shared@gmail.com') });
  assert.equal(clash.code, 'CONFLICT');
  assert.equal(b.post({ action: 'unlinkGoogle', token: amina }).ok, true);
  assert.equal(b.post({ action: 'googleLogin', credential: b.googleToken('shared@gmail.com') }).code, 'GOOGLE_NOT_LINKED');
  assert.equal(b.post({ action: 'linkGoogle', token: ramesh, credential: b.googleToken('shared@gmail.com') }).ok, true);
});

test('the users list for leaders never includes Google addresses', () => {
  const b = googleBackend();
  b.post({ action: 'linkGoogle', token: b.tokenFor('Minal'), credential: b.googleToken('minal@gmail.com') });
  const res = b.post({ action: 'users', token: b.tokenFor('Shehroz') });
  assert.equal(res.ok, true);
  assert.ok(!JSON.stringify(res).includes('minal@gmail.com'));
});
