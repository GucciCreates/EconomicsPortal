/**
 * EconomicsPortal — Backend (Google Apps Script)
 * Account to use: bahriabatch30@gmail.com
 * Repo:           https://github.com/GucciCreates/EconomicsPortal
 *
 * v2: adds extra performance metrics (streak, improvement delta, at-risk
 * flag, mock-to-mock delta, preview completion, peer rating, punctuality,
 * doubt count) and a full instructor role for Dr. Numan with edit rights
 * over marks and tasks.
 *
 * ───────────────────────────────────────────────────────────────────
 * ONE-TIME SETUP (see SETUP_GUIDE.md)
 * ───────────────────────────────────────────────────────────────────
 * Same as v1. If you already set up v1, see "UPGRADING FROM v1" in
 * SETUP_GUIDE.md before pasting this in — the Marks tab gets new columns.
 */

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — edit this list once, right now, with real names and PINs.
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
  USERS: "Users",
  MARKS: "Marks",
  TASKS: "Tasks",
  SUBMISSIONS: "Submissions",
  ESCALATIONS: "Escalations",
};

// Marks now carries new input fields: mockNumber, previewDone, peerRating,
// punctual, editedBy — on top of the original quizScore/submission/attendance.
const HEADERS = {
  Users:       ["name", "role", "team", "pin"],
  Marks:       ["id", "member", "team", "cycle", "mockNumber", "quizScore", "submission", "attendance", "previewDone", "peerRating", "punctual", "notes", "editedBy", "timestamp"],
  Tasks:       ["id", "title", "description", "team", "dueDate", "fileUrl", "createdBy", "status", "timestamp"],
  Submissions: ["id", "taskId", "member", "team", "content", "fileUrl", "timestamp"],
  Escalations: ["id", "raisedBy", "team", "topic", "details", "severity", "status", "timestamp"],
};

// ─────────────────────────────────────────────────────────────────────────
// SETUP — run this once from the Apps Script editor
// ─────────────────────────────────────────────────────────────────────────
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_NAMES).forEach(key => {
    const name = SHEET_NAMES[key];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
    sheet.setFrozenRows(1);
  });

  const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const rows = PEOPLE.map(p => [p[0], p[1], p[2], p[3]]);
  usersSheet.getRange(2, 1, rows.length, 4).setValues(rows);

  Logger.log("Setup complete. " + rows.length + " users created.");
}

