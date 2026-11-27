/**
 * Team leader "Submissions" tab: check the team's work and forward it to the
 * group leader and assistant for grading.
 */

import { apiRequestGrading } from '../../api.js';
import { esc, linkHtml } from '../../utils.js';
import { timeHtml } from '../../dates.js';
import { openModal } from '../modal.js';
import { bindActions, runAction, alertHtml, emptyState } from '../ui.js';

export function renderSubmissionsTab(panel, ctx) {
  const { user, data, onRefresh, submissions } = ctx;
  const tasks = data.tasks || [];
  const taskTitle = (id) => (tasks.find((t) => String(t.id) === String(id)) || {}).title || 'Removed task';
  const list = [...submissions].sort((a, b) => Number(Boolean(a.gradingRequested)) - Number(Boolean(b.gradingRequested)) || new Date(b.timestamp) - new Date(a.timestamp));

  panel.innerHTML = `
    <section class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Team ${esc(user.team)} submissions</h3>
          <p class="card-note">Open each file, check it's complete, then forward it for grading.</p>
        </div>
      </div>
      ${
        list.length === 0
          ? emptyState('Nothing submitted yet.', 'Students submit from the Tasks tab on their dashboard. Use the Tasks tab here to see who is missing.')
          : `<div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead><tr><th>Student</th><th>Task</th><th>What they sent</th><th>File</th><th>When</th><th>Status</th></tr></thead>
          <tbody>
            ${list
              .map((s) => {
                const sent = Boolean(s.gradingRequested);
                return `
            <tr>
              <td data-label="Student"><strong>${esc(s.member)}</strong></td>
              <td data-label="Task">${esc(taskTitle(s.taskId))}</td>
              <td data-label="What they sent">${esc(s.content || '—')}</td>
              <td data-label="File">${linkHtml(s.fileUrl, 'Open', '', '<span class="muted">No file</span>')}</td>
              <td data-label="When" class="nowrap">${timeHtml(s.timestamp)}</td>
              <td data-label="Status">${
                sent
                  ? `<span class="badge badge-done" title="${esc(s.reviewNotes || '')}">Forwarded</span>`
                  : `<button type="button" class="btn btn-primary btn-sm btn-request-grading" data-action="forward" data-id="${esc(s.id)}" data-member="${esc(s.member)}">Forward for grading</button>`
              }</td>
            </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`
      }
    </section>
  `;

  bindActions(panel, {
    click: {
      forward: (btn) => {
        const { dialog, close } = openModal({
          title: `Forward ${btn.dataset.member}'s work`,
          bodyHtml: `
            <p class="modal-intro">Shehroz and Sajal will see it in their grading queue.</p>
            <div id="req-feedback" aria-live="polite"></div>
            <form id="form-confirm-grading" data-form="confirm">
              <div class="form-group">
                <label class="form-label" for="req-grading-notes">Note for the markers <span class="optional">optional</span></label>
                <textarea id="req-grading-notes" class="form-control" rows="3" maxlength="1000" placeholder="e.g. Questions 1–4 done, diagrams included"></textarea>
              </div>
              <div class="modal-btn-row">
                <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
                <button type="submit" class="btn btn-primary" id="btn-submit-req-grading">Forward</button>
              </div>
            </form>`,
        });
        const feedback = dialog.querySelector('#req-feedback');
        bindActions(dialog, {
          submit: {
            confirm: (form) =>
              runAction(
                form.querySelector('button[type="submit"]'),
                'Forwarding…',
                () => apiRequestGrading({ submissionId: btn.dataset.id, reviewNotes: form.querySelector('#req-grading-notes').value.trim() }),
                {
                  success: 'Forwarded for grading.',
                  onDone: () => {
                    close();
                    onRefresh();
                  },
                  onError: (m) => (feedback.innerHTML = alertHtml(m)),
                },
              ),
          },
        });
      },
    },
  });
}
