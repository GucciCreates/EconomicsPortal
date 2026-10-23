/**
 * EconomicsPortal — API Client
 * 
 * Supports both:
 * 1. Live Google Apps Script Web App (production)
 * 2. In-browser simulated database (instant demo / fallback mode)
 */

import { API_URL, isDemoMode } from "./config.js";
import {
  MOCK_USERS,
  MOCK_TASKS,
  MOCK_MARKS,
  MOCK_SUBMISSIONS,
  MOCK_ESCALATIONS,
  computeMockTeamAverages
} from "./mockData.js";

// Persistent in-memory/localStorage store for Demo Mode
const DEMO_STORAGE_KEY = "economics_portal_demo_db_v1";

function getDemoStore() {
  try {
    const cached = localStorage.getItem(DEMO_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.warn("Could not read demo storage", e);
  }
  const initial = {
    users: [...MOCK_USERS],
    tasks: [...MOCK_TASKS],
    marks: [...MOCK_MARKS],
    submissions: [...MOCK_SUBMISSIONS],
    escalations: [...MOCK_ESCALATIONS],
  };
  saveDemoStore(initial);
  return initial;
}

function saveDemoStore(store) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn("Could not save demo storage", e);
  }
}

export function resetDemoData() {
  localStorage.removeItem(DEMO_STORAGE_KEY);
  return getDemoStore();
}

/**
 * Universal POST helper
 * Google Apps Script Web Apps require 'text/plain;charset=utf-8' with stringified body
 * to prevent CORS preflight OPTIONS failures.
 */
async function postToAppsScript(body) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Universal GET helper
 */
async function getFromAppsScript(params) {
  const query = new URLSearchParams(params).toString();
  const response = await fetch(`${API_URL}?${query}`);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH: LOGIN
// ─────────────────────────────────────────────────────────────────────────────
export async function apiLogin(name, pin) {
  const cleanName = (name || "").trim();
  const cleanPin = (pin || "").trim();

  if (isDemoMode()) {
    const store = getDemoStore();
    const user = store.users.find(
      (u) =>
        u.name.toLowerCase() === cleanName.toLowerCase() &&
        String(u.pin).trim() === cleanPin
    );
    if (!user) {
      return { ok: false, error: "Invalid name or PIN. (Demo mode: try Shehroz / 1111, Amina / 2001, or Ramesh / 2002)" };
    }
    return {
      ok: true,
      user: { name: user.name, role: user.role, team: user.team },
      demo: true,
    };
  }

  return await getFromAppsScript({
    action: "login",
    name: cleanName,
    pin: cleanPin,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD DATA
// ─────────────────────────────────────────────────────────────────────────────
export async function apiGetDashboard(role, team, name) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const tasks = store.tasks;
    const marks = store.marks;
    const subs = store.submissions;
    const escalations = store.escalations;
    const teamAverages = computeMockTeamAverages(marks);

    if (role === "group_leader" || role === "assistant") {
      return {
        ok: true,
        data: {
          tasks,
          marks,
          submissions: subs,
          escalations,
          teamAverages,
        },
      };
    }

    if (role === "team_leader") {
      return {
        ok: true,
        data: {
          tasks: tasks.filter((t) => t.team === team || t.team === "ALL"),
          marks: marks.filter((m) => m.team === team),
          submissions: subs.filter((s) => s.team === team),
          escalations: escalations.filter((es) => es.team === team),
          teamAverage: teamAverages[team] || null,
        },
      };
    }

    // member / instructor
    return {
      ok: true,
      data: {
        tasks: tasks.filter((t) => t.team === team || t.team === "ALL"),
        myMarks: marks.filter((m) => m.member.toLowerCase() === name.toLowerCase()),
        teamAverage: teamAverages[team] || null,
        mySubmissions: subs.filter((s) => s.member.toLowerCase() === name.toLowerCase()),
      },
    };
  }

  return await getFromAppsScript({
    action: "dashboard",
    role,
    team,
    name,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATIONS (POST)
// ─────────────────────────────────────────────────────────────────────────────

export async function apiAddMark(payload) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const newMark = {
      id: "mk-" + Math.random().toString(36).substr(2, 6),
      member: payload.member,
      team: payload.team,
      cycle: payload.cycle,
      quizScore: Number(payload.quizScore),
      submission: payload.submission,
      attendance: payload.attendance,
      notes: payload.notes || "",
      timestamp: new Date().toISOString(),
    };
    store.marks.unshift(newMark);
    saveDemoStore(store);
    return { ok: true };
  }

  return await postToAppsScript({
    action: "addMark",
    ...payload,
  });
}

export async function apiAddTask(payload) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const newTask = {
      id: "tsk-" + Math.random().toString(36).substr(2, 6),
      title: payload.title,
      description: payload.description || "",
      team: payload.team,
      dueDate: payload.dueDate || "",
      fileUrl: payload.fileUrl || "",
      createdBy: payload.createdBy,
      status: "open",
      timestamp: new Date().toISOString(),
    };
    store.tasks.unshift(newTask);
    saveDemoStore(store);
    return { ok: true };
  }

  return await postToAppsScript({
    action: "addTask",
    ...payload,
  });
}

export async function apiUpdateTaskStatus(id, status, role) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const task = store.tasks.find((t) => t.id === id);
    if (task) {
      task.status = status;
      saveDemoStore(store);
    }
    return { ok: true };
  }

  return await postToAppsScript({
    action: "updateTaskStatus",
    role,
    id,
    status,
  });
}

export async function apiAddSubmission(payload) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const newSub = {
      id: "sub-" + Math.random().toString(36).substr(2, 6),
      taskId: payload.taskId,
      member: payload.member,
      team: payload.team,
      content: payload.content || "",
      fileUrl: payload.fileUrl || "",
      timestamp: new Date().toISOString(),
    };
    store.submissions.unshift(newSub);
    saveDemoStore(store);
    return { ok: true };
  }

  return await postToAppsScript({
    action: "addSubmission",
    ...payload,
  });
}

export async function apiAddEscalation(payload) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const newEsc = {
      id: "esc-" + Math.random().toString(36).substr(2, 6),
      raisedBy: payload.raisedBy,
      team: payload.team,
      topic: payload.topic,
      details: payload.details,
      severity: payload.severity || "normal",
      status: "open",
      timestamp: new Date().toISOString(),
    };
    store.escalations.unshift(newEsc);
    saveDemoStore(store);
    return { ok: true };
  }

  return await postToAppsScript({
    action: "addEscalation",
    ...payload,
  });
}

export async function apiUpdateEscalationStatus(id, status, role) {
  if (isDemoMode()) {
    const store = getDemoStore();
    const esc = store.escalations.find((e) => e.id === id);
    if (esc) {
      esc.status = status;
      saveDemoStore(store);
    }
    return { ok: true };
  }

  return await postToAppsScript({
    action: "updateEscalationStatus",
    role,
    id,
    status,
  });
}
