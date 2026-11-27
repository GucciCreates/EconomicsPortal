/**
 * EconomicsPortal — Header account menu: "Change my PIN" and "Log out".
 */

import { apiChangeMyPin } from '../api.js';
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
        <span>${esc(user.name)}</span>
        <span class="role-pill role-${esc(user.role)}">${esc(String(user.role).replace('_', ' '))}</span>
        <span aria-hidden="true">▾</span>
      </button>
      <div class="account-menu-list" id="account-menu-list" role="menu" hidden>
        <button type="button" role="menuitem" class="account-menu-item" id="btn-change-my-pin">🔑 Change my PIN</button>
        <button type="button" role="menuitem" class="account-menu-item" id="btn-logout">↩ Log out</button>
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
  host.querySelector('#btn-change-my-pin').addEventListener('click', () => {
    setOpen(false);
    openChangeMyPinModal();
  });
}

export function openChangeMyPinModal() {
  const pinInput = (id, label, autocomplete) => `
    <div class="form-group">
      <label class="form-label" for="${id}">${label}</label>
      <input type="password" id="${id}" class="form-control pin-input" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" minlength="4" autocomplete="${autocomplete}" required />
    </div>`;
  const { dialog, close } = openModal({
    title: 'Change my PIN',
    bodyHtml: `
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.85rem;">
        You'll stay signed in here. Any other device using your account will be signed out.
      </p>
      <div id="my-pin-feedback" aria-live="polite"></div>
      <form id="form-change-my-pin" novalidate>
        ${pinInput('my-pin-current', 'Current PIN', 'current-password')}
        ${pinInput('my-pin-new', 'New 4-digit PIN', 'new-password')}
        ${pinInput('my-pin-confirm', 'Type the new PIN again', 'new-password')}
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" data-modal-close style="flex: 1;">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-my-pin" style="flex: 2;">Change PIN</button>
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
    if (!/^\d{4}$/.test(currentPin)) return showError('Enter your current 4-digit PIN.');
    if (!/^\d{4}$/.test(newPin)) return showError('Your new PIN must be exactly 4 digits.');
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
