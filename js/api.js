/**
 * EconomicsPortal — API Client (v6)
 *
 * Every call goes through `call()`, which attaches the signed session token
 * and sends the request either to the live Google Apps Script backend or to
 * the in-browser demo backend (js/demoServer.js, loaded only in Demo Mode),
 * which enforces the same rules. The server decides who you are from the
 * token; role/name fields in a payload are ignored.
 *
 * Sign-in and every write return the updated dashboard, so the page never
 * needs a second request. The latest dashboard is kept in memory and in
 * sessionStorage (this tab only, never localStorage) so a refresh can show it
 * instantly.
 */

import { API_URL, isDemoMode } from './config.js';
import { getSessionToken, getCurrentUser, clearCurrentUser, updateSessionToken, getDeviceId } from './auth.js';
import { normalizeUserName } from './utils.js';

export { normalizeUserName };

const demoBackend = () => import('./demoServer.js');

export async function resetDemoData() {
  const demo = await demoBackend();
  return demo.resetDemoStore();
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

// ── Latest dashboard ────────────────────────────────────────────────────────
const DASH_PREFIX = 'economics_portal_dash_v1:';
let latest = null; // { key, data, at, fresh }

function dashKey() {
  const user = getCurrentUser();
  return user ? DASH_PREFIX + (isDemoMode() ? 'demo:' : '') + normalizeUserName(user.name) : '';
}

function rememberDashboard(data) {
  const key = dashKey();
  if (!key) return;
  latest = { key, data, at: Date.now(), fresh: true };
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, at: latest.at }));
  } catch (e) {
    /* too big or storage unavailable: memory copy still works */
  }
  window.dispatchEvent(new CustomEvent('economics:synced', { detail: { at: latest.at } }));
}

/** The dashboard that just arrived with a sign-in or write, once. */
export function takeFreshDashboard() {
  if (latest && latest.fresh && latest.key === dashKey()) {
    latest.fresh = false;
    return latest.data;
  }
  return null;
}

/** The last dashboard this tab saw for the signed-in user (may be stale). */
export function getCachedDashboard() {
  const key = dashKey();
  if (!key) return null;
  if (latest && latest.key === key) return { data: latest.data, at: latest.at };
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && saved.data) return saved;
  } catch (e) {
    /* ignore */
  }
  return null;
}

export function lastSyncedAt() {
  const cached = getCachedDashboard();
  return cached ? cached.at : null;
}

export function forgetDashboards() {
  latest = null;
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(DASH_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch (e) {
    /* ignore */
  }
}

async function call(action, payload = {}, { withToken = true } = {}) {
  const body = { ...payload, action };
  if (withToken) body.token = getSessionToken();

  const res = isDemoMode()
    ? await (await demoBackend()).handleDemoRequest(body)
    : await postToAppsScript(body);

  if (res && res.code === 'AUTH') {
    clearCurrentUser();
    forgetDashboards();
    window.dispatchEvent(new CustomEvent('economics:session-expired'));
    return res;
  }
  // Sliding renewal: the server sends a new token near the end of the old one.
  const isSignIn = action === 'login' || action === 'googleLogin';
  if (res && res.ok && res.token && !isSignIn) updateSessionToken(res.token);
  if (res && res.ok && res.data && !isSignIn) rememberDashboard(res.data);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
export async function apiLogin(name, pin) {
  const res = await call(
    'login',
    { name: (name || '').trim(), pin: (pin || '').trim(), device: getDeviceId() },
    { withToken: false },
  );
  if (res && res.ok && res.user) {
    return { ...res, user: { ...res.user, token: res.token } };
  }
  return res;
}

/** Sign in with a Google ID token from the Google button. Same response as apiLogin. */
export async function apiGoogleLogin(credential) {
  const res = await call('googleLogin', { credential, device: getDeviceId() }, { withToken: false });
  if (res && res.ok && res.user) {
    return { ...res, user: { ...res.user, token: res.token } };
  }
  return res;
}

export const apiLinkGoogle = (credential) => call('linkGoogle', { credential });
export const apiUnlinkGoogle = () => call('unlinkGoogle');

/** Call after the session from apiLogin has been saved. */
export function acceptLoginDashboard(res) {
  if (res && res.data) rememberDashboard(res.data);
}

export async function apiChangeMyPin({ currentPin, newPin }) {
  return call('changeMyPin', { currentPin, newPin, device: getDeviceId() });
}

/** First names for the login form's suggestions (no token). */
export const apiNames = () => call('names', {}, { withToken: false });
export const apiHealth = () => call('health', {}, { withToken: false });
export const apiSetReminders = (payload) => call('setReminders', payload);

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
