/**
 * EconomicsPortal — Team Leader Dashboard Component (v2)
 */

import { apiAddMark, apiUpdateTaskStatus } from "../api.js";
import { getScoreBand, renderMemberMetricsHTML } from "./metricsPanel.js";
import { renderSparkline } from "./charts.js";

export const TEAM_ROSTER = {
  Shehroz: ["Gorsi", "Haris"],
  Amina: ["Ramesh", "Mamoon", "Tazneem"],
  Ayesha: ["Minal", "Anika", "Ahmed bin Nasir"],
  Lareb: ["Shaiman", "Aisha Amjad", "Haseeb"],
};

export function renderTeamLeaderDashboard(container, user, data, onRefresh) {
  const tasks = data.tasks || [];
  const marks = data.marks || [];
  const submissions = data.submissions || [];
  const escalations = data.escalations || [];
  const teamAverage = data.teamAverage;
  const memberMetrics = data.memberMetrics || {};
  const atRiskMembers = data.atRiskMembers || [];

  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;
  const teamMembers = TEAM_ROSTER[user.team] || [];

  container.innerHTML = `
    <!-- Top Header -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700;">Team Leader Workspace — ${user.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            Leading: <strong>Team ${user.team}</strong> (${teamMembers.length} members)
          </p>
        </div>
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Team Average</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--teal);" class="num">
              ${teamAverage !== null ? teamAverage : "—"}
            </div>
            ${avgBand ? `<span class="badge ${avgBand.cls}">${avgBand.label}</span>` : ""}
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-tl">↻ Refresh</button>
        </div>
      </div>
    </div>

    <!-- At-Risk Alert Banner (if any) -->
    ${
      atRiskMembers.length > 0
        ? `
      <div class="at-risk-panel">
        <div class="at-risk-title">⚠️ At-Risk Team Members (${atRiskMembers.length})</div>
        <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">
          The following members failed the last two cycles (quiz &lt; 50 or missed submission) and require a support plan:
        </p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${atRiskMembers.map((m) => `<span class="badge badge-support">${m.member || m.name}</span>`).join(" ")}
        </div>
      </div>
    `
        : ""
    }

    <!-- Main Layout -->
    <div class="grid-2">
      <!-- Left Column: Tasks & Add Mark -->
      <div>
        <!-- Team Tasks -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Team Tasks (${tasks.length})</h3>
          </div>

          <div id="tl-tasks-list">
            ${
              tasks.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No tasks assigned.</p>`
                : tasks
                    .map((task) => {
                      const isDone = task.status === "done";
                      return `
                      <div class="task-item ${isDone ? "done" : ""}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
                          <h4 style="font-size: 0.95rem; font-weight: 700;">${task.title}</h4>
                          <span class="badge ${isDone ? "badge-done" : "badge-open"}">${task.status}</span>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.45rem;">
                          ${task.description || "No description provided."}
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                          <span>Due: <strong>${task.dueDate || "Not set"}</strong></span>
                          <div>
                            ${
                              !isDone
                                ? `<button class="btn btn-teal btn-sm btn-relay-task" data-id="${task.id}">
                                    Relayed to team ✓
                                  </button>`
                                : `<span style="color: var(--teal); font-weight: 600; font-size: 0.8rem;">✓ Relayed</span>`
                            }
                          </div>
                        </div>
                      </div>
                    `;
                    })
                    .join("")
            }
          </div>
        </div>

        <!-- Add Marks Form (v2) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Record Member Marks</h3>
          </div>
          <div id="tl-mark-feedback"></div>
          <form id="form-tl-add-mark">
            <div class="form-group">
              <label class="form-label">Team Member</label>
              <select id="tl-mark-member" class="form-control" required>
                <option value="">-- Select Member --</option>
                ${teamMembers.map((m) => `<option value="${m}">${m}</option>`).join("")}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Cycle (e.g. Cycle 2)</label>
                <input type="text" id="tl-mark-cycle" class="form-control" value="Cycle 2" required />
              </div>
              <div class="form-group">
                <label class="form-label">Mock # (Sprint weeks only)</label>
                <input type="number" id="tl-mark-mock" class="form-control" placeholder="Optional" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Quiz Score (0-100)</label>
                <input type="number" id="tl-mark-quiz" class="form-control" min="0" max="100" placeholder="e.g. 85" required />
              </div>
              <div class="form-group">
                <label class="form-label">Submission</label>
                <select id="tl-mark-sub" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Attendance Rate</label>
                <input type="text" id="tl-mark-att" class="form-control" value="100%" />
              </div>
              <div class="form-group">
                <label class="form-label">Preview Completed</label>
                <select id="tl-mark-prev" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Peer Rating (1-5)</label>
                <input type="number" step="0.1" min="1" max="5" id="tl-mark-peer" class="form-control" placeholder="e.g. 4.5" />
              </div>
              <div class="form-group">
                <label class="form-label">Punctual</label>
                <select id="tl-mark-punctual" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Performance Notes</label>
              <input type="text" id="tl-mark-notes" class="form-control" placeholder="Observations, strengths or areas to review..." />
            </div>

            <button type="submit" class="btn btn-teal" style="width: 100%;">Save Mark</button>
          </form>
        </div>
      </div>

      <!-- Right Column: Member Performance & Team Scorecard -->
      <div>
        <!-- Performance Overview (Per Member) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Member Performance & Trends</h3>
          </div>
          <div>
            ${teamMembers
              .map((member) => {
                const met = memberMetrics[member];
                const memMarks = marks.filter((m) => m.member === member);
                return `
                <div style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.75rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                    <strong>${member}</strong>
                    <canvas class="sparkline-canvas" data-member="${member}" width="130" height="34"></canvas>
                  </div>
                  ${renderMemberMetricsHTML(met, { title: `${member}'s Metrics` })}
                </div>
              `;
              })
              .join("")}
          </div>
        </div>

        <!-- Team Scorecard Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Team Scorecard</h3>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Cycle</th>
                  <th>Score</th>
                  <th>Sub</th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                ${
                  marks.length === 0
                    ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks recorded yet.</td></tr>`
                    : marks
                        .map((m) => {
                          const band = getScoreBand(m.quizScore);
                          return `
                        <tr>
                          <td><strong>${m.member}</strong></td>
                          <td>${m.cycle}</td>
                          <td><strong>${m.quizScore}</strong></td>
                          <td>${m.submission}</td>
                          <td><span class="badge ${band.cls}">${band.label}</span></td>
                        </tr>
                      `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Submissions & Escalations -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Doubts & Questions (${escalations.length})</h3>
          </div>
          <div>
            ${
              escalations.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No open doubts.</p>`
                : escalations
                    .map((esc) => {
                      const isSevere = esc.severity === "severe";
                      return `
                      <div class="escalation-item ${isSevere ? "severe" : ""}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.25rem;">
                          <h4 style="font-size: 0.9rem; font-weight: 700;">${esc.topic}</h4>
                          <span class="badge ${esc.status === "closed" ? "badge-closed" : "badge-open"}">${esc.status}</span>
                        </div>
                        <p style="font-size: 0.85rem; margin-bottom: 0.25rem;">${esc.details}</p>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">From: ${esc.raisedBy}</div>
                      </div>
                    `;
                    })
                    .join("")
            }
          </div>
        </div>
      </div>
    </div>
  `;

  // Render sparklines
  container.querySelectorAll(".sparkline-canvas").forEach((canvas) => {
    const memName = canvas.getAttribute("data-member");
    const memMarks = marks.filter((m) => m.member === memName);
    renderSparkline(canvas, memMarks);
  });

  // Relay Task
  container.querySelectorAll(".btn-relay-task").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.getAttribute("data-id");
      btn.disabled = true;

      try {
        const res = await apiUpdateTaskStatus(taskId, "done", user.role);
        if (res.ok) onRefresh();
        else alert(res.error || "Update failed.");
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Add Mark Form
  const markForm = container.querySelector("#form-tl-add-mark");
  markForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const member = container.querySelector("#tl-mark-member").value;
    const cycle = container.querySelector("#tl-mark-cycle").value;
    const mockNumber = container.querySelector("#tl-mark-mock").value;
    const quizScore = container.querySelector("#tl-mark-quiz").value;
    const submission = container.querySelector("#tl-mark-sub").value;
    const attendance = container.querySelector("#tl-mark-att").value;
    const previewDone = container.querySelector("#tl-mark-prev").value;
    const peerRating = container.querySelector("#tl-mark-peer").value;
    const punctual = container.querySelector("#tl-mark-punctual").value;
    const notes = container.querySelector("#tl-mark-notes").value;
    const feedback = container.querySelector("#tl-mark-feedback");
    const btn = markForm.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const res = await apiAddMark({
        role: user.role,
        name: user.name,
        member,
        team: user.team,
        cycle,
        mockNumber,
        quizScore: Number(quizScore),
        submission,
        attendance,
        previewDone,
        peerRating,
        punctual,
        notes,
      });

      if (res.ok) {
        feedback.innerHTML = `<div class="alert alert-success">Mark saved for ${member}!</div>`;
        markForm.reset();
        setTimeout(() => (feedback.innerHTML = ""), 3000);
        onRefresh();
      } else {
        feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to save mark."}</div>`;
      }
    } catch (err) {
      feedback.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Save Mark";
    }
  });

  // Refresh
  container.querySelector("#btn-refresh-tl").addEventListener("click", () => {
    onRefresh();
  });
}
