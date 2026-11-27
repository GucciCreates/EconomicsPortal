/**
 * EconomicsPortal — Backend (Google Apps Script) v4
 * Account to use: bahriabatch30@gmail.com
 * Repo:           https://github.com/GucciCreates/EconomicsPortal
 *
 * v4 security model
 * ─────────────────
 * - `login` checks name + PIN and returns a signed session token
 *   (HMAC-SHA256, secret kept in Script Properties, 7-day expiry).
 * - Every other action must carry that token. The caller's name, role and
 *   team are always read from the Users sheet, never from the request.
 * - PINs are stored as salted SHA-256 hashes and never returned.
 * - Changing a PIN invalidates every token issued before the change.
 * - Failed logins are rate-limited per name (5 tries, then a 15-minute lock).
 * - Every write is validated, done under a script lock, and recorded in the
 *   AuditLog sheet.
 *
 * Owner functions to run from the Apps Script editor:
 *   setup()               — create/upgrade all tabs, seed the roster (safe to re-run)
 *   migratePins()         — convert plaintext PINs to hashes (setup() runs it too)
 *   migrateSubmissions()  — repair rows written by the old addSubmission bug
 *   resetAllPins()        — new random PIN for everyone (do this when upgrading)
 *   setPinForUser(name, pin) — set someone's PIN from the editor
 *   installBackupTrigger() — weekly spreadsheet backup to Drive (keeps 8)
 */

// ─────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────
const SCHEMA_VERSION = "4";
const TEAMS = ["Shehroz", "Amina", "Ayesha", "Lareb"];
const ROLES = ["instructor", "group_leader", "assistant", "team_leader", "member"];
const SESSION_DAYS = 7;
const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;
const MAX_TITLE = 200;
const MAX_BODY = 5000;
const MAX_SHORT = 100;
const BACKUP_FOLDER_NAME = "EconomicsPortal Backups";
const BACKUPS_TO_KEEP = 8;

// Class roster. PINs are NOT stored here: setup() generates a random PIN for
// each person and prints them once in the execution log.
const PEOPLE = [
  // name,              role,          team
  ["Dr. Numan",        "instructor",  "-"],
  ["Shehroz",          "group_leader","Shehroz"],
  ["Sajal",            "assistant",   "Shehroz"],
  ["Amina",            "team_leader", "Amina"],
  ["Ramesh",           "member",      "Amina"],
  ["Mamoon",           "member",      "Amina"],
  ["Tazneem",          "member",      "Amina"],
  ["Ayesha (Quetta)",  "team_leader", "Ayesha"],
  ["Minal",            "member",      "Ayesha"],
  ["Anika",            "member",      "Ayesha"],
  ["Ahmed bin Nasir",  "member",      "Ayesha"],
  ["Lareb",            "team_leader", "Lareb"],
  ["Shaiman",          "member",      "Lareb"],
  ["Aisha Amjad",      "member",      "Lareb"],
  ["Haseeb",           "member",      "Lareb"],
  ["Gorsi",            "member",      "Shehroz"],
  ["Haris",            "member",      "Shehroz"],
];

const SHEET_NAMES = {
  USERS:              "Users",
  MARKS:              "Marks",
  TASKS:              "Tasks",
  SUBMISSIONS:        "Submissions",
  ESCALATIONS:        "Escalations",
  ESCALATION_REPLIES: "EscalationReplies",
  ANNOUNCEMENTS:      "Announcements",
  QUIZ_SCHEDULE:      "QuizSchedule",
  GOALS:              "Goals",
  TEAM_MESSAGES:      "TeamMessages",
  MENTORSHIP:         "Mentorship",
  AUDIT_LOG:          "AuditLog",
};

const HEADERS = {
  Users:             ["name", "role", "team", "pinHash", "salt"],
  Marks:             ["id", "member", "team", "cycle", "mockNumber", "quizScore", "submission", "attendance", "previewDone", "peerRating", "punctual", "notes", "editedBy", "timestamp"],
  Tasks:             ["id", "title", "description", "team", "dueDate", "fileUrl", "createdBy", "status", "timestamp"],
  Submissions:       ["id", "taskId", "member", "team", "content", "fileUrl", "gradingRequested", "requestedBy", "reviewNotes", "timestamp"],
  Escalations:       ["id", "raisedBy", "team", "topic", "details", "severity", "status", "timestamp", "updatedAt", "closedBy"],
  EscalationReplies: ["id", "escalationId", "author", "role", "message", "timestamp"],
  Announcements:     ["id", "title", "body", "pinned", "postedBy", "timestamp"],
  QuizSchedule:      ["id", "title", "scheduledAt", "scope", "notes", "createdBy", "timestamp"],
  Goals:             ["name", "team", "target", "description", "setAt"],
  TeamMessages:      ["id", "team", "author", "message", "timestamp"],
  Mentorship:        ["id", "student", "mentor", "team", "milestones", "status", "assignedBy", "timestamp"],
  AuditLog:          ["id", "timestamp", "actor", "role", "action", "targetId", "details"],
};

const LEADERS = ["group_leader", "instructor"];
const MARK_EDITORS = ["group_leader", "instructor", "assistant"];
const MARK_FIELDS = ["cycle", "mockNumber", "quizScore", "submission", "attendance", "previewDone", "peerRating", "punctual", "notes"];
const TASK_FIELDS = ["title", "description", "team", "dueDate", "fileUrl"];

