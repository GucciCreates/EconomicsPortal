/**
 * EconomicsPortal — Member Dashboard Component
 */

import { apiAddSubmission, apiAddEscalation } from "../api.js";

export function getScoreBand(score) {
  const num = Number(score);
  if (isNaN(num)) return { label: "N/A", cls: "badge-attention" };
  if (num >= 85) return { label: "Outstanding", cls: "badge-outstanding" };
  if (num >= 70) return { label: "Strong", cls: "badge-strong" };
  if (num >= 50) return { label: "Needs attention", cls: "badge-attention" };
  return { label: "Support plan", cls: "badge-support" };
}

export function renderMemberDashboard(container, user, data, onRefresh) {
  const tasks = data.tasks || [];
  const myMarks = data.myMarks || [];
  const teamAverage = data.teamAverage;
  const mySubmissions = data.mySubmissions || [];

  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;

  container.innerHTML = `
    <!-- Header Banner -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.4rem; font-weight: 700;">Welcome, ${user.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            Team: <strong style="color: var(--text-main);">${user.team}</strong> • Member Workspace
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Team Average</div>
          <div style="font-size: 1.75rem; font-weight: 800; color: var(--primary);">
            ${teamAverage !== null ? teamAverage : "—"}
          </div>
          ${avgBand ? `<span class="badge ${avgBand.cls}">${avgBand.label}</span>` : ""}
        </div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Left Column: Tasks & Submissions -->
      <div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📝 My Tasks (${tasks.length})</h3>
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
                      <div class="task-item ${isDone ? "done" : ""}" id="task-card-${task.id}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                          <h4 style="font-size: 1rem; font-weight: 700;">${task.title}</h4>
                          <span class="badge ${isDone ? "badge-done" : "badge-open"}">${task.status}</span>
                        </div>
                        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.65rem;">
                          ${task.description || "No description provided."}
                        </p>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                          <span>📅 Due: <strong>${task.dueDate || "Not set"}</strong></span>
                          <span>👥 Scope: <strong>${task.team === "ALL" ? "All Teams" : "Team " + task.team}</strong></span>
                          ${
                            task.fileUrl
                              ? `<a href="${task.fileUrl}" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">📎 View Attachment / Drive File ↗</a>`
                              : ""
                          }
                        </div>

                        <!-- Submission Status or Form -->
                        <div style="border-top: 1px dashed var(--border-color); padding-top: 0.65rem; margin-top: 0.5rem;">
                          ${
                            isSubmitted
                              ? `
                              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem;">
                                <span style="color: #059669; font-weight: 600;">✓ Submitted</span>
                                <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(submission.timestamp).toLocaleDateString()}</span>
                              </div>
                              <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                                <em>"${submission.content || "Marked as completed"}"</em>
                              </p>
                              ${submission.fileUrl ? `<a href="${submission.fileUrl}" target="_blank" style="font-size: 0.75rem;">Link provided ↗</a>` : ""}
                            `
                              : `
                              <form class="task-submit-form" data-task-id="${task.id}" style="margin-top: 0.4rem;">
                                <div style="display: flex; gap: 0.5rem;">
                                  <input type="text" name="content" class="form-control" style="font-size: 0.85rem; padding: 0.45rem 0.65rem;" placeholder="Your answer, notes, or Google Drive link..." required />
                                  <button type="submit" class="btn btn-primary btn-sm" style="white-space: nowrap;">Submit</button>
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

      <!-- Right Column: My Marks & Escalation/Doubt -->
      <div>
        <!-- My Marks -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📊 My Performance & Marks</h3>
          </div>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Quiz Score</th>
                  <th>Submission</th>
                  <th>Attendance</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                ${
                  myMarks.length === 0
                    ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks recorded yet for this cycle.</td></tr>`
                    : myMarks
                        .map((m) => {
                          const band = getScoreBand(m.quizScore);
                          return `
                        <tr>
                          <td><strong>${m.cycle || "Cycle 1"}</strong></td>
                          <td><strong style="font-size: 1rem;">${m.quizScore}</strong>/100</td>
                          <td>${m.submission || "—"}</td>
                          <td>${m.attendance || "—"}</td>
                          <td><span class="badge ${band.cls}">${band.label}</span></td>
                        </tr>
                        ${
                          m.notes
                            ? `<tr><td colspan="5" style="font-size: 0.8rem; color: var(--text-muted); background-color: var(--bg-subtle); padding: 0.4rem 0.9rem;">
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

        <!-- Raise a Doubt / Escalation -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">❓ Raise a Doubt / Question</h3>
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
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; font-weight: 600;">
                <input type="checkbox" id="doubt-urgent" style="width: 17px; height: 17px; accent-color: #ef4444;" />
                <span>This is urgent / I need the group leader directly</span>
              </label>
              <p id="doubt-hint" class="form-hint" style="color: var(--text-muted); margin-top: 0.35rem;">
                ℹ️ This goes to your team leader first.
              </p>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Question</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Dynamic hint toggle
  const urgentCheckbox = container.querySelector("#doubt-urgent");
  const hintEl = container.querySelector("#doubt-hint");
  urgentCheckbox.addEventListener("change", () => {
    if (urgentCheckbox.checked) {
      hintEl.textContent = "🚨 This goes straight to the group leader.";
      hintEl.style.color = "#dc2626";
      hintEl.style.fontWeight = "600";
    } else {
      hintEl.textContent = "ℹ️ This goes to your team leader first.";
      hintEl.style.color = "var(--text-muted)";
      hintEl.style.fontWeight = "normal";
    }
  });

  // Handle task submissions
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
        alert("Error submitting task: " + err.message);
        btn.disabled = false;
        btn.textContent = "Submit";
      }
    });
  });

  // Handle Doubt submission
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
            ✓ Your question has been submitted successfully (${isUrgent ? "Sent to Group Leader" : "Sent to Team Leader"}).
          </div>
        `;
        doubtForm.reset();
        hintEl.textContent = "ℹ️ This goes to your team leader first.";
        hintEl.style.color = "var(--text-muted)";
        hintEl.style.fontWeight = "normal";
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

  // Refresh button
  container.querySelector("#btn-refresh-tasks").addEventListener("click", () => {
    onRefresh();
  });
}