// ─────────────────────────────────────────────────────────────────────────
// WEB API
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

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

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

    // NEW: edit an existing mark — instructor and group leader only.
    // body.fields = {columnName: newValue, ...} — any Marks column.
    if (action === "editMark") {
      requireRole(body, ["group_leader", "instructor"]);
      updateRow(ss, SHEET_NAMES.MARKS, body.id, body.fields, body.editedBy || body.name);
      return json({ ok: true });
    }

    // NEW: delete a mark row entirely — instructor only (correcting bad data).
    if (action === "deleteMark") {
      requireRole(body, ["instructor"]);
      deleteRow(ss, SHEET_NAMES.MARKS, body.id);
      return json({ ok: true });
    }

    if (action === "addTask") {
      requireRole(body, ["group_leader", "instructor"]);
      appendRow(ss, SHEET_NAMES.TASKS, [
        newId(), body.title, body.description || "", body.team,
        body.dueDate || "", body.fileUrl || "", body.createdBy, "open",
        new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "updateTaskStatus") {
      requireRole(body, ["group_leader", "team_leader", "instructor"]);
      updateCell(ss, SHEET_NAMES.TASKS, body.id, "status", body.status);
      return json({ ok: true });
    }

    // NEW: instructor/group leader can edit any task field (title, due date, etc).
    if (action === "editTask") {
      requireRole(body, ["group_leader", "instructor"]);
      updateRow(ss, SHEET_NAMES.TASKS, body.id, body.fields, null);
      return json({ ok: true });
    }

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

    return json({ ok: false, error: "Unknown action." });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function findUser(ss, name, pin) {
  const users = sheetToObjects(ss.getSheetByName(SHEET_NAMES.USERS));
  return users.find(u =>
    String(u.name).trim().toLowerCase() === name.toLowerCase() &&
    String(u.pin).trim() === pin
  );
}

function requireRole(body, allowed) {
  if (!allowed.includes(body.role)) {
    throw new Error("Not authorized for this action.");
  }
}

function buildDashboard(ss, role, team, name) {
  const tasks = sheetToObjects(ss.getSheetByName(SHEET_NAMES.TASKS));
  const marks = sheetToObjects(ss.getSheetByName(SHEET_NAMES.MARKS));
  const subs = sheetToObjects(ss.getSheetByName(SHEET_NAMES.SUBMISSIONS));
  const escalations = sheetToObjects(ss.getSheetByName(SHEET_NAMES.ESCALATIONS));
  const metrics = computeMemberMetrics(marks, escalations);

  // Instructor sees everything the group leader sees, plus canEdit so the
  // frontend shows edit/delete controls on every mark and task.
  if (role === "instructor") {
    return {
      tasks: tasks, marks: marks, submissions: subs, escalations: escalations,
      teamAverages: computeTeamAverages(marks),
      memberMetrics: metrics,
      atRiskMembers: Object.values(metrics).filter(m => m.atRisk),
      canEdit: true,
    };
  }

  if (role === "group_leader" || role === "assistant") {
    return {
      tasks: tasks, marks: marks, submissions: subs, escalations: escalations,
      teamAverages: computeTeamAverages(marks),
      memberMetrics: metrics,
      atRiskMembers: Object.values(metrics).filter(m => m.atRisk),
      canEdit: role === "group_leader", // Sajal (assistant) stays read-only
    };
  }

  if (role === "team_leader") {
    const teamMetrics = {};
    Object.keys(metrics).forEach(m => { if (metrics[m].team === team) teamMetrics[m] = metrics[m]; });
    return {
      tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
      marks: marks.filter(m => m.team === team),
      submissions: subs.filter(s => s.team === team),
      escalations: escalations.filter(es => es.team === team),
      teamAverage: computeTeamAverages(marks)[team] || null,
      memberMetrics: teamMetrics,
      atRiskMembers: Object.values(teamMetrics).filter(m => m.atRisk),
    };
  }

  // member — sees only their own metrics, plus team average
  const myMarks = marks.filter(m => m.member === name);
  const teamAvg = computeTeamAverages(marks)[team] || null;
  return {
    tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
    myMarks: myMarks,
    teamAverage: teamAvg,
    mySubmissions: subs.filter(s => s.member === name),
    myMetrics: metrics[name] || null,
  };
}

function computeTeamAverages(marks) {
  const byTeam = {};
  marks.forEach(m => {
    const score = Number(m.quizScore);
    if (isNaN(score)) return;
    if (!byTeam[m.team]) byTeam[m.team] = [];
    byTeam[m.team].push(score);
  });
  const result = {};
  Object.keys(byTeam).forEach(team => {
    const arr = byTeam[team];
    result[team] = round1(arr.reduce((a, b) => a + b, 0) / arr.length);
  });
  return result;
}

/**
 * Per-member metrics beyond the raw marks table:
 *   streak           — consecutive most-recent cycles with quizScore >= 50
 *                       AND submission marked done/yes
 *   improvementDelta — latest quizScore minus the cycle before it
 *   mockDelta        — latest mockNumber's score minus the previous
 *                       mockNumber's score (sprint weeks only)
 *   avgPeerRating    — mean of peerRating entries (1-5 scale)
 *   previewRate      — % of cycles where previewDone was marked yes
 *   punctualityRate  — % of cycles where punctual was marked yes
 *   doubtCount       — number of escalations raisedBy this member
 *   atRisk           — true if the two most recent cycles each failed
 *                       (missing submission OR quizScore < 50)
 */
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

    let improvementDelta = null;
    const scored = rows.filter(r => r.quizScore !== "" && !isNaN(Number(r.quizScore)));
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
      member,
      team, streak, improvementDelta, mockDelta, avgPeerRating,
      previewRate, punctualityRate, doubtCount, atRisk,
    };
  });
  return result;
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

function sheetToObjects(sheet) {
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

function appendRow(ss, sheetName, rowArray) {
  ss.getSheetByName(sheetName).appendRow(rowArray);
}

function updateCell(ss, sheetName, id, columnName, value) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("id");
  const targetCol = headers.indexOf(columnName);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.getRange(i + 1, targetCol + 1).setValue(value);
      return;
    }
  }
  throw new Error("Row with id " + id + " not found in " + sheetName);
}

// NEW: patch several fields on one row at once, e.g. fields = {quizScore: 72, notes: "re-marked"}.
// If editedByName is given and the sheet has an "editedBy" column, stamps who made the edit.
function updateRow(ss, sheetName, id, fields, editedByName) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("id");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      Object.keys(fields).forEach(col => {
        const colIndex = headers.indexOf(col);
        if (colIndex !== -1) sheet.getRange(i + 1, colIndex + 1).setValue(fields[col]);
      });
      const editedByCol = headers.indexOf("editedBy");
      if (editedByCol !== -1 && editedByName) {
        sheet.getRange(i + 1, editedByCol + 1).setValue(editedByName);
      }
      return;
    }
  }
  throw new Error("Row with id " + id + " not found in " + sheetName);
}

// NEW: delete a row by id.
function deleteRow(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("id");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error("Row with id " + id + " not found in " + sheetName);
}

function newId() {
  return Utilities.getUuid().slice(0, 8);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