// ─────────────────────────────────────────────────────────────────────────
// ACTION TABLE — who may call what. `write: true` runs under a script lock.
// ─────────────────────────────────────────────────────────────────────────
const ACTIONS = {
  dashboard:              { fn: actionDashboard },
  users:                  { fn: actionUsers, roles: LEADERS },
  auditLog:               { fn: actionAuditLog, roles: LEADERS },

  addMark:                { fn: actionAddMark, write: true, roles: ["group_leader", "instructor", "assistant", "team_leader"] },
  editMark:               { fn: actionEditMark, write: true, roles: MARK_EDITORS },
  deleteMark:             { fn: actionDeleteMark, write: true, roles: ["instructor"] },

  addTask:                { fn: actionAddTask, write: true, roles: LEADERS },
  editTask:               { fn: actionEditTask, write: true, roles: LEADERS },
  updateTaskStatus:       { fn: actionUpdateTaskStatus, write: true, roles: ["group_leader", "instructor", "team_leader"] },

  addSubmission:          { fn: actionAddSubmission, write: true },
  addEscalation:          { fn: actionAddEscalation, write: true },
  updateEscalationStatus: { fn: actionUpdateEscalationStatus, write: true, roles: LEADERS },
  addEscalationReply:     { fn: actionAddEscalationReply, write: true, roles: ["group_leader", "instructor", "assistant", "team_leader"] },

  addAnnouncement:        { fn: actionAddAnnouncement, write: true, roles: LEADERS },
  deleteAnnouncement:     { fn: actionDeleteAnnouncement, write: true, roles: LEADERS },
  pinAnnouncement:        { fn: actionPinAnnouncement, write: true, roles: LEADERS },

  addQuiz:                { fn: actionAddQuiz, write: true, roles: LEADERS },
  deleteQuiz:             { fn: actionDeleteQuiz, write: true, roles: LEADERS },

  setGoal:                { fn: actionSetGoal, write: true },

  updatePin:              { fn: actionUpdatePin, write: true, roles: ["group_leader"] },
  changeMyPin:            { fn: actionChangeMyPin, write: true },

  requestGrading:         { fn: actionRequestGrading, write: true, roles: ["team_leader", "group_leader"] },
  addTeamMessage:         { fn: actionAddTeamMessage, write: true, roles: ["team_leader", "group_leader"] },
  deleteTeamMessage:      { fn: actionDeleteTeamMessage, write: true, roles: ["team_leader", "group_leader"] },

  createMentorshipPlan:   { fn: actionCreateMentorshipPlan, write: true, roles: LEADERS },
  updateMentorshipStatus: { fn: actionUpdateMentorshipStatus, write: true, roles: LEADERS },
};

// ─────────────────────────────────────────────────────────────────────────
// WEB ENTRY POINTS
// ─────────────────────────────────────────────────────────────────────────
function doGet(e) {
  return json(handleSafely((e && e.parameter) || {}));
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json({ ok: false, error: "Request body must be JSON.", code: "BAD_REQUEST" });
  }
  return json(handleSafely(body || {}));
}

function handleSafely(params) {
  try {
    return handleRequest(params);
  } catch (err) {
    if (err && err.code) return { ok: false, error: err.message, code: err.code };
    return { ok: false, error: "Server error: " + String(err && err.message ? err.message : err), code: "SERVER" };
  }
}

function handleRequest(params) {
  const action = String(params.action || "");
  if (action === "ping") return { ok: true, version: SCHEMA_VERSION };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema(ss);

  if (action === "login") return actionLogin(ss, params);

  const entry = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!entry) throw apiError("Unknown action.", "BAD_REQUEST");

  const session = requireSession(ss, params.token);
  if (entry.roles && entry.roles.indexOf(session.role) === -1) {
    throw apiError("You are not allowed to do this.", "FORBIDDEN");
  }

  if (!entry.write) return entry.fn(ss, session, params);

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return entry.fn(ss, session, params);
  } finally {
    lock.releaseLock();
  }
}

function apiError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────────────────
// AUTH: LOGIN, TOKENS, PIN HASHING
// ─────────────────────────────────────────────────────────────────────────
function actionLogin(ss, params) {
  const name = String(params.name || "").trim();
  const pin = String(params.pin || "").trim();
  const key = normalizeName(name);
  if (!key || !/^\d{4}$/.test(pin)) {
    throw apiError("Enter your full name and your 4-digit PIN.", "VALIDATION");
  }

  const cache = CacheService.getScriptCache();
  if (cache.get("lock:" + key)) {
    throw apiError("Too many failed attempts for this name. Try again in 15 minutes.", "LOCKED");
  }

  const found = findUser(ss, name);
  if (!found || !found.user.pinHash || !verifyPin(found.user, pin)) {
    recordLoginFailure(cache, key);
    throw apiError("Invalid name or PIN.", "LOGIN_FAILED");
  }

  cache.remove("fail:" + key);
  return { ok: true, token: issueToken(found.user), user: publicUser(found.user) };
}

function recordLoginFailure(cache, key) {
  const fails = Number(cache.get("fail:" + key) || 0) + 1;
  if (fails >= LOGIN_MAX_FAILS) {
    cache.put("lock:" + key, "1", LOGIN_LOCK_SECONDS);
    cache.remove("fail:" + key);
    throw apiError("Too many failed attempts for this name. Try again in 15 minutes.", "LOCKED");
  }
  cache.put("fail:" + key, String(fails), LOGIN_LOCK_SECONDS);
}

let _secretCache = null;
function getSecret() {
  if (_secretCache) return _secretCache;
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("TOKEN_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("TOKEN_SECRET", secret);
  }
  _secretCache = secret;
  return secret;
}

function sign(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value, getSecret()));
}

function pinFingerprint(pinHash) {
  return sign("pin:" + String(pinHash)).slice(0, 22);
}

function issueToken(user) {
  const now = Date.now();
  const payload = {
    n: user.name,
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60 * 1000,
    f: pinFingerprint(user.pinHash),
  };
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  return body + "." + sign(body);
}

function requireSession(ss, token) {
  const expired = () => apiError("Your session expired, please sign in again.", "AUTH");
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw expired();
  if (!safeEqual(sign(parts[0]), parts[1])) throw expired();

  let payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    throw expired();
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) throw expired();

  const found = findUser(ss, payload.n);
  if (!found || !found.user.pinHash) throw expired();
  if (!safeEqual(pinFingerprint(found.user.pinHash), String(payload.f || ""))) throw expired();
  if (ROLES.indexOf(found.user.role) === -1) throw expired();

  return { name: String(found.user.name), role: String(found.user.role), team: String(found.user.team) };
}

function hashPin(pin, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + ":" + String(pin),
    Utilities.Charset.UTF_8
  );
  return "v1$" + Utilities.base64EncodeWebSafe(bytes);
}

function newSalt() {
  return "s" + Utilities.getUuid().replace(/-/g, "");
}

