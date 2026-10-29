/**
 * EconomicsPortal — Backend (Google Apps Script)
 * Account to use: bahriabatch30@gmail.com
 * Repo:           https://github.com/GucciCreates/EconomicsPortal
 *
 * v3: Tab-based structure, Announcements, Quiz Scheduling with live countdowns,
 * Leaderboard metrics, Personal Goal Tracking, and Instructor Executive Summary.
 */

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — Class roster with names and PINs
// ─────────────────────────────────────────────────────────────────────────
const PEOPLE = [
  // name,              role,          team,     pin
  ["Dr. Numan",        "instructor",  "-",      "0000"],
  ["Shehroz",          "group_leader","Shehroz","1111"],
  ["Sajal",            "assistant",   "Shehroz","1112"],
  ["Amina",            "team_leader", "Amina",  "2001"],
  ["Ramesh",           "member",      "Amina",  "2002"],
  ["Mamoon",           "member",      "Amina",  "2003"],
  ["Tazneem",          "member",      "Amina",  "2004"],
  ["Ayesha (Quetta)",  "team_leader", "Ayesha", "3001"],
  ["Minal",            "member",      "Ayesha", "3002"],
  ["Anika",            "member",      "Ayesha", "3003"],
  ["Ahmed bin Nasir",  "member",      "Ayesha", "3004"],
  ["Lareb",            "team_leader", "Lareb",  "4001"],
  ["Shaiman",          "member",      "Lareb",  "4002"],
  ["Aisha Amjad",      "member",      "Lareb",  "4003"],
  ["Haseeb",           "member",      "Lareb",  "4004"],
  ["Gorsi",            "member",      "Shehroz","1113"],
  ["Haris",            "member",      "Shehroz","1114"],
];

const SHEET_NAMES = {
  USERS:         "Users",
  MARKS:         "Marks",
  TASKS:         "Tasks",
  SUBMISSIONS:   "Submissions",
  ESCALATIONS:   "Escalations",
  ANNOUNCEMENTS: "Announcements",
  QUIZ_SCHEDULE: "QuizSchedule",
  GOALS:         "Goals",
};

const HEADERS = {
  Users:         ["name", "role", "team", "pin"],
  Marks:         ["id", "member", "team", "cycle", "mockNumber", "quizScore", "submission", "attendance", "previewDone", "peerRating", "punctual", "notes", "editedBy", "timestamp"],
  Tasks:         ["id", "title", "description", "team", "dueDate", "fileUrl", "createdBy", "status", "timestamp"],
  Submissions:   ["id", "taskId", "member", "team", "content", "fileUrl", "timestamp"],
  Escalations:   ["id", "raisedBy", "team", "topic", "details", "severity", "status", "timestamp"],
  Announcements: ["id", "title", "body", "pinned", "postedBy", "timestamp"],
  QuizSchedule:  ["id", "title", "scheduledAt", "scope", "notes", "createdBy", "timestamp"],
  Goals:         ["name", "team", "target", "description", "setAt"],
};

// ─────────────────────────────────────────────────────────────────────────
// SETUP — run this once from Apps Script editor
// ─────────────────────────────────────────────────────────────────────────
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(key => {
    const name = SHEET_NAMES[key];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    // If it's a new or existing sheet, make sure headers exist
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sheet.setFrozenRows(1);
    }
  });

  const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  if (usersSheet.getLastRow() <= 1) {
    const rows = PEOPLE.map(p => [p[0], p[1], p[2], p[3]]);
    usersSheet.getRange(2, 1, rows.length, 4).setValues(rows);
    Logger.log("Users created.");
  }

  Logger.log("Setup v3 complete.");
}

// ─────────────────────────────────────────────────────────────────────────
// WEB API (GET)
// ─────────────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "login") {
      const name = (e.parameter.name || "").trim();
      const pin = (e.parameter.pin || "").trim();
      const user = findUser(ss, name, pin);
      if (!user) return json({ ok: false, error: "Invalid name or PIN." });
      return json({ ok: true, user: { name: user.name, role: user.role, team: user.team } });
    }

    if (action === "dashboard") {
      const role = e.parameter.role;
      const team = e.parameter.team;
      const name = e.parameter.name;
      return json({ ok: true, data: buildDashboard(ss, role, team, name) });
    }

    if (action === "users") {
      if (!["group_leader", "instructor"].includes(e.parameter.role)) {
        return json({ ok: false, error: "Not authorized." });
      }
      return json({ ok: true, users: sheetToObjects(ss.getSheetByName(SHEET_NAMES.USERS)) });
    }

    return json({ ok: false, error: "Unknown action." });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// WEB API (POST)
