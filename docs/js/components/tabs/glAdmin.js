/**
 * Leaders' "Admin" tab: data export, the activity log (instructor and group
 * leader) and PIN resets (instructor and group leader). The assistant sees only export.
 */

import { apiUpdatePin, apiGetUsers, apiIssuedPins } from '../../api.js';
import { esc } from '../../utils.js';
import { renderExportToolbar } from '../exportUtils.js';
import { renderActivityLog } from '../activityLog.js';
import { openModal } from '../modal.js';
import { bindActions, runAction, alertHtml, emptyState, teamChip, sameName, copyText, toast } from '../ui.js';

const LONG_PIN_ROLES = ['instructor', 'group_leader', 'assistant'];

/** The pre-v6 server only knew 4-digit PINs; say what's really wrong. */
function explainResetError(message) {
  if (/exactly 4/i.test(message)) {
    return 'The class server is running old code that only accepts 4-digit PINs. The sheet owner needs to paste the new backend/Code.gs into Apps Script and deploy a new version. Until then, type a 4-digit PIN for students.';
  }
  return message;
}

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
          <p class="card-note">Show PINs lists the PINs you or the instructor set, until the person chooses their own. A PIN someone chose themselves can't be seen by anyone.</p>
        </div>
        <div class="pins-tools">
          <button type="button" class="btn btn-secondary btn-sm" id="btn-show-pins" data-action="toggle-pins" aria-pressed="false">Show PINs</button>
          <label class="sr-only" for="pins-search">Search people</label>
          <input type="search" id="pins-search" class="form-control form-control-sm" placeholder="Search by name" data-action="search" />
        </div>
      </div>
      <div id="pins-feedback" aria-live="polite"></div>
      <div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead><tr><th>Name</th><th>Role</th><th>Team</th><th>PIN</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody id="pins-tbody"><tr><td colspan="5" class="muted">Loading…</td></tr></tbody>
        </table>
      </div>
      <p class="form-hint">Each time PINs are shown, it is recorded in the Activity Log. Resetting signs that person out on every device. Instructor, group leader and assistant PINs must be at least 6 digits.</p>
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
  const showBtn = shell.querySelector('#btn-show-pins');
  // name → { pin, status } while "Show PINs" is on. Kept only in memory, never stored.
  let shown = null;

  function pinCell(m) {
    if (shown) {
      const entry = shown.get(String(m.name).toLowerCase());
      if (entry && entry.pin) return `<span class="pin-shown num">${esc(entry.pin)}</span>`;
      if (entry && entry.status === 'own') return '<span class="muted">Chosen by them</span>';
    }
    return m.hasPin ? '<span class="badge badge-done">Set</span>' : '<span class="badge badge-atrisk">Not set</span>';
  }

  function hidePins() {
    shown = null;
    showBtn.textContent = 'Show PINs';
    showBtn.setAttribute('aria-pressed', 'false');
    draw(shell.querySelector('#pins-search').value.trim());
  }

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
          <td data-label="PIN">${pinCell(m)}</td>
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
            <p class="form-hint">You can look it up later with Show PINs, until ${esc(person.name)} chooses their own.</p>
          </div>
          <div class="modal-btn-row">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-pin">Save new PIN</button>
          </div>
        </form>`,
    });
    const input = dialog.querySelector('#input-new-pin');
    const feedback = dialog.querySelector('#pin-modal-feedback');

    // After saving, the new PIN stays on screen until "Done", so a Random PIN
    // can't vanish before it's written down. It is never shown again after that.
    function showDone(pin) {
      const body = dialog.querySelector('#form-update-pin');
      feedback.innerHTML = '';
      body.outerHTML = `
        <div class="pin-reset-done" role="status">
          <p>${esc(person.name)}'s new PIN:</p>
          <output class="pin-reveal num" aria-label="New PIN ${esc(pin.split('').join(' '))}">${esc(pin)}</output>
          <p class="form-hint">Give it to ${esc(person.name)} in person. They are signed out everywhere and can choose their own PIN under their name → Change my PIN.</p>
          <div class="modal-btn-row">
            <button type="button" class="btn btn-secondary" data-action="copy-pin">Copy PIN</button>
            <button type="button" class="btn btn-primary" data-action="done">Done</button>
          </div>
        </div>`;
      dialog.querySelector('[data-action="done"]').focus();
    }

    bindActions(dialog, {
      click: {
        'copy-pin': async () => {
          const pin = dialog.querySelector('.pin-reveal').textContent.trim();
          if (await copyText(pin, 'Copy the new PIN:')) toast('PIN copied.', 'success');
        },
        done: () => close(),
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
              if (shown) shown.set(String(person.name).toLowerCase(), { pin, status: 'issued' });
              draw(shell.querySelector('#pins-search').value);
              showDone(pin);
            },
            onError: (m) => (feedback.innerHTML = alertHtml(explainResetError(m))),
          });
        },
      },
    });
    input.focus();
  }

  bindActions(shell, {
    click: {
      reset: (btn) => openReset(btn.dataset.name),
      'toggle-pins': (btn) => {
        if (shown) return hidePins();
        const feedback = shell.querySelector('#pins-feedback');
        feedback.innerHTML = '';
        // No busy label for runAction: it would put "Show PINs" back after onDone.
        btn.textContent = 'Loading…';
        runAction(btn, '', () => apiIssuedPins(), {
          onDone: (res) => {
            shown = new Map((res.pins || []).map((p) => [String(p.name).toLowerCase(), p]));
            btn.textContent = 'Hide PINs';
            btn.setAttribute('aria-pressed', 'true');
            draw(shell.querySelector('#pins-search').value.trim());
          },
          onError: (m) => {
            btn.textContent = 'Show PINs';
            feedback.innerHTML = alertHtml(
              /unknown action/i.test(m)
                ? 'The class server is running old code without Show PINs. The sheet owner needs to paste the new backend/Code.gs into Apps Script and deploy a new version.'
                : m,
            );
          },
        }).then(() => {
          if (!shown && btn.isConnected) btn.textContent = 'Show PINs';
        });
      },
    },
    input: { search: (el) => draw(el.value.trim()) },
  });
  draw();
}