function verifyPin(user, pin) {
  return safeEqual(hashPin(pin, user.salt), String(user.pinHash));
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Same rules as normalizeUserName() in js/api.js. */
function normalizeName(value) {
  return String(value == null ? "" : value)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function publicUser(u) {
  return { name: String(u.name), role: String(u.role), team: String(u.team) };
}

function randomPin() {
  const hex = Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  return String(parseInt(hex, 16) % 10000).padStart(4, "0");
}

// ─────────────────────────────────────────────────────────────────────────
// SETUP, SCHEMA & MIGRATIONS (run from the Apps Script editor)
// ─────────────────────────────────────────────────────────────────────────
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().deleteProperty("SCHEMA_VERSION");
  ensureSchema(ss);

  const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (usersSheet.getLastRow() <= 1) {
    const lines = [];
    PEOPLE.forEach(p => {
      const pin = randomPin();
      const salt = newSalt();
      appendObject(usersSheet, { name: p[0], role: p[1], team: p[2], pinHash: hashPin(pin, salt), salt: salt });
      lines.push(p[0] + " → " + pin);
    });
    Logger.log("Users created. Hand out these PINs privately — they are not stored anywhere in plain text:\n" + lines.join("\n"));
  }
  Logger.log("Setup v" + SCHEMA_VERSION + " complete.");
}

function ensureSchema(ss) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("SCHEMA_VERSION") === SCHEMA_VERSION) return;

  migratePinsIn(ss);
  Object.keys(SHEET_NAMES).forEach(key => {
    const sheet = getOrInitSheet(ss, SHEET_NAMES[key]);
    ensureHeaders(sheet, HEADERS[SHEET_NAMES[key]]);
  });
  props.setProperty("SCHEMA_VERSION", SCHEMA_VERSION);
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  const current = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  let col = current.filter(h => h !== "").length;
  headers.forEach(h => {
    if (current.indexOf(h) === -1) {
      col++;
      sheet.getRange(1, col).setValue(h);
    }
  });
}

/** Converts a plaintext `pin` column into `pinHash` + `salt`. Safe to re-run. */
function migratePins() {
  const n = migratePinsIn(SpreadsheetApp.getActiveSpreadsheet());
  Logger.log(n === 0 ? "No plaintext PINs found — nothing to migrate." : "Hashed " + n + " PINs.");
}

function migratePinsIn(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (!sheet || sheet.getLastRow() === 0) return 0;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const pinCol = headers.indexOf("pin");
  if (pinCol === -1) return 0;

  let saltCol = headers.indexOf("salt");
  if (saltCol === -1) {
    saltCol = headers.filter(h => h !== "").length;
    sheet.getRange(1, saltCol + 1).setValue("salt");
  }

  let count = 0;
  for (let r = 1; r < values.length; r++) {
    let raw = String(values[r][pinCol] == null ? "" : values[r][pinCol]).trim().replace(/^'/, "");
    if (/^\d{1,4}$/.test(raw)) raw = raw.padStart(4, "0");
    if (!/^\d{4}$/.test(raw)) {
      sheet.getRange(r + 1, pinCol + 1).setValue("");
      continue;
    }
    const salt = newSalt();
    sheet.getRange(r + 1, pinCol + 1).setValue(cell(hashPin(raw, salt)));
    sheet.getRange(r + 1, saltCol + 1).setValue(cell(salt));
    count++;
  }
  sheet.getRange(1, pinCol + 1).setValue("pinHash");
  return count;
}

/**
 * Repairs Submissions rows written by the old addSubmission bug, which put the
 * timestamp in the gradingRequested column and left timestamp empty.
 */
function migrateSubmissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const t = readTable(ss, SHEET_NAMES.SUBMISSIONS);
  const gCol = t.headers.indexOf("gradingRequested");
  const tsCol = t.headers.indexOf("timestamp");
  let fixed = 0;
  t.rows.forEach(row => {
    if (isDate(row.gradingRequested) && (row.timestamp === "" || row.timestamp == null)) {
      t.sheet.getRange(row._row, tsCol + 1).setValue(row.gradingRequested);
      t.sheet.getRange(row._row, gCol + 1).setValue(false);
      fixed++;
    }
  });
  Logger.log("Repaired " + fixed + " submission rows.");
  return fixed;
}

/**
 * Gives every person a new random PIN, prints the list once in the
 * execution log, and signs everyone out. Run this when upgrading from v3:
 * the old default PINs were published in the public README.
 */
function resetAllPins() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema(ss);
  const lines = [];
  readTable(ss, SHEET_NAMES.USERS).rows.forEach(u => {
    const pin = randomPin();
    writePin(ss, u.name, pin);
    lines.push(u.name + " → " + pin);
  });
  Logger.log("New PINs (hand them out privately — they are not stored anywhere in plain text):\n" + lines.join("\n"));
  return lines.length;
}

/** Set a PIN from the editor, e.g. setPinForUser("Shehroz", "4821"). */
function setPinForUser(name, pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSchema(ss);
  if (!/^\d{4}$/.test(String(pin))) throw new Error("PIN must be exactly 4 digits.");
  writePin(ss, name, String(pin));
  Logger.log("PIN updated for " + name + ".");
}

// ─────────────────────────────────────────────────────────────────────────
// BACKUPS
// ─────────────────────────────────────────────────────────────────────────
function installBackupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "runBackup")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("runBackup").timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
  runBackup();
  Logger.log("Weekly backup installed (Sundays ~2 AM). A first backup was made just now.");
}

function runBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER_NAME);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HHmm");
  DriveApp.getFileById(ss.getId()).makeCopy(ss.getName() + " backup " + stamp, folder);

  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  files.slice(BACKUPS_TO_KEEP).forEach(f => f.setTrashed(true));
}

// ─────────────────────────────────────────────────────────────────────────
// READ ACTIONS
// ─────────────────────────────────────────────────────────────────────────
function actionUsers(ss, session) {
  return { ok: true, users: readTable(ss, SHEET_NAMES.USERS).rows.map(sanitizeUser) };
}

function sanitizeUser(u) {
  return { name: String(u.name), role: String(u.role), team: String(u.team), hasPin: Boolean(u.pinHash) };
}