// ─────────────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── Marks ──
    if (action === "addMark") {
      requireRole(body, ["group_leader", "team_leader", "instructor"]);
      appendRow(ss, SHEET_NAMES.MARKS, [
        newId(), body.member, body.team, body.cycle, body.mockNumber || "",
        body.quizScore, body.submission, body.attendance,
        body.previewDone || "", body.peerRating || "", body.punctual || "",
        body.notes || "", body.editedBy || body.name || "", new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "editMark") {
      requireRole(body, ["group_leader", "instructor"]);
      updateRow(ss, SHEET_NAMES.MARKS, body.id, body.fields, body.editedBy || body.name);
      return json({ ok: true });
    }

    if (action === "deleteMark") {
      requireRole(body, ["instructor"]);
      deleteRow(ss, SHEET_NAMES.MARKS, body.id);
      return json({ ok: true });
    }

    // ── Tasks ──
    if (action === "addTask") {
      requireRole(body, ["group_leader", "instructor"]);
      appendRow(ss, SHEET_NAMES.TASKS, [
        newId(), body.title, body.description || "", body.team,
        body.dueDate || "", body.fileUrl || "", body.createdBy, "open",
        new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "editTask") {
      requireRole(body, ["group_leader", "instructor"]);
      updateRow(ss, SHEET_NAMES.TASKS, body.id, body.fields, null);
      return json({ ok: true });
    }

    if (action === "updateTaskStatus") {
      requireRole(body, ["group_leader", "team_leader", "instructor"]);
      updateCell(ss, SHEET_NAMES.TASKS, body.id, "status", body.status);
      return json({ ok: true });
    }

    // ── Submissions & Escalations ──
    if (action === "addSubmission") {
      appendRow(ss, SHEET_NAMES.SUBMISSIONS, [
        newId(), body.taskId, body.member, body.team,
        body.content || "", body.fileUrl || "", new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "addEscalation") {
      appendRow(ss, SHEET_NAMES.ESCALATIONS, [
        newId(), body.raisedBy, body.team, body.topic,
        body.details, body.severity || "normal", "open", new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "updateEscalationStatus") {
      requireRole(body, ["group_leader", "instructor"]);
      updateCell(ss, SHEET_NAMES.ESCALATIONS, body.id, "status", body.status);
      return json({ ok: true });
    }

    // ── Announcements (v3) ──
    if (action === "addAnnouncement") {
      requireRole(body, ["group_leader", "instructor"]);
      appendRow(ss, SHEET_NAMES.ANNOUNCEMENTS, [
        newId(), body.title, body.body, body.pinned ? true : false,
        body.postedBy || body.name, new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "deleteAnnouncement") {
      requireRole(body, ["group_leader", "instructor"]);
      deleteRow(ss, SHEET_NAMES.ANNOUNCEMENTS, body.id);
      return json({ ok: true });
    }

    if (action === "pinAnnouncement") {
      requireRole(body, ["group_leader", "instructor"]);
      updateCell(ss, SHEET_NAMES.ANNOUNCEMENTS, body.id, "pinned", body.pinned);
      return json({ ok: true });
    }

    // ── Quizzes (v3) ──
    if (action === "addQuiz") {
      requireRole(body, ["group_leader", "instructor"]);
      appendRow(ss, SHEET_NAMES.QUIZ_SCHEDULE, [
        newId(), body.title, body.scheduledAt, body.scope || "ALL",
        body.notes || "", body.name, new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "deleteQuiz") {
      requireRole(body, ["group_leader", "instructor"]);
      deleteRow(ss, SHEET_NAMES.QUIZ_SCHEDULE, body.id);
      return json({ ok: true });
    }

    // ── Goals (v3) ──
    if (action === "setGoal") {
      upsertGoal(ss, body.name, body.team, body.target, body.description);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Unknown action." });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DASHBOARD AGGREGATOR
// ─────────────────────────────────────────────────────────────────────────
function buildDashboard(ss, role, team, name) {
  const tasks = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.TASKS));
  const marks = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.MARKS));
  const subs = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.SUBMISSIONS));
  const escalations = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.ESCALATIONS));
  const announcements = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.ANNOUNCEMENTS));
  const quizzes = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.QUIZ_SCHEDULE));
  const goals = sheetToObjects(getOrInitSheet(ss, SHEET_NAMES.GOALS));

  const teamAverages = computeTeamAverages(marks);
  const metrics = computeMemberMetrics(marks, escalations);
  const atRiskMembers = Object.values(metrics).filter(m => m.atRisk);

  if (role === "instructor" || role === "group_leader" || role === "assistant") {
    return {
      tasks: tasks,
      marks: marks,
      submissions: subs,
      escalations: escalations,
      announcements: announcements,
      quizzes: quizzes,
      goals: goals,
      teamAverages: teamAverages,
      memberMetrics: metrics,
      atRiskMembers: atRiskMembers,
      canEdit: role === "instructor" || role === "group_leader",
    };
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
      teamAverage: teamAverages[team] || null,
      teamAverages: teamAverages,
      memberMetrics: teamMetrics,
      atRiskMembers: Object.values(teamMetrics).filter(m => m.atRisk),
    };
  }

  // Member
  const myGoal = goals.find(g => String(g.name).toLowerCase() === name.toLowerCase()) || null;
  return {
    tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
    myMarks: marks.filter(m => String(m.member).toLowerCase() === name.toLowerCase()),
    marks: marks.filter(m => m.team === team || String(m.member).toLowerCase() === name.toLowerCase()),
    teamAverage: teamAverages[team] || null,
    teamAverages: teamAverages,
    mySubmissions: subs.filter(s => String(s.member).toLowerCase() === name.toLowerCase()),
    myMetrics: metrics[name] || null,
    memberMetrics: metrics,
    announcements: announcements,
    quizzes: quizzes.filter(q => q.scope === "ALL" || q.scope === team),
    myGoal: myGoal,
  };
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
    const doubtCount = escalations.filter(es => es.raisedBy === member).length;

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
// SHEET CRUD HELPERS
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

function sheetToObjects(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1)
    .filter(row => row.some(cell => cell !== ""))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}

