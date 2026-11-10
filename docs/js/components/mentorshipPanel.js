/**
 * EconomicsPortal — At-Risk Recovery & Peer Mentorship Component (v3)
 * Tracks intervention plans, assigned peer mentors, and milestone completion.
 */

import { apiCreateMentorshipPlan, apiUpdateMentorshipStatus } from "../api.js";

/**
 * Render the Mentorship & Recovery Panel.
 * @param {HTMLElement} container
 * @param {object} user - current user
 * @param {Array} plans - existing mentorship plans
 * @param {Array} atRiskMembers - list of members currently at risk
 * @param {object} memberMetrics - metrics dictionary to identify top performers as candidate mentors
 * @param {Function} onRefresh
 */
export function renderMentorshipPanel(container, user, plans = [], atRiskMembers = [], memberMetrics = {}, onRefresh) {
  const isLeader = user.role === "instructor" || user.role === "group_leader";
  const myName = user.name;

  // Filter plans relevant to current user if member
  const relevantPlans = isLeader
    ? plans
    : plans.filter((p) => p.student.toLowerCase() === myName.toLowerCase() || p.mentor.toLowerCase() === myName.toLowerCase());

  // Identify candidate mentors: top performers (avg >= 80, not at risk)
  const candidateMentors = Object.entries(memberMetrics)
    .filter(([name, m]) => !m.atRisk && Number(m.avgScore || 0) >= 80)
    .map(([name, m]) => ({ name, team: m.team, avg: m.avgScore }));

  container.innerHTML = `
    <div class="mentorship-panel">
      <!-- Overview Banner -->
      <div class="card" style="margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 class="card-title">🛡️ Academic Recovery & Peer Mentorship Program</h3>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem;">
              Structured peer support system pairing struggling students with cohort top performers.
            </p>
          </div>
          ${
            isLeader && atRiskMembers.length > 0
              ? `
            <button class="btn btn-primary btn-sm" id="btn-open-create-plan">
              + Assign New Mentorship Plan
            </button>
          `
              : ""
          }
        </div>
      </div>

      <!-- At-Risk Alert Strip (Visible if any unassigned at-risk members) -->
      ${
        atRiskMembers.length > 0
          ? `
        <div class="at-risk-panel" style="margin-bottom: 1.25rem;">
          <div class="at-risk-title">⚠️ Students Requiring Recovery Action (${atRiskMembers.length})</div>
          <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">
            The following students have failed recent benchmarks. A dedicated peer mentor should be assigned:
          </p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${atRiskMembers
              .map((m) => {
                const name = m.member || m.name;
                const hasPlan = plans.some((p) => p.student.toLowerCase() === name.toLowerCase() && p.status !== "resolved");
                return `
                <span class="badge ${hasPlan ? "badge-done" : "badge-atrisk"}" style="padding: 0.35rem 0.65rem;">
                  ${name} (${m.team}) • ${hasPlan ? "Plan Active ✓" : "Needs Mentor!"}
                </span>
              `;
              })
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      <!-- Active Mentorship Plans -->
      <div class="mentorship-plans-list">
        ${
          relevantPlans.length === 0
            ? `
          <div class="card" style="text-align: center; padding: 2.5rem 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🤝</div>
            <h4 style="font-weight: 700; margin-bottom: 0.3rem;">No Active Intervention Plans</h4>
            <p style="color: var(--text-muted); font-size: 0.85rem;">
              ${isLeader ? "All students are meeting baseline benchmarks or plans have not yet been assigned." : "You do not have any active mentorship assignments at this time."}
            </p>
          </div>
        `
            : relevantPlans
                .map((plan) => {
                  const isResolved = plan.status === "resolved";
                  const isMentee = plan.student.toLowerCase() === myName.toLowerCase();
                  const isMentor = plan.mentor.toLowerCase() === myName.toLowerCase();

                  return `
                <div class="card plan-card ${isResolved ? "resolved" : "active"}" style="margin-bottom: 1rem;" data-plan-id="${plan.id}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge ${isResolved ? "badge-closed" : "badge-support"}">
                          ${isResolved ? "✓ Recovered & Resolved" : "⚡ Active Recovery Plan"}
                        </span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Assigned by ${plan.assignedBy}</span>
                      </div>
                      <h4 style="font-size: 1.1rem; font-weight: 700; margin-top: 0.35rem;">
                        Student: <strong style="color: var(--purple);">${plan.student}</strong>
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: normal;">(Team ${plan.team})</span>
                      </h4>
                      <p style="font-size: 0.9rem; margin-top: 0.2rem;">
                        Assigned Peer Mentor: <strong>${plan.mentor}</strong> 🌟
                        ${isMentee ? `<span class="badge badge-teal" style="margin-left: 0.4rem;">You are the Mentee</span>` : ""}
                        ${isMentor ? `<span class="badge badge-teal" style="margin-left: 0.4rem;">You are the Mentor</span>` : ""}
                      </p>
                    </div>

                    ${
                      isLeader && !isResolved
                        ? `
                      <button class="btn btn-teal btn-sm btn-resolve-plan" data-id="${plan.id}">
                        Verify Recovery & Resolve Plan ✓
                      </button>
                    `
                        : ""
                    }
                  </div>

                  <!-- Milestones Checklist -->
                  <div class="plan-milestones" style="background-color: var(--bg-subtle); border-radius: var(--radius); padding: 0.85rem; margin-top: 0.65rem;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.45rem;">
                      Action Milestones
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem;">
                      ${(plan.milestones || [
                        "Review lecture notes & model derivation together",
                        "Complete and pre-check problem set 48h before due date",
                        "Score at least 65% in next mock assessment"
                      ])
                        .map(
                          (m, i) => `
                        <li style="display: flex; align-items: center; gap: 0.5rem;">
                          <span style="color: var(--teal); font-weight: 700;">✓</span>
                          <span>${m}</span>
                        </li>
                      `
                        )
                        .join("")}
                    </ul>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.65rem; font-size: 0.75rem; color: var(--text-muted);">
                    <span>Initiated: ${new Date(plan.timestamp).toLocaleDateString()}</span>
                    <span>Target Recovery: Unit 3 Assessment</span>
                  </div>
                </div>
              `;
                })
                .join("")
        }
      </div>

      <!-- Create Plan Modal Shell -->
      <div id="create-plan-modal-shell"></div>
    </div>
  `;

  // Action: Open Create Plan Modal
  if (isLeader) {
    const openBtn = container.querySelector("#btn-open-create-plan");
    const modalShell = container.querySelector("#create-plan-modal-shell");

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        modalShell.innerHTML = `
          <div class="modal-overlay" id="plan-modal-overlay">
            <div class="modal-content" style="max-width: 460px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <div>
                  <h3 style="font-size: 1.15rem; font-weight: 700;">Assign Mentorship Plan</h3>
                  <p style="font-size: 0.85rem; color: var(--text-muted);">Pair an at-risk student with a top performer</p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-close-plan-modal">✕</button>
              </div>

              <div id="plan-modal-feedback"></div>

              <form id="form-create-plan">
                <div class="form-group">
                  <label class="form-label">Student (Mentee)</label>
                  <select id="plan-student" class="form-control" required>
                    <option value="">-- Select At-Risk Student --</option>
                    ${atRiskMembers
                      .map((m) => {
                        const name = m.member || m.name;
                        return `<option value="${name}" data-team="${m.team}">${name} (Team ${m.team})</option>`;
                      })
                      .join("")}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Select Peer Mentor (Top Performer)</label>
                  <select id="plan-mentor" class="form-control" required>
                    <option value="">-- Select Candidate Mentor --</option>
                    ${candidateMentors
                      .map((m) => `<option value="${m.name}">${m.name} (Team ${m.team} • Avg ${m.avg})</option>`)
                      .join("")}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Target Milestones & Recovery Goals</label>
                  <textarea id="plan-goals" class="form-control" rows="3" placeholder="1. Weekly 30-min concept review&#10;2. Pre-check problem sets&#10;3. Pass next mock with 65+" required>1. Weekly 30-min concept review
2. Pre-check problem sets before submission
3. Pass next mock assessment with 65+</textarea>
                </div>

                <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-plan-modal" style="flex: 1;">Cancel</button>
                  <button type="submit" class="btn btn-primary" id="btn-submit-plan" style="flex: 2;">Activate Mentorship Plan</button>
                </div>
              </form>
            </div>
          </div>
        `;

        const overlay = modalShell.querySelector("#plan-modal-overlay");
        const form = modalShell.querySelector("#form-create-plan");
        const feedback = modalShell.querySelector("#plan-modal-feedback");
        const submitBtn = modalShell.querySelector("#btn-submit-plan");

        const closeModal = () => (modalShell.innerHTML = "");

        modalShell.querySelector("#btn-close-plan-modal").addEventListener("click", closeModal);
        modalShell.querySelector("#btn-cancel-plan-modal").addEventListener("click", closeModal);
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) closeModal();
        });

        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const studentSelect = modalShell.querySelector("#plan-student");
          const student = studentSelect.value;
          const team = studentSelect.options[studentSelect.selectedIndex].getAttribute("data-team");
          const mentor = modalShell.querySelector("#plan-mentor").value;
          const goals = modalShell.querySelector("#plan-goals").value.split("\n").filter((g) => g.trim().length > 0);

          submitBtn.disabled = true;
          submitBtn.textContent = "Activating...";

          try {
            const res = await apiCreateMentorshipPlan({
              role: user.role,
              assignedBy: user.name,
              student,
              mentor,
              team,
              milestones: goals,
            });

            if (res.ok) {
              feedback.innerHTML = `<div class="alert alert-success">Mentorship plan activated for ${student}!</div>`;
              setTimeout(() => {
                closeModal();
                onRefresh();
              }, 1200);
            } else {
              feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to create plan."}</div>`;
              submitBtn.disabled = false;
              submitBtn.textContent = "Activate Mentorship Plan";
            }
          } catch (err) {
            feedback.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
            submitBtn.disabled = false;
            submitBtn.textContent = "Activate Mentorship Plan";
          }
        });
      });
    }

    // Resolve plan action
    container.querySelectorAll(".btn-resolve-plan").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const planId = btn.getAttribute("data-id");
        if (!confirm("Confirm that this student has met recovery milestones and resolved the at-risk status?")) return;

        btn.disabled = true;
        try {
          const res = await apiUpdateMentorshipStatus(planId, "resolved", user.role);
          if (res.ok) onRefresh();
          else alert(res.error || "Failed to resolve.");
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }
}
