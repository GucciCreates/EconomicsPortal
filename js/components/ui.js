/**
 * EconomicsPortal — small shared UI helpers used by every tab.
 *
 * - bindActions(): one delegated listener per event type for a whole tab, so
 *   re-rendering part of a tab never needs listeners re-attached.
 * - runAction(): the busy-button → API call → toast → refresh pattern.
 * - emptyState(): the same "nothing here yet, here's what to do" block everywhere.
 */
import { esc } from '../utils.js';
import { describeApiError } from '../api.js';

export const TEAMS = ['Shehroz', 'Amina', 'Ayesha', 'Lareb'];

/** [{ name, team }] for everyone who gets marks. Comes only from the server (never shipped in code). */
export function rosterList(data) {
  return data && Array.isArray(data.roster) ? data.roster.map((r) => ({ name: r.name, team: r.team })) : [];
}

/**
 * @param {HTMLElement} root
 * @param {{ click?: object, submit?: object, change?: object, input?: object }} handlers
 *   Keyed by the element's data-action (click/change/input) or form's data-form (submit).
 *   Each handler is (element, event) => void.
 */
export function bindActions(root, handlers) {
  if (handlers.click) {
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el)) return;
      const fn = handlers.click[el.dataset.action];
      if (fn) fn(el, e);
    });
  }
  if (handlers.submit) {
    root.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-form]');
      if (!form || !root.contains(form)) return;
      const fn = handlers.submit[form.dataset.form];
      if (!fn) return;
      e.preventDefault();
      fn(form, e);
    });
  }
  ['change', 'input'].forEach((type) => {
    if (!handlers[type]) return;
    root.addEventListener(type, (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el)) return;
      const fn = handlers[type][el.dataset.action];
      if (fn) fn(el, e);
    });
  });
}

export function toast(message, type = 'info') {
  if (window.showEconomicsToast) window.showEconomicsToast(message, type);
}

/**
 * Disable `button` (showing `busyLabel`), run `call`, then toast the result.
 * On success: toast `success` (if given) and call `onDone(res)`.
 * @returns {Promise<object|null>} the API response, or null on a network error
 */
export async function runAction(button, busyLabel, call, { success, onDone, onError } = {}) {
  const label = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    if (busyLabel) button.textContent = busyLabel;
  }
  try {
    const res = await call();
    if (res && res.ok) {
      if (success) toast(success, 'success');
      if (onDone) onDone(res);
    } else if (res && res.code !== 'AUTH') {
      const msg = res.error || 'That didn’t work. Try again.';
      if (onError) onError(msg);
      else toast(msg, 'error');
    }
    return res;
  } catch (err) {
    const msg = describeApiError(err);
    if (onError) onError(msg);
    else toast(msg, 'error');
    return null;
  } finally {
    if (button && button.isConnected) {
      button.disabled = false;
      if (busyLabel) button.textContent = label;
    }
  }
}

/** Inline alert HTML for a form's feedback area. `message` is plain text. */
export function alertHtml(message, type = 'error') {
  return `<div class="alert alert-${esc(type)}" role="${type === 'error' ? 'alert' : 'status'}">${esc(message)}</div>`;
}

/**
 * "Nothing here yet" block. `message` and `hint` are plain text; `actionHtml`
 * is trusted markup (e.g. a button) placed under them.
 */
export function emptyState(message, hint = '', actionHtml = '') {
  return `
    <div class="empty-state">
      <p class="empty-state-title">${esc(message)}</p>
      ${hint ? `<p class="empty-state-hint">${esc(hint)}</p>` : ''}
      ${actionHtml}
    </div>`;
}

/** <option>s for a team picker. */
export function teamOptions(selected = 'ALL', { includeAll = true } = {}) {
  const opts = includeAll ? [['ALL', 'All teams']] : [];
  TEAMS.forEach((t) => opts.push([t, `Team ${t}`]));
  return opts
    .map(([v, label]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`)
    .join('');
}

/** Team chip. */
export function teamChip(team) {
  return `<span class="chip">${esc(team === 'ALL' ? 'All teams' : team)}</span>`;
}

/** Copy text to the clipboard; falls back to a prompt. Resolves true if copied. */
export async function copyText(text, promptLabel = 'Copy this text:') {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    window.prompt(promptLabel, text);
    return false;
  }
}

/**
 * Pressing Enter in a field moves to the next field instead of submitting;
 * Enter in the last field submits. Textareas keep their normal Enter.
 */
export function enterMovesToNextField(form) {
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    if (el.type === 'checkbox' || el.type === 'submit') return;
    const fields = [...form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])')]
      .filter((f) => f.offsetParent !== null);
    const i = fields.indexOf(el);
    if (i === -1) return;
    e.preventDefault();
    if (i < fields.length - 1) fields[i + 1].focus();
    else form.requestSubmit(form.querySelector('button[type="submit"]'));
  });
}

/** Same person? (names are compared case-insensitively). */
export function sameName(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}