function appendRow(ss, sheetName, rowData) {
  const sheet = getOrInitSheet(ss, sheetName);
  sheet.appendRow(rowData);
}

function updateCell(ss, sheetName, id, colName, newValue) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const colIndex = headers.indexOf(colName);
  if (colIndex === -1) throw new Error("Column not found: " + colName);

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      sheet.getRange(r + 1, colIndex + 1).setValue(newValue);
      return;
    }
  }
  throw new Error("Row not found for id " + id);
}

function updateRow(ss, sheetName, id, fields, editorName) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      Object.keys(fields).forEach(colName => {
        const c = headers.indexOf(colName);
        if (c !== -1) {
          sheet.getRange(r + 1, c + 1).setValue(fields[colName]);
        }
      });
      if (editorName && headers.includes("editedBy")) {
        const ec = headers.indexOf("editedBy");
        sheet.getRange(r + 1, ec + 1).setValue(editorName);
      }
      return;
    }
  }
  throw new Error("Row not found for id " + id);
}

function deleteRow(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]) === String(id)) {
      sheet.deleteRow(r + 1);
      return;
    }
  }
  throw new Error("Row not found for id " + id);
}

function upsertGoal(ss, memberName, team, target, description) {
  const sheet = getOrInitSheet(ss, SHEET_NAMES.GOALS);
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][0]).toLowerCase() === memberName.toLowerCase()) {
      sheet.getRange(r + 1, 3).setValue(target);
      sheet.getRange(r + 1, 4).setValue(description || "");
      sheet.getRange(r + 1, 5).setValue(new Date());
      return;
    }
  }
  sheet.appendRow([memberName, team, target, description || "", new Date()]);
}

function findUser(ss, name, pin) {
  const users = sheetToObjects(ss.getSheetByName(SHEET_NAMES.USERS));
  return users.find(u => {
    const nameMatch = String(u.name).trim().toLowerCase() === name.toLowerCase();
    const pinStr = String(u.pin).trim();
    const pinMatch = pinStr === pin || pinStr.padStart(4, "0") === pin || String(Number(pinStr)) === String(Number(pin));
    return nameMatch && pinMatch;
  });
}

function requireRole(body, allowed) {
  if (!allowed.includes(body.role)) {
    throw new Error("Not authorized for this action.");
  }
}

function newId() {
  return "id-" + Utilities.getUuid().slice(0, 8);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
