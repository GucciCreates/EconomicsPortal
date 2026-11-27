/**
 * EconomicsPortal — In-browser demo backend (v6)
 *
 * Mirrors backend/Code.gs so Demo Mode behaves like the live site: tokens on
 * every call, identity and role taken from the roster (never from the
 * request), team scoping, validation, sanitized responses, audit log, doubt
 * replies, PIN rules, escalating login locks, one-request sign-in and writes,
 * token renewal and reminder settings. Data lives in sessionStorage (this tab
 * only) and is sample data: nothing is saved.
 *
 * Loaded with a dynamic import, only in Demo Mode.
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
import { normalizeUserName } from './utils.js';
import { sha256Hex } from './sha256.js';

export { normalizeUserName };

const DEMO_STORAGE_KEY = 'economics_portal_demo_db_v7';
const TEAMS = ['Shehroz', 'Amina', 'Ayesha', 'Lareb'];
const LEADERBOARD_TOP = 5;
const SERVER_VERSION = '7'; // same as Code.gs SCHEMA_VERSION
const ROLES = ['instructor', 'group_leader', 'assistant', 'team_leader', 'member'];
const LEADERS = ['group_leader', 'instructor'];
const MARK_EDITORS = ['group_leader', 'instructor', 'assistant'];
const MARK_FIELDS = ['cycle', 'mockNumber', 'quizScore', 'submission', 'attendance', 'previewDone', 'peerRating', 'punctual', 'notes'];
const TASK_FIELDS = ['title', 'description', 'team', 'dueDate', 'fileUrl'];
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const RENEW_MS = 2 * 24 * 60 * 60 * 1000;
const PIN_MIN = 4;
const PIN_MAX = 8;
const LEADER_PIN_MIN = 6;
const LONG_PIN_ROLES = ['instructor', 'group_leader', 'assistant'];
const LOGIN_MAX_FAILS = 5;
const LOCK_STEPS_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60];
const MAX_TITLE = 200;
const MAX_BODY = 5000;
const MAX_SHORT = 100;

// Login rate limiting and known devices are kept in memory for the demo.
const loginBuckets = {};
const knownDevices = {};

// Older demo databases lived in localStorage; drop them.
try {
  ['economics_portal_demo_db_v3', 'economics_portal_demo_db_v4'].forEach((k) => localStorage.removeItem(k));
} catch (e) {
  /* ignore */
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
    const cached = sessionStorage.getItem(DEMO_STORAGE_KEY);
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
    sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    /* storage unavailable: keep in memory */
  }
}

