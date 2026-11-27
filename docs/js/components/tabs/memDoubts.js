/**
 * Student "Doubts" tab: ask a question and see replies to the ones you asked.
 */

import { apiAddEscalation } from '../../api.js';
import { renderDoubtThreads } from '../doubtThread.js';
import { bindActions, runAction, alertHtml } from '../ui.js';

export function renderMyDoubtsTab(panel, ctx) {
  const { user, data, onRefresh, seen } = ctx;
  const mine = data.myEscalations || [];

  panel.innerHTML = `
    <section class="card">
      <div class="card-header"><h3 class="card-title">Ask a doubt</h3></div>
      <p class="card-note">Stuck on theory, a problem set or the instructions? Dr. Numan, Shehroz and your team leader will see it.</p>
      <div id="escalation-feedback" aria-live="polite"></div>
      <form id="form-add-escalation" data-form="ask">
        <div class="form-group">
          <label class="form-label" for="esc-topic">Your question in a line</label>
          <input type="text" id="esc-topic" class="form-control" maxlength="200" placeholder="e.g. Why does the LM curve slope upward?" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="esc-details">Details</label>
          <textarea id="esc-details" class="form-control" rows="3" maxlength="5000" placeholder="What you tried and where you got stuck" required></textarea>
        </div>
        <div class="form-actions">
          <label class="custom-checkbox-label"><input type="checkbox" id="esc-urgent" /> It's urgent (it's stopping me submitting)</label>
          <button type="submit" class="btn btn-primary" id="btn-submit-esc">Send question</button>
        </div>
      </form>
    </section>
    <div id="my-doubts"></div>
  `;

  renderDoubtThreads(panel.querySelector('#my-doubts'), {
    escalations: mine,
    user,
    since: seen.doubts,
    title: 'Your questions',
    emptyText: "You haven't asked anything yet.",
    emptyHint: 'Ask above; replies show up here.',
    onRefresh,
  });

  const feedback = panel.querySelector('#escalation-feedback');
  bindActions(panel.querySelector('#form-add-escalation').parentElement, {
    submit: {
      ask: (form) =>
        runAction(
          form.querySelector('button[type="submit"]'),
          'Sending…',
          () =>
            apiAddEscalation({
              topic: form.querySelector('#esc-topic').value.trim(),
              details: form.querySelector('#esc-details').value.trim(),
              severity: form.querySelector('#esc-urgent').checked ? 'severe' : 'normal',
            }),
          { success: 'Question sent.', onDone: onRefresh, onError: (m) => (feedback.innerHTML = alertHtml(m)) },
        ),
    },
  });
}
