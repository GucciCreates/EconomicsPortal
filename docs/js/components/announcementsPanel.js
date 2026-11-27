/**
 * EconomicsPortal — class announcements (pinned first, then newest).
 * The instructor and group leader can post, pin and delete.
 */

import { apiAddAnnouncement, apiDeleteAnnouncement, apiPinAnnouncement } from "../api.js";
import { esc } from "../utils.js";
import { newPill } from "../lastSeen.js";
import { timeHtml } from "../dates.js";
import { bindActions, runAction, alertHtml, emptyState } from "./ui.js";

/**
 * @param {HTMLElement} container
 * @param {object} user
 * @param {Array} announcements
 * @param {Function} onRefresh
 * @param {{ since?: number }} [opts] - last-seen time; newer posts by others get a "New" pill
 */
export function renderAnnouncementsPanel(container, user, announcements, onRefresh, opts = {}) {
  const canManage = user.role === "instructor" || user.role === "group_leader";
  const list = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  container.innerHTML = `
    <div class="announcements-panel">
      ${
        canManage
          ? `
        <section class="card">
          <div class="card-header"><h3 class="card-title">Post an announcement</h3></div>
          <div id="ann-feedback" aria-live="polite"></div>
          <form id="form-add-announcement" data-form="add-announcement">
            <div class="form-group">
              <label class="form-label" for="ann-title">Title</label>
              <input type="text" id="ann-title" class="form-control" maxlength="200" placeholder="e.g. Quiz 3 moved to Thursday" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="ann-body">Message</label>
              <textarea id="ann-body" class="form-control" rows="3" maxlength="5000" placeholder="What everyone needs to know" required></textarea>
            </div>
            <div class="form-actions">
              <label class="custom-checkbox-label"><input type="checkbox" id="ann-pin" /> Pin to the top</label>
              <button type="submit" class="btn btn-primary">Post announcement</button>
            </div>
          </form>
        </section>`
          : ""
      }

      <div id="ann-list" class="stack">
        ${
          list.length === 0
            ? `<section class="card">${emptyState(
                "No announcements yet.",
                canManage ? "Post one above and the whole class will see it." : "Class news from Dr. Numan and Shehroz will appear here.",
              )}</section>`
            : list
                .map(
                  (a) => `
          <article class="announcement-item ${a.pinned ? "pinned" : ""}" data-ann-id="${esc(a.id)}">
            <div class="ann-header">
              <h4 class="ann-title">
                ${a.pinned ? `<span class="pin-badge">Pinned</span>` : ""}
                ${esc(a.title)}${a.postedBy !== user.name ? newPill(a.timestamp, opts.since) : ""}
              </h4>
              ${
                canManage
                  ? `<div class="btn-group">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="pin" data-id="${esc(a.id)}" data-pinned="${esc(a.pinned)}">${esc(a.pinned ? "Unpin" : "Pin")}</button>
                  <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${esc(a.id)}" aria-label="Delete announcement ${esc(a.title)}">Delete</button>
                </div>`
                  : ""
              }
            </div>
            <p class="ann-body">${esc(a.body)}</p>
            <div class="ann-meta">${esc(a.postedBy)} · ${timeHtml(a.timestamp)}</div>
          </article>`,
                )
                .join("")
        }
      </div>
    </div>
  `;

  if (!canManage) return;
  const feedback = container.querySelector("#ann-feedback");

  bindActions(container, {
    submit: {
      "add-announcement": (form) =>
        runAction(
          form.querySelector('button[type="submit"]'),
          "Posting…",
          () =>
            apiAddAnnouncement({
              title: form.querySelector("#ann-title").value.trim(),
              body: form.querySelector("#ann-body").value.trim(),
              pinned: form.querySelector("#ann-pin").checked,
            }),
          { success: "Announcement posted.", onDone: onRefresh, onError: (m) => (feedback.innerHTML = alertHtml(m)) },
        ),
    },
    click: {
      pin: (btn) =>
        runAction(btn, "", () => apiPinAnnouncement({ id: btn.dataset.id, pinned: btn.dataset.pinned !== "true" }), {
          onDone: onRefresh,
        }),
      delete: (btn) => {
        if (!window.confirmEconomicsAction("Delete this announcement? This can't be undone.")) return;
        runAction(btn, "", () => apiDeleteAnnouncement({ id: btn.dataset.id }), { success: "Announcement deleted.", onDone: onRefresh });
      },
    },
  });
}
