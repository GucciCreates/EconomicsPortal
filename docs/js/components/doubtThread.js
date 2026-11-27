/**
 * EconomicsPortal — doubts with replies.
 *
 * Used by the leaders' views (reply, and resolve for instructor / group
 * leader), the team leader view (reply, own team) and the student view
 * (read-only thread of their own questions).
 */

import { apiAddEscalationReply, apiUpdateEscalationStatus } from '../api.js';
import { esc } from '../utils.js';
import { isNewer, newPill } from '../lastSeen.js';
import { timeHtml } from '../dates.js';
import { bindActions, runAction, emptyState } from './ui.js';

function sortDoubts(list) {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (a.severity !== b.severity) return a.severity === 'severe' ? -1 : 1;
    return new Date(b.updatedAt || b.timestamp) - new Date(a.updatedAt || a.timestamp);
  });
}

/** Number of doubts with activity newer than `since` that `user` didn't cause. */
export function countDoubtUpdates(list, since, user) {
  return (list || []).filter((d) => {
    const replies = d.replies || [];
    const foreignReply = replies.some((r) => isNewer(r.timestamp, since) && r.author !== user.name);
    const newFromOther = d.raisedBy !== user.name && isNewer(d.timestamp, since);
    const closedByOther = d.status === 'closed' && d.closedBy && d.closedBy !== user.name && isNewer(d.updatedAt, since);
    return foreignReply || newFromOther || closedByOther;
  }).length;
}

/**
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {Array} opts.escalations
 * @param {object} opts.user
 * @param {boolean} [opts.canReply]
 * @param {boolean} [opts.canResolve]
 * @param {number} [opts.since] - last-seen time for "New" pills
 * @param {string} [opts.title]
 * @param {string} [opts.emptyText]
 * @param {string} [opts.emptyHint]
 * @param {Function} opts.onRefresh
 */
export function renderDoubtThreads(container, opts) {
  const { escalations = [], user, canReply = false, canResolve = false, since = 0, onRefresh } = opts;
  const list = sortDoubts(escalations);
  const showFrom = user.role !== 'member';
  const open = list.filter((d) => d.status !== 'closed').length;

  container.innerHTML = `
    <section class="card">
      <div class="card-header">
        <h3 class="card-title">${esc(opts.title || 'Doubts')}</h3>
        ${list.length ? `<span class="card-note">${esc(open)} open · ${esc(list.length - open)} resolved</span>` : ''}
      </div>
      ${
        list.length === 0
          ? emptyState(opts.emptyText || 'No doubts yet.', opts.emptyHint || '')
          : `<div class="stack">${list
              .map((d) => {
                const isSevere = d.severity === 'severe';
                const isClosed = d.status === 'closed';
                const replies = d.replies || [];
                return `
        <article class="escalation-item ${isSevere ? 'severe' : ''}" data-doubt-id="${esc(d.id)}">
          <div class="item-head">
            <h4 class="item-title">${esc(d.topic)} ${newPill(d.timestamp, user.name === d.raisedBy ? Infinity : since)}</h4>
            <div class="btn-group">
              ${isSevere ? `<span class="badge badge-atrisk">Urgent</span>` : ''}
              <span class="badge ${isClosed ? 'badge-closed' : 'badge-open'}">${isClosed ? 'Resolved' : 'Open'}</span>
            </div>
          </div>
          <p class="pre-wrap">${esc(d.details)}</p>
          <p class="item-meta">
            ${showFrom ? `${esc(d.raisedBy)} · Team ${esc(d.team)} · ` : 'Asked '}${timeHtml(d.timestamp)}
            ${isClosed && d.closedBy ? ` · resolved by ${esc(d.closedBy)} ${d.closedBy !== user.name ? newPill(d.updatedAt, since) : ''}` : ''}
          </p>
          ${
            replies.length
              ? `<ol class="doubt-replies" aria-label="Replies">
              ${replies
                .map(
                  (r) => `
                <li class="doubt-reply">
                  <div class="doubt-reply-meta">
                    <strong>${esc(r.author)}</strong>
                    <span>${esc(String(r.role || '').replace('_', ' '))} · ${timeHtml(r.timestamp)}</span>
                    ${r.author !== user.name ? newPill(r.timestamp, since) : ''}
                  </div>
                  <p>${esc(r.message)}</p>
                </li>`,
                )
                .join('')}
            </ol>`
              : user.role === 'member'
                ? `<p class="form-hint">No reply yet. Replies show up here, marked New.</p>`
                : ''
          }
          ${
            canReply || (canResolve && !isClosed)
              ? `<div class="doubt-actions">
              ${
                canReply
                  ? `<form class="doubt-reply-form" data-form="reply" data-id="${esc(d.id)}">
                  <label class="sr-only" for="reply-${esc(d.id)}">Reply to ${esc(d.raisedBy)}</label>
                  <textarea id="reply-${esc(d.id)}" class="form-control" rows="2" maxlength="5000" placeholder="Reply to ${esc(d.raisedBy)}" required></textarea>
                  <button type="submit" class="btn btn-primary btn-sm">Send reply</button>
                </form>`
                  : ''
              }
              ${canResolve && !isClosed ? `<button type="button" class="btn btn-teal btn-sm btn-resolve-esc" data-action="resolve" data-id="${esc(d.id)}">Mark resolved</button>` : ''}
            </div>`
              : ''
          }
        </article>`;
              })
              .join('')}</div>`
      }
    </section>
  `;

  bindActions(container, {
    submit: {
      reply: (form) => {
        const message = form.querySelector('textarea').value.trim();
        if (!message) return;
        runAction(form.querySelector('button[type="submit"]'), 'Sending…', () => apiAddEscalationReply(form.dataset.id, message), {
          success: 'Reply sent.',
          onDone: onRefresh,
        });
      },
    },
    click: {
      resolve: (btn) =>
        runAction(btn, '', () => apiUpdateEscalationStatus(btn.dataset.id, 'closed'), { success: 'Marked as resolved.', onDone: onRefresh }),
    },
  });
}
