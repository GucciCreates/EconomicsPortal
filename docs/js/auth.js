/**
 * EconomicsPortal — Session storage
 *
 * The session is { name, role, team, token }. name/role/team are only used to
 * pick which dashboard to draw; the server re-checks everything from the
 * signed token. Live sessions are kept in localStorage (they survive closing
 * the browser for up to 7 idle days); demo sessions only in sessionStorage.
 */
import { isDemoMode } from './config.js';

const STORAGE_KEY = 'economics_portal_session_v1';
const DEMO_KEY = 'economics_portal_demo_session_v1';
const DEVICE_KEY = 'economics_portal_device_v1';

function store() {
  return isDemoMode() ? sessionStorage : localStorage;
}
function storageKey() {
  return isDemoMode() ? DEMO_KEY : STORAGE_KEY;
}

export function getCurrentUser() {
  try {
    const raw = store().getItem(storageKey());
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user || !user.token) {
      store().removeItem(storageKey());
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
    store().setItem(storageKey(), JSON.stringify(user));
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
    store().removeItem(storageKey());
  } catch (e) {
    /* ignore */
  }
}

/**
 * A random ID for this browser. The server remembers devices that have signed
 * in before, so wrong guesses from elsewhere can't lock this device out.
 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch (e) {
    return '';
  }
}
