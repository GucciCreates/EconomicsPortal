/**
 * EconomicsPortal — Header account menu: "Sign in with Google" (once the
 * owner has turned it on), "Change my PIN", "Email reminders" and "Log out".
 */

import { apiChangeMyPin, apiLinkGoogle, apiSetReminders, apiUnlinkGoogle, getCachedDashboard } from '../api.js';
import { cachedGoogleClientId, renderGoogleButton } from '../googleSignIn.js';
import { getCurrentUser } from '../auth.js';
import { isDemoMode } from '../config.js';
import { esc } from '../utils.js';
import { openModal } from './modal.js';

/**
 * @param {HTMLElement} host - element to render the menu into
 * @param {object} user
 * @param {Function} onLogout
 */
export function renderAccountMenu(host, user, onLogout) {
  host.innerHTML = `
    <div class="account-menu">
      <button type="button" class="user-badge account-menu-trigger" id="btn-account-menu" aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu-list">
        <span class="user-initial" aria-hidden="true">${esc(String(user.name || '?').trim().charAt(0).toUpperCase())}</span>
        <span>${esc(user.name)}</span>
        <span class="role-pill role-${esc(user.role)}">${esc(String(user.role).replace('_', ' '))}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div class="account-menu-list" id="account-menu-list" role="menu" hidden>
        ${googleAvailable() ? '<button type="button" role="menuitem" class="account-menu-item" id="btn-google-link">Sign in with Google</button>' : ''}
        <button type="button" role="menuitem" class="account-menu-item" id="btn-change-my-pin">Change my PIN</button>
        <button type="button" role="menuitem" class="account-menu-item" id="btn-email-reminders">Email reminders</button>
        <button type="button" role="menuitem" class="account-menu-item" id="btn-logout">Log out</button>
      </div>
    </div>
  `;

  const trigger = host.querySelector('#btn-account-menu');
  const list = host.querySelector('#account-menu-list');
  const items = () => [...list.querySelectorAll('[role="menuitem"]')];

  const setOpen = (open, focusFirst = false) => {
    list.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open && focusFirst) items()[0].focus();
  };

  trigger.addEventListener('click', () => setOpen(list.hidden, true));
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true, true);
    }
  });
  list.addEventListener('keydown', (e) => {
    const all = items();
    const i = all.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      setOpen(false);
      trigger.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      all[(i + 1) % all.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      all[(i - 1 + all.length) % all.length].focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!host.contains(e.target)) setOpen(false);
  });

  host.querySelector('#btn-logout').addEventListener('click', () => {
    setOpen(false);
    onLogout();
  });
  const googleItem = host.querySelector('#btn-google-link');
  if (googleItem) {
    googleItem.addEventListener('click', () => {
      setOpen(false);
      openGoogleLinkModal();
    });
  }
  host.querySelector('#btn-change-my-pin').addEventListener('click', () => {
    setOpen(false);
    openChangeMyPinModal();
  });
  host.querySelector('#btn-email-reminders').addEventListener('click', () => {
    setOpen(false);
    openRemindersModal();
  });
}

function googleAvailable() {
  return !isDemoMode() && Boolean(cachedGoogleClientId());
}

/** Link (or unlink) a Google account so next time is one tap. */
export function openGoogleLinkModal() {
  const cached = getCachedDashboard();
  const me = (cached && cached.data && cached.data.me) || {};
  const linked = String(me.googleEmail || '');
  const { dialog, close } = openModal({
    title: 'Sign in with Google',
    bodyHtml: linked
      ? `
      <p class="modal-intro">You can sign in with the Google account <strong>${esc(linked)}</strong>. Your name and PIN still work too.</p>
      <div id="google-link-feedback" aria-live="polite"></div>
      <div class="modal-btn-row">
        <button type="button" class="btn btn-secondary" data-modal-close>Close</button>
        <button type="button" class="btn btn-danger" id="btn-unlink-google">Stop using Google</button>
      </div>`
      : `
      <p class="modal-intro">
        Choose your Google account below. After that, the Google button on the sign-in page signs you in with one tap,
        with no PIN to type. Your name and PIN keep working as a backup.
      </p>
      <div id="google-link-feedback" aria-live="polite"></div>
      <div class="google-btn-host google-link-status" id="google-link-host"></div>
      <div class="modal-btn-row">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      </div>`,
  });
  const feedback = dialog.querySelector('#google-link-feedback');
  const showError = (msg) => (feedback.innerHTML = `<div class="alert alert-error" role="alert">${esc(msg)}</div>`);

  if (linked) {
    const btn = dialog.querySelector('#btn-unlink-google');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await apiUnlinkGoogle();
        if (res.ok) {
          close();
          window.showEconomicsToast('Google sign-in turned off for your account.', 'success');
        } else if (res.code !== 'AUTH') showError(res.error || 'Could not save.');
      } catch (err) {
        showError("Can't reach the class server. Try again in a moment.");
      } finally {
        btn.disabled = false;
      }
    });
    return;
  }

  renderGoogleButton(
    dialog.querySelector('#google-link-host'),
    cachedGoogleClientId(),
    async (credential) => {
      feedback.innerHTML = '<div class="alert alert-info" role="status">Linking your Google account…</div>';
      try {
        const res = await apiLinkGoogle(credential);
        if (res.ok) {
          close();
          window.showEconomicsToast(`Done. Next time, sign in with Google as ${res.googleEmail}.`, 'success');
        } else if (res.code !== 'AUTH') showError(res.error || 'Could not link that account.');
      } catch (err) {
        showError("Can't reach the class server. Try again in a moment.");
      }
    },
    { text: 'continue_with' },
  ).then((ok) => {
    if (!ok) showError("Google's sign-in button couldn't load. Check your connection or turn off any blocker for accounts.google.com.");
  });
}

