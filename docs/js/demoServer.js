/**
 * EconomicsPortal — In-browser demo backend (v4)
 *
 * Mirrors backend/Code.gs so Demo Mode behaves like the live site: tokens on
 * every call, identity and role taken from the roster (never from the
 * request), team scoping, validation, sanitized responses, audit log and
 * doubt replies. Data lives in localStorage and is sample data only.
 */

import {
  MOCK_USERS,
  MOCK_TASKS,
  MOCK_MARKS,
  MOCK_SUBMISSIONS,
  MOCK_ESCALATIONS,
  MOCK_ANNOUNCEMENTS,
  MOCK_QUIZZES,
  MOCK_GOALS,
  MOCK_TEAM_MESSAGES,
  MOCK_MENTORSHIP,
  computeMockTeamAverages,
  computeMockMemberMetrics,
} from './mockData.js';

const DEMO_STORAGE_KEY = 'economics_portal_demo_db_v4';
const TEAMS = ['Shehroz', 'Amina', 'Ayesha', 'Lareb'];
const ROLES = ['instructor', 'group_leader', 'assistant', 'team_leader', 'member'];
const LEADERS = ['group_leader', 'instructor'];
const MARK_EDITORS = ['group_leader', 'instructor', 'assistant'];
const MARK_FIELDS = ['cycle', 'mockNumber', 'quizScore', 'submission', 'attendance', 'previewDone', 'peerRating', 'punctual', 'notes'];
const TASK_FIELDS = ['title', 'description', 'team', 'dueDate', 'fileUrl'];
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TITLE = 200;
const MAX_BODY = 5000;
const MAX_SHORT = 100;

// Login rate limiting is kept in memory for the demo (resets on reload).
const loginFailures = {};

export function normalizeUserName(value = '') {
  return String(value == null ? '' : value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function initialStore() {
  return {
    users: clone(MOCK_USERS),
    tasks: clone(MOCK_TASKS),
    marks: clone(MOCK_MARKS),
    submissions: clone(MOCK_SUBMISSIONS),
    escalations: clone(MOCK_ESCALATIONS),
    escalationReplies: [],
    announcements: clone(MOCK_ANNOUNCEMENTS),
    quizzes: clone(MOCK_QUIZZES),
    goals: clone(MOCK_GOALS),
    teamMessages: clone(MOCK_TEAM_MESSAGES),
    mentorship: clone(MOCK_MENTORSHIP),
    auditLog: [],
  };
}

let memoryStore = null;

function getStore() {
  try {
    const cached = localStorage.getItem(DEMO_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    /* storage unavailable: fall back to memory */
  }
  if (!memoryStore) memoryStore = initialStore();
  return memoryStore;
}

function saveStore(store) {
  memoryStore = store;
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    /* storage unavailable: keep in memory */
  }
}

export function resetDemoStore() {
  memoryStore = null;
  try {
    localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
  const store = initialStore();
  saveStore(store);
  return store;
}

// ─────────────────────────────────────────────────────────────────────────
// ERRORS, TOKENS
// ─────────────────────────────────────────────────────────────────────────
function apiError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function pinFingerprint(pin) {
  let h = 5381;
  const s = 'demo-pin:' + String(pin);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function issueToken(user) {
  const payload = { demo: true, n: user.name, exp: Date.now() + SESSION_MS, f: pinFingerprint(user.pin) };
  return 'demo.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function requireSession(store, token) {
  const expired = () => apiError('Your session expired, please sign in again.', 'AUTH');
  const t = String(token || '');
  if (!t.startsWith('demo.')) throw expired();
  let payload;
  try {
    payload = JSON.parse(decodeURIComponent(escape(atob(t.slice(5)))));
  } catch (e) {
    throw expired();
  }
  if (!payload || payload.exp < Date.now()) throw expired();
  const user = findUser(store, payload.n);
  if (!user || pinFingerprint(user.pin) !== payload.f || !ROLES.includes(user.role)) throw expired();
  return { name: user.name, role: user.role, team: user.team };
}

function findUser(store, name) {
  const key = normalizeUserName(name);
  if (!key) return null;
  return store.users.find((u) => normalizeUserName(u.name) === key) || null;
}

function newId(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 10);
}

function nowIso() {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION (same rules as Code.gs)
// ─────────────────────────────────────────────────────────────────────────
function text(v, max, label, required) {
  const s = v == null ? '' : String(v).trim();
  if (required && !s) throw apiError(`${label} is required.`, 'VALIDATION');
  if (s.length > max) throw apiError(`${label} is too long (max ${max} characters).`, 'VALIDATION');
  return s;
}

function numberIn(v, min, max, label, required) {
  if (v === '' || v == null) {
    if (required) throw apiError(`${label} is required.`, 'VALIDATION');
    return '';
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw apiError(`${label} must be between ${min} and ${max}.`, 'VALIDATION');
  }
  return n;
}

function oneOf(v, allowed, label, fallback) {
  const s = v == null ? '' : String(v);
  if (s === '' && fallback !== undefined) return fallback;
  if (!allowed.includes(s)) {
    throw apiError(`${label} must be one of: ${allowed.filter(Boolean).join(', ')}.`, 'VALIDATION');
  }
  return s;
}

function teamOrAll(v) {
  const s = String(v == null ? '' : v);
  if (s !== 'ALL' && !TEAMS.includes(s)) throw apiError(`Team must be ALL or one of: ${TEAMS.join(', ')}.`, 'VALIDATION');
  return s;
}

function teamOnly(v) {
  const s = String(v == null ? '' : v);
  if (!TEAMS.includes(s)) throw apiError(`Team must be one of: ${TEAMS.join(', ')}.`, 'VALIDATION');
  return s;
}

function urlField(v) {
  const s = text(v, 1000, 'Link', false);
  if (!s) return '';
  if (!/^https?:\/\/[^\s]+$/i.test(s)) throw apiError('Links must start with http:// or https://.', 'VALIDATION');
  return s;
}

function dateField(v, label, required) {
  const s = text(v, 10, label, required);
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(s + 'T00:00:00Z').getTime())) {
    throw apiError(`${label} must be a date like 2026-11-30.`, 'VALIDATION');
  }
  return s;
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  });
  return out;
}

