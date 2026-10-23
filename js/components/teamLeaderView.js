/**
 * EconomicsPortal — Team Leader Dashboard Component
 */

import { apiAddMark, apiUpdateTaskStatus } from "../api.js";
import { getScoreBand } from "./memberView.js";

// Roster map of members belonging to each team
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
  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;

  const teamMembers = TEAM_ROSTER[user.team] || [];

  container.innerHTML = `
    <!-- Top KPI Bar -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.4rem; font-weight: 700;">Team Leader Workspace — ${user.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            Leading: <strong style="color: var(--text-main);">Team ${user.team}</strong> (${teamMembers.length} members)
          </p>
        </div>
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Team Average</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--primary);">
              ${teamAverage !== null ? teamAverage : "—"}
            </div>
            ${avgBand ? `<span class="badge ${avgBand.cls}">${avgBand.label}</span>` : ""}
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-tl">↻ Refresh</button>
        </div>
      </div>
    </div>

    <!-- Main 2-column layout -->
    <div class="grid-2">
      <!-- Left Column: Tasks & Add Mark Form -->
      <div>
        <!-- Team Tasks -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📋 Team Tasks & Relays (${tasks.length})</h3>
          </div>

          <div id="tl-tasks-list">
            ${
              tasks.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No tasks assigned to your team.</p>`
                : tasks
                    .map((task) => {
                      const isDone = task.status === "done";
                      return `
                      <div class="task-item ${isDone ? "done" : ""}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
                          <h4 style="font-size: 0.95rem; font-weight: 700;">${task.title}</h4>
                          <span class="badge ${isDone ? "badge-done" : "badge-open"}">${task.status}</span>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                          ${task.description || "No description provided."}
                        </p>
                        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                          <div>
                            <span>📅 Due: <strong>${task.dueDate || "Not set"}</strong></span>
                            ${task.fileUrl ? ` • <a href="${task.fileUrl}" target="_blank">Drive File ↗</a>` : ""}
                          </div>
                          <div>
                            ${
                              !isDone
                                ? `<button class="btn btn-success btn-sm btn-relay-task" data-id="${task.id}">
                                    Relayed to team ✓
                                  </button>`
                                : `<span style="color: #059669; font-weight: 600; font-size: 0.8rem;">✓ Relayed</span>`
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

        <!-- Add Marks Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">✍️ Record Member Marks</h3>
          </div>
          <div id="mark-feedback"></div>
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
                <label class="form-label">Cycle</label>
                <input type="text" id="tl-mark-cycle" class="form-control" value="Cycle 1" required />
              </div>
              <div class="form-group">
                <label class="form-label">Quiz Score (0-100)</label>
                <input type="number" id="tl-mark-quiz" class="form-control" min="0" max="100" placeholder="e.g. 85" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Submission Rate</label>
                <input type="text" id="tl-mark-sub" class="form-control" value="100%" placeholder="e.g. 100%" required />
              </div>
              <div class="form-group">
                <label class="form-label">Attendance Rate</label>
                <input type="text" id="tl-mark-att" class="form-control" value="100%" placeholder="e.g. 95%" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Performance Notes / Feedback</label>
              <input type="text" id="tl-mark-notes" class="form-control" placeholder="Observations, key strengths or areas to review..." />
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Save Mark</button>
          </form>
        </div>
      </div>

      <!-- Right Column: Team Marks Table, Submissions & Escalations -->
      <div>
        <!-- Team Marks Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📈 Team Scorecard</h3>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Cycle</th>
                  <th>Score</th>
                  <th>Rating Band</th>
                </tr>
              </thead>
              <tbody>
                ${
                  marks.length === 0
                    ? `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks recorded yet for Team ${user.team}.</td></tr>`
                    : marks
                        .map((m) => {
                          const band = getScoreBand(m.quizScore);
                          return `
                        <tr>
                          <td><strong>${m.member}</strong></td>
                          <td>${m.cycle}</td>
                          <td><strong>${m.quizScore}</strong>/100</td>
                          <td><span class="badge ${band.cls}">${band.label}</span></td>
                        </tr>
                        ${
                          m.notes
                            ? `<tr><td colspan="4" style="font-size: 0.8rem; color: var(--text-muted); background-color: var(--bg-subtle); padding: 0.35rem 0.9rem;">
                                💬 <em>${m.notes}</em>
                              </td></tr>`
                            : ""
                        }
                      `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Team Submissions -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📥 Member Submissions (${submissions.length})</h3>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Task ID</th>
                  <th>Content / Link</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${
                  submissions.length === 0
                    ? `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No submissions recorded yet.</td></tr>`
                    : submissions
                        .map((s) => {
                          return `
                        <tr>
                          <td><strong>${s.member}</strong></td>
                          <td><span style="font-family: monospace; font-size: 0.8rem;">${s.taskId}</span></td>
                          <td>
                            ${s.content || "Completed"}
                            ${s.fileUrl ? `<br/><a href="${s.fileUrl}" target="_blank" style="font-size: 0.8rem;">View Link ↗</a>` : ""}
                          </td>
                          <td style="font-size: 0.8rem; color: var(--text-muted);">
                            ${new Date(s.timestamp).toLocaleDateString()}
                          </td>
                        </tr>
                      `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Team Escalations / Doubts -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">💬 Team Doubts & Escalations (${escalations.length})</h3>
          </div>
          <div>
            ${
              escalations.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No questions or escalations from your team.</p>`
                : escalations
                    .map((esc) => {
                      const isSevere = esc.severity === "severe";
                      return `
                      <div class="escalation-item ${isSevere ? "severe" : ""}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.3rem;">
                          <h4 style="font-size: 0.95rem; font-weight: 700;">${esc.topic}</h4>
                          <div>
                            ${isSevere ? `<span class="badge badge-severe">URGENT</span>` : ""}
                            <span class="badge ${esc.status === "closed" ? "badge-closed" : "badge-open"}">${esc.status}</span>
                          </div>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.4rem;">
                          ${esc.details}
                        </p>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">
                          Raised by: <strong>${esc.raisedBy}</strong> • ${new Date(esc.timestamp).toLocaleDateString()}
                        </div>
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

  // Relay task button listener
  container.querySelectorAll(".btn-relay-task").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.getAttribute("data-id");
      btn.disabled = true;
      btn.textContent = "Updating...";

      try {
        const res = await apiUpdateTaskStatus(taskId, "done", user.role);
        if (res.ok) {
          onRefresh();
        } else {
          alert(res.error || "Update failed.");
          btn.disabled = false;
          btn.textContent = "Relayed to team ✓";
        }
      } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Relayed to team ✓";
      }
    });
  });

  // Handle Add Mark Form
  const markForm = container.querySelector("#form-tl-add-mark");
  markForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const member = container.querySelector("#tl-mark-member").value;
    const cycle = container.querySelector("#tl-mark-cycle").value;
    const quizScore = container.querySelector("#tl-mark-quiz").value;
    const submission = container.querySelector("#tl-mark-sub").value;
    const attendance = container.querySelector("#tl-mark-att").value;
    const notes = container.querySelector("#tl-mark-notes").value;
    const feedback = container.querySelector("#mark-feedback");
    const btn = markForm.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const res = await apiAddMark({
        role: user.role,
        member,
        team: user.team,
        cycle,
        quizScore: Number(quizScore),
        submission,
        attendance,
        notes,
      });

      if (res.ok) {
        feedback.innerHTML = `<div class="alert alert-success">✓ Mark recorded for ${member}!</div>`;
        markForm.reset();
        setTimeout(() => (feedback.innerHTML = ""), 3000);
        onRefresh();
      } else {
        feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to record mark."}</div>`;
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
