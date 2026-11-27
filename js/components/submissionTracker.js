/**
 * EconomicsPortal — Submission tracker (leaders).
 *
 * For one task at a time: who has submitted on time, who submitted late
 * (after the due date), and who hasn't submitted yet, grouped by team,
 * with a "copy reminder list" button for the students still missing.
 */

import { esc } from '../utils.js';
import { normalizeUserName } from '../utils.js';

/** End of the due day in local time, or null when no due date is set. */
export function dueDeadline(dueDate) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(String(dueDate))) return null;
  return new Date(String(dueDate).slice(0, 10) + 'T23:59:59');
}

/**
 * @returns {{ name, team, status: 'on_time'|'late'|'missing', submission }[]}
 */
export function trackTask(task, submissions, roster) {
  const deadline = dueDeadline(task.dueDate);
  const expected = roster.filter((r) => task.team === 'ALL' || r.team === task.team);
  return expected.map((r) => {
    const mine = submissions
      .filter((s) => String(s.taskId) === String(task.id) && normalizeUserName(s.member) === normalizeUserName(r.name))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const first = mine[0] || null;
    let status = 'missing';
    if (first) status = deadline && new Date(first.timestamp) > deadline ? 'late' : 'on_time';
    return { name: r.name, team: r.team, status, submission: first };
  });
}

const STATUS = {
  on_time: { label: 'Submitted', cls: 'tracker-on-time', icon: '✓' },
  late: { label: 'Late', cls: 'tracker-late', icon: '⏰' },
  missing: { label: 'Not submitted', cls: 'tracker-missing', icon: '✗' },
};

/**
 * @param {HTMLElement} container
 * @param {{ tasks: Array, submissions: Array, roster: Array }} data
 */
export function renderSubmissionTracker(container, { tasks = [], submissions = [], roster = [] }) {
  const now = new Date();
  const sorted = [...tasks].sort((a, b) => {
    const da = dueDeadline(a.dueDate);
    const db = dueDeadline(b.dueDate);
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });
  // Default to the open task due soonest from now, else the most recent one.
  const upcoming = sorted
    .filter((t) => t.status !== 'done' && dueDeadline(t.dueDate) && dueDeadline(t.dueDate) >= now)
    .sort((a, b) => dueDeadline(a.dueDate) - dueDeadline(b.dueDate));
  let selectedId = (upcoming[0] || sorted[0] || {}).id;

  if (!tasks.length) {
    container.innerHTML = `<div class="card"><p style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No tasks to track yet.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h3 class="card-title">Submission Tracker</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Who has turned in each task, who was late, and who still needs a reminder.</span>
        </div>
        <div class="form-group" style="margin: 0; min-width: 240px;">
          <label class="form-label" for="tracker-task">Task</label>
          <select id="tracker-task" class="form-control">
            ${sorted
              .map(
                (t) =>
                  `<option value="${esc(t.id)}">${esc(t.title)} — ${esc(t.team === 'ALL' ? 'All teams' : 'Team ' + t.team)}${t.dueDate ? ' · due ' + esc(String(t.dueDate).slice(0, 10)) : ''}</option>`,
              )
              .join('')}
          </select>
        </div>
      </div>
      <div id="tracker-body"></div>
    </div>
  `;

  const select = container.querySelector('#tracker-task');
  const body = container.querySelector('#tracker-body');
  select.value = selectedId;

  function draw() {
    const task = tasks.find((t) => String(t.id) === String(selectedId));
    if (!task) return;
    const rows = trackTask(task, submissions, roster);
    const deadline = dueDeadline(task.dueDate);
    const pastDue = deadline && now > deadline;
    const counts = { on_time: 0, late: 0, missing: 0 };
    rows.forEach((r) => counts[r.status]++);
    const missing = rows.filter((r) => r.status === 'missing');
    const teams = [...new Set(rows.map((r) => r.team))];

    body.innerHTML = `
      <div class="tracker-summary" role="status">
        <span class="tracker-pill tracker-on-time">✓ ${counts.on_time} on time</span>
        <span class="tracker-pill tracker-late">⏰ ${counts.late} late</span>
        <span class="tracker-pill tracker-missing">✗ ${counts.missing} not submitted${pastDue && counts.missing ? ' (overdue)' : ''}</span>
        <span style="font-size: 0.8rem; color: var(--text-muted);">
          ${deadline ? `Due ${esc(deadline.toLocaleDateString())}${pastDue ? ' — deadline has passed' : ''}` : 'No due date set'}
        </span>
        <button type="button" class="btn btn-primary btn-sm" id="btn-copy-reminders" ${missing.length ? '' : 'disabled'} style="margin-left: auto;">
          Copy reminder list (${missing.length})
        </button>
      </div>
      <div id="tracker-copy-fallback"></div>
      ${
        rows.length === 0
          ? `<p style="color: var(--text-muted); padding: 1rem;">No students are assigned to this task.</p>`
          : teams
              .map(
                (team) => `
        <div class="tracker-team">
          <h4 class="tracker-team-title">Team ${esc(team)}</h4>
          <ul class="tracker-grid">
            ${rows
              .filter((r) => r.team === team)
              .map((r) => {
                const st = STATUS[r.status];
                const when = r.submission ? new Date(r.submission.timestamp).toLocaleString() : '';
                return `
              <li class="tracker-cell ${st.cls}" title="${esc(when ? st.label + ' ' + when : st.label)}">
                <span aria-hidden="true">${st.icon}</span>
                <span class="tracker-name">${esc(r.name)}</span>
                <span class="tracker-status">${esc(st.label)}${when ? ` · ${esc(new Date(r.submission.timestamp).toLocaleDateString())}` : ''}</span>
              </li>`;
              })
              .join('')}
          </ul>
        </div>`,
              )
              .join('')
      }
    `;

    const copyBtn = body.querySelector('#btn-copy-reminders');
    copyBtn.addEventListener('click', async () => {
      const text =
        `Reminder: "${task.title}" ${deadline ? (pastDue ? `was due ${deadline.toLocaleDateString()}` : `is due ${deadline.toLocaleDateString()}`) : 'is waiting for you'}. ` +
        `Still to submit: ${missing.map((m) => m.name).join(', ')}.`;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied ✓';
        setTimeout(() => (copyBtn.textContent = `Copy reminder list (${missing.length})`), 2000);
      } catch (e) {
        const fb = body.querySelector('#tracker-copy-fallback');
        fb.innerHTML = `<label class="form-label" for="tracker-copy-text">Copy this reminder:</label><textarea id="tracker-copy-text" class="form-control" rows="3" readonly></textarea>`;
        const ta = fb.querySelector('textarea');
        ta.value = text;
        ta.select();
      }
    });
  }

  select.addEventListener('change', () => {
    selectedId = select.value;
    draw();
  });
  draw();
}