function actionAuditLog(ss, session, params) {
  const limit = Math.min(1000, Math.max(1, Number(params.limit) || 500));
  const rows = readTable(ss, SHEET_NAMES.AUDIT_LOG).rows.map(stripRow);
  rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return {
    ok: true,
    entries: rows.slice(0, limit).map(r => {
      let details = {};
      try { details = JSON.parse(r.details || "{}"); } catch (e) { details = { raw: String(r.details) }; }
      return Object.assign({}, r, { details: details });
    }),
  };
}

function actionDashboard(ss, session) {
  return { ok: true, data: buildDashboard(ss, session) };
}

function buildDashboard(ss, session) {
  const role = session.role;
  const team = session.team;
  const me = normalizeName(session.name);
  const isMe = v => normalizeName(v) === me;

  const tasks = readTable(ss, SHEET_NAMES.TASKS).rows.map(stripRow).map(t => Object.assign(t, { dueDate: dateOnly(t.dueDate) }));
  const marks = readTable(ss, SHEET_NAMES.MARKS).rows.map(stripRow);
  const subs = readTable(ss, SHEET_NAMES.SUBMISSIONS).rows.map(stripRow);
  const replies = readTable(ss, SHEET_NAMES.ESCALATION_REPLIES).rows.map(stripRow);
  const escalations = readTable(ss, SHEET_NAMES.ESCALATIONS).rows.map(stripRow).map(es =>
    Object.assign(es, { replies: replies.filter(r => String(r.escalationId) === String(es.id)) })
  );
  const announcements = readTable(ss, SHEET_NAMES.ANNOUNCEMENTS).rows.map(stripRow);
  const quizzes = readTable(ss, SHEET_NAMES.QUIZ_SCHEDULE).rows.map(stripRow);
  const goals = readTable(ss, SHEET_NAMES.GOALS).rows.map(stripRow);
  const teamMessages = readTable(ss, SHEET_NAMES.TEAM_MESSAGES).rows.map(stripRow);
  const mentorship = readTable(ss, SHEET_NAMES.MENTORSHIP).rows.map(stripRow).map(p => {
    let milestones = [];
    try { milestones = JSON.parse(p.milestones || "[]"); } catch (e) { milestones = []; }
    return Object.assign(p, { milestones: milestones });
  });

  const teamAverages = computeTeamAverages(marks);
  const metrics = computeMemberMetrics(marks, escalations);

  if (role === "group_leader" || role === "instructor" || role === "assistant") {
    const out = {
      tasks: tasks,
      marks: marks,
      submissions: subs,
      escalations: escalations,
      announcements: announcements,
      quizzes: quizzes,
      goals: goals,
      teamMessages: teamMessages,
      mentorship: mentorship,
      teamAverages: teamAverages,
      memberMetrics: metrics,
      atRiskMembers: Object.values(metrics).filter(m => m.atRisk),
      roster: rosterFor(ss, null),
      canEdit: true,
    };
    if (role === "group_leader") out.users = readTable(ss, SHEET_NAMES.USERS).rows.map(sanitizeUser);
    return out;
  }

  if (role === "team_leader") {
    const teamMetrics = {};
    Object.keys(metrics).forEach(m => {
      if (metrics[m].team === team) teamMetrics[m] = metrics[m];
    });
    return {
      tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
      marks: marks.filter(m => m.team === team),
      submissions: subs.filter(s => s.team === team),
      escalations: escalations.filter(es => es.team === team),
      announcements: announcements,
      quizzes: quizzes.filter(q => q.scope === "ALL" || q.scope === team),
      goals: goals.filter(g => g.team === team),
      teamMessages: teamMessages.filter(tm => tm.team === team),
      mentorship: mentorship.filter(mp => mp.team === team),
      teamAverage: teamAverages[team] !== undefined ? teamAverages[team] : null,
      teamAverages: teamAverages,
      memberMetrics: teamMetrics,
      atRiskMembers: Object.values(teamMetrics).filter(m => m.atRisk),
      roster: rosterFor(ss, team),
    };
  }

  // Member: only their own detail, plus a public leaderboard summary.
  const myMarks = marks.filter(m => isMe(m.member));
  const myMetricsKey = Object.keys(metrics).find(k => isMe(k));
  const leaderboard = {};
  Object.keys(metrics).forEach(k => {
    leaderboard[k] = isMe(k) ? metrics[k] : publicMetrics(metrics[k]);
  });
  return {
    tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
    myMarks: myMarks,
    marks: myMarks,
    teamAverage: teamAverages[team] !== undefined ? teamAverages[team] : null,
    teamAverages: teamAverages,
    mySubmissions: subs.filter(s => isMe(s.member)),
    myMetrics: myMetricsKey ? metrics[myMetricsKey] : null,
    memberMetrics: leaderboard,
    myEscalations: escalations.filter(es => isMe(es.raisedBy)),
    announcements: announcements,
    quizzes: quizzes.filter(q => q.scope === "ALL" || q.scope === team),
    teamMessages: teamMessages.filter(tm => tm.team === team),
    mentorship: mentorship.filter(mp => isMe(mp.student) || isMe(mp.mentor)),
    myGoal: goals.find(g => isMe(g.name)) || null,
  };
}

/** What a member may see about classmates: enough for the leaderboard, nothing more. */
function publicMetrics(m) {
  return { member: m.member, team: m.team, avgScore: m.avgScore, streak: m.streak, delta: m.delta };
}

/** Students on a team (or all teams), for submission tracking. */
function rosterFor(ss, team) {
  return readTable(ss, SHEET_NAMES.USERS).rows
    .filter(u => TEAMS.indexOf(String(u.team)) !== -1)
    .filter(u => String(u.role) === "member" || String(u.role) === "team_leader")
    .filter(u => !team || String(u.team) === team)
    .map(u => ({ name: String(u.name), team: String(u.team), role: String(u.role) }));
}

// ─────────────────────────────────────────────────────────────────────────
// WRITE ACTIONS
// ─────────────────────────────────────────────────────────────────────────
function actionAddMark(ss, session, p) {
  const student = findUser(ss, p.member);
  if (!student || TEAMS.indexOf(String(student.user.team)) === -1) {
    throw apiError("Choose a student from the roster.", "VALIDATION");
  }
  const memberTeam = String(student.user.team);
  if (session.role === "team_leader" && memberTeam !== session.team) {
    throw apiError("Team leaders can only record marks for their own team.", "FORBIDDEN");
  }
  const row = Object.assign({ id: newId(), member: String(student.user.name), team: memberTeam }, validateMarkFields(p, true), {
    editedBy: session.name,
    timestamp: new Date(),
  });
  appendObject(getSheet(ss, SHEET_NAMES.MARKS), row);
  audit(ss, session, "addMark", row.id, { after: row });
  return { ok: true, id: row.id };
}

