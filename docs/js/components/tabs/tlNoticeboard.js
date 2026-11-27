/**
 * Team leader "Noticeboard" tab: messages for your own team only.
 */

import { apiAddTeamMessage, apiDeleteTeamMessage } from '../../api.js';
import { esc } from '../../utils.js';
import { timeHtml } from '../../dates.js';
import { bindActions, runAction, alertHtml, emptyState } from '../ui.js';

export function renderNoticeboardTab(panel, ctx) {
  const { user, data, onRefresh } = ctx;
  const messages = [...(data.teamMessages || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  panel.innerHTML = `
    <section class="card">
      <div class="card-header"><h3 class="card-title">Post to Team ${esc(user.team)}</h3></div>
      <p class="card-note">Your team sees the newest notice at the top of their dashboard.</p>
      <div id="tm-feedback" aria-live="polite"></div>
      <form id="form-add-team-msg" data-form="post">
        <div class="form-group">
          <label class="form-label" for="tm-body">Message</label>
          <textarea id="tm-body" class="form-control" rows="3" maxlength="5000" placeholder="e.g. Review call Thursday 5 PM. Bring your IS-LM questions." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary" id="btn-post-team-msg">Post to the team</button>
      </form>
    </section>

    <section class="card">
      <div class="card-header"><h3 class="card-title">Notices</h3></div>
      ${
        messages.length === 0
          ? emptyState('No notices yet.', 'Post one above to reach your whole team.')
          : `<div class="stack">${messages
              .map(
                (m) => `
          <article class="announcement-item notice-item">
            <div class="ann-header">
              <h4 class="ann-title">From ${esc(m.author)}</h4>
              <button type="button" class="btn btn-danger btn-sm btn-delete-tm" data-action="delete" data-id="${esc(m.id)}" aria-label="Remove this notice">Remove</button>
            </div>
            <p class="ann-body">${esc(m.message)}</p>
            <div class="ann-meta">${timeHtml(m.timestamp)}</div>
          </article>`,
              )
              .join('')}</div>`
      }
    </section>
  `;

  const feedback = panel.querySelector('#tm-feedback');
  bindActions(panel, {
    submit: {
      post: (form) =>
        runAction(form.querySelector('button[type="submit"]'), 'Posting…', () => apiAddTeamMessage({ message: form.querySelector('#tm-body').value.trim() }), {
          success: 'Notice posted.',
          onDone: onRefresh,
          onError: (m) => (feedback.innerHTML = alertHtml(m)),
        }),
    },
    click: {
      delete: (btn) => {
        if (!window.confirmEconomicsAction('Remove this notice?')) return;
        runAction(btn, '', () => apiDeleteTeamMessage({ id: btn.dataset.id }), { success: 'Notice removed.', onDone: onRefresh });
      },
    },
  });
}
