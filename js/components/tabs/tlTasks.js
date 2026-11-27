/**
 * Team leader "Tasks" tab: the team's tasks and who has submitted each one.
 */

import { apiUpdateTaskStatus } from '../../api.js';
import { esc, linkHtml } from '../../utils.js';
import { timeHtml } from '../../dates.js';
import { renderSubmissionTracker } from '../submissionTracker.js';
import { bindActions, runAction, emptyState, teamChip } from '../ui.js';

export function renderTeamTasksTab(panel, ctx) {
  const { user, data, onRefresh } = ctx;
  const tasks = [...(data.tasks || [])].sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));

  panel.innerHTML = `
    <div id="tracker-shell"></div>
    <section class="card">
      <div class="card-header"><h3 class="card-title">Tasks</h3><span class="card-note">Set by Dr. Numan and Shehroz</span></div>
      ${
        tasks.length === 0
          ? emptyState('No tasks for your team yet.', 'Tasks assigned to your team or the whole class appear here.')
          : `<div class="stack">${tasks
              .map((t) => {
                const done = t.status === 'done';
                return `
          <article class="task-item ${done ? 'done' : ''}">
            <div class="item-head">
              <h4 class="item-title">${esc(t.title)}</h4>
              <span class="badge ${done ? 'badge-done' : 'badge-open'}">${done ? 'Done' : 'Open'}</span>
            </div>
            ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ''}
            <p class="item-meta">${teamChip(t.team)} · due ${t.dueDate ? timeHtml(String(t.dueDate).slice(0, 10)) : 'date not set'} ${linkHtml(t.fileUrl, 'Open the file', '')}</p>
            ${
              !done && t.team === user.team
                ? `<button type="button" class="btn btn-teal btn-sm btn-relay-task" data-action="done" data-id="${esc(t.id)}">Mark done for the team</button>`
                : ''
            }
          </article>`;
              })
              .join('')}</div>`
      }
    </section>
  `;

  renderSubmissionTracker(panel.querySelector('#tracker-shell'), { tasks, submissions: data.submissions || [], roster: data.roster || [] });

  bindActions(panel, {
    click: {
      done: (btn) => runAction(btn, '', () => apiUpdateTaskStatus(btn.dataset.id, 'done'), { success: 'Task marked done.', onDone: onRefresh }),
    },
  });
}