function actionEditMark(ss, session, p) {
  const fields = validateMarkFields(pick(p.fields || {}, MARK_FIELDS), false);
  if (!Object.keys(fields).length) throw apiError("Nothing to change.", "VALIDATION");
  fields.editedBy = session.name;
  const before = updateRowById(ss, SHEET_NAMES.MARKS, p.id, fields);
  const changedBefore = {};
  Object.keys(fields).forEach(k => { changedBefore[k] = before[k]; });
  audit(ss, session, "editMark", p.id, { member: before.member, before: changedBefore, after: fields });
  return { ok: true };
}

function actionDeleteMark(ss, session, p) {
  const before = deleteRowById(ss, SHEET_NAMES.MARKS, p.id);
  audit(ss, session, "deleteMark", p.id, { before: before });
  return { ok: true };
}

function validateMarkFields(p, isNew) {
  const out = {};
  const has = k => isNew || Object.prototype.hasOwnProperty.call(p, k);
  if (has("cycle")) out.cycle = text(p.cycle, MAX_SHORT, "Topic / unit", true);
  if (has("mockNumber")) out.mockNumber = numberIn(p.mockNumber, 0, 99, "Mock number", false);
  if (has("quizScore")) out.quizScore = numberIn(p.quizScore, 0, 100, "Quiz score", true);
  if (has("submission")) out.submission = oneOf(p.submission, ["Yes", "No"], "Submission", isNew ? "Yes" : "");
  if (has("attendance")) out.attendance = text(p.attendance, 20, "Attendance", false);
  if (has("previewDone")) out.previewDone = oneOf(p.previewDone, ["Yes", "No", ""], "Preview", "");
  if (has("peerRating")) out.peerRating = numberIn(p.peerRating, 1, 5, "Peer rating", false);
  if (has("punctual")) out.punctual = oneOf(p.punctual, ["Yes", "No", ""], "Punctual", "");
  if (has("notes")) out.notes = text(p.notes, 1000, "Notes", false);
  return out;
}

function actionAddTask(ss, session, p) {
  const row = Object.assign({ id: newId() }, validateTaskFields(p, true), {
    createdBy: session.name,
    status: "open",
    timestamp: new Date(),
  });
  appendObject(getSheet(ss, SHEET_NAMES.TASKS), row);
  audit(ss, session, "addTask", row.id, { after: row });
  return { ok: true, id: row.id };
}

function actionEditTask(ss, session, p) {
  const fields = validateTaskFields(pick(p.fields || {}, TASK_FIELDS), false);
  if (!Object.keys(fields).length) throw apiError("Nothing to change.", "VALIDATION");
  const before = updateRowById(ss, SHEET_NAMES.TASKS, p.id, fields);
  const changedBefore = {};
  Object.keys(fields).forEach(k => { changedBefore[k] = before[k]; });
  audit(ss, session, "editTask", p.id, { before: changedBefore, after: fields });
  return { ok: true };
}

function validateTaskFields(p, isNew) {
  const out = {};
  const has = k => isNew || Object.prototype.hasOwnProperty.call(p, k);
  if (has("title")) out.title = text(p.title, MAX_TITLE, "Title", true);
  if (has("description")) out.description = text(p.description, MAX_BODY, "Description", false);
  if (has("team")) out.team = teamOrAll(p.team);
  if (has("dueDate")) out.dueDate = dateField(p.dueDate, "Due date", false);
  if (has("fileUrl")) out.fileUrl = urlField(p.fileUrl);
  return out;
}

function actionUpdateTaskStatus(ss, session, p) {
  const status = oneOf(p.status, ["open", "done"], "Status");
  const task = findRowById(ss, SHEET_NAMES.TASKS, p.id);
  if (session.role === "team_leader" && String(task.team) !== session.team) {
    throw apiError("Team leaders can only update their own team's tasks.", "FORBIDDEN");
  }
  updateRowById(ss, SHEET_NAMES.TASKS, p.id, { status: status });
  audit(ss, session, "updateTaskStatus", p.id, { before: { status: task.status }, after: { status: status } });
  return { ok: true };
}

function actionAddSubmission(ss, session, p) {
  if (TEAMS.indexOf(session.team) === -1) throw apiError("Only students on a team can submit work.", "FORBIDDEN");
  const task = findRowById(ss, SHEET_NAMES.TASKS, p.taskId);
  if (String(task.team) !== "ALL" && String(task.team) !== session.team) {
    throw apiError("This task is not assigned to your team.", "FORBIDDEN");
  }
  const row = {
    id: newId(),
    taskId: String(task.id),
    member: session.name,
    team: session.team,
    content: text(p.content, MAX_BODY, "Submission notes", true),
    fileUrl: urlField(p.fileUrl),
    gradingRequested: false,
    requestedBy: "",
    reviewNotes: "",
    timestamp: new Date(),
  };
  appendObject(getSheet(ss, SHEET_NAMES.SUBMISSIONS), row);
  audit(ss, session, "addSubmission", row.id, { taskId: row.taskId });
  return { ok: true, id: row.id };
}

function actionAddEscalation(ss, session, p) {
  const now = new Date();
  const row = {
    id: newId(),
    raisedBy: session.name,
    team: session.team,
    topic: text(p.topic, MAX_TITLE, "Topic", true),
    details: text(p.details, MAX_BODY, "Details", true),
    severity: oneOf(p.severity, ["normal", "severe"], "Urgency", "normal"),
    status: "open",
    timestamp: now,
    updatedAt: now,
    closedBy: "",
  };
  appendObject(getSheet(ss, SHEET_NAMES.ESCALATIONS), row);
  audit(ss, session, "addEscalation", row.id, { topic: row.topic });
  return { ok: true, id: row.id };
}

