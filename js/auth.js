/**
 * EconomicsPortal — Authentication & Session Manager
 */

const STORAGE_KEY = "economics_portal_session_v1";

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse user session", e);
    return null;
  }
}

export function setCurrentUser(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error("Failed to persist user session", e);
  }
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear user session", e);
  }
}
