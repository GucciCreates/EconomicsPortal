/**
 * EconomicsPortal — API Client (v4)
 *
 * Every call goes through `call()`, which attaches the signed session token
 * and sends the request either to the live Google Apps Script backend or to
 * the in-browser demo backend (js/demoServer.js), which enforces the same
 * rules. The server decides who you are from the token; role/name fields in
 * a payload are ignored.
 */

import { API_URL, isDemoMode } from './config.js';
import { getSessionToken, clearCurrentUser, updateSessionToken } from './auth.js';
import { handleDemoRequest, resetDemoStore, normalizeUserName } from './demoServer.js';

export { normalizeUserName };

export function resetDemoData() {
  return resetDemoStore();
}

/**
 * POST to Apps Script. Uses 'text/plain' with a JSON string body so the
 * browser does not send a CORS preflight, which Apps Script cannot answer.
 */
async function postToAppsScript(body) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

async function call(action, payload = {}, { withToken = true } = {}) {
  const body = { ...payload, action };
  if (withToken) body.token = getSessionToken();

  const res = isDemoMode() ? await handleDemoRequest(body) : await postToAppsScript(body);

  if (res && res.code === 'AUTH') {
    clearCurrentUser();
    window.dispatchEvent(new CustomEvent('economics:session-expired'));
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
export async function apiLogin(name, pin) {
  const res = await call(
    'login',
    { name: (name || '').trim(), pin: (pin || '').trim() },
    { withToken: false },
  );
  if (res && res.ok && res.user) {
    return { ...res, user: { ...res.user, token: res.token } };
  }
  return res;
}

export async function apiChangeMyPin({ currentPin, newPin }) {
  const res = await call('changeMyPin', { currentPin, newPin });
  if (res && res.ok && res.token) updateSessionToken(res.token);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────────────────────
export const apiGetDashboard = () => call('dashboard');
export const apiGetUsers = () => call('users');
export const apiGetAuditLog = (limit = 500) => call('auditLog', { limit });

// ─────────────────────────────────────────────────────────────────────────────
// MARKS
// ─────────────────────────────────────────────────────────────────────────────
export const apiAddMark = (payload) => call('addMark', payload);
export const apiEditMark = (payload) => call('editMark', payload);
export const apiDeleteMark = (payload) => call('deleteMark', payload);

// ─────────────────────────────────────────────────────────────────────────────
// TASKS & SUBMISSIONS
// ─────────────────────────────────────────────────────────────────────────────
export const apiAddTask = (payload) => call('addTask', payload);
export const apiEditTask = (payload) => call('editTask', payload);
export const apiUpdateTaskStatus = (id, status) => call('updateTaskStatus', { id, status });
export const apiAddSubmission = (payload) => call('addSubmission', payload);
export const apiRequestGrading = (payload) => call('requestGrading', payload);

// ─────────────────────────────────────────────────────────────────────────────
// DOUBTS & ESCALATIONS
// ─────────────────────────────────────────────────────────────────────────────
export const apiAddEscalation = (payload) => call('addEscalation', payload);
export const apiUpdateEscalationStatus = (id, status) => call('updateEscalationStatus', { id, status });
export const apiAddEscalationReply = (escalationId, message) =>
  call('addEscalationReply', { escalationId, message });

// ─────────────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS, QUIZZES, GOALS, TEAM MESSAGES
// ─────────────────────────────────────────────────────────────────────────────
export const apiAddAnnouncement = (payload) => call('addAnnouncement', payload);
export const apiDeleteAnnouncement = (payload) => call('deleteAnnouncement', payload);
export const apiPinAnnouncement = (payload) => call('pinAnnouncement', payload);
export const apiAddQuiz = (payload) => call('addQuiz', payload);
export const apiDeleteQuiz = (payload) => call('deleteQuiz', payload);
export const apiSetGoal = (payload) => call('setGoal', payload);
export const apiAddTeamMessage = (payload) => call('addTeamMessage', payload);
export const apiDeleteTeamMessage = (payload) => call('deleteTeamMessage', payload);

// ─────────────────────────────────────────────────────────────────────────────
// PINS & MENTORSHIP
// ─────────────────────────────────────────────────────────────────────────────
export const apiUpdatePin = (payload) => call('updatePin', payload);
export const apiCreateMentorshipPlan = (payload) => call('createMentorshipPlan', payload);
export const apiUpdateMentorshipStatus = (id, status) => call('updateMentorshipStatus', { id, status });