function actionUpdateEscalationStatus(ss, session, p) {
  const status = oneOf(p.status, ["open", "closed"], "Status");
  const before = updateRowById(ss, SHEET_NAMES.ESCALATIONS, p.id, {
    status: status,
    updatedAt: new Date(),
    closedBy: status === "closed" ? session.name : "",
  });
  audit(ss, session, "updateEscalationStatus", p.id, { before: { status: before.status }, after: { status: status } });
  return { ok: true };
}

function actionAddEscalationReply(ss, session, p) {
  const esc = findRowById(ss, SHEET_NAMES.ESCALATIONS, p.escalationId);
  if (session.role === "team_leader" && String(esc.team) !== session.team) {
    throw apiError("Team leaders can only reply to their own team's doubts.", "FORBIDDEN");
  }
  const row = {
    id: newId(),
    escalationId: String(esc.id),
    author: session.name,
    role: session.role,
    message: text(p.message, MAX_BODY, "Reply", true),
    timestamp: new Date(),
  };
  appendObject(getSheet(ss, SHEET_NAMES.ESCALATION_REPLIES), row);
  updateRowById(ss, SHEET_NAMES.ESCALATIONS, esc.id, { updatedAt: row.timestamp });
  audit(ss, session, "addEscalationReply", String(esc.id), { replyId: row.id });
  return { ok: true, id: row.id };
}

function actionAddAnnouncement(ss, session, p) {
  const row = {
    id: newId(),
    title: text(p.title, MAX_TITLE, "Title", true),
    body: text(p.body, MAX_BODY, "Message", true),
    pinned: p.pinned === true || p.pinned === "true",
    postedBy: session.name,
    timestamp: new Date(),
  };
  appendObject(getSheet(ss, SHEET_NAMES.ANNOUNCEMENTS), row);
  audit(ss, session, "addAnnouncement", row.id, { title: row.title });
  return { ok: true, id: row.id };
}

function actionDeleteAnnouncement(ss, session, p) {
  const before = deleteRowById(ss, SHEET_NAMES.ANNOUNCEMENTS, p.id);
  audit(ss, session, "deleteAnnouncement", p.id, { before: before });
  return { ok: true };
}

function actionPinAnnouncement(ss, session, p) {
  const pinned = p.pinned === true || p.pinned === "true";
  updateRowById(ss, SHEET_NAMES.ANNOUNCEMENTS, p.id, { pinned: pinned });
  audit(ss, session, "pinAnnouncement", p.id, { after: { pinned: pinned } });
  return { ok: true };
}

function actionAddQuiz(ss, session, p) {
  const when = new Date(p.scheduledAt);
  if (!p.scheduledAt || isNaN(when.getTime())) throw apiError("Choose a valid date and time.", "VALIDATION");
  const row = {
    id: newId(),
    title: text(p.title, MAX_TITLE, "Title", true),
    scheduledAt: when.toISOString(),
    scope: teamOrAll(p.scope || "ALL"),
    notes: text(p.notes, 1000, "Notes", false),
    createdBy: session.name,
    timestamp: new Date(),
  };
  appendObject(getSheet(ss, SHEET_NAMES.QUIZ_SCHEDULE), row);
  audit(ss, session, "addQuiz", row.id, { title: row.title, scheduledAt: row.scheduledAt });
  return { ok: true, id: row.id };
}

function actionDeleteQuiz(ss, session, p) {
  const before = deleteRowById(ss, SHEET_NAMES.QUIZ_SCHEDULE, p.id);
  audit(ss, session, "deleteQuiz", p.id, { before: before });
  return { ok: true };
}

function actionSetGoal(ss, session, p) {
  const target = numberIn(p.target, 0, 100, "Target score", true);
  const description = text(p.description, MAX_TITLE, "Goal description", false);
  const t = readTable(ss, SHEET_NAMES.GOALS);
  const existing = t.rows.find(r => normalizeName(r.name) === normalizeName(session.name));
  const fields = { name: session.name, team: session.team, target: target, description: description, setAt: new Date() };
  if (existing) {
    writeFields(t, existing._row, fields);
  } else {
    appendObject(t.sheet, fields);
  }
  audit(ss, session, "setGoal", session.name, { after: { target: target, description: description } });
  return { ok: true };
}

function actionUpdatePin(ss, session, p) {
  const newPin = String(p.newPin || "").trim();
  if (!/^\d{4}$/.test(newPin)) throw apiError("PIN must be exactly 4 numeric digits.", "VALIDATION");
  const target = findUser(ss, p.targetMember);
  if (!target) throw apiError("Member not found in roster.", "NOT_FOUND");
  writePin(ss, target.user.name, newPin);
  audit(ss, session, "resetPin", String(target.user.name), {});
  return { ok: true };
}

function actionChangeMyPin(ss, session, p) {
  const currentPin = String(p.currentPin || "").trim();
  const newPin = String(p.newPin || "").trim();
  const me = findUser(ss, session.name);
  const cache = CacheService.getScriptCache();
  const key = normalizeName(session.name);
  if (cache.get("lock:" + key)) throw apiError("Too many failed attempts. Try again in 15 minutes.", "LOCKED");
  if (!/^\d{4}$/.test(currentPin) || !verifyPin(me.user, currentPin)) {
    recordLoginFailure(cache, key);
    throw apiError("Your current PIN is not correct.", "VALIDATION");
  }
  if (!/^\d{4}$/.test(newPin)) throw apiError("New PIN must be exactly 4 numeric digits.", "VALIDATION");
  if (newPin === currentPin) throw apiError("Choose a PIN that is different from your current one.", "VALIDATION");
  writePin(ss, session.name, newPin);
  audit(ss, session, "changeMyPin", session.name, {});
  // Hand back a fresh token so this device stays signed in; every other
  // session was issued against the old PIN and is now invalid.
  return { ok: true, token: issueToken(findUser(ss, session.name).user) };
}

function writePin(ss, name, pin) {
  const found = findUser(ss, name);
  if (!found) throw apiError("Member not found in roster: " + name, "NOT_FOUND");
  const salt = newSalt();
  writeFields(readTable(ss, SHEET_NAMES.USERS), found.row, { pinHash: hashPin(pin, salt), salt: salt });
}

