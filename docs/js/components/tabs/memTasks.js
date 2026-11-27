/**
 * Student "Tasks" tab: tasks for my team, with a submit form on each.
 */

import { apiAddSubmission } from '../../api.js';
import { esc, linkHtml, slug } from '../../utils.js';
import { timeHtml } from '../../dates.js';
import { newPill } from '../../lastSeen.js';
import { bindActions, runAction, emptyState, teamChip } from '../ui.js';

export function renderMyTasksTab(panel, ctx) {
  const { data, onRefresh, isOverdue, seen } = ctx;
  const mySubmissions = data.mySubmissions || [];
  const tasks = [...(data.tasks || [])].sort((a, b) => {
    const sa = mySubmissions.some((s) => String(s.taskId) === String(a.id)) || a.status === 'done';
    const sb = mySubmissions.some((s) => String(s.taskId) === String(b.id)) || b.status === 'done';
    if (sa !== sb) return sa ? 1 : -1; // things still to do first
    return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
  });

  panel.innerHTML = `
    <section class="card">
      <div class="card-header"><h3 class="card-title">Tasks</h3><span class="card-note">Still to do first</span></div>
      ${
        tasks.length === 0
          ? emptyState('No tasks yet.', 'When Dr. Numan or Shehroz assigns work to your team it appears here.')
          : `<div class="stack" id="tasks-list">${tasks
              .map((task) => {
                const submission = mySubmissions.find((s) => String(s.taskId) === String(task.id));
                const done = task.status === 'done';
                const overdue = isOverdue(task);
                const id = slug(task.id);
                return `
          <article class="task-item ${done ? 'done' : ''} ${overdue ? 'overdue' : ''}">
            <div class="item-head">
              <h4 class="item-title">${esc(task.title)}${newPill(task.timestamp, seen.tasks)}${overdue ? ' <span class="badge badge-atrisk">Overdue</span>' : ''}</h4>
              <span class="badge ${submission ? 'badge-done' : done ? 'badge-closed' : 'badge-open'}">${submission ? 'Submitted' : done ? 'Closed' : 'To do'}</span>
            </div>
            ${task.description ? `<p class="pre-wrap">${esc(task.description)}</p>` : ''}
            <p class="item-meta">Due ${task.dueDate ? timeHtml(String(task.dueDate).slice(0, 10)) : 'date not set'} · ${teamChip(task.team)} ${linkHtml(task.fileUrl, 'Open the file', '')}</p>
            <div class="task-submit">
              ${
                submission
                  ? `<p class="text-teal">You submitted ${timeHtml(submission.timestamp)}: ${esc(submission.content || '')} ${linkHtml(submission.fileUrl, 'your file', '')}</p>`
                  : done
                    ? `<p class="muted">This task is closed.</p>`
                    : `<form class="form-submit-task" data-form="submit-task" data-task-id="${esc(task.id)}">
                  <div class="form-grid form-grid-2">
                    <div class="form-group">
                      <label class="form-label" for="sub-content-${esc(id)}">What you're submitting</label>
                      <input type="text" id="sub-content-${esc(id)}" class="form-control sub-content" maxlength="5000" placeholder="e.g. Questions 1–5 with diagrams" required />
                    </div>
                    <div class="form-group">
                      <label class="form-label" for="sub-file-${esc(id)}">Link to your file <span class="optional">optional</span></label>
                      <input type="url" id="sub-file-${esc(id)}" class="form-control sub-file" placeholder="https://drive.google.com/…" />
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary btn-sm">Submit</button>
                </form>`
              }
            </div>
          </article>`;
              })
              .join('')}</div>`
      }
    </section>
  `;

  bindActions(panel, {
    submit: {
      'submit-task': (form) =>
        runAction(
          form.querySelector('button[type="submit"]'),
          'Submitting…',
          () =>
            apiAddSubmission({
              taskId: form.dataset.taskId,
              content: form.querySelector('.sub-content').value.trim(),
              fileUrl: form.querySelector('.sub-file').value.trim(),
            }),
          { success: 'Submitted.', onDone: onRefresh },
        ),
    },
  });
}
