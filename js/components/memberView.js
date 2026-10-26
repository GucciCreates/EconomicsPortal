/**
 * EconomicsPortal — Member Dashboard Component (v2)
 */

import { apiAddSubmission, apiAddEscalation } from "../api.js";
import { getScoreBand, renderMemberMetricsHTML } from "./metricsPanel.js";
import { renderSparkline } from "./charts.js";

export function renderMemberDashboard(container, user, data, onRefresh) {
  const tasks = data.tasks || [];
  const myMarks = data.myMarks || [];
  const teamAverage = data.teamAverage;
  const mySubmissions = data.mySubmissions || [];
  const myMetrics = data.myMetrics;

  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;

  container.innerHTML = `
    <!-- Header Banner -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${user.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            Student Workspace • Team <strong>${user.team}</strong>
            ${myMetrics && myMetrics.atRisk ? `<span class="badge badge-atrisk" style="margin-left: 0.5rem;">Needs attention</span>` : ""}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Team Average</div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--teal);" class="num">
            ${teamAverage !== null ? teamAverage : "—"}
          </div>
          ${avgBand ? `<span class="badge ${avgBand.cls}">${avgBand.label}</span>` : ""}
        </div>
      </div>
    </div>

    <!-- Performance Metrics Panel & Sparkline -->
    <div style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <h3 style="font-size: 1.05rem; font-weight: 700;">My Performance</h3>
        ${
          myMarks.length > 1
            ? `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Quiz trend:</span>
            <canvas id="member-sparkline" width="140" height="38" style="vertical-align: middle;"></canvas>
          </div>
        `
            : ""
        }
      </div>
      ${renderMemberMetricsHTML(myMetrics, { title: "Metrics & Growth" })}
    </div>

    <div class="grid-2">
      <!-- Left Column: Tasks -->
      <div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">My Tasks (${tasks.length})</h3>
            <button class="btn btn-secondary btn-sm" id="btn-refresh-tasks">↻ Refresh</button>
          </div>

          <div id="tasks-list">
            ${
              tasks.length === 0
                ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No active tasks assigned to your team.</p>`
                : tasks
                    .map((task) => {
                      const submission = mySubmissions.find((s) => s.taskId === task.id);
                      const isSubmitted = !!submission;
                      const isDone = task.status === "done";

                      return `
                      <div class="task-item ${isDone ? "done" : ""}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
                          <h4 style="font-size: 0.95rem; font-weight: 700;">${task.title}</h4>
                          <span class="badge ${isDone ? "badge-done" : "badge-open"}">${task.status}</span>
                        </div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.6rem;">
                          ${task.description || "No description provided."}
                        </p>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.65rem;">
                          <span>Due: <strong>${task.dueDate || "Not set"}</strong></span>
                          <span>Scope: <strong>${task.team === "ALL" ? "All Teams" : "Team " + task.team}</strong></span>
                          ${
                            task.fileUrl
                              ? `<a href="${task.fileUrl}" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">View Attachment ↗</a>`
                              : ""
                          }
                        </div>

                        <!-- Submission Form or Status -->
                        <div style="border-top: 1px dashed var(--border-color); padding-top: 0.6rem; margin-top: 0.5rem;">
                          ${
                            isSubmitted
                              ? `
                              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;">
                                <span style="color: var(--teal); font-weight: 600;">✓ Submitted</span>
                                <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(submission.timestamp).toLocaleDateString()}</span>
                              </div>
                              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                                <em>"${submission.content || "Marked as completed"}"</em>
                              </p>
                            `
                              : `
                              <form class="task-submit-form" data-task-id="${task.id}" style="margin-top: 0.4rem;">
                                <div style="display: flex; gap: 0.5rem;">
                                  <input type="text" name="content" class="form-control" style="font-size: 0.85rem; padding: 0.45rem 0.65rem;" placeholder="Your answer, notes, or Google Drive link..." required />
                                  <button type="submit" class="btn btn-teal btn-sm" style="white-space: nowrap;">Submit</button>
                                </div>
                              </form>
                            `
                          }
                        </div>
                      </div>
                    `;
                    })
                    .join("")
            }
          </div>
        </div>
      </div>

      <!-- Right Column: My Marks & Doubt Form -->
      <div>
        <!-- My Marks -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Scorecard & Cycles</h3>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Score</th>
                  <th>Submission</th>
                  <th>Attendance</th>
                  <th>Band</th>
                </tr>
              </thead>
              <tbody>
                ${
                  myMarks.length === 0
                    ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks recorded yet.</td></tr>`
                    : myMarks
                        .map((m) => {
                          const band = getScoreBand(m.quizScore);
                          return `
                        <tr>
                          <td><strong>${m.cycle || "Cycle 1"}</strong></td>
                          <td><strong style="font-size: 0.95rem;">${m.quizScore}</strong>/100</td>
                          <td>${m.submission || "—"}</td>
                          <td>${m.attendance || "—"}</td>
                          <td><span class="badge ${band.cls}">${band.label}</span></td>
                        </tr>
                        ${
                          m.notes
                            ? `<tr><td colspan="5" style="font-size: 0.8rem; color: var(--text-muted); background-color: var(--bg-subtle); padding: 0.35rem 0.85rem;">
                                💬 <em>Notes: ${m.notes}</em>
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

        <!-- Raise a Doubt Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Raise a Doubt / Question</h3>
          </div>
          <div id="escalation-feedback"></div>
          <form id="form-raise-doubt">
            <div class="form-group">
              <label class="form-label">Topic / Subject</label>
              <input type="text" id="doubt-topic" class="form-control" placeholder="e.g. Question 3 on IS-LM model" required />
            </div>

            <div class="form-group">
              <label class="form-label">Details / Clarification</label>
              <textarea id="doubt-details" class="form-control" rows="3" placeholder="Explain what you need help with..." required></textarea>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.875rem; font-weight: 600;">
                <input type="checkbox" id="doubt-urgent" style="width: 16px; height: 16px; accent-color: var(--red);" />
                <span>This is urgent / I need the group leader directly</span>
              </label>
              <p id="doubt-hint" class="form-hint" style="color: var(--text-muted); margin-top: 0.3rem;">
                This goes to your team leader first.
              </p>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Question</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Render sparkline if multiple cycles exist
  const sparklineCanvas = container.querySelector("#member-sparkline");
  if (sparklineCanvas) {
    renderSparkline(sparklineCanvas, myMarks);
  }

  // Dynamic hint toggle
  const urgentCheckbox = container.querySelector("#doubt-urgent");
  const hintEl = container.querySelector("#doubt-hint");
  urgentCheckbox.addEventListener("change", () => {
    if (urgentCheckbox.checked) {
      hintEl.textContent = "This goes straight to the group leader.";
      hintEl.style.color = "var(--red)";
      hintEl.style.fontWeight = "600";
    } else {
      hintEl.textContent = "This goes to your team leader first.";
      hintEl.style.color = "var(--text-muted)";
      hintEl.style.fontWeight = "normal";
    }
  });

  // Task submit listener
  container.querySelectorAll(".task-submit-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const taskId = form.getAttribute("data-task-id");
      const content = form.querySelector('input[name="content"]').value;
      const btn = form.querySelector('button[type="submit"]');

      btn.disabled = true;
      btn.textContent = "Submitting...";

      try {
        const res = await apiAddSubmission({
          taskId,
          member: user.name,
          team: user.team,
          content,
          fileUrl: content.startsWith("http") ? content : "",
        });

        if (res.ok) {
          onRefresh();
        } else {
          alert(res.error || "Submission failed.");
          btn.disabled = false;
          btn.textContent = "Submit";
        }
      } catch (err) {
        alert("Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Submit";
      }
    });
  });

  // Doubt form listener
  const doubtForm = container.querySelector("#form-raise-doubt");
  doubtForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = container.querySelector("#doubt-topic").value;
    const details = container.querySelector("#doubt-details").value;
    const isUrgent = container.querySelector("#doubt-urgent").checked;
    const feedback = container.querySelector("#escalation-feedback");
    const btn = doubtForm.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
      const res = await apiAddEscalation({
        raisedBy: user.name,
        team: user.team,
        topic,
        details,
        severity: isUrgent ? "severe" : "normal",
      });

      if (res.ok) {
        feedback.innerHTML = `
          <div class="alert alert-success">
            Question submitted (${isUrgent ? "Sent to Group Leader" : "Sent to Team Leader"}).
          </div>
        `;
        doubtForm.reset();
        setTimeout(() => (feedback.innerHTML = ""), 4000);
      } else {
        feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to submit."}</div>`;
      }
    } catch (err) {
      feedback.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Submit Question";
    }
  });

  // Refresh
  container.querySelector("#btn-refresh-tasks").addEventListener("click", () => {
    onRefresh();
  });
}