function actionRequestGrading(ss, session, p) {
  const sub = findRowById(ss, SHEET_NAMES.SUBMISSIONS, p.submissionId);
  if (session.role === "team_leader" && String(sub.team) !== session.team) {
    throw apiError("Team leaders can only forward their own team's submissions.", "FORBIDDEN");
  }
  updateRowById(ss, SHEET_NAMES.SUBMISSIONS, p.submissionId, {
    gradingRequested: true,
    requestedBy: session.name,
    reviewNotes: text(p.reviewNotes, 1000, "Review notes", false),
  });
  audit(ss, session, "requestGrading", p.submissionId, { member: sub.member });
  return { ok: true };
}

function actionAddTeamMessage(ss, session, p) {
  const team = session.role === "team_leader" ? session.team : teamOnly(p.team);
  if (session.role === "team_leader" && p.team && String(p.team) !== session.team) {
    throw apiError("Team leaders can only post to their own team.", "FORBIDDEN");
  }
  const row = {
    id: newId(),
    team: team,
    author: session.name,
    message: text(p.message, MAX_BODY, "Message", true),
    timestamp: new Date(),
  };
  appendObject(getSheet(ss, SHEET_NAMES.TEAM_MESSAGES), row);
  audit(ss, session, "addTeamMessage", row.id, { team: team });
  return { ok: true, id: row.id };
}

function actionDeleteTeamMessage(ss, session, p) {
  const msg = findRowById(ss, SHEET_NAMES.TEAM_MESSAGES, p.id);
  if (session.role === "team_leader" && String(msg.team) !== session.team) {
    throw apiError("Team leaders can only remove their own team's notices.", "FORBIDDEN");
  }
  const before = deleteRowById(ss, SHEET_NAMES.TEAM_MESSAGES, p.id);
  audit(ss, session, "deleteTeamMessage", p.id, { before: before });
  return { ok: true };
}

function actionCreateMentorshipPlan(ss, session, p) {
  const student = findUser(ss, p.student);
  const mentor = findUser(ss, p.mentor);
  if (!student || TEAMS.indexOf(String(student.user.team)) === -1) throw apiError("Choose a student from the roster.", "VALIDATION");
  if (!mentor) throw apiError("Choose a mentor from the roster.", "VALIDATION");
  if (normalizeName(student.user.name) === normalizeName(mentor.user.name)) throw apiError("A student cannot mentor themselves.", "VALIDATION");
  const milestones = (Array.isArray(p.milestones) ? p.milestones : [])
    .map(m => text(m, MAX_TITLE, "Milestone", false))
    .filter(Boolean)
    .slice(0, 10);
  const row = {
    id: newId(),
    student: String(student.user.name),
    mentor: String(mentor.user.name),
    team: String(student.user.team),
    milestones: JSON.stringify(milestones),
    status: "active",
    assignedBy: session.name,
    timestamp: new Date(),
  };
  appendObject(getSheet(ss, SHEET_NAMES.MENTORSHIP), row);
  audit(ss, session, "createMentorshipPlan", row.id, { student: row.student, mentor: row.mentor });
  return { ok: true, id: row.id };
}

function actionUpdateMentorshipStatus(ss, session, p) {
  const status = oneOf(p.status, ["active", "resolved"], "Status");
  const before = updateRowById(ss, SHEET_NAMES.MENTORSHIP, p.id, { status: status });
  audit(ss, session, "updateMentorshipStatus", p.id, { before: { status: before.status }, after: { status: status } });
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────
function text(v, max, label, required) {
  const s = v == null ? "" : String(v).trim();
  if (required && !s) throw apiError(label + " is required.", "VALIDATION");
  if (s.length > max) throw apiError(label + " is too long (max " + max + " characters).", "VALIDATION");
  return s;
}

function numberIn(v, min, max, label, required) {
  if (v === "" || v == null) {
    if (required) throw apiError(label + " is required.", "VALIDATION");
    return "";
  }
  const n = Number(v);
  if (!isFinite(n) || n < min || n > max) {
    throw apiError(label + " must be between " + min + " and " + max + ".", "VALIDATION");
  }
  return n;
}

function oneOf(v, allowed, label, fallback) {
  const s = v == null ? "" : String(v);
  if (s === "" && fallback !== undefined) return fallback;
  if (allowed.indexOf(s) === -1) throw apiError(label + " must be one of: " + allowed.filter(Boolean).join(", ") + ".", "VALIDATION");
  return s;
}

function teamOrAll(v) {
  const s = String(v == null ? "" : v);
  if (s !== "ALL" && TEAMS.indexOf(s) === -1) throw apiError("Team must be ALL or one of: " + TEAMS.join(", ") + ".", "VALIDATION");
  return s;
}

function teamOnly(v) {
  const s = String(v == null ? "" : v);
  if (TEAMS.indexOf(s) === -1) throw apiError("Team must be one of: " + TEAMS.join(", ") + ".", "VALIDATION");
  return s;
}

function urlField(v) {
  const s = text(v, 1000, "Link", false);
  if (!s) return "";
  if (!/^https?:\/\/[^\s]+$/i.test(s)) throw apiError("Links must start with http:// or https://.", "VALIDATION");
  return s;
}

function dateField(v, label, required) {
  const s = text(v, 10, label, required);
  if (!s) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + "T00:00:00Z").getTime())) {
    throw apiError(label + " must be a date like 2026-11-30.", "VALIDATION");
  }
  return s;
}

