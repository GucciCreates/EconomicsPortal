/**
 * Leaders' "Admin" tab: data export, the activity log (instructor and group
 * leader) and PIN resets (group leader). The assistant sees only export.
 */

import { apiUpdatePin, apiGetUsers } from '../../api.js';
import { esc } from '../../utils.js';
import { renderExportToolbar } from '../exportUtils.js';
import { renderActivityLog } from '../activityLog.js';
import { openModal } from '../modal.js';
import { bindActions, runAction, alertHtml, emptyState, teamChip, sameName } from '../ui.js';

const LONG_PIN_ROLES = ['instructor', 'group_leader', 'assistant'];

export function renderAdminTab(panel, ctx) {
  const { data, canLead, isGroupLeader, isInstructor } = ctx;
  const canResetPins = isGroupLeader || isInstructor; // same rule as updatePin on the server
  panel.innerHTML = `
    ${canResetPins ? '<div id="pins-shell"></div>' : ''}
    <div id="export-shell"></div>
    ${canLead ? '<div id="activity-shell"></div>' : ''}
  `;
  if (canResetPins) renderPins(panel.querySelector('#pins-shell'), data);
  renderExportToolbar(panel.querySelector('#export-shell'), {
    marks: data.marks || [],
    submissions: data.submissions || [],
    memberMetrics: data.memberMetrics || {},
  });
  if (canLead) renderActivityLog(panel.querySelector('#activity-shell'));
}

async function renderPins(shell, data) {
  shell.innerHTML = `
    <section class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">PINs</h3>
          <p class="card-note">Nobody can see a PIN, including you. Reset one and tell the person the new PIN in person.</p>
        </div>
        <label class="sr-only" for="pins-search">Search people</label>
        <input type="search" id="pins-search" class="form-control form-control-sm" placeholder="Search by name" data-action="search" />
      </div>
      <div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead><tr><th>Name</th><th>Role</th><th>Team</th><th>PIN</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody id="pins-tbody"><tr><td colspan="5" class="muted">Loading…</td></tr></tbody>
        </table>
      </div>
      <p class="form-hint">Resetting signs that person out on every device. Instructor, group leader and assistant PINs must be at least 6 digits.</p>
    </section>
  `;

  let roster = data.users || [];
  if (!roster.length) {
    try {
      const res = await apiGetUsers();
      if (res.ok && res.users) roster = res.users;
    } catch (e) {
      /* table shows the empty state */
    }
  }
  if (!shell.isConnected) return;
  const tbody = shell.querySelector('#pins-tbody');

  function draw(q = '') {
    const list = roster.filter((m) => [m.name, m.team, m.role].some((v) => String(v).toLowerCase().includes(q.toLowerCase())));
    tbody.innerHTML = list.length
      ? list
          .map(
            (m) => `
        <tr data-member="${esc(m.name)}">
          <td data-label="Name"><strong>${esc(m.name)}</strong></td>
          <td data-label="Role"><span class="role-pill role-${esc(m.role)}">${esc(String(m.role).replace('_', ' '))}</span></td>
          <td data-label="Team">${m.team && m.team !== '-' ? teamChip(m.team) : '<span class="muted">—</span>'}</td>
          <td data-label="PIN">${m.hasPin ? '<span class="badge badge-done">Set</span>' : '<span class="badge badge-atrisk">Not set</span>'}</td>
          <td data-label="" class="actions-cell"><button type="button" class="btn btn-secondary btn-sm btn-change-member-pin" data-action="reset" data-name="${esc(m.name)}">Reset PIN</button></td>
        </tr>`,
          )
          .join('')
      : `<tr class="row-empty"><td colspan="5">${emptyState('Nobody matches that search.')}</td></tr>`;
  }

  function openReset(name) {
    const person = roster.find((u) => sameName(u.name, name)) || { name, role: 'member' };
    const min = LONG_PIN_ROLES.includes(person.role) ? 6 : 4;
    const { dialog, close } = openModal({
      title: `Reset PIN for ${person.name}`,
      bodyHtml: `
        <div id="pin-modal-feedback" aria-live="polite"></div>
        <form id="form-update-pin" data-form="save-pin">
          <div class="form-group">
            <label class="form-label" for="input-new-pin">New PIN (${esc(min)} to 8 digits)</label>
            <div class="input-with-button">
              <input type="text" id="input-new-pin" class="form-control pin-input" inputmode="numeric" maxlength="8" pattern="[0-9]{${esc(min)},8}" autocomplete="off" required />
              <button type="button" class="btn btn-secondary" data-action="random">Random</button>
            </div>
            <p class="form-hint">Write it down now. It can't be shown again after you save.</p>
          </div>
          <div class="modal-btn-row">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-pin">Save new PIN</button>
          </div>
        </form>`,
    });
    const input = dialog.querySelector('#input-new-pin');
    const feedback = dialog.querySelector('#pin-modal-feedback');
    bindActions(dialog, {
      click: {
        random: () => {
          const buf = new Uint32Array(1);
          crypto.getRandomValues(buf);
          input.value = String(buf[0] % 1000000).padStart(6, '0');
        },
      },
      submit: {
        'save-pin': (form) => {
          const pin = input.value.trim();
          if (!new RegExp(`^\\d{${min},8}$`).test(pin)) {
            feedback.innerHTML = alertHtml(`The PIN must be ${min} to 8 digits.`);
            return;
          }
          runAction(form.querySelector('button[type="submit"]'), 'Saving…', () => apiUpdatePin({ targetMember: person.name, newPin: pin }), {
            onDone: () => {
              person.hasPin = true;
              draw(shell.querySelector('#pins-search').value);
              feedback.innerHTML = alertHtml(`PIN reset for ${person.name}. Tell them the new PIN in person.`, 'success');
              setTimeout(close, 2200);
            },
            onError: (m) => (feedback.innerHTML = alertHtml(m)),
          });
        },
      },
    });
    input.focus();
  }

  bindActions(shell, {
    click: { reset: (btn) => openReset(btn.dataset.name) },
    input: { search: (el) => draw(el.value.trim()) },
  });
  draw();
}
