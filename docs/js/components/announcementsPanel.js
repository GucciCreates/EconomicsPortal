/**
 * EconomicsPortal — Announcements Panel (v3)
 *
 * Displays announcements (pinned first, newest next).
 * Instructors / group leaders can post, pin, and delete.
 */

import { apiAddAnnouncement, apiDeleteAnnouncement, apiPinAnnouncement } from "../api.js";
import { esc } from "../utils.js";
import { newPill } from "../lastSeen.js";

/**
 * @param {HTMLElement} container
 * @param {object} user
 * @param {Array} announcements  — sorted by pinned desc, timestamp desc
 * @param {Function} onRefresh
 */
/**
 * @param {object} [opts]
 * @param {number} [opts.since] - last-seen time; newer posts by others get a "New" pill
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
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-header"><h3 class="card-title">Post Announcement</h3></div>
          <div id="ann-feedback"></div>
          <form id="form-add-announcement">
            <div class="form-group">
              <label class="form-label" for="ann-title">Title</label>
              <input type="text" id="ann-title" class="form-control" placeholder="e.g. Quiz 3 rescheduled" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="ann-body">Message</label>
              <textarea id="ann-body" class="form-control" rows="3" placeholder="Announcement details..." required></textarea>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <label style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; cursor: pointer;">
                <input type="checkbox" id="ann-pin" /> Pin to top
              </label>
              <button type="submit" class="btn btn-primary" style="margin-left: auto;">Post Announcement</button>
            </div>
          </form>
        </div>
      `
          : ""
      }

      <div id="ann-list">
        ${
          list.length === 0
            ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No announcements yet.</p>`
            : list
                .map(
                  (a) => `
          <div class="announcement-item ${esc(a.pinned ? "pinned" : "")}" data-ann-id="${esc(a.id)}">
            <div class="ann-header">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${a.pinned ? `<span class="pin-badge">Pinned</span>` : ""}
                <strong style="font-size: 0.95rem;">${esc(a.title)}</strong>${a.postedBy !== user.name ? newPill(a.timestamp, opts.since) : ""}
              </div>
              ${
                canManage
                  ? `
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-secondary btn-sm btn-pin-ann" data-id="${esc(a.id)}" data-pinned="${esc(a.pinned)}" title="${esc(a.pinned ? "Unpin" : "Pin")}">
                    ${esc(a.pinned ? "Unpin" : "Pin")}
                  </button>
                  <button class="btn btn-danger btn-sm btn-delete-ann" data-id="${esc(a.id)}" title="Delete" aria-label="Delete announcement">Delete</button>
                </div>
              `
                  : ""
              }
            </div>
            <p class="ann-body">${esc(a.body)}</p>
            <div class="ann-meta">
              Posted by <strong>${esc(a.postedBy)}</strong> · ${esc(new Date(a.timestamp).toLocaleString())}
            </div>
          </div>
        `
                )
                .join("")
        }
      </div>
    </div>
  `;

  // Post form
  if (canManage) {
    const form = container.querySelector("#form-add-announcement");
    const feedback = container.querySelector("#ann-feedback");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = "Posting...";
      try {
        const res = await apiAddAnnouncement({
          role: user.role,
          name: user.name,
          title: container.querySelector("#ann-title").value.trim(),
          body: container.querySelector("#ann-body").value.trim(),
          pinned: container.querySelector("#ann-pin").checked,
          postedBy: user.name,
        });
        if (res.ok) {
          feedback.innerHTML = `<div class="alert alert-success">Announcement posted!</div>`;
          form.reset();
          setTimeout(() => (feedback.innerHTML = ""), 3000);
          onRefresh();
        } else {
          feedback.innerHTML = `<div class="alert alert-error">${esc(res.error)}</div>`;
        }
      } catch (err) {
        feedback.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "Post Announcement";
      }
    });

    // Pin/Unpin
    container.querySelectorAll(".btn-pin-ann").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const currentlyPinned = btn.getAttribute("data-pinned") === "true";
        btn.disabled = true;
        try {
          const res = await apiPinAnnouncement({ role: user.role, id, pinned: !currentlyPinned });
          if (res.ok) onRefresh();
          else alert(res.error || "Failed.");
        } catch (err) {
          alert(err.message);
        }
      });
    });

    // Delete
    container.querySelectorAll(".btn-delete-ann").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this announcement?")) return;
        const id = btn.getAttribute("data-id");
        btn.disabled = true;
        try {
          const res = await apiDeleteAnnouncement({ role: user.role, id });
          if (res.ok) onRefresh();
          else alert(res.error || "Failed.");
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }
}
