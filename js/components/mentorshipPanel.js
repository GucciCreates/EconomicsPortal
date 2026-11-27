/**
 * EconomicsPortal — support plans: an at-risk student paired with a peer mentor.
 */

import { apiCreateMentorshipPlan, apiUpdateMentorshipStatus } from "../api.js";
import { esc } from "../utils.js";
import { timeHtml } from "../dates.js";
import { openModal } from "./modal.js";
import { bindActions, runAction, alertHtml, emptyState, sameName } from "./ui.js";

/**
 * @param {HTMLElement} container
 * @param {object} user
 * @param {Array} plans
 * @param {Array} atRiskMembers
 * @param {object} memberMetrics - used to suggest mentors (average 80+, not at risk)
 * @param {Function} onRefresh
 */
export function renderMentorshipPanel(container, user, plans = [], atRiskMembers = [], memberMetrics = {}, onRefresh) {
  const isLeader = user.role === "instructor" || user.role === "group_leader";
  const relevant = isLeader ? plans : plans.filter((p) => sameName(p.student, user.name) || sameName(p.mentor, user.name));
  const mentors = Object.entries(memberMetrics)
    .filter(([, m]) => !m.atRisk && Number(m.avgScore || 0) >= 80)
    .map(([name, m]) => ({ name, team: m.team, avg: m.avgScore }));
  const hasActivePlan = (name) => plans.some((p) => sameName(p.student, name) && p.status !== "resolved");

  container.innerHTML = `
    <div class="mentorship-panel stack">
      <section class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Support plans</h3>
            <p class="card-note">Pair a student who is struggling with a classmate who is doing well.</p>
          </div>
          ${isLeader && atRiskMembers.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="new-plan">New support plan</button>` : ""}
        </div>
        ${
          atRiskMembers.length
            ? `<div class="chip-row">
            ${atRiskMembers
              .map((m) => {
                const name = m.member || m.name;
                const active = hasActivePlan(name);
                return `<span class="badge ${active ? "badge-done" : "badge-atrisk"}">${esc(name)} · ${esc(active ? "has a plan" : "needs a mentor")}</span>`;
              })
              .join("")}
          </div>`
            : `<p class="muted">Nobody is below the support threshold right now.</p>`
        }
      </section>

      ${
        relevant.length === 0
          ? `<section class="card">${emptyState(
              isLeader ? "No support plans yet." : "You're not part of a support plan.",
              isLeader ? (atRiskMembers.length ? "Start one with New support plan." : "Plans appear here when you create them.") : "",
            )}</section>`
          : relevant
              .map((plan) => {
                const resolved = plan.status === "resolved";
                return `
        <article class="card plan-card ${resolved ? "is-resolved" : ""}">
          <div class="card-header">
            <div>
              <h4 class="item-title">${esc(plan.student)} <span class="muted">· Team ${esc(plan.team)}</span></h4>
              <p class="item-meta">Mentor: <strong>${esc(plan.mentor)}</strong> · set up by ${esc(plan.assignedBy)} ${timeHtml(plan.timestamp)}</p>
            </div>
            <div class="btn-group">
              <span class="badge ${resolved ? "badge-closed" : "badge-support"}">${esc(resolved ? "Resolved" : "Active")}</span>
              ${isLeader && !resolved ? `<button type="button" class="btn btn-teal btn-sm" data-action="resolve-plan" data-id="${esc(plan.id)}">Mark resolved</button>` : ""}
            </div>
          </div>
          ${
            (plan.milestones || []).length
              ? `<ol class="milestones">${plan.milestones.map((m) => `<li>${esc(m)}</li>`).join("")}</ol>`
              : `<p class="muted small">No milestones written down.</p>`
          }
        </article>`;
              })
              .join("")
      }
    </div>
  `;

  if (!isLeader) return;

  function openNewPlan() {
    const { dialog, close } = openModal({
      title: "New support plan",
      maxWidth: "480px",
      bodyHtml: `
        <div id="plan-modal-feedback" aria-live="polite"></div>
        <form id="form-create-plan" data-form="create-plan">
          <div class="form-group">
            <label class="form-label" for="plan-student">Student who needs support</label>
            <select id="plan-student" class="form-control" required>
              <option value="">Choose a student</option>
              ${atRiskMembers
                .map((m) => {
                  const name = m.member || m.name;
                  return `<option value="${esc(name)}">${esc(name)} (Team ${esc(m.team)})</option>`;
                })
                .join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="plan-mentor">Mentor</label>
            <select id="plan-mentor" class="form-control" required>
              <option value="">Choose a mentor</option>
              ${mentors.map((m) => `<option value="${esc(m.name)}">${esc(m.name)} (Team ${esc(m.team)}, average ${esc(m.avg)})</option>`).join("")}
            </select>
            ${mentors.length ? "" : `<p class="form-hint">Nobody has an average of 80+ yet, so there are no suggested mentors.</p>`}
          </div>
          <div class="form-group">
            <label class="form-label" for="plan-goals">Milestones, one per line</label>
            <textarea id="plan-goals" class="form-control" rows="4" required>Weekly 30-minute concept review
Check problem sets together before submitting
65+ on the next mock</textarea>
          </div>
          <div class="modal-btn-row">
            <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
            <button type="submit" class="btn btn-primary">Start plan</button>
          </div>
        </form>`,
    });
    const feedback = dialog.querySelector("#plan-modal-feedback");
    bindActions(dialog, {
      submit: {
        "create-plan": (form) =>
          runAction(
            form.querySelector('button[type="submit"]'),
            "Saving…",
            () =>
              apiCreateMentorshipPlan({
                student: form.querySelector("#plan-student").value,
                mentor: form.querySelector("#plan-mentor").value,
                milestones: form.querySelector("#plan-goals").value.split("\n").map((g) => g.trim()).filter(Boolean),
              }),
            {
              success: "Support plan started.",
              onDone: () => {
                close();
                onRefresh();
              },
              onError: (m) => (feedback.innerHTML = alertHtml(m)),
            },
          ),
      },
    });
  }

  bindActions(container, {
    click: {
      "new-plan": openNewPlan,
      "resolve-plan": (btn) => {
        if (!window.confirmEconomicsAction("Mark this support plan as resolved?")) return;
        runAction(btn, "", () => apiUpdateMentorshipStatus(btn.dataset.id, "resolved"), { success: "Plan resolved.", onDone: onRefresh });
      },
    },
  });
}