function pick(obj, keys) {
  const out = {};
  keys.forEach(k => { if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k]; });
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// METRICS & COMPUTATIONS
// ─────────────────────────────────────────────────────────────────────────
function computeMemberMetrics(marks, escalations) {
  const byMember = {};
  marks.forEach(m => {
    if (!byMember[m.member]) byMember[m.member] = [];
    byMember[m.member].push(m);
  });

  const result = {};
  Object.keys(byMember).forEach(member => {
    const rows = byMember[member].slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const team = rows[rows.length - 1].team;

    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const passed = Number(rows[i].quizScore) >= 50 && isYes(rows[i].submission);
      if (passed) streak++; else break;
    }

    const scored = rows.filter(r => r.quizScore !== "" && !isNaN(Number(r.quizScore)));
    const avgScore = scored.length ? round1(scored.reduce((sum, r) => sum + Number(r.quizScore), 0) / scored.length) : 0;
    const lastCycleScore = scored.length ? Number(scored[scored.length - 1].quizScore) : 0;

    let improvementDelta = null;
    if (scored.length >= 2) {
      improvementDelta = round1(Number(scored[scored.length - 1].quizScore) - Number(scored[scored.length - 2].quizScore));
    }

    let mockDelta = null;
    const mocks = rows.filter(r => r.mockNumber !== "" && r.mockNumber !== undefined && r.mockNumber !== null)
      .sort((a, b) => Number(a.mockNumber) - Number(b.mockNumber));
    if (mocks.length >= 2) {
      mockDelta = round1(Number(mocks[mocks.length - 1].quizScore) - Number(mocks[mocks.length - 2].quizScore));
    }

    const ratings = rows.map(r => Number(r.peerRating)).filter(v => !isNaN(v) && v > 0);
    const avgPeerRating = ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

    const previewRate = rateOfYes(rows, "previewDone");
    const punctualityRate = rateOfYes(rows, "punctual");
    const doubtCount = escalations.filter(es => normalizeName(es.raisedBy) === normalizeName(member)).length;

    const lastTwo = rows.slice(-2);
    const atRisk = lastTwo.length === 2 && lastTwo.every(r =>
      !isYes(r.submission) || (r.quizScore !== "" && Number(r.quizScore) < 50)
    );

    result[member] = {
      member: member,
      team: team,
      streak: streak,
      avgScore: avgScore,
      lastCycleScore: lastCycleScore,
      delta: improvementDelta !== null ? improvementDelta : 0,
      improvementDelta: improvementDelta,
      mockDelta: mockDelta,
      avgPeerRating: avgPeerRating,
      previewRate: previewRate,
      punctualityRate: punctualityRate,
      doubtCount: doubtCount,
      atRisk: atRisk,
      cycles: rows.length,
    };
  });
  return result;
}

function computeTeamAverages(marks) {
  const byTeam = {};
  marks.forEach(m => {
    if (m.quizScore === "" || m.quizScore == null) return;
    const s = Number(m.quizScore);
    if (isNaN(s)) return;
    if (!byTeam[m.team]) byTeam[m.team] = [];
    byTeam[m.team].push(s);
  });
  const res = {};
  Object.keys(byTeam).forEach(team => {
    const arr = byTeam[team];
    res[team] = round1(arr.reduce((a, b) => a + b, 0) / arr.length);
  });
  return res;
}

function isYes(v) {
  const s = String(v).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "done" || s === "1" || s === "on time" || s === "100%";
}

function rateOfYes(rows, field) {
  const relevant = rows.filter(r => r[field] !== "" && r[field] !== undefined && r[field] !== null);
  if (!relevant.length) return null;
  const yesCount = relevant.filter(r => isYes(r[field])).length;
  return Math.round((yesCount / relevant.length) * 100);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────
function audit(ss, session, action, targetId, details) {
  appendObject(getSheet(ss, SHEET_NAMES.AUDIT_LOG), {
    id: newId(),
    timestamp: new Date(),
    actor: session.name,
    role: session.role,
    action: action,
    targetId: String(targetId == null ? "" : targetId),
    details: JSON.stringify(details || {}).slice(0, 45000),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SHEET HELPERS (all lookups go by header name, not column position)
// ─────────────────────────────────────────────────────────────────────────
function getOrInitSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (HEADERS[name]) {
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function getSheet(ss, name) {
  return getOrInitSheet(ss, name);
}

/** Reads a sheet into { sheet, headers, rows }, each row an object with a `_row` (1-based) index. */
function readTable(ss, name) {
  const sheet = getOrInitSheet(ss, name);
  if (sheet.getLastRow() === 0) return { sheet: sheet, headers: [], rows: [] };
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row.some(c => c !== "" && c !== null)) continue;
    const obj = { _row: r + 1 };
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    rows.push(obj);
  }
  return { sheet: sheet, headers: headers, rows: rows };
}

function stripRow(row) {
  const out = {};
  Object.keys(row).forEach(k => {
    if (k === "_row" || k === "pinHash" || k === "salt" || k === "pin") return;
    out[k] = row[k];
  });
  return out;
}

/**
 * Text is written with a leading apostrophe so Sheets keeps it exactly as
 * typed: "2026-11-05" stays text (not a Date), "95%" stays text, and input
 * starting with "=" can never run as a formula.
 */
function cell(v) {
  if (typeof v === "string" && v !== "") return "'" + v;
  return v;
}

function appendObject(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  sheet.appendRow(headers.map(h => (h && obj[h] !== undefined ? cell(obj[h]) : "")));
}

function writeFields(table, rowNumber, fields) {
  Object.keys(fields).forEach(k => {
    const c = table.headers.indexOf(k);
    if (c !== -1) table.sheet.getRange(rowNumber, c + 1).setValue(cell(fields[k]));
  });
}

function findRowById(ss, sheetName, id) {
  const t = readTable(ss, sheetName);
  const row = t.rows.find(r => String(r.id) === String(id));
  if (id === undefined || id === null || id === "" || !row) throw apiError("That record no longer exists.", "NOT_FOUND");
  return row;
}

/** Updates the given fields and returns the row as it was before. */
function updateRowById(ss, sheetName, id, fields) {
  const t = readTable(ss, sheetName);
  const row = t.rows.find(r => String(r.id) === String(id));
  if (id === undefined || id === null || id === "" || !row) throw apiError("That record no longer exists.", "NOT_FOUND");
  writeFields(t, row._row, fields);
  return stripRow(row);
}

function deleteRowById(ss, sheetName, id) {
  const t = readTable(ss, sheetName);
  const row = t.rows.find(r => String(r.id) === String(id));
  if (id === undefined || id === null || id === "" || !row) throw apiError("That record no longer exists.", "NOT_FOUND");
  t.sheet.deleteRow(row._row);
  return stripRow(row);
}

function findUser(ss, name) {
  const key = normalizeName(name);
  if (!key) return null;
  const row = readTable(ss, SHEET_NAMES.USERS).rows.find(u => normalizeName(u.name) === key);
  return row ? { row: row._row, user: row } : null;
}

function newId() {
  return "id-" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
}

function isDate(v) {
  return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime());
}

function dateOnly(v) {
  if (isDate(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return v == null ? "" : String(v);
}
