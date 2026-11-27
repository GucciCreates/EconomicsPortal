/**
 * EconomicsPortal — Doubts & escalations with replies.
 *
 * Shared by the group leader / instructor view (reply + resolve), the team
 * leader view (reply, own team) and the member view (read-only thread of the
 * member's own questions).
 */

import { apiAddEscalationReply, apiUpdateEscalationStatus } from '../api.js';
import { esc } from '../utils.js';
import { isNewer, newPill } from '../lastSeen.js';

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
 * @param {boolean} opts.canReply
 * @param {boolean} opts.canResolve
 * @param {number} [opts.since] - last-seen timestamp for "New" pills
 * @param {string} [opts.title]
 * @param {string} [opts.emptyText]
 * @param {Function} opts.onRefresh
 */
export function renderDoubtThreads(container, opts) {
  const { escalations = [], user, canReply = false, canResolve = false, since = 0, onRefresh } = opts;
  const list = sortDoubts(escalations);
  const showFrom = user.role !== 'member';

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${esc(opts.title || `Doubts & Escalations (${list.length})`)}</h3>
      </div>
      ${
        list.length === 0
          ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">${esc(opts.emptyText || 'No questions or issues reported.')}</p>`
          : list
              .map((d) => {
                const isSevere = d.severity === 'severe';
                const isClosed = d.status === 'closed';
                const replies = d.replies || [];
                return `
        <article class="escalation-item ${isSevere ? 'severe' : ''}" style="margin-bottom: 0.85rem;" data-doubt-id="${esc(d.id)}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700;">${esc(d.topic)} ${newPill(d.timestamp, user.name === d.raisedBy ? Infinity : since)}</h4>
            <div style="display: flex; gap: 0.35rem; align-items: center; flex-shrink: 0;">
              ${isSevere ? `<span class="badge badge-atrisk">URGENT</span>` : ''}
              <span class="badge ${isClosed ? 'badge-closed' : 'badge-open'}">${isClosed ? 'Resolved' : 'Open'}</span>
            </div>
          </div>
          <p style="font-size: 0.85rem; margin-bottom: 0.45rem; white-space: pre-wrap;">${esc(d.details)}</p>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            ${showFrom ? `From <strong>${esc(d.raisedBy)}</strong> (Team ${esc(d.team)}) • ` : 'Asked '}${esc(new Date(d.timestamp).toLocaleDateString())}
            ${isClosed && d.closedBy ? ` • Resolved by ${esc(d.closedBy)} ${d.closedBy !== user.name ? newPill(d.updatedAt, since) : ''}` : ''}
          </div>

          ${
            replies.length
              ? `<ol class="doubt-replies" aria-label="Replies">
              ${replies
                .map(
                  (r) => `
                <li class="doubt-reply">
                  <div class="doubt-reply-meta">
                    <strong>${esc(r.author)}</strong>
                    <span>${esc(String(r.role || '').replace('_', ' '))} · ${esc(new Date(r.timestamp).toLocaleString())}</span>
                    ${r.author !== user.name ? newPill(r.timestamp, since) : ''}
                  </div>
                  <p>${esc(r.message)}</p>
                </li>`,
                )
                .join('')}
            </ol>`
              : user.role === 'member'
                ? `<p class="form-hint" style="margin-top: 0.5rem;">No reply yet — you'll see it here, marked New.</p>`
                : ''
          }

          ${
            canReply || (canResolve && !isClosed)
              ? `<div class="doubt-actions">
              ${
                canReply
                  ? `<form class="doubt-reply-form" data-id="${esc(d.id)}">
                  <label class="sr-only" for="reply-${esc(d.id)}">Reply to ${esc(d.raisedBy)}</label>
                  <textarea id="reply-${esc(d.id)}" class="form-control" rows="2" maxlength="5000" placeholder="Write a reply to ${esc(d.raisedBy)}…" required></textarea>
                  <button type="submit" class="btn btn-primary btn-sm">Send reply</button>
                </form>`
                  : ''
              }
              ${
                canResolve && !isClosed
                  ? `<button type="button" class="btn btn-teal btn-sm btn-resolve-esc" data-id="${esc(d.id)}">Mark Resolved ✓</button>`
                  : ''
              }
            </div>`
              : ''
          }
        </article>`;
              })
              .join('')
      }
    </div>
  `;

  container.querySelectorAll('.doubt-reply-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const message = form.querySelector('textarea').value.trim();
      if (!message) return;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const res = await apiAddEscalationReply(form.getAttribute('data-id'), message);
        if (res.ok) {
          window.showEconomicsToast('Reply sent.', 'success');
          onRefresh();
        } else if (res.code !== 'AUTH') {
          window.showEconomicsToast(res.error || 'Could not send reply.', 'error');
        }
      } catch (err) {
        window.showEconomicsToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send reply';
      }
    });
  });

  container.querySelectorAll('.btn-resolve-esc').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await apiUpdateEscalationStatus(btn.getAttribute('data-id'), 'closed');
        if (res.ok) {
          window.showEconomicsToast('Doubt marked as resolved.', 'success');
          onRefresh();
        } else if (res.code !== 'AUTH') {
          window.showEconomicsToast(res.error || 'Update failed.', 'error');
          btn.disabled = false;
        }
      } catch (err) {
        window.showEconomicsToast(err.message, 'error');
        btn.disabled = false;
      }
    });
  });
}