export function resetDemoStore() {
  memoryStore = null;
  try {
    sessionStorage.removeItem(DEMO_STORAGE_KEY);
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
  return { name: user.name, role: user.role, team: user.team, exp: payload.exp };
}

// ── PIN rules (same as Code.gs) ──────────────────────────────────────────
const isPinFormat = (pin) => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(String(pin));
const minPinLength = (role) => (LONG_PIN_ROLES.includes(role) ? LEADER_PIN_MIN : PIN_MIN);
function checkNewPin(pin, role, label = 'PIN') {
  const min = minPinLength(role);
  if (!isPinFormat(pin) || String(pin).length < min) {
    throw apiError(`${label} must be ${min} to ${PIN_MAX} digits.`, 'VALIDATION');
  }
}

/** "Ayesha (Quetta)" → "Ayesha", "Dr. Numan" → "Numan". */
function firstName(full) {
  const words = String(full || '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean);
  return words.find((w) => !/\.$/.test(w)) || words[0] || '';
}

// ── Escalating login locks, per name + device ────────────────────────────
function lockBucket(key, device) {
  const d = /^[A-Za-z0-9_-]{16,64}$/.test(String(device || '')) ? String(device) : '';
  const known = d && (knownDevices[key] || []).includes(d);
  return `${key}:${known ? d : 'unknown'}`;
}
function lockMessage(seconds) {
  const mins = Math.max(1, Math.ceil(seconds / 60));
  return `Too many wrong PINs. Try again in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`;
}
function checkLock(bucket) {
  const st = loginBuckets[bucket];
  if (st && st.until > Date.now()) throw apiError(lockMessage((st.until - Date.now()) / 1000), 'LOCKED');
}
function recordFailure(store, bucket, name) {
  const st = loginBuckets[bucket] || { n: 0, level: 0, until: 0 };
  st.n += 1;
  loginBuckets[bucket] = st;
  if (st.n >= LOGIN_MAX_FAILS) {
    st.level = Math.min(LOCK_STEPS_SECONDS.length, st.level + 1);
    const seconds = LOCK_STEPS_SECONDS[st.level - 1];
    st.until = Date.now() + seconds * 1000;
    st.n = 0;
    audit(store, { name: 'system', role: 'system' }, 'loginLocked', name, { minutes: seconds / 60, level: st.level });
    saveStore(store);
    throw apiError(lockMessage(seconds), 'LOCKED');
  }
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
  if (!key || !isPinFormat(pin)) throw apiError('Enter your name and your PIN (4 to 8 digits).', 'VALIDATION');

  const user = findUser(store, name);
  if (!user) {
    const matches = store.users.filter((u) => normalizeUserName(firstName(u.name)) === key);
    if (matches.length === 1) {
      return { ok: false, code: 'DID_YOU_MEAN', suggestion: matches[0].name, error: `Did you mean ${matches[0].name}?` };
    }
  }
  const realKey = user ? normalizeUserName(user.name) : key;
  const bucket = lockBucket(realKey, p.device);
  checkLock(bucket);
  if (!user || String(user.pin) !== pin) {
    recordFailure(store, bucket, user ? user.name : name);
    throw apiError(
      "That name and PIN don't match. (Demo PINs: Shehroz 111222, Dr. Numan 100200, Amina 2101, Bilal 2002, Ayesha (Quetta) 3101)",
      'LOGIN_FAILED',
    );
  }
  delete loginBuckets[bucket];
  if (p.device && /^[A-Za-z0-9_-]{16,64}$/.test(String(p.device))) {
    knownDevices[realKey] = [String(p.device), ...(knownDevices[realKey] || []).filter((d) => d !== p.device)].slice(0, 5);
  }
  const session = { name: user.name, role: user.role, team: user.team, exp: Date.now() + SESSION_MS };
  return {
    ok: true,
    token: issueToken(user),
    user: { name: user.name, role: user.role, team: user.team },
    pinUpgrade: pin.length < LEADER_PIN_MIN,
    pinMinLength: minPinLength(user.role),
    data: buildDashboard(store, session),
    demo: true,
  };
}

function myPrefs(store, session) {
  const u = findUser(store, session.name) || {};
  return { email: String(u.email || ''), reminders: u.reminders === true, googleEmail: String(u.googleEmail || '') };
}

function buildDashboard(store, session) {
  return { ...buildDashboardFor(store, session), serverVersion: SERVER_VERSION };
}

function buildDashboardFor(store, session) {
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
    out.me = myPrefs(store, session);
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
      me: myPrefs(store, session),
    });
  }

  const myMarks = marks.filter((m) => isMe(m.member));
  const myKey = Object.keys(metrics).find((k) => isMe(k));
  // Same rule as Code.gs: the top LEADERBOARD_TOP plus your own place.
  const ranked = Object.keys(metrics)
    .filter((k) => Number(metrics[k].avgScore) > 0)
    .sort((x, y) => Number(metrics[y].avgScore) - Number(metrics[x].avgScore) || String(x).localeCompare(String(y)));
  const leaderboard = {};
  ranked.forEach((k, i) => {
    if (i >= LEADERBOARD_TOP && !isMe(k)) return;
    leaderboard[k] = { ...(isMe(k) ? metrics[k] : publicMetrics(metrics[k])), rank: i + 1 };
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
    leaderboardSize: ranked.length,
    myEscalations: escalations.filter((es) => isMe(es.raisedBy)),
    announcements,
    quizzes: quizzes.filter((q) => q.scope === 'ALL' || q.scope === team),
    teamMessages: teamMessages.filter((tm) => tm.team === team),
    mentorship: mentorship.filter((mp) => isMe(mp.student) || isMe(mp.mentor)),
    myGoal: goals.find((g) => isMe(g.name)) || null,
    me: myPrefs(store, session),
  });
}