const LONG_PIN_ROLES = ['instructor', 'group_leader', 'assistant'];

/** Shortest new PIN this person may choose (same rule as the server). */
export function minPinLengthFor(role) {
  return LONG_PIN_ROLES.includes(role) ? 6 : 4;
}

export function openRemindersModal() {
  const cached = getCachedDashboard();
  const me = (cached && cached.data && cached.data.me) || { email: '', reminders: false };
  const { dialog, close } = openModal({
    title: 'Email reminders',
    bodyHtml: `
      <p class="modal-intro">
        Get an email around 7 AM when a task for your team is due within 24 hours and you haven't submitted it.
        Your email address is only visible to you.
      </p>
      ${isDemoMode() ? '<p class="form-hint">Demo: settings are saved for this tab only and no emails are sent.</p>' : ''}
      <div id="reminders-feedback" aria-live="polite"></div>
      <form id="form-reminders" novalidate>
        <div class="form-group">
          <label class="form-label" for="reminders-email">Email address</label>
          <input type="email" id="reminders-email" class="form-control" autocomplete="email" value="${esc(me.email)}" placeholder="you@example.com" />
        </div>
        <div class="form-group">
          <label class="custom-checkbox-label">
            <input type="checkbox" id="reminders-on" ${me.reminders ? 'checked' : ''} />
            <span>Email me about deadlines</span>
          </label>
        </div>
        <div class="modal-btn-row">
          <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-reminders">Save</button>
        </div>
      </form>
    `,
  });
  const form = dialog.querySelector('#form-reminders');
  const feedback = dialog.querySelector('#reminders-feedback');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = dialog.querySelector('#reminders-email').value.trim();
    const reminders = dialog.querySelector('#reminders-on').checked;
    if (reminders && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.innerHTML = '<div class="alert alert-error">Enter a valid email address to turn reminders on.</div>';
      return;
    }
    const btn = dialog.querySelector('#btn-save-reminders');
    btn.disabled = true;
    try {
      const res = await apiSetReminders({ email, reminders });
      if (res.ok) {
        close();
        window.showEconomicsToast(reminders ? 'Deadline reminders turned on.' : 'Deadline reminders turned off.', 'success');
      } else if (res.code !== 'AUTH') {
        feedback.innerHTML = `<div class="alert alert-error">${esc(res.error || 'Could not save.')}</div>`;
      }
    } catch (err) {
      feedback.innerHTML = '<div class="alert alert-error">Can\'t reach the class server. Try again in a moment.</div>';
    } finally {
      btn.disabled = false;
    }
  });
}

export function openChangeMyPinModal() {
  const user = getCurrentUser() || {};
  const min = minPinLengthFor(user.role);
  const pinInput = (id, label, autocomplete, minLen) => `
    <div class="form-group">
      <label class="form-label" for="${id}">${label}</label>
      <input type="password" id="${id}" class="form-control pin-input" inputmode="numeric" pattern="[0-9]{${minLen},8}" maxlength="8" minlength="${minLen}" autocomplete="${autocomplete}" required />
    </div>`;
  const { dialog, close } = openModal({
    title: 'Change my PIN',
    bodyHtml: `
      <p class="modal-intro">
        You'll stay signed in here. Any other device using your account will be signed out.
      </p>
      <div id="my-pin-feedback" aria-live="polite"></div>
      <form id="form-change-my-pin" novalidate>
        ${pinInput('my-pin-current', 'Current PIN', 'current-password', 4)}
        ${pinInput('my-pin-new', `New PIN (${min} to 8 digits)`, 'new-password', min)}
        ${pinInput('my-pin-confirm', 'Type the new PIN again', 'new-password', min)}
        <div class="modal-btn-row">
          <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-my-pin">Change PIN</button>
        </div>
      </form>
    `,
  });

  const form = dialog.querySelector('#form-change-my-pin');
  const feedback = dialog.querySelector('#my-pin-feedback');
  const saveBtn = dialog.querySelector('#btn-save-my-pin');
  const showError = (msg) => (feedback.innerHTML = `<div class="alert alert-error">${esc(msg)}</div>`);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPin = dialog.querySelector('#my-pin-current').value.trim();
    const newPin = dialog.querySelector('#my-pin-new').value.trim();
    const confirmPin = dialog.querySelector('#my-pin-confirm').value.trim();
    if (!/^\d{4,8}$/.test(currentPin)) return showError('Enter your current PIN.');
    if (!new RegExp(`^\\d{${min},8}$`).test(newPin)) return showError(`Your new PIN must be ${min} to 8 digits.`);
    if (newPin !== confirmPin) return showError('The two new PINs do not match.');
    if (newPin === currentPin) return showError('Choose a PIN that is different from your current one.');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try {
      const res = await apiChangeMyPin({ currentPin, newPin });
      if (res.ok) {
        close();
        window.showEconomicsToast('PIN changed. Other devices were signed out.', 'success');
      } else if (res.code !== 'AUTH') {
        showError(res.error || 'Could not change your PIN.');
      }
    } catch (err) {
      showError('Error: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Change PIN';
    }
  });
}