function validateMarkFields(p, isNew) {
  const out = {};
  const has = (k) => isNew || Object.prototype.hasOwnProperty.call(p, k);
  if (has('cycle')) out.cycle = text(p.cycle, MAX_SHORT, 'Topic / unit', true);
  if (has('mockNumber')) out.mockNumber = numberIn(p.mockNumber, 0, 99, 'Mock number', false);
  if (has('quizScore')) out.quizScore = numberIn(p.quizScore, 0, 100, 'Quiz score', true);
  if (has('submission')) out.submission = oneOf(p.submission, ['Yes', 'No'], 'Submission', isNew ? 'Yes' : '');
  if (has('attendance')) out.attendance = text(p.attendance, 20, 'Attendance', false);
  if (has('previewDone')) out.previewDone = oneOf(p.previewDone, ['Yes', 'No', ''], 'Preview', '');
  if (has('peerRating')) out.peerRating = numberIn(p.peerRating, 1, 5, 'Peer rating', false);
  if (has('punctual')) out.punctual = oneOf(p.punctual, ['Yes', 'No', ''], 'Punctual', '');
  if (has('notes')) out.notes = text(p.notes, 1000, 'Notes', false);
  return out;
}

function validateTaskFields(p, isNew) {
  const out = {};
  const has = (k) => isNew || Object.prototype.hasOwnProperty.call(p, k);
  if (has('title')) out.title = text(p.title, MAX_TITLE, 'Title', true);
  if (has('description')) out.description = text(p.description, MAX_BODY, 'Description', false);
  if (has('team')) out.team = teamOrAll(p.team);
  if (has('dueDate')) out.dueDate = dateField(p.dueDate, 'Due date', false);
  if (has('fileUrl')) out.fileUrl = urlField(p.fileUrl);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// ROW HELPERS
// ─────────────────────────────────────────────────────────────────────────
function findById(list, id) {
  const row = (list || []).find((r) => String(r.id) === String(id));
  if (id === undefined || id === null || id === '' || !row) throw apiError('That record no longer exists.', 'NOT_FOUND');
  return row;
}

function removeById(store, key, id) {
  const row = findById(store[key], id);
  store[key] = store[key].filter((r) => r !== row);
  return row;
}

function audit(store, session, action, targetId, details) {
  store.auditLog.unshift({
    id: newId('aud'),
    timestamp: nowIso(),
    actor: session.name,
    role: session.role,
    action,
    targetId: String(targetId == null ? '' : targetId),
    details: details || {},
  });
  store.auditLog = store.auditLog.slice(0, 2000);
}

function sanitizeUser(u) {
  return { name: u.name, role: u.role, team: u.team, hasPin: Boolean(u.pin) };
}

function publicMetrics(m) {
  return { member: m.member, team: m.team, avgScore: m.avgScore, streak: m.streak, delta: m.delta };
}

function rosterFor(store, team) {
  return store.users
    .filter((u) => TEAMS.includes(u.team) && (u.role === 'member' || u.role === 'team_leader'))
    .filter((u) => !team || u.team === team)
    .map((u) => ({ name: u.name, team: u.team, role: u.role }));
}

// ─────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────
function actionLogin(store, p) {
  const name = String(p.name || '').trim();
  const pin = String(p.pin || '').trim();
  const key = normalizeUserName(name);
  if (!key || !/^\d{4}$/.test(pin)) throw apiError('Enter your full name and your 4-digit PIN.', 'VALIDATION');

  const state = loginFailures[key];
  if (state && state.lockedUntil > Date.now()) {
    throw apiError('Too many failed attempts for this name. Try again in 15 minutes.', 'LOCKED');
  }
  const user = findUser(store, name);
  if (!user || String(user.pin) !== pin) {
    const fails = (state && state.lockedUntil <= Date.now() && state.lockedUntil ? 0 : (state ? state.fails : 0)) + 1;
    if (fails >= 5) {
      loginFailures[key] = { fails: 0, lockedUntil: Date.now() + 15 * 60 * 1000 };
      throw apiError('Too many failed attempts for this name. Try again in 15 minutes.', 'LOCKED');
    }
    loginFailures[key] = { fails, lockedUntil: 0 };
    throw apiError(
      'Invalid name or PIN. (Demo: Shehroz / 1111, Dr. Numan / 0000, Amina / 2001, Ramesh / 2002, Ayesha (Quetta) / 3001)',
      'LOGIN_FAILED',
    );
  }
  delete loginFailures[key];
  return { ok: true, token: issueToken(user), user: { name: user.name, role: user.role, team: user.team }, demo: true };
}

function buildDashboard(store, session) {
  const { role, team } = session;
  const me = normalizeUserName(session.name);
  const isMe = (v) => normalizeUserName(v) === me;

  const replies = store.escalationReplies || [];
  const escalations = (store.escalations || []).map((es) => ({
    ...es,
    replies: replies.filter((r) => String(r.escalationId) === String(es.id)),
  }));
  const tasks = store.tasks || [];
  const marks = store.marks || [];
  const subs = store.submissions || [];
  const announcements = store.announcements || [];
  const quizzes = store.quizzes || [];
  const goals = store.goals || [];
  const teamMessages = store.teamMessages || [];
  const mentorship = store.mentorship || [];
  const teamAverages = computeMockTeamAverages(marks);
  const metrics = computeMockMemberMetrics(marks, escalations);

  if (role === 'group_leader' || role === 'instructor' || role === 'assistant') {
    const out = {
      tasks,
      marks,
      submissions: subs,
      escalations,
      announcements,
      quizzes,
      goals,
      teamMessages,
      mentorship,
      teamAverages,
      memberMetrics: metrics,
      atRiskMembers: Object.values(metrics).filter((m) => m.atRisk),
      roster: rosterFor(store, null),
      canEdit: true,
    };
    if (role === 'group_leader') out.users = store.users.map(sanitizeUser);
    return clone(out);
  }

  if (role === 'team_leader') {
    const teamMetrics = {};
    Object.keys(metrics).forEach((m) => {
      if (metrics[m].team === team) teamMetrics[m] = metrics[m];
    });
    return clone({
      tasks: tasks.filter((t) => t.team === team || t.team === 'ALL'),
      marks: marks.filter((m) => m.team === team),
      submissions: subs.filter((s) => s.team === team),
      escalations: escalations.filter((es) => es.team === team),
      announcements,
      quizzes: quizzes.filter((q) => q.scope === 'ALL' || q.scope === team),
      goals: goals.filter((g) => g.team === team),
      teamMessages: teamMessages.filter((tm) => tm.team === team),
      mentorship: mentorship.filter((mp) => mp.team === team),
      teamAverage: teamAverages[team] !== undefined ? teamAverages[team] : null,
      teamAverages,
      memberMetrics: teamMetrics,
      atRiskMembers: Object.values(teamMetrics).filter((m) => m.atRisk),
      roster: rosterFor(store, team),
    });
  }

  const myMarks = marks.filter((m) => isMe(m.member));
  const myKey = Object.keys(metrics).find((k) => isMe(k));
  const leaderboard = {};
  Object.keys(metrics).forEach((k) => {
    leaderboard[k] = isMe(k) ? metrics[k] : publicMetrics(metrics[k]);
  });
  return clone({
    tasks: tasks.filter((t) => t.team === team || t.team === 'ALL'),
    myMarks,
    marks: myMarks,
    teamAverage: teamAverages[team] !== undefined ? teamAverages[team] : null,
    teamAverages,
    mySubmissions: subs.filter((s) => isMe(s.member)),
    myMetrics: myKey ? metrics[myKey] : null,
    memberMetrics: leaderboard,
    myEscalations: escalations.filter((es) => isMe(es.raisedBy)),
    announcements,
    quizzes: quizzes.filter((q) => q.scope === 'ALL' || q.scope === team),
    teamMessages: teamMessages.filter((tm) => tm.team === team),
    mentorship: mentorship.filter((mp) => isMe(mp.student) || isMe(mp.mentor)),
    myGoal: goals.find((g) => isMe(g.name)) || null,
  });
}

const ACTIONS = {
  dashboard: { fn: (store, s) => ({ ok: true, data: buildDashboard(store, s) }) },
  users: { roles: LEADERS, fn: (store) => ({ ok: true, users: store.users.map(sanitizeUser) }) },
  auditLog: {
    roles: LEADERS,
    fn: (store, s, p) => ({ ok: true, entries: clone(store.auditLog.slice(0, Math.min(1000, Number(p.limit) || 500))) }),
  },

  addMark: {
    write: true,
    roles: ['group_leader', 'instructor', 'assistant', 'team_leader'],
    fn(store, s, p) {
      const student = findUser(store, p.member);
      if (!student || !TEAMS.includes(student.team)) throw apiError('Choose a student from the roster.', 'VALIDATION');
      if (s.role === 'team_leader' && student.team !== s.team) {
        throw apiError('Team leaders can only record marks for their own team.', 'FORBIDDEN');
      }
      const row = {
        id: newId('mk'),
        member: student.name,
        team: student.team,
        ...validateMarkFields(p, true),
        editedBy: s.name,
        timestamp: nowIso(),
      };
      store.marks.unshift(row);
      audit(store, s, 'addMark', row.id, { after: row });
      return { ok: true, id: row.id };
    },
  },
  editMark: {
    write: true,
    roles: MARK_EDITORS,
    fn(store, s, p) {
      const fields = validateMarkFields(pick(p.fields || {}, MARK_FIELDS), false);
      if (!Object.keys(fields).length) throw apiError('Nothing to change.', 'VALIDATION');
      fields.editedBy = s.name;
      const mark = findById(store.marks, p.id);
      const before = {};
      Object.keys(fields).forEach((k) => (before[k] = mark[k]));
      Object.assign(mark, fields);
      audit(store, s, 'editMark', p.id, { member: mark.member, before, after: fields });
      return { ok: true };
    },
  },
  deleteMark: {
    write: true,
    roles: ['instructor'],
    fn(store, s, p) {
      const before = removeById(store, 'marks', p.id);
      audit(store, s, 'deleteMark', p.id, { before });
      return { ok: true };
    },
  },

  addTask: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const row = { id: newId('tsk'), ...validateTaskFields(p, true), createdBy: s.name, status: 'open', timestamp: nowIso() };
      store.tasks.unshift(row);
      audit(store, s, 'addTask', row.id, { after: row });
      return { ok: true, id: row.id };
    },
  },
  editTask: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const fields = validateTaskFields(pick(p.fields || {}, TASK_FIELDS), false);
      if (!Object.keys(fields).length) throw apiError('Nothing to change.', 'VALIDATION');
      const task = findById(store.tasks, p.id);
      const before = {};
      Object.keys(fields).forEach((k) => (before[k] = task[k]));
      Object.assign(task, fields);
      audit(store, s, 'editTask', p.id, { before, after: fields });
      return { ok: true };
    },
  },
  updateTaskStatus: {
    write: true,
    roles: ['group_leader', 'instructor', 'team_leader'],
    fn(store, s, p) {
      const status = oneOf(p.status, ['open', 'done'], 'Status');
      const task = findById(store.tasks, p.id);
      if (s.role === 'team_leader' && task.team !== s.team) {
        throw apiError("Team leaders can only update their own team's tasks.", 'FORBIDDEN');
      }
      const before = task.status;
      task.status = status;
      audit(store, s, 'updateTaskStatus', p.id, { before: { status: before }, after: { status } });
      return { ok: true };
    },
  },

  addSubmission: {
    write: true,
    fn(store, s, p) {
      if (!TEAMS.includes(s.team)) throw apiError('Only students on a team can submit work.', 'FORBIDDEN');
      const task = findById(store.tasks, p.taskId);
      if (task.team !== 'ALL' && task.team !== s.team) throw apiError('This task is not assigned to your team.', 'FORBIDDEN');
      const row = {
        id: newId('sub'),
        taskId: task.id,
        member: s.name,
        team: s.team,
        content: text(p.content, MAX_BODY, 'Submission notes', true),
        fileUrl: urlField(p.fileUrl),
        gradingRequested: false,
        requestedBy: '',
        reviewNotes: '',
        timestamp: nowIso(),
      };
      store.submissions.unshift(row);
      audit(store, s, 'addSubmission', row.id, { taskId: row.taskId });
      return { ok: true, id: row.id };
    },
  },
  addEscalation: {
    write: true,
    fn(store, s, p) {
      const now = nowIso();
      const row = {
        id: newId('esc'),
        raisedBy: s.name,
        team: s.team,
        topic: text(p.topic, MAX_TITLE, 'Topic', true),
        details: text(p.details, MAX_BODY, 'Details', true),
        severity: oneOf(p.severity, ['normal', 'severe'], 'Urgency', 'normal'),
        status: 'open',
        timestamp: now,
        updatedAt: now,
        closedBy: '',
      };
      store.escalations.unshift(row);
      audit(store, s, 'addEscalation', row.id, { topic: row.topic });
      return { ok: true, id: row.id };
    },
  },
  updateEscalationStatus: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const status = oneOf(p.status, ['open', 'closed'], 'Status');
      const esc = findById(store.escalations, p.id);
      const before = esc.status;
      Object.assign(esc, { status, updatedAt: nowIso(), closedBy: status === 'closed' ? s.name : '' });
      audit(store, s, 'updateEscalationStatus', p.id, { before: { status: before }, after: { status } });
      return { ok: true };
    },
  },
  addEscalationReply: {
    write: true,
    roles: ['group_leader', 'instructor', 'assistant', 'team_leader'],
    fn(store, s, p) {
      const esc = findById(store.escalations, p.escalationId);
      if (s.role === 'team_leader' && esc.team !== s.team) {
        throw apiError("Team leaders can only reply to their own team's doubts.", 'FORBIDDEN');
      }
      const row = {
        id: newId('rep'),
        escalationId: esc.id,
        author: s.name,
        role: s.role,
        message: text(p.message, MAX_BODY, 'Reply', true),
        timestamp: nowIso(),
      };
      if (!store.escalationReplies) store.escalationReplies = [];
      store.escalationReplies.push(row);
      esc.updatedAt = row.timestamp;
      audit(store, s, 'addEscalationReply', esc.id, { replyId: row.id });
      return { ok: true, id: row.id };
    },
  },

  addAnnouncement: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const row = {
        id: newId('ann'),
        title: text(p.title, MAX_TITLE, 'Title', true),
        body: text(p.body, MAX_BODY, 'Message', true),
        pinned: p.pinned === true || p.pinned === 'true',
        postedBy: s.name,
        timestamp: nowIso(),
      };
      store.announcements.unshift(row);
      audit(store, s, 'addAnnouncement', row.id, { title: row.title });
      return { ok: true, id: row.id };
    },
  },
  deleteAnnouncement: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const before = removeById(store, 'announcements', p.id);
      audit(store, s, 'deleteAnnouncement', p.id, { before });
      return { ok: true };
    },
  },
  pinAnnouncement: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const ann = findById(store.announcements, p.id);
      ann.pinned = p.pinned === true || p.pinned === 'true';
      audit(store, s, 'pinAnnouncement', p.id, { after: { pinned: ann.pinned } });
      return { ok: true };
    },
  },

  addQuiz: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const when = new Date(p.scheduledAt);
      if (!p.scheduledAt || Number.isNaN(when.getTime())) throw apiError('Choose a valid date and time.', 'VALIDATION');
      const row = {
        id: newId('qz'),
        title: text(p.title, MAX_TITLE, 'Title', true),
        scheduledAt: when.toISOString(),
        scope: teamOrAll(p.scope || 'ALL'),
        notes: text(p.notes, 1000, 'Notes', false),
        createdBy: s.name,
        timestamp: nowIso(),
      };
      store.quizzes.push(row);
      audit(store, s, 'addQuiz', row.id, { title: row.title, scheduledAt: row.scheduledAt });
      return { ok: true, id: row.id };
    },
  },
  deleteQuiz: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const before = removeById(store, 'quizzes', p.id);
      audit(store, s, 'deleteQuiz', p.id, { before });
      return { ok: true };
    },
  },

  setGoal: {
    write: true,
    fn(store, s, p) {
      const target = numberIn(p.target, 0, 100, 'Target score', true);
      const description = text(p.description, MAX_TITLE, 'Goal description', false);
      const existing = store.goals.find((g) => normalizeUserName(g.name) === normalizeUserName(s.name));
      const fields = { name: s.name, team: s.team, target, description, setAt: nowIso() };
      if (existing) Object.assign(existing, fields);
      else store.goals.push(fields);
      audit(store, s, 'setGoal', s.name, { after: { target, description } });
      return { ok: true };
    },
  },

  updatePin: {
    write: true,
    roles: ['group_leader'],
    fn(store, s, p) {
      const newPin = String(p.newPin || '').trim();
      if (!/^\d{4}$/.test(newPin)) throw apiError('PIN must be exactly 4 numeric digits.', 'VALIDATION');
      const target = findUser(store, p.targetMember);
      if (!target) throw apiError('Member not found in roster.', 'NOT_FOUND');
      target.pin = newPin;
      audit(store, s, 'resetPin', target.name, {});
      return { ok: true };
    },
  },
  changeMyPin: {
    write: true,
    fn(store, s, p) {
      const me = findUser(store, s.name);
      const currentPin = String(p.currentPin || '').trim();
      const newPin = String(p.newPin || '').trim();
      if (String(me.pin) !== currentPin) throw apiError('Your current PIN is not correct.', 'VALIDATION');
      if (!/^\d{4}$/.test(newPin)) throw apiError('New PIN must be exactly 4 numeric digits.', 'VALIDATION');
      if (newPin === currentPin) throw apiError('Choose a PIN that is different from your current one.', 'VALIDATION');
      me.pin = newPin;
      audit(store, s, 'changeMyPin', s.name, {});
      return { ok: true, token: issueToken(me) };
    },
  },

  requestGrading: {
    write: true,
    roles: ['team_leader', 'group_leader'],
    fn(store, s, p) {
      const sub = findById(store.submissions, p.submissionId);
      if (s.role === 'team_leader' && sub.team !== s.team) {
        throw apiError("Team leaders can only forward their own team's submissions.", 'FORBIDDEN');
      }
      Object.assign(sub, {
        gradingRequested: true,
        requestedBy: s.name,
        reviewNotes: text(p.reviewNotes, 1000, 'Review notes', false),
      });
      audit(store, s, 'requestGrading', sub.id, { member: sub.member });
      return { ok: true };
    },
  },
  addTeamMessage: {
    write: true,
    roles: ['team_leader', 'group_leader'],
    fn(store, s, p) {
      if (s.role === 'team_leader' && p.team && String(p.team) !== s.team) {
        throw apiError('Team leaders can only post to their own team.', 'FORBIDDEN');
      }
      const team = s.role === 'team_leader' ? s.team : teamOnly(p.team);
      const row = { id: newId('tm'), team, author: s.name, message: text(p.message, MAX_BODY, 'Message', true), timestamp: nowIso() };
      store.teamMessages.unshift(row);
      audit(store, s, 'addTeamMessage', row.id, { team });
      return { ok: true, id: row.id };
    },
  },
  deleteTeamMessage: {
    write: true,
    roles: ['team_leader', 'group_leader'],
    fn(store, s, p) {
      const msg = findById(store.teamMessages, p.id);
      if (s.role === 'team_leader' && msg.team !== s.team) {
        throw apiError("Team leaders can only remove their own team's notices.", 'FORBIDDEN');
      }
      const before = removeById(store, 'teamMessages', p.id);
      audit(store, s, 'deleteTeamMessage', p.id, { before });
      return { ok: true };
    },
  },

  createMentorshipPlan: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const student = findUser(store, p.student);
      const mentor = findUser(store, p.mentor);
      if (!student || !TEAMS.includes(student.team)) throw apiError('Choose a student from the roster.', 'VALIDATION');
      if (!mentor) throw apiError('Choose a mentor from the roster.', 'VALIDATION');
      if (student.name === mentor.name) throw apiError('A student cannot mentor themselves.', 'VALIDATION');
      const milestones = (Array.isArray(p.milestones) ? p.milestones : [])
        .map((m) => text(m, MAX_TITLE, 'Milestone', false))
        .filter(Boolean)
        .slice(0, 10);
      const row = {
        id: newId('mnt'),
        student: student.name,
        mentor: mentor.name,
        team: student.team,
        milestones,
        status: 'active',
        assignedBy: s.name,
        timestamp: nowIso(),
      };
      store.mentorship.unshift(row);
      audit(store, s, 'createMentorshipPlan', row.id, { student: row.student, mentor: row.mentor });
      return { ok: true, id: row.id };
    },
  },
  updateMentorshipStatus: {
    write: true,
    roles: LEADERS,
    fn(store, s, p) {
      const status = oneOf(p.status, ['active', 'resolved'], 'Status');
      const plan = findById(store.mentorship, p.id);
      const before = plan.status;
      plan.status = status;
      audit(store, s, 'updateMentorshipStatus', p.id, { before: { status: before }, after: { status } });
      return { ok: true };
    },
  },
};

/**
 * Handle one request exactly like the Apps Script backend would.
 * @param {object} params - { action, token, ...fields }
 */
export async function handleDemoRequest(params) {
  try {
    const store = getStore();
    const action = String(params.action || '');
    if (action === 'login') return actionLogin(store, params);

    const entry = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
    if (!entry) throw apiError('Unknown action.', 'BAD_REQUEST');

    const session = requireSession(store, params.token);
    if (entry.roles && !entry.roles.includes(session.role)) {
      throw apiError('You are not allowed to do this.', 'FORBIDDEN');
    }
    const result = entry.fn(store, session, params);
    if (entry.write) saveStore(store);
    return result;
  } catch (err) {
    if (err && err.code) return { ok: false, error: err.message, code: err.code };
    return { ok: false, error: 'Demo error: ' + (err && err.message ? err.message : String(err)), code: 'SERVER' };
  }
}
