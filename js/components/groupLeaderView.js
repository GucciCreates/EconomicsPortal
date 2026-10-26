/**
 * EconomicsPortal — Group Leader & Instructor Dashboard Component (v2)
 */

import {
  apiAddTask,
  apiEditTask,
  apiAddMark,
  apiEditMark,
  apiDeleteMark,
  apiUpdateTaskStatus,
  apiUpdateEscalationStatus,
} from "../api.js";
import { getScoreBand } from "./metricsPanel.js";
import { TEAM_ROSTER } from "./teamLeaderView.js";
import { renderTeamAveragesChart, renderBandDistributionChart, renderSparkline } from "./charts.js";
import { openEditMarkModal, openEditTaskModal } from "./editModals.js";

export function renderGroupLeaderDashboard(container, user, data, onRefresh) {
  const isInstructor = user.role === "instructor";
  const isAssistant = user.role === "assistant";
  const isGroupLeader = user.role === "group_leader";
  const canEdit = isInstructor || isGroupLeader;

  const tasks = data.tasks || [];
  const marks = data.marks || [];
  const submissions = data.submissions || [];
  const escalations = data.escalations || [];
  const teamAverages = data.teamAverages || {};
  const atRiskMembers = data.atRiskMembers || [];
  const memberMetrics = data.memberMetrics || {};

  // Sort escalations: severe first, then open first
  const sortedEscalations = [...escalations].sort((a, b) => {
    if (a.severity === "severe" && b.severity !== "severe") return -1;
    if (a.severity !== "severe" && b.severity === "severe") return 1;
    if (a.status === "open" && b.status === "closed") return -1;
    if (a.status === "closed" && b.status === "open") return 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const teams = ["Shehroz", "Amina", "Ayesha", "Lareb"];

  container.innerHTML = `
    <!-- Top Header Banner -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700;">
            ${isInstructor ? "Instructor Workspace — Dr. Numan" : isAssistant ? "Group Assistant — " + user.name : "Group Leader — " + user.name}
          </h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            ${
              isInstructor
                ? "Academic Oversight & Verification • Audit and Edit Rights Enabled"
                : isAssistant
                ? "Class Recordkeeping & Support Workspace (Read-only)"
                : "Full Class Oversight • 17 Members • 4 Teams"
            }
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${
            isInstructor
              ? `<span class="badge" style="background-color: var(--purple-soft); color: var(--purple); font-weight: 600;">Instructor View — Changes logged</span>`
              : ""
          }
          <button class="btn btn-secondary btn-sm" id="btn-refresh-gl">↻ Refresh Data</button>
        </div>
      </div>
    </div>

    <!-- At-Risk Members Panel (High Priority: Displayed First) -->
    ${
      atRiskMembers.length > 0
        ? `
      <div class="at-risk-panel">
        <div class="at-risk-title">⚠️ At-Risk Alert (${atRiskMembers.length} members require support)</div>
        <p style="font-size: 0.85rem; margin-bottom: 0.6rem;">
          These students failed the two most recent cycles (quiz score &lt; 50 or missing submission).
        </p>
        <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
          ${atRiskMembers
            .map((m) => {
              const name = m.member || m.name;
              return `
              <span class="badge badge-support" style="padding: 0.3rem 0.6rem; cursor: pointer;" data-followup="${name}">
                ${name} (Team ${m.team}) • Follow up ↗
              </span>
            `;
            })
            .join(" ")}
        </div>
      </div>
    `
        : ""
    }

    <!-- Visual Analytics: Team Comparison & Rating Band Distribution -->
    <div class="grid-2" style="margin-bottom: 1.25rem;">
      <!-- Chart 1: Team Averages Comparison -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Team Averages Comparison</h3>
        </div>
        <div style="height: 180px; position: relative;">
          <canvas id="chart-team-averages"></canvas>
        </div>
        <p class="form-hint" style="text-align: center; margin-top: 0.5rem;">
          Mean score per team (Color-coded by performance band)
        </p>
      </div>

      <!-- Chart 2: Rating Band Distribution -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Class Rating Distribution</h3>
        </div>
        <div style="height: 180px; position: relative;">
          <canvas id="chart-band-dist"></canvas>
        </div>
        <p class="form-hint" style="text-align: center; margin-top: 0.5rem;">
          Cohort distribution across score tiers
        </p>
      </div>
    </div>

    <!-- 4 Teams Overview Tiles -->
    <div style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
        <h3 style="font-size: 1.05rem; font-weight: 700;">Teams Overview</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Click a team to filter ledger</span>
      </div>
      <div class="grid-4" id="team-cards-grid">
        ${teams
          .map((t) => {
            const avg = teamAverages[t] !== undefined ? teamAverages[t] : null;
            const band = avg !== null ? getScoreBand(avg) : null;
            const memberCount = (TEAM_ROSTER[t] || []).length;
            return `
            <div class="stat-tile team-filter-card" data-team="${t}">
              <div class="stat-title">Team ${t}</div>
              <div class="stat-val num">${avg !== null ? avg : "—"}</div>
              <div style="margin-top: 0.35rem;">
                ${band ? `<span class="badge ${band.cls}">${band.label}</span>` : `<span style="color: var(--text-muted); font-size: 0.75rem;">No scores</span>`}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">
                ${memberCount} members
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>

    <!-- Class Marks Ledger -->
    <div class="card" style="margin-bottom: 1.5rem;" id="ledger-card">
      <div class="card-header">
        <h3 class="card-title" id="marks-panel-title">Class Scorecard Ledger</h3>
        <button class="btn btn-secondary btn-sm" id="btn-show-all-marks">Show All Teams</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Team</th>
              <th>Cycle</th>
              <th>Score</th>
              <th>Sub</th>
              <th>Att</th>
              <th>Preview</th>
              <th>Peer</th>
              <th>Punctual</th>
              <th>Band</th>
              <th>Notes / Edited</th>
              ${canEdit ? `<th>Actions</th>` : ""}
            </tr>
          </thead>
          <tbody id="gl-marks-tbody">
            ${renderMarksRows(marks)}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Action Forms (Hidden for Assistant) -->
    ${
      canEdit
        ? `
      <div class="grid-2" style="margin-bottom: 1.5rem;">
        <!-- Assign Task Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Assign a Task</h3>
          </div>
          <div id="task-feedback"></div>
          <form id="form-gl-add-task">
            <div class="form-group">
              <label class="form-label">Task Title</label>
              <input type="text" id="gl-task-title" class="form-control" placeholder="e.g. Cycle 2 Macroeconomics Problem Set" required />
            </div>

            <div class="form-group">
              <label class="form-label">Description / Instructions</label>
              <textarea id="gl-task-desc" class="form-control" rows="2" placeholder="Task requirements..." required></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Assign To</label>
                <select id="gl-task-team" class="form-control" required>
                  <option value="ALL">All Teams (Class-wide)</option>
                  <option value="Shehroz">Team Shehroz</option>
                  <option value="Amina">Team Amina</option>
                  <option value="Ayesha">Team Ayesha</option>
                  <option value="Lareb">Team Lareb</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" id="gl-task-due" class="form-control" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Google Drive Link</label>
              <input type="url" id="gl-task-file" class="form-control" placeholder="https://drive.google.com/..." />
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Create & Assign Task</button>
          </form>
        </div>

        <!-- Enter Marks Form (v2) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Enter Marks (v2)</h3>
          </div>
          <div id="gl-mark-feedback"></div>
          <form id="form-gl-add-mark">
            <div class="form-group">
              <label class="form-label">Student</label>
              <select id="gl-mark-member" class="form-control" required>
                <option value="">-- Choose Member --</option>
                ${Object.keys(TEAM_ROSTER)
                  .map(
                    (teamName) => `
                  <optgroup label="Team ${teamName}">
                    ${TEAM_ROSTER[teamName]
                      .map((mem) => `<option value="${mem}" data-team="${teamName}">${mem} (Team ${teamName})</option>`)
                      .join("")}
                  </optgroup>
                `
                  )
                  .join("")}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Cycle</label>
                <input type="text" id="gl-mark-cycle" class="form-control" value="Cycle 2" required />
              </div>
              <div class="form-group">
                <label class="form-label">Mock # (Sprint weeks)</label>
                <input type="number" id="gl-mark-mock" class="form-control" placeholder="Optional" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Quiz Score (0-100)</label>
                <input type="number" id="gl-mark-quiz" class="form-control" min="0" max="100" placeholder="e.g. 88" required />
              </div>
              <div class="form-group">
                <label class="form-label">Submission</label>
                <select id="gl-mark-sub" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Attendance</label>
                <input type="text" id="gl-mark-att" class="form-control" value="100%" />
              </div>
              <div class="form-group">
                <label class="form-label">Preview Done</label>
                <select id="gl-mark-prev" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Peer Rating (1-5)</label>
                <input type="number" step="0.1" min="1" max="5" id="gl-mark-peer" class="form-control" placeholder="e.g. 4.5" />
              </div>
              <div class="form-group">
                <label class="form-label">Punctual</label>
                <select id="gl-mark-punctual" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Performance Notes</label>
              <input type="text" id="gl-mark-notes" class="form-control" placeholder="Observations, strengths..." />
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Save Mark</button>
          </form>
        </div>
      </div>
    `
        : ""
    }

    <!-- Tasks & Escalations Grid -->
    <div class="grid-2">
      <!-- Tasks Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All Tasks (${tasks.length})</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Team</th>
                <th>Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                tasks.length === 0
                  ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No tasks assigned yet.</td></tr>`
                  : tasks
                      .map((task) => {
                        const isDone = task.status === "done";
                        return `
                      <tr>
                        <td>
                          <strong>${task.title}</strong>
                          ${task.fileUrl ? `<br/><a href="${task.fileUrl}" target="_blank" style="font-size: 0.75rem;">Drive Link ↗</a>` : ""}
                        </td>
                        <td><span class="badge" style="background-color: var(--bg-subtle);">${task.team}</span></td>
                        <td style="font-size: 0.8rem; white-space: nowrap;">${task.dueDate || "—"}</td>
                        <td><span class="badge ${isDone ? "badge-done" : "badge-open"}">${task.status}</span></td>
                        <td>
                          <div style="display: flex; gap: 0.35rem; align-items: center;">
                            ${
                              canEdit
                                ? `
                              <button class="btn btn-secondary btn-sm btn-edit-task" data-id="${task.id}" title="Edit task">
                                ✏️
                              </button>
                              <button class="btn btn-secondary btn-sm btn-toggle-task" data-id="${task.id}" data-current="${task.status}">
                                ${isDone ? "Reopen" : "Done"}
                              </button>
                            `
                                : "—"
                            }
                          </div>
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

      <!-- Escalations Log -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Doubts & Escalation Log (${escalations.length})</h3>
        </div>
        <div>
          ${
            sortedEscalations.length === 0
              ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No escalations or questions reported.</p>`
              : sortedEscalations
                  .map((esc) => {
                    const isSevere = esc.severity === "severe";
                    const isClosed = esc.status === "closed";
                    return `
                    <div class="escalation-item ${isSevere ? "severe" : ""}">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
                        <h4 style="font-size: 0.95rem; font-weight: 700;">${esc.topic}</h4>
                        <div style="display: flex; gap: 0.35rem; align-items: center;">
                          ${isSevere ? `<span class="badge badge-atrisk">URGENT</span>` : ""}
                          <span class="badge ${isClosed ? "badge-closed" : "badge-open"}">${esc.status}</span>
                        </div>
                      </div>
                      <p style="font-size: 0.85rem; margin-bottom: 0.35rem;">${esc.details}</p>
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                        <span>From: <strong>${esc.raisedBy}</strong> (Team ${esc.team}) • ${new Date(esc.timestamp).toLocaleDateString()}</span>
                        ${
                          !isClosed && canEdit
                            ? `
                          <button class="btn btn-teal btn-sm btn-resolve-esc" data-id="${esc.id}">
                            Mark Resolved ✓
                          </button>
                        `
                            : ""
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

    <!-- Submissions Table -->
    <div class="card" style="margin-top: 1.5rem;">
      <div class="card-header">
        <h3 class="card-title">Class Submissions Tracker (${submissions.length})</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Team</th>
              <th>Task</th>
              <th>Submission Content</th>
              <th>Link</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${
              submissions.length === 0
                ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No submissions yet.</td></tr>`
                : submissions
                    .map((s) => {
                      return `
                    <tr>
                      <td><strong>${s.member}</strong></td>
                      <td><span class="badge" style="background-color: var(--bg-subtle);">${s.team}</span></td>
                      <td style="font-size: 0.8rem; font-family: monospace;">${s.taskId}</td>
                      <td>${s.content || "Completed"}</td>
                      <td>${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank">Drive Link ↗</a>` : "—"}</td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(s.timestamp).toLocaleDateString()}</td>
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

  // Render Analytics Charts
  setTimeout(() => {
    renderTeamAveragesChart("chart-team-averages", teamAverages);
    renderBandDistributionChart("chart-band-dist", memberMetrics, marks);
  }, 50);

  // Helper row renderer for marks table
  function renderMarksRows(marksList) {
    if (!marksList || marksList.length === 0) {
      return `<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks recorded.</td></tr>`;
    }
    return marksList
      .map((m) => {
        const band = getScoreBand(m.quizScore);
        return `
        <tr id="mark-row-${m.id}" data-member="${m.member}">
          <td><strong>${m.member}</strong></td>
          <td><span class="badge" style="background-color: var(--bg-subtle);">${m.team}</span></td>
          <td>${m.cycle}</td>
          <td><strong class="num" style="font-size: 0.95rem;">${m.quizScore}</strong></td>
          <td>${m.submission || "—"}</td>
          <td>${m.attendance || "—"}</td>
          <td>${m.previewDone || "—"}</td>
          <td>${m.peerRating || "—"}</td>
          <td>${m.punctual || "—"}</td>
          <td><span class="badge ${band.cls}">${band.label}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 180px;">
            ${m.notes || "—"}
            ${m.editedBy ? `<br/><span style="font-size: 0.7rem; color: var(--purple);">Edited by: ${m.editedBy}</span>` : ""}
          </td>
          ${
            canEdit
              ? `
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button class="btn btn-secondary btn-sm btn-edit-mark" data-id="${m.id}" title="Edit mark">
                  ✏️
                </button>
                ${
                  isInstructor
                    ? `
                  <button class="btn btn-danger btn-sm btn-delete-mark" data-id="${m.id}" data-member="${m.member}" title="Delete mark entry">
                    🗑️
                  </button>
                `
                    : ""
                }
              </div>
            </td>
          `
              : ""
          }
        </tr>
      `;
      })
      .join("");
  }

  // Follow-up scroll shortcut from At-Risk Panel
  container.querySelectorAll("[data-followup]").forEach((badge) => {
    badge.addEventListener("click", () => {
      const memName = badge.getAttribute("data-followup");
      const targetRow = container.querySelector(`tr[data-member="${memName}"]`);
      if (targetRow) {
        targetRow.scrollIntoView({ behavior: "smooth", block: "center" });
        targetRow.classList.add("row-updated");
        setTimeout(() => targetRow.classList.remove("row-updated"), 2000);
      }
    });
  });

  // Team Filtering
  const teamCards = container.querySelectorAll(".team-filter-card");
  const marksTbody = container.querySelector("#gl-marks-tbody");
  const marksTitle = container.querySelector("#marks-panel-title");

  teamCards.forEach((card) => {
    card.addEventListener("click", () => {
      teamCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const chosenTeam = card.getAttribute("data-team");
      marksTitle.textContent = `Class Scorecard Ledger — Team ${chosenTeam}`;
      const filtered = marks.filter((m) => m.team === chosenTeam);
      marksTbody.innerHTML = renderMarksRows(filtered);
      attachMarksActions();
    });
  });

  container.querySelector("#btn-show-all-marks").addEventListener("click", () => {
    teamCards.forEach((c) => c.classList.remove("active"));
    marksTitle.textContent = `Class Scorecard Ledger (All Teams)`;
    marksTbody.innerHTML = renderMarksRows(marks);
    attachMarksActions();
  });

  function attachMarksActions() {
    // Edit Mark
    container.querySelectorAll(".btn-edit-mark").forEach((btn) => {
      btn.addEventListener("click", () => {
        const markId = btn.getAttribute("data-id");
        const mark = marks.find((m) => m.id === markId);
        if (!mark) return;

        openEditMarkModal(mark, async (fields) => {
          try {
            const res = await apiEditMark({
              role: user.role,
              name: user.name,
              id: markId,
              fields,
            });
            if (res.ok) onRefresh();
            else alert(res.error || "Edit failed.");
          } catch (err) {
            alert(err.message);
          }
        });
      });
    });

    // Delete Mark (Instructor Only)
    container.querySelectorAll(".btn-delete-mark").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const markId = btn.getAttribute("data-id");
        const member = btn.getAttribute("data-member");
        if (confirm(`Delete mark entry for ${member}? This cannot be undone.`)) {
          try {
            const res = await apiDeleteMark({
              role: user.role,
              id: markId,
            });
            if (res.ok) onRefresh();
            else alert(res.error || "Delete failed.");
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });
  }

  attachMarksActions();

  // Edit Task
  container.querySelectorAll(".btn-edit-task").forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskId = btn.getAttribute("data-id");
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      openEditTaskModal(task, async (fields) => {
        try {
          const res = await apiEditTask({
            role: user.role,
            id: taskId,
            fields,
          });
          if (res.ok) onRefresh();
          else alert(res.error || "Task edit failed.");
        } catch (err) {
          alert(err.message);
        }
      });
    });
  });

  // Task status toggle
  container.querySelectorAll(".btn-toggle-task").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const taskId = btn.getAttribute("data-id");
      const current = btn.getAttribute("data-current");
      const next = current === "done" ? "open" : "done";
      btn.disabled = true;

      try {
        const res = await apiUpdateTaskStatus(taskId, next, user.role);
        if (res.ok) onRefresh();
        else alert(res.error || "Update failed.");
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Escalation resolve
  container.querySelectorAll(".btn-resolve-esc").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const escId = btn.getAttribute("data-id");
      btn.disabled = true;

      try {
        const res = await apiUpdateEscalationStatus(escId, "closed", user.role);
        if (res.ok) onRefresh();
        else alert(res.error || "Update failed.");
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Add Task Form
  if (canEdit) {
    const taskForm = container.querySelector("#form-gl-add-task");
    if (taskForm) {
      taskForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = container.querySelector("#gl-task-title").value;
        const description = container.querySelector("#gl-task-desc").value;
        const team = container.querySelector("#gl-task-team").value;
        const dueDate = container.querySelector("#gl-task-due").value;
        const fileUrl = container.querySelector("#gl-task-file").value;
        const feedback = container.querySelector("#task-feedback");
        const btn = taskForm.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = "Assigning...";

        try {
          const res = await apiAddTask({
            role: user.role,
            createdBy: user.name,
            title,
            description,
            team,
            dueDate,
            fileUrl,
          });

          if (res.ok) {
            feedback.innerHTML = `<div class="alert alert-success">Task assigned successfully!</div>`;
            taskForm.reset();
            setTimeout(() => (feedback.innerHTML = ""), 3000);
            onRefresh();
          } else {
            feedback.innerHTML = `<div class="alert alert-error">${res.error || "Failed to create task."}</div>`;
          }
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.textContent = "Create & Assign Task";
        }
      });
    }

    // Add Mark Form
    const markForm = container.querySelector("#form-gl-add-mark");
    if (markForm) {
      markForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const selectEl = container.querySelector("#gl-mark-member");
        const member = selectEl.value;
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const team = selectedOption.getAttribute("data-team");
        const cycle = container.querySelector("#gl-mark-cycle").value;
        const mockNumber = container.querySelector("#gl-mark-mock").value;
        const quizScore = container.querySelector("#gl-mark-quiz").value;
        const submission = container.querySelector("#gl-mark-sub").value;
        const attendance = container.querySelector("#gl-mark-att").value;
        const previewDone = container.querySelector("#gl-mark-prev").value;
        const peerRating = container.querySelector("#gl-mark-peer").value;
        const punctual = container.querySelector("#gl-mark-punctual").value;
        const notes = container.querySelector("#gl-mark-notes").value;
        const feedback = container.querySelector("#gl-mark-feedback");
        const btn = markForm.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
          const res = await apiAddMark({
            role: user.role,
            name: user.name,
            member,
            team,
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
    }
  }

  // Refresh
  container.querySelector("#btn-refresh-gl").addEventListener("click", () => {
    onRefresh();
  });
}
