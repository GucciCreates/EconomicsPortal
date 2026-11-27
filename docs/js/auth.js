/**
 * EconomicsPortal — Session storage
 *
 * The session is { name, role, team, token }. name/role/team are only used to
 * pick which dashboard to draw; the server re-checks everything from the
 * signed token. Sessions saved before v4 have no token and are discarded.
 */

const STORAGE_KEY = 'economics_portal_session_v1';

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || !user.token) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return user;
  } catch (e) {
    return null;
  }
}

export function getSessionToken() {
  const user = getCurrentUser();
  return user ? user.token : '';
}

export function setCurrentUser(user) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to persist user session', e);
  }
}

export function updateSessionToken(token) {
  const user = getCurrentUser();
  if (user) setCurrentUser({ ...user, token });
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    /* ignore */
  }
}
