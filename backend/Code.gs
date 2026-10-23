/**
 * EconomicsPortal — Backend (Google Apps Script)
 * Account to use: bahriabatch30@gmail.com
 * Repo:           https://github.com/GucciCreates/EconomicsPortal
 *
 * This script turns a Google Sheet into a free JSON API for the three
 * dashboards (Group Leader, Team Leader, Member). It costs nothing,
 * never pauses, and needs no credit card.
 *
 * ───────────────────────────────────────────────────────────────────
 * ONE-TIME SETUP (see SETUP_GUIDE.md for screenshots-level detail)
 * ───────────────────────────────────────────────────────────────────
 * 1. Sign in to bahriabatch30@gmail.com
 * 2. Go to sheets.new — create a blank Google Sheet, name it "EconomicsPortalDB"
 * 3. Create these tabs (exact names, case-sensitive):
 *      Users, Marks, Tasks, Submissions, Escalations
 * 4. Add header rows exactly as shown in HEADERS below (row 1 of each tab)
 * 5. Extensions > Apps Script. Delete the sample code. Paste this whole file.
 * 6. Click the gear icon (Project Settings) > check "Show appsscript.json"
 *    not required; just click Deploy.
 * 7. Deploy > New deployment > type: Web app
 *      - Execute as: Me (bahriabatch30@gmail.com)
 *      - Who has access: Anyone
 * 8. Copy the Web App URL it gives you — that is API_URL for the frontend.
 * 9. Run the function `setup()` once from the Apps Script editor (select it
 *    in the dropdown, click Run) to seed header rows and the 17 people.
 *    The first run will ask you to authorize — approve it (it's your own script).
 */

// ─────────────────────────────────────────────────────────────────────────
// CONFIG — edit this list once, right now, with real names and PINs.
// PINs are 4 digits, chosen by you, given out privately to each person.
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

const HEADERS = {
  Users:       ["name", "role", "team", "pin"],
  Marks:       ["id", "member", "team", "cycle", "quizScore", "submission", "attendance", "notes", "timestamp"],
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
// doGet handles: login, dashboard data, lists
// doPost handles: adding marks, tasks, submissions, escalations
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
      // group leader only — pass role check from frontend, double-checked here
      if (e.parameter.role !== "group_leader") return json({ ok: false, error: "Not authorized." });
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
      requireRole(body, ["group_leader", "team_leader"]);
      appendRow(ss, SHEET_NAMES.MARKS, [
        newId(), body.member, body.team, body.cycle,
        body.quizScore, body.submission, body.attendance, body.notes || "",
        new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "addTask") {
      requireRole(body, ["group_leader"]);
      appendRow(ss, SHEET_NAMES.TASKS, [
        newId(), body.title, body.description || "", body.team,
        body.dueDate || "", body.fileUrl || "", body.createdBy, "open",
        new Date(),
      ]);
      return json({ ok: true });
    }

    if (action === "updateTaskStatus") {
      requireRole(body, ["group_leader", "team_leader"]);
      updateCell(ss, SHEET_NAMES.TASKS, body.id, "status", body.status);
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
      requireRole(body, ["group_leader"]);
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

  if (role === "group_leader" || role === "assistant") {
    return {
      tasks: tasks,
      marks: marks,
      submissions: subs,
      escalations: escalations,
      teamAverages: computeTeamAverages(marks),
    };
  }

  if (role === "team_leader") {
    return {
      tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
      marks: marks.filter(m => m.team === team),
      submissions: subs.filter(s => s.team === team),
      escalations: escalations.filter(es => es.team === team),
      teamAverage: computeTeamAverages(marks)[team] || null,
    };
  }

  // member or instructor
  const myMarks = marks.filter(m => m.member === name);
  const teamAvg = computeTeamAverages(marks)[team] || null;
  return {
    tasks: tasks.filter(t => t.team === team || t.team === "ALL"),
    myMarks: myMarks,
    teamAverage: teamAvg,
    mySubmissions: subs.filter(s => s.member === name),
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
    result[team] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  });
  return result;
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

function newId() {
  return Utilities.getUuid().slice(0, 8);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
