/**
 * EconomicsPortal — Submission tracker (leaders).
 *
 * For one task at a time: who has submitted on time, who submitted late
 * (after the due date), and who hasn't submitted yet, grouped by team,
 * with a "copy reminder list" button for the students still missing.
 */

import { esc, normalizeUserName } from '../utils.js';
import { timeHtml, formatRelative, formatFull } from '../dates.js';
import { bindActions, emptyState, copyText } from './ui.js';

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
  on_time: { label: 'On time', cls: 'tracker-on-time', icon: '✓' },
  late: { label: 'Late', cls: 'tracker-late', icon: '!' },
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
    container.innerHTML = `<section class="card">${emptyState('No tasks to track yet.', 'Once a task is assigned you can see who has submitted it here.')}</section>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Who has submitted</h3>
          <p class="card-note">Pick a task to see who turned it in on time, late, or not yet.</p>
        </div>
        <div class="form-group form-group-inline">
          <label class="form-label" for="tracker-task">Task</label>
          <select id="tracker-task" class="form-control">
            ${sorted
              .map(
                (t) =>
                  `<option value="${esc(t.id)}">${esc(t.title)} · ${esc(t.team === 'ALL' ? 'all teams' : 'Team ' + t.team)}${t.dueDate ? ' · due ' + esc(formatRelative(String(t.dueDate).slice(0, 10))) : ''}</option>`,
              )
              .join('')}
          </select>
        </div>
      </div>
      <div id="tracker-body"></div>
    </section>
  `;

  const select = container.querySelector('#tracker-task');
  const body = container.querySelector('#tracker-body');
  select.value = selectedId;
  let reminderText = '';

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
    const dueText = deadline ? formatFull(String(task.dueDate).slice(0, 10)) : '';
    reminderText =
      `Reminder: "${task.title}" ${deadline ? (pastDue ? `was due ${dueText}` : `is due ${dueText}`) : 'is waiting for you'}. ` +
      `Still to submit: ${missing.map((m) => m.name).join(', ')}.`;

    body.innerHTML = `
      <div class="tracker-summary" role="status">
        <span class="tracker-pill tracker-on-time">${counts.on_time} on time</span>
        <span class="tracker-pill tracker-late">${counts.late} late</span>
        <span class="tracker-pill tracker-missing">${counts.missing} not submitted${pastDue && counts.missing ? ' (overdue)' : ''}</span>
        <span class="muted small">${deadline ? `Due ${timeHtml(String(task.dueDate).slice(0, 10))}` : 'No due date'}</span>
        <button type="button" class="btn btn-primary btn-sm tracker-copy" data-action="copy" ${missing.length ? '' : 'disabled'}>
          Copy reminder (${missing.length})
        </button>
      </div>
      ${
        rows.length === 0
          ? emptyState('Nobody is assigned to this task.')
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
                return `
              <li class="tracker-cell ${st.cls}">
                <span aria-hidden="true">${st.icon}</span>
                <span class="tracker-name">${esc(r.name)}</span>
                <span class="tracker-status">${esc(st.label)}${r.submission ? ` · ${timeHtml(r.submission.timestamp)}` : ''}</span>
              </li>`;
              })
              .join('')}
          </ul>
        </div>`,
              )
              .join('')
      }
    `;
  }

  bindActions(container, {
    change: {},
    click: {
      copy: async (btn) => {
        const label = btn.textContent;
        if (await copyText(reminderText, 'Copy this reminder:')) {
          btn.textContent = 'Copied';
          setTimeout(() => btn.isConnected && (btn.textContent = label), 2000);
        }
      },
    },
  });
  select.addEventListener('change', () => {
    selectedId = select.value;
    draw();
  });
  draw();
}
