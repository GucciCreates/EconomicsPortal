/**
 * EconomicsPortal — Team Leader Dashboard Component (v3)
 */

import { apiAddMark, apiUpdateTaskStatus } from "../api.js";
import { getScoreBand, renderMemberMetricsHTML } from "./metricsPanel.js";
import { renderSparkline } from "./charts.js";
import { createTabNav } from "./tabNav.js";
import { renderAnnouncementsPanel } from "./announcementsPanel.js";
import { renderQuizScheduler, cleanupQuizCountdowns } from "./quizScheduler.js";
import { renderLeaderboard } from "./leaderboard.js";

export const TEAM_ROSTER = {
  Shehroz: ["Gorsi", "Haris"],
  Amina: ["Amina", "Ramesh", "Mamoon", "Tazneem"],
  Ayesha: ["Ayesha (Quetta)", "Minal", "Anika", "Ahmed bin Nasir"],
  Lareb: ["Lareb", "Shaiman", "Aisha Amjad", "Haseeb"],
};

export function renderTeamLeaderDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const tasks = data.tasks || [];
  const marks = data.marks || [];
  const submissions = data.submissions || [];
  const escalations = data.escalations || [];
  const announcements = data.announcements || [];
  const quizzes = data.quizzes || [];
  const teamAverage = data.teamAverage;
  const teamAverages = data.teamAverages || {};
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
      <div class="at-risk-panel" style="margin-bottom: 1.25rem;">
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

    <!-- Tab Content Shell -->
    <div id="tl-tab-content"></div>
  `;

  const contentShell = container.querySelector("#tl-tab-content");

  const tabs = [
    { id: "members", label: "Team Members & Roster", icon: "👥" },
    { id: "tasks", label: `Tasks & Log Marks (${tasks.length})`, icon: "📋" },
    { id: "quizzes", label: `Quizzes & Tests (${quizzes.length})`, icon: "⏱️" },
    { id: "leaderboard", label: "Class Leaderboard", icon: "🏆" },
    { id: "announcements", label: `Announcements (${announcements.length})`, icon: "📢" },
  ];

  function switchTab(tabId) {
    if (tabId === "members") renderMembersTab(contentShell);
    else if (tabId === "tasks") renderTasksTab(contentShell);
    else if (tabId === "quizzes") renderQuizzesTab(contentShell);
    else if (tabId === "leaderboard") renderLeaderboardTab(contentShell);
    else if (tabId === "announcements") renderAnnouncementsTab(contentShell);
  }

  createTabNav(container.querySelector("#tl-tab-content"), tabs, switchTab);
  switchTab("members");

  function renderMembersTab(wrap) {
    wrap.innerHTML = `
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header">
          <h3 class="card-title">Team ${user.team} Roster & Performance Profiles</h3>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${teamMembers
            .map((memberName) => {
              const memData = memberMetrics[memberName];
              const memMarks = marks.filter((m) => m.member.toLowerCase() === memberName.toLowerCase());
              return `
              <div style="border: 1px solid var(--border-color); border-radius: var(--radius); padding: 1rem; background-color: var(--bg-surface);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <h4 style="font-size: 1rem; font-weight: 700;">${memberName}</h4>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    ${memMarks.length > 1 ? `<canvas id="sparkline-${memberName.replace(/\s+/g, "_")}" width="120" height="32"></canvas>` : ""}
                    <span class="badge" style="background: var(--bg-subtle);">Team ${user.team}</span>
                  </div>
                </div>
                ${renderMemberMetricsHTML(memData, { compact: true })}
              </div>
            `;
            })
            .join("")}
        </div>
      </div>
    `;

    setTimeout(() => {
      teamMembers.forEach((memberName) => {
        const memMarks = marks.filter((m) => m.member.toLowerCase() === memberName.toLowerCase());
        if (memMarks.length > 1) {
          const scores = memMarks.map((m) => Number(m.quizScore)).filter((s) => !isNaN(s));
          const canvasId = `sparkline-${memberName.replace(/\s+/g, "_")}`;
          renderSparkline(canvasId, scores);
        }
      });
    }, 50);
  }

  function renderTasksTab(wrap) {
    wrap.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Team Tasks (${tasks.length})</h3></div>
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
                              : `<span style="color: var(--teal); font-weight: 600;">Completed</span>`
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

        <div class="card">
          <div class="card-header"><h3 class="card-title">Log Marks for Team Member</h3></div>
          <div id="tl-mark-feedback"></div>
          <form id="form-tl-add-mark">
            <div class="form-group">
              <label class="form-label">Member</label>
              <select id="tl-mark-member" class="form-control" required>
                <option value="">-- Choose Member --</option>
                ${teamMembers.map((m) => `<option value="${m}">${m}</option>`).join("")}
              </select>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Cycle</label>
                <input type="text" id="tl-mark-cycle" class="form-control" value="Cycle 2" required />
              </div>
              <div class="form-group">
                <label class="form-label">Mock #</label>
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
                <label class="form-label">Attendance</label>
                <input type="text" id="tl-mark-att" class="form-control" value="100%" />
              </div>
              <div class="form-group">
                <label class="form-label">Preview Done</label>
                <select id="tl-mark-prev" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Peer Rating (1-5)</label>
                <input type="number" step="0.1" min="1" max="5" id="tl-mark-peer" class="form-control" placeholder="4.5" />
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
              <label class="form-label">Notes</label>
              <input type="text" id="tl-mark-notes" class="form-control" placeholder="Performance notes..." />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">Save Team Mark</button>
          </form>
        </div>
      </div>
    `;

    // Handlers
    wrap.querySelectorAll(".btn-relay-task").forEach((btn) => {
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

    const form = wrap.querySelector("#form-tl-add-mark");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const member = wrap.querySelector("#tl-mark-member").value;
        const cycle = wrap.querySelector("#tl-mark-cycle").value;
        const mockNumber = wrap.querySelector("#tl-mark-mock").value;
        const quizScore = wrap.querySelector("#tl-mark-quiz").value;
        const submission = wrap.querySelector("#tl-mark-sub").value;
        const attendance = wrap.querySelector("#tl-mark-att").value;
        const previewDone = wrap.querySelector("#tl-mark-prev").value;
        const peerRating = wrap.querySelector("#tl-mark-peer").value;
        const punctual = wrap.querySelector("#tl-mark-punctual").value;
        const notes = wrap.querySelector("#tl-mark-notes").value;
        const feedback = wrap.querySelector("#tl-mark-feedback");
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

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
            feedback.innerHTML = `<div class="alert alert-success">Mark recorded for ${member}!</div>`;
            form.reset();
            setTimeout(() => (feedback.innerHTML = ""), 3000);
            onRefresh();
          } else {
            feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to save mark."}</div>`;
          }
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Save Team Mark";
        }
      });
    }
  }

  function renderQuizzesTab(wrap) {
    wrap.innerHTML = `<div id="tl-quiz-shell"></div>`;
    renderQuizScheduler(wrap.querySelector("#tl-quiz-shell"), user, quizzes, onRefresh);
  }

  function renderLeaderboardTab(wrap) {
    wrap.innerHTML = `<div id="tl-lb-shell"></div>`;
    renderLeaderboard(wrap.querySelector("#tl-lb-shell"), memberMetrics, teamAverages, user);
  }

  function renderAnnouncementsTab(wrap) {
    wrap.innerHTML = `<div id="tl-ann-shell"></div>`;
    renderAnnouncementsPanel(wrap.querySelector("#tl-ann-shell"), user, announcements, onRefresh);
  }

  container.querySelector("#btn-refresh-tl").addEventListener("click", () => {
    onRefresh();
  });
}
