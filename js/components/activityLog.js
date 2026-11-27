/**
 * EconomicsPortal — Activity (audit log) tab for the instructor and group leader.
 * Read-only list of every write, with filters for person, action and date.
 */

import { apiGetAuditLog } from '../api.js';
import { esc } from '../utils.js';

const ACTION_LABELS = {
  addMark: 'Added mark',
  editMark: 'Edited mark',
  deleteMark: 'Deleted mark',
  addTask: 'Created task',
  editTask: 'Edited task',
  updateTaskStatus: 'Task status',
  addSubmission: 'Submitted work',
  addEscalation: 'Raised doubt',
  updateEscalationStatus: 'Doubt status',
  addEscalationReply: 'Replied to doubt',
  addAnnouncement: 'Posted announcement',
  deleteAnnouncement: 'Deleted announcement',
  pinAnnouncement: 'Pinned announcement',
  addQuiz: 'Scheduled quiz',
  deleteQuiz: 'Removed quiz',
  setGoal: 'Set goal',
  resetPin: 'Reset a PIN',
  changeMyPin: 'Changed own PIN',
  requestGrading: 'Requested grading',
  addTeamMessage: 'Posted team notice',
  deleteTeamMessage: 'Removed team notice',
  createMentorshipPlan: 'Created mentorship plan',
  updateMentorshipStatus: 'Mentorship status',
};

const FIELD_LABELS = {
  quizScore: 'score',
  peerRating: 'peer rating',
  previewDone: 'preview',
  mockNumber: 'mock #',
  dueDate: 'due',
  fileUrl: 'link',
};

function show(v) {
  if (v === '' || v === null || v === undefined) return '—';
  return String(v);
}

/** One readable line per entry. Returns escaped HTML. */
export function describeEntry(entry) {
  const d = entry.details || {};
  if (d.before && d.after && typeof d.before === 'object') {
    const changes = Object.keys(d.after)
      .filter((k) => k !== 'editedBy')
      .map(
        (k) =>
          `<span class="audit-change"><strong>${esc(FIELD_LABELS[k] || k)}</strong>: ${esc(show(d.before[k]))} → ${esc(show(d.after[k]))}</span>`,
      );
    const who = d.member ? `<strong>${esc(d.member)}</strong> · ` : '';
    return who + (changes.join(' ') || '—');
  }
  if (d.after && typeof d.after === 'object') {
    const a = d.after;
    const bits = [a.member, a.title, a.cycle, a.quizScore !== undefined ? `score ${a.quizScore}` : '', a.team, a.target !== undefined ? `target ${a.target}` : '']
      .filter((x) => x !== undefined && x !== '');
    return esc(bits.join(' · ') || '—');
  }
  if (d.before && typeof d.before === 'object') {
    const b = d.before;
    return 'Removed: ' + esc([b.member, b.title, b.cycle, b.quizScore !== undefined ? `score ${b.quizScore}` : ''].filter(Boolean).join(' · ') || entry.targetId);
  }
  const bits = [d.member, d.title, d.topic, d.student && `student ${d.student}`, d.mentor && `mentor ${d.mentor}`, d.team && `team ${d.team}`, d.taskId && `task ${d.taskId}`]
    .filter(Boolean);
  return esc(bits.join(' · ') || entry.targetId || '—');
}

export async function renderActivityLog(container) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 class="card-title">Activity Log</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Every change to marks, tasks, doubts and settings — who did it and when. Read-only.</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-reload-audit">↻ Reload</button>
      </div>
      <div class="audit-filters">
        <div class="form-group">
          <label class="form-label" for="audit-person">Person</label>
          <select id="audit-person" class="form-control"><option value="">Everyone</option></select>
        </div>
        <div class="form-group">
          <label class="form-label" for="audit-action">Action</label>
          <select id="audit-action" class="form-control"><option value="">All actions</option></select>
        </div>
        <div class="form-group">
          <label class="form-label" for="audit-from">From</label>
          <input type="date" id="audit-from" class="form-control" />
        </div>
        <div class="form-group">
          <label class="form-label" for="audit-to">To</label>
          <input type="date" id="audit-to" class="form-control" />
        </div>
      </div>
      <p class="form-hint" id="audit-count" aria-live="polite">Loading activity…</p>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr>
          </thead>
          <tbody id="audit-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = container.querySelector('#audit-tbody');
  const count = container.querySelector('#audit-count');
  const personSel = container.querySelector('#audit-person');
  const actionSel = container.querySelector('#audit-action');
  const fromInput = container.querySelector('#audit-from');
  const toInput = container.querySelector('#audit-to');
  let entries = [];

  function fillSelect(sel, values, labelFor) {
    const current = sel.value;
    sel.innerHTML =
      sel.options[0].outerHTML +
      values.map((v) => `<option value="${esc(v)}">${esc(labelFor(v))}</option>`).join('');
    sel.value = values.includes(current) ? current : '';
  }

  function apply() {
    const person = personSel.value;
    const action = actionSel.value;
    const from = fromInput.value ? new Date(fromInput.value + 'T00:00:00') : null;
    const to = toInput.value ? new Date(toInput.value + 'T23:59:59') : null;
    const list = entries.filter((e) => {
      const t = new Date(e.timestamp);
      return (!person || e.actor === person) && (!action || e.action === action) && (!from || t >= from) && (!to || t <= to);
    });
    count.textContent = `Showing ${list.length} of ${entries.length} entries.`;
    tbody.innerHTML = list.length
      ? list
          .map(
            (e) => `
        <tr>
          <td style="font-size: 0.8rem; white-space: nowrap;">${esc(new Date(e.timestamp).toLocaleString())}</td>
          <td><strong>${esc(e.actor)}</strong><br /><span style="font-size: 0.7rem; color: var(--text-muted);">${esc(String(e.role || '').replace('_', ' '))}</span></td>
          <td><span class="badge" style="background: var(--bg-subtle);">${esc(ACTION_LABELS[e.action] || e.action)}</span></td>
          <td style="font-size: 0.82rem;">${describeEntry(e)}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No activity matches these filters.</td></tr>`;
  }

  async function load() {
    count.textContent = 'Loading activity…';
    try {
      const res = await apiGetAuditLog(1000);
      if (!res.ok) {
        if (res.code !== 'AUTH') count.textContent = res.error || 'Could not load the activity log.';
        return;
      }
      entries = res.entries || [];
      fillSelect(personSel, [...new Set(entries.map((e) => e.actor))].sort(), (v) => v);
      fillSelect(actionSel, [...new Set(entries.map((e) => e.action))].sort(), (v) => ACTION_LABELS[v] || v);
      apply();
    } catch (err) {
      count.textContent = 'Error: ' + err.message;
    }
  }

  [personSel, actionSel, fromInput, toInput].forEach((el) => el.addEventListener('change', apply));
  container.querySelector('#btn-reload-audit').addEventListener('click', load);
  await load();
}