const ACTIONS = {
  dashboard: { fn: (store, s) => ({ ok: true, data: buildDashboard(store, s) }) },
  // Same rule as Code.gs: needs a Google client ID, which Demo Mode never has.
  linkGoogle: { write: true, fn: () => { throw apiError("Google sign-in isn't available in Demo Mode.", 'NOT_CONFIGURED'); } },
  unlinkGoogle: {
    write: true,
    fn(store, s) {
      const me = findUser(store, s.name);
      me.googleEmail = '';
      audit(store, s, 'unlinkGoogle', s.name, {});
      return { ok: true };
    },
  },
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
    roles: ['group_leader', 'instructor'],
    fn(store, s, p) {
      const newPin = String(p.newPin || '').trim();
      const target = findUser(store, p.targetMember);
      if (!target) throw apiError('Member not found in roster.', 'NOT_FOUND');
      checkNewPin(newPin, target.role, 'PIN');
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
      const bucket = lockBucket(normalizeUserName(s.name), p.device);
      checkLock(bucket);
      if (String(me.pin) !== currentPin) {
        recordFailure(store, bucket, s.name);
        throw apiError('Your current PIN is not correct.', 'VALIDATION');
      }
      checkNewPin(newPin, s.role, 'New PIN');
      if (newPin === currentPin) throw apiError('Choose a PIN that is different from your current one.', 'VALIDATION');
      me.pin = newPin;
      audit(store, s, 'changeMyPin', s.name, {});
      return { ok: true, token: issueToken(me) };
    },
  },

  setReminders: {
    write: true,
    fn(store, s, p) {
      const on = p.reminders === true || p.reminders === 'true';
      const email = text(p.email, 254, 'Email', on);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw apiError('Enter a valid email address.', 'VALIDATION');
      const me = findUser(store, s.name);
      me.email = email;
      me.reminders = on;
      audit(store, s, 'setReminders', s.name, { after: { reminders: on, email: email ? 'set' : '' } });
      return { ok: true };
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
// Same rule as Code.gs PUBLISHED_PINS: the first README published every
// person's starting PIN, so those name + PIN pairs are refused everywhere.
const PUBLISHED_PINS = ['fff4a103e0a26f5eb6ee069f', 'f8122729b48ae2e67e31deed', '77c9554014050ce3e982edb1', '27b1ca4deb94ea3af26e305e', 'cb0e3e27def67b05123adbb7', '190248acf92d2fdbebfba802', 'fce41495f1061cf4232d1196', 'c369435c5acf69a4ce687b84', 'c4a99445fc074a05d6168854', 'b59f515decc41dda4ab86fb7', '4fc3dfa6cd2574d64096e5bb', '5863e795c9118e3211b3b528', 'a7458dc4a94fd619f0ba0769', '1dcb3fd679b8b4d133edcb68', '636b70560c8fb1ebfbf12040', 'f3f53afc9ee4ed0bf7496cf1', '8f96b5befed87c7ce168f8d9'];

function isPublishedPin(name, pin) {
  const hex = sha256Hex('published-pin:' + normalizeUserName(name) + '|' + String(pin)).slice(0, 24);
  return PUBLISHED_PINS.includes(hex);
}

export async function handleDemoRequest(params) {
  try {
    const store = getStore();
    const action = String(params.action || '');
    if (action === 'health' || action === 'ping') return { ok: true, version: SERVER_VERSION, time: nowIso(), demo: true };
    if (action === 'login') {
      const who = findUser(store, params.name);
      if (who && (isPublishedPin(who.name, String(params.pin || '').trim()))) {
        throw apiError(
          "This PIN was published online in an old version of the portal, so it can't be used any more. Ask your group leader or instructor to give you a new PIN.",
          'PIN_PUBLISHED',
        );
      }
      return actionLogin(store, params);
    }
    if (action === 'names') {
      const names = [...new Set(store.users.map((u) => firstName(u.name)).filter(Boolean))].sort();
      // No Google client ID in Demo Mode, so the sign-in page shows the PIN form only.
      return { ok: true, names, googleClientId: '' };
    }
    if (action === 'googleLogin') throw apiError("Google sign-in isn't available in Demo Mode. Use a name and PIN.", 'NOT_CONFIGURED');

    const entry = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
    if (!entry) throw apiError('Unknown action.', 'BAD_REQUEST');

    const session = requireSession(store, params.token);
    if (action === 'changeMyPin' || action === 'updatePin') {
      const target = action === 'changeMyPin' ? session.name : (findUser(store, params.targetMember) || {}).name;
      if (target && (isPublishedPin(target, String(params.newPin || '').trim()))) {
        throw apiError('That PIN was published online in an old version of the portal. Choose a different one.', 'VALIDATION');
      }
    }
    if (entry.roles && !entry.roles.includes(session.role)) {
      throw apiError('You are not allowed to do this.', 'FORBIDDEN');
    }
    const result = entry.fn(store, session, params);
    if (entry.write) {
      saveStore(store);
      if (result && result.ok && params.withDashboard !== false) result.data = buildDashboard(store, session);
    }
    if (result && result.ok && !result.token && session.exp - Date.now() < RENEW_MS) {
      result.token = issueToken(findUser(store, session.name));
    }
    return result;
  } catch (err) {
    if (err && err.code) return { ok: false, error: err.message, code: err.code };
    return { ok: false, error: 'Demo error: ' + (err && err.message ? err.message : String(err)), code: 'SERVER' };
  }
}
