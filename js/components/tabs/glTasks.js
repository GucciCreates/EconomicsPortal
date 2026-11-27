/**
 * Leaders' "Tasks" tab: assign tasks, see who has submitted, and the
 * submissions log.
 */

import { apiAddTask, apiEditTask, apiUpdateTaskStatus } from '../../api.js';
import { esc, linkHtml } from '../../utils.js';
import { timeHtml } from '../../dates.js';
import { openEditTaskModal } from '../editModals.js';
import { renderSubmissionTracker } from '../submissionTracker.js';
import { bindActions, runAction, alertHtml, emptyState, teamOptions, teamChip } from '../ui.js';

export function renderTasksTab(panel, ctx) {
  const { data, onRefresh, canLead } = ctx;
  const tasks = [...(data.tasks || [])].sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));
  const submissions = [...(data.submissions || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const taskTitle = (id) => (tasks.find((t) => String(t.id) === String(id)) || {}).title || 'Removed task';

  panel.innerHTML = `
    ${
      canLead
        ? `
      <section class="card">
        <div class="card-header"><h3 class="card-title">Assign a task</h3></div>
        <div id="task-feedback" aria-live="polite"></div>
        <form id="form-gl-add-task" data-form="add-task">
          <div class="form-grid form-grid-3">
            <div class="form-group">
              <label class="form-label" for="gl-task-title">Title</label>
              <input type="text" id="gl-task-title" class="form-control" maxlength="200" placeholder="e.g. Problem set 4: monetary policy" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-task-team">For</label>
              <select id="gl-task-team" class="form-control">${teamOptions('ALL')}</select>
            </div>
            <div class="form-group">
              <label class="form-label" for="gl-task-due">Due date</label>
              <input type="date" id="gl-task-due" class="form-control" required />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="gl-task-desc">Instructions</label>
            <textarea id="gl-task-desc" class="form-control" rows="2" maxlength="5000" placeholder="What to do and how it's marked"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="gl-task-file">Link to the file <span class="optional">optional</span></label>
            <input type="url" id="gl-task-file" class="form-control" placeholder="https://drive.google.com/…" />
          </div>
          <button type="submit" class="btn btn-primary">Assign task</button>
        </form>
      </section>`
        : ''
    }

    <section class="card">
      <div class="card-header"><h3 class="card-title">Tasks</h3><span class="card-note">${esc(tasks.length)} in total</span></div>
      ${
        tasks.length === 0
          ? emptyState('No tasks yet.', canLead ? 'Assign one above and students can submit it from their dashboard.' : '')
          : `<div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead><tr><th>Task</th><th>For</th><th>Due</th><th>Status</th>${canLead ? '<th><span class="sr-only">Actions</span></th>' : ''}</tr></thead>
          <tbody>
            ${tasks
              .map((t) => {
                const done = t.status === 'done';
                return `
            <tr>
              <td data-label="Task">
                <strong>${esc(t.title)}</strong>
                ${t.description ? `<p class="muted small">${esc(t.description)}</p>` : ''}
                ${linkHtml(t.fileUrl, 'Open the file', 'class="small"')}
              </td>
              <td data-label="For">${teamChip(t.team)}</td>
              <td data-label="Due" class="nowrap">${t.dueDate ? timeHtml(String(t.dueDate).slice(0, 10)) : '—'}</td>
              <td data-label="Status"><span class="badge ${done ? 'badge-done' : 'badge-open'}">${done ? 'Done' : 'Open'}</span></td>
              ${
                canLead
                  ? `<td data-label="" class="actions-cell"><div class="btn-group">
                <button type="button" class="btn btn-secondary btn-sm" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Edit ${esc(t.title)}">Edit</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="toggle-task" data-id="${esc(t.id)}" data-next="${done ? 'open' : 'done'}">${done ? 'Reopen' : 'Mark done'}</button>
              </div></td>`
                  : ''
              }
            </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`
      }
    </section>

    <div id="tracker-shell"></div>

    <section class="card">
      <div class="card-header"><h3 class="card-title">Submissions</h3><span class="card-note">Newest first</span></div>
      ${
        submissions.length === 0
          ? emptyState('No submissions yet.', 'Students submit from the Tasks tab on their dashboard.')
          : `<div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead><tr><th>Student</th><th>Task</th><th>What they sent</th><th>File</th><th>When</th></tr></thead>
          <tbody>
            ${submissions
              .map(
                (s) => `
            <tr>
              <td data-label="Student"><strong>${esc(s.member)}</strong> ${teamChip(s.team)}</td>
              <td data-label="Task">${esc(taskTitle(s.taskId))}</td>
              <td data-label="What they sent">${esc(s.content || '—')}</td>
              <td data-label="File">${linkHtml(s.fileUrl, 'Open', '', '—')}</td>
              <td data-label="When" class="nowrap">${timeHtml(s.timestamp)}</td>
            </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`
      }
    </section>
  `;

  renderSubmissionTracker(panel.querySelector('#tracker-shell'), { tasks, submissions, roster: data.roster || [] });
  if (!canLead) return;

  const feedback = panel.querySelector('#task-feedback');
  bindActions(panel, {
    submit: {
      'add-task': (form) =>
        runAction(
          form.querySelector('button[type="submit"]'),
          'Assigning…',
          () =>
            apiAddTask({
              title: form.querySelector('#gl-task-title').value.trim(),
              description: form.querySelector('#gl-task-desc').value.trim(),
              team: form.querySelector('#gl-task-team').value,
              dueDate: form.querySelector('#gl-task-due').value,
              fileUrl: form.querySelector('#gl-task-file').value.trim(),
            }),
          { success: 'Task assigned.', onDone: onRefresh, onError: (m) => (feedback.innerHTML = alertHtml(m)) },
        ),
    },
    click: {
      'edit-task': (btn) => {
        const task = tasks.find((t) => String(t.id) === btn.dataset.id);
        if (!task) return;
        openEditTaskModal(task, (fields) =>
          runAction(null, '', () => apiEditTask({ id: task.id, fields }), { success: 'Task updated.', onDone: onRefresh }),
        );
      },
      'toggle-task': (btn) =>
        runAction(btn, '', () => apiUpdateTaskStatus(btn.dataset.id, btn.dataset.next), {
          success: btn.dataset.next === 'done' ? 'Task marked done.' : 'Task reopened.',
          onDone: onRefresh,
        }),
    },
  });
}
