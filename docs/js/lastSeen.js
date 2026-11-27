/**
 * EconomicsPortal — "New since your last visit"
 *
 * Remembers, per user and per section, when the user last opened it
 * (localStorage, this device only). On a user's very first visit nothing is
 * marked new; from then on anything newer than the last visit is.
 */

import { normalizeUserName } from './demoServer.js';

const PREFIX = 'economics_portal_last_seen_v1:';

function key(user) {
  return PREFIX + normalizeUserName(user && user.name);
}

function read(user) {
  try {
    return JSON.parse(localStorage.getItem(key(user)) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function write(user, data) {
  try {
    localStorage.setItem(key(user), JSON.stringify(data));
  } catch (e) {
    /* storage unavailable: badges just won't persist */
  }
}

/**
 * Returns a snapshot { section: timestampMs } for this render. Sections never
 * seen before are baselined to "now" so a first visit shows nothing as new.
 */
export function loadLastSeen(user, sections) {
  const data = read(user);
  const now = Date.now();
  let changed = false;
  sections.forEach((s) => {
    if (typeof data[s] !== 'number') {
      data[s] = now;
      changed = true;
    }
  });
  if (changed) write(user, data);
  return { ...data };
}

export function markSeen(user, section) {
  const data = read(user);
  data[section] = Date.now();
  write(user, data);
}

export function toTime(v) {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function isNewer(v, since) {
  return toTime(v) > (since || 0);
}

/** Small "NEW" pill for items newer than `since`. */
export function newPill(v, since) {
  return isNewer(v, since) ? '<span class="new-pill">New</span>' : '';
}
