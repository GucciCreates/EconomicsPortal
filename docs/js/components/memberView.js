/**
 * EconomicsPortal — Member Dashboard Component (v3)
 */

import { apiAddSubmission, apiAddEscalation } from "../api.js";
import { getScoreBand, renderMemberMetricsHTML } from "./metricsPanel.js";
import { renderSparkline } from "./charts.js";
import { createTabNav } from "./tabNav.js";
import { renderGoalPanel } from "./goalPanel.js";
import { renderQuizScheduler, cleanupQuizCountdowns } from "./quizScheduler.js";
import { renderLeaderboard } from "./leaderboard.js";
import { renderAnnouncementsPanel } from "./announcementsPanel.js";

export function renderMemberDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const tasks = data.tasks || [];
  const myMarks = data.myMarks || [];
  const teamAverage = data.teamAverage;
  const teamAverages = data.teamAverages || {};
  const mySubmissions = data.mySubmissions || [];
  const myMetrics = data.myMetrics;
  const memberMetrics = data.memberMetrics || {};
  const quizzes = data.quizzes || [];
  const announcements = data.announcements || [];
  const myGoal = data.myGoal || null;

  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;

  container.innerHTML = `
    <!-- Header Banner -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${user.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            Student Workspace • Team <strong>${user.team}</strong>
            ${myMetrics && myMetrics.atRisk ? `<span class="badge badge-atrisk" style="margin-left: 0.5rem;">Requires attention</span>` : ""}
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
          <button class="btn btn-secondary btn-sm" id="btn-refresh-mem">↻ Refresh</button>
        </div>
      </div>
    </div>

    <!-- Tab Content Shell -->
    <div id="mem-tab-content"></div>
  `;

  const contentShell = container.querySelector("#mem-tab-content");

  const tabs = [
    { id: "overview", label: "My Scorecard & Metrics", icon: "📊" },
    { id: "goals", label: "My Goal & Progress", icon: "🎯" },
    { id: "tasks", label: `Tasks & Submit (${tasks.length})`, icon: "📝" },
    { id: "quizzes", label: `Quizzes & Tests (${quizzes.length})`, icon: "⏱️" },
    { id: "leaderboard", label: "Class Leaderboard", icon: "🏆" },
    { id: "doubts", label: "Ask a Doubt", icon: "❓" },
    { id: "announcements", label: `Announcements (${announcements.length})`, icon: "📢" },
  ];

  function switchTab(tabId) {
    if (tabId === "overview") renderOverviewTab(contentShell);
    else if (tabId === "goals") renderGoalsTab(contentShell);
    else if (tabId === "tasks") renderTasksTab(contentShell);
    else if (tabId === "quizzes") renderQuizzesTab(contentShell);
    else if (tabId === "leaderboard") renderLeaderboardTab(contentShell);
    else if (tabId === "doubts") renderDoubtsTab(contentShell);
    else if (tabId === "announcements") renderAnnouncementsTab(contentShell);
  }

  createTabNav(container.querySelector("#mem-tab-content"), tabs, switchTab);
  switchTab("overview");

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: OVERVIEW & SCORECARD
  // ─────────────────────────────────────────────────────────────────────────
  function renderOverviewTab(wrap) {
    wrap.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Performance & Growth Summary</h3>
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

      <div class="card">
        <div class="card-header"><h3 class="card-title">My Recorded Cycle Scores</h3></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Mock #</th>
                <th>Score</th>
                <th>Submission</th>
                <th>Attendance</th>
                <th>Preview</th>
                <th>Peer Rating</th>
                <th>Punctual</th>
                <th>Band</th>
                <th>Feedback / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${
                myMarks.length === 0
                  ? `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No scores recorded yet.</td></tr>`
                  : myMarks
                      .map((m) => {
                        const band = getScoreBand(m.quizScore);
                        return `
                      <tr>
                        <td><strong>${m.cycle}</strong></td>
                        <td>${m.mockNumber || "—"}</td>
                        <td><strong class="num" style="font-size: 1.05rem;">${m.quizScore}</strong></td>
                        <td>${m.submission || "—"}</td>
                        <td>${m.attendance || "—"}</td>
                        <td>${m.previewDone || "—"}</td>
                        <td>${m.peerRating || "—"}</td>
                        <td>${m.punctual || "—"}</td>
                        <td><span class="badge ${band.cls}">${band.label}</span></td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);">
                          ${m.notes || "—"}
                          ${m.editedBy ? `<br/><span style="font-size: 0.7rem; color: var(--purple);">Verified by: ${m.editedBy}</span>` : ""}
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
    `;

    setTimeout(() => {
      if (myMarks.length > 1) {
        const scores = myMarks.map((m) => Number(m.quizScore)).filter((s) => !isNaN(s));
        renderSparkline("member-sparkline", scores);
      }
    }, 50);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: GOALS
  // ─────────────────────────────────────────────────────────────────────────
  function renderGoalsTab(wrap) {
    wrap.innerHTML = `<div id="mem-goals-shell"></div>`;
    renderGoalPanel(wrap.querySelector("#mem-goals-shell"), user, myGoal, myMetrics, onRefresh);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: TASKS & SUBMIT
  // ─────────────────────────────────────────────────────────────────────────
  function renderTasksTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Assigned Tasks (${tasks.length})</h3></div>
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
                        ${task.fileUrl ? `<a href="${task.fileUrl}" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">View Attachment ↗</a>` : ""}
                      </div>

                      <div style="border-top: 1px dashed var(--border-color); padding-top: 0.6rem; margin-top: 0.5rem;">
                        ${
                          isSubmitted
                            ? `
                          <div style="font-size: 0.85rem; color: var(--teal); display: flex; justify-content: space-between; align-items: center;">
                            <span>✓ <strong>Submitted:</strong> ${submission.content || "Uploaded"}</span>
                            ${submission.fileUrl ? `<a href="${submission.fileUrl}" target="_blank" style="font-size: 0.8rem; font-weight: 600;">View File ↗</a>` : ""}
                          </div>
                        `
                            : `
                          <form class="form-submit-task" data-task-id="${task.id}">
                            <div class="form-group" style="margin-bottom: 0.5rem;">
                              <label class="form-label" style="font-size: 0.8rem;">Submission Notes / Answer summary</label>
                              <input type="text" class="form-control form-control-sm sub-content" placeholder="e.g. Completed IS-LM problem set questions 1 to 5" required />
                            </div>
                            <div class="form-group" style="margin-bottom: 0.65rem;">
                              <label class="form-label" style="font-size: 0.8rem;">Google Drive Link</label>
                              <input type="url" class="form-control form-control-sm sub-file" placeholder="https://drive.google.com/file/..." />
                            </div>
                            <button type="submit" class="btn btn-primary btn-sm">Turn In Assignment</button>
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
    `;

    wrap.querySelectorAll(".form-submit-task").forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const taskId = form.getAttribute("data-task-id");
        const content = form.querySelector(".sub-content").value;
        const fileUrl = form.querySelector(".sub-file").value;
        const btn = form.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = "Submitting...";

        try {
          const res = await apiAddSubmission({
            taskId,
            member: user.name,
            team: user.team,
            content,
            fileUrl,
          });

          if (res.ok) {
            onRefresh();
          } else {
            alert(res.error || "Failed to submit assignment.");
            btn.disabled = false;
            btn.textContent = "Turn In Assignment";
          }
        } catch (err) {
          alert("Error: " + err.message);
          btn.disabled = false;
          btn.textContent = "Turn In Assignment";
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4: QUIZZES
  // ─────────────────────────────────────────────────────────────────────────
  function renderQuizzesTab(wrap) {
    wrap.innerHTML = `<div id="mem-quiz-shell"></div>`;
    renderQuizScheduler(wrap.querySelector("#mem-quiz-shell"), user, quizzes, onRefresh);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 5: LEADERBOARD
  // ─────────────────────────────────────────────────────────────────────────
  function renderLeaderboardTab(wrap) {
    wrap.innerHTML = `<div id="mem-lb-shell"></div>`;
    renderLeaderboard(wrap.querySelector("#mem-lb-shell"), memberMetrics, teamAverages, user);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 6: DOUBTS & ESCALATIONS
  // ─────────────────────────────────────────────────────────────────────────
  function renderDoubtsTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Ask a Doubt / Request Help</h3></div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Have a question on theory, upcoming mock exams, or assignment instructions? Raise it here for Dr. Numan and Shehroz.
        </p>

        <div id="escalation-feedback"></div>

        <form id="form-add-escalation">
          <div class="form-group">
            <label class="form-label" for="esc-topic">Topic / Question Subject</label>
            <input type="text" id="esc-topic" class="form-control" placeholder="e.g. Question 3 derivation on IS-LM curve" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="esc-details">Explanation / Details</label>
            <textarea id="esc-details" class="form-control" rows="3" placeholder="Describe the question or issue clearly..." required></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="esc-severity">Urgency Level</label>
            <select id="esc-severity" class="form-control">
              <option value="normal">Normal (Review before next session)</option>
              <option value="severe">Urgent (Blocks submission / conflict)</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary" id="btn-submit-esc" style="width: 100%;">
            Send Question to Instructor & Group Leader
          </button>
        </form>
      </div>
    `;

    const escForm = wrap.querySelector("#form-add-escalation");
    if (escForm) {
      escForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const topic = wrap.querySelector("#esc-topic").value;
        const details = wrap.querySelector("#esc-details").value;
        const severity = wrap.querySelector("#esc-severity").value;
        const feedback = wrap.querySelector("#escalation-feedback");
        const submitBtn = wrap.querySelector("#btn-submit-esc");

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
          const res = await apiAddEscalation({
            raisedBy: user.name,
            team: user.team,
            topic,
            details,
            severity,
          });

          if (res.ok) {
            feedback.innerHTML = `<div class="alert alert-success">Question sent to Dr. Numan and Shehroz!</div>`;
            escForm.reset();
            setTimeout(() => {
              feedback.innerHTML = "";
              onRefresh();
            }, 2500);
          } else {
            feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to submit."}</div>`;
          }
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send Question to Instructor & Group Leader";
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 7: ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  function renderAnnouncementsTab(wrap) {
    wrap.innerHTML = `<div id="mem-ann-shell"></div>`;
    renderAnnouncementsPanel(wrap.querySelector("#mem-ann-shell"), user, announcements, onRefresh);
  }

  container.querySelector("#btn-refresh-mem").addEventListener("click", () => {
    onRefresh();
  });
}
