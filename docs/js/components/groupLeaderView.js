/**
 * EconomicsPortal — Group Leader & Assistant Dashboard Component
 */

import { apiAddTask, apiAddMark, apiUpdateTaskStatus, apiUpdateEscalationStatus } from "../api.js";
import { getScoreBand } from "./memberView.js";
import { TEAM_ROSTER } from "./teamLeaderView.js";

export function renderGroupLeaderDashboard(container, user, data, onRefresh) {
  const isAssistant = user.role === "assistant";
  const tasks = data.tasks || [];
  const marks = data.marks || [];
  const submissions = data.submissions || [];
  const escalations = data.escalations || [];
  const teamAverages = data.teamAverages || {};

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
          <h2 style="font-size: 1.4rem; font-weight: 700;">
            ${isAssistant ? "Group Assistant — " + user.name : "Group Leader — " + user.name}
          </h2>
          <p style="color: var(--text-muted); font-size: 0.9rem;">
            ${
              isAssistant
                ? "Class Recordkeeping & Support Workspace (Read-only for Marks & Tasks)"
                : "Full Class Oversight • 17 Members • 4 Teams"
            }
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button class="btn btn-secondary btn-sm" id="btn-refresh-gl">↻ Refresh Data</button>
        </div>
      </div>
    </div>

    <!-- 4 Teams Overview Cards -->
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="font-size: 1.1rem; font-weight: 700;">All Teams Overview</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Click a team card to filter team marks</span>
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
              <div class="stat-val">${avg !== null ? avg : "—"}</div>
              <div class="stat-sub">
                ${band ? `<span class="badge ${band.cls}">${band.label}</span>` : `<span style="color: var(--text-muted);">No scores yet</span>`}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.4rem;">
                ${memberCount} members
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>

    <!-- Active Team Marks Panel (shown when team card clicked or all by default) -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div class="card-header">
        <h3 class="card-title" id="marks-panel-title">📊 Class Scorecard (All Teams)</h3>
        <button class="btn btn-secondary btn-sm" id="btn-show-all-marks">Show All</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Team</th>
              <th>Cycle</th>
              <th>Quiz Score</th>
              <th>Submission</th>
              <th>Attendance</th>
              <th>Band</th>
              <th>Notes</th>
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
      !isAssistant
        ? `
      <div class="grid-2" style="margin-bottom: 1.5rem;">
        <!-- Assign Task Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📌 Assign a Task</h3>
          </div>
          <div id="task-feedback"></div>
          <form id="form-gl-add-task">
            <div class="form-group">
              <label class="form-label">Task Title</label>
              <input type="text" id="gl-task-title" class="form-control" placeholder="e.g. Cycle 2 Macroeconomics Problem Set" required />
            </div>

            <div class="form-group">
              <label class="form-label">Description / Instructions</label>
              <textarea id="gl-task-desc" class="form-control" rows="2" placeholder="Task requirements, instructions, and deliverables..." required></textarea>
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
              <label class="form-label">File / Reference URL (Google Drive Share Link)</label>
              <input type="url" id="gl-task-file" class="form-control" placeholder="https://drive.google.com/..." />
              <p class="form-hint">Paste a Google Drive share link for the quiz or assignment document.</p>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Create & Assign Task</button>
          </form>
        </div>

        <!-- Enter Marks Form -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">✍️ Enter Marks</h3>
          </div>
          <div id="gl-mark-feedback"></div>
          <form id="form-gl-add-mark">
            <div class="form-group">
              <label class="form-label">Select Student (Spans All Teams)</label>
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
                <input type="text" id="gl-mark-cycle" class="form-control" value="Cycle 1" required />
              </div>
              <div class="form-group">
                <label class="form-label">Quiz Score (0-100)</label>
                <input type="number" id="gl-mark-quiz" class="form-control" min="0" max="100" placeholder="e.g. 88" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Submission Rate</label>
                <input type="text" id="gl-mark-sub" class="form-control" value="100%" required />
              </div>
              <div class="form-group">
                <label class="form-label">Attendance Rate</label>
                <input type="text" id="gl-mark-att" class="form-control" value="100%" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Performance Notes / Feedback</label>
              <input type="text" id="gl-mark-notes" class="form-control" placeholder="Observations, key strengths..." />
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
      <!-- All Tasks Table -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📝 All Tasks (${tasks.length})</h3>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Team</th>
                <th>Due</th>
                <th>Status</th>
                <th>Action</th>
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
                          ${task.fileUrl ? `<br/><a href="${task.fileUrl}" target="_blank" style="font-size: 0.75rem;">Attachment ↗</a>` : ""}
                        </td>
                        <td><span class="badge" style="background-color: var(--bg-subtle);">${task.team}</span></td>
                        <td style="font-size: 0.8rem; white-space: nowrap;">${task.dueDate || "—"}</td>
                        <td><span class="badge ${isDone ? "badge-done" : "badge-open"}">${task.status}</span></td>
                        <td>
                          ${
                            !isAssistant
                              ? `
                            <button class="btn btn-secondary btn-sm btn-toggle-task" data-id="${task.id}" data-current="${task.status}">
                              ${isDone ? "Reopen" : "Mark Done"}
                            </button>
                          `
                              : "—"
                          }
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
          <h3 class="card-title">🚨 Escalation & Doubts Log (${escalations.length})</h3>
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
                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                          ${isSevere ? `<span class="badge badge-severe">URGENT</span>` : ""}
                          <span class="badge ${isClosed ? "badge-closed" : "badge-open"}">${esc.status}</span>
                        </div>
                      </div>
                      <p style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 0.4rem;">
                        ${esc.details}
                      </p>
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                        <span>From: <strong>${esc.raisedBy}</strong> (Team ${esc.team}) • ${new Date(esc.timestamp).toLocaleDateString()}</span>
                        ${
                          !isClosed && !isAssistant
                            ? `
                          <button class="btn btn-success btn-sm btn-resolve-esc" data-id="${esc.id}">
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

    <!-- All Submissions Across Class -->
    <div class="card" style="margin-top: 1.5rem;">
      <div class="card-header">
        <h3 class="card-title">📥 All Submissions (${submissions.length})</h3>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Team</th>
              <th>Task ID</th>
              <th>Submission Content</th>
              <th>Link</th>
              <th>Timestamp</th>
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
                      <td style="font-family: monospace; font-size: 0.8rem;">${s.taskId}</td>
                      <td>${s.content || "Completed"}</td>
                      <td>${s.fileUrl ? `<a href="${s.fileUrl}" target="_blank">Drive File ↗</a>` : "—"}</td>
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

  // Helper row renderer for marks table
  function renderMarksRows(marksList) {
    if (!marksList || marksList.length === 0) {
      return `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks found.</td></tr>`;
    }
    return marksList
      .map((m) => {
        const band = getScoreBand(m.quizScore);
        return `
        <tr>
          <td><strong>${m.member}</strong></td>
          <td><span class="badge" style="background-color: var(--bg-subtle);">${m.team}</span></td>
          <td>${m.cycle}</td>
          <td><strong>${m.quizScore}</strong>/100</td>
          <td>${m.submission || "—"}</td>
          <td>${m.attendance || "—"}</td>
          <td><span class="badge ${band.cls}">${band.label}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 200px;">${m.notes || "—"}</td>
        </tr>
      `;
      })
      .join("");
  }

  // Team card filtering
  const teamCards = container.querySelectorAll(".team-filter-card");
  const marksTbody = container.querySelector("#gl-marks-tbody");
  const marksTitle = container.querySelector("#marks-panel-title");

  teamCards.forEach((card) => {
    card.addEventListener("click", () => {
      teamCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const chosenTeam = card.getAttribute("data-team");
      marksTitle.textContent = `📊 Class Scorecard — Team ${chosenTeam}`;
      const filtered = marks.filter((m) => m.team === chosenTeam);
      marksTbody.innerHTML = renderMarksRows(filtered);
    });
  });

  const showAllBtn = container.querySelector("#btn-show-all-marks");
  showAllBtn.addEventListener("click", () => {
    teamCards.forEach((c) => c.classList.remove("active"));
    marksTitle.textContent = `📊 Class Scorecard (All Teams)`;
    marksTbody.innerHTML = renderMarksRows(marks);
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
      btn.textContent = "Resolving...";

      try {
        const res = await apiUpdateEscalationStatus(escId, "closed", user.role);
        if (res.ok) onRefresh();
        else alert(res.error || "Update failed.");
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Add Task form
  if (!isAssistant) {
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
            feedback.innerHTML = `<div class="alert alert-success">✓ Task assigned successfully!</div>`;
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

    // Add Mark form
    const markForm = container.querySelector("#form-gl-add-mark");
    if (markForm) {
      markForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const selectEl = container.querySelector("#gl-mark-member");
        const member = selectEl.value;
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const team = selectedOption.getAttribute("data-team");
        const cycle = container.querySelector("#gl-mark-cycle").value;
        const quizScore = container.querySelector("#gl-mark-quiz").value;
        const submission = container.querySelector("#gl-mark-sub").value;
        const attendance = container.querySelector("#gl-mark-att").value;
        const notes = container.querySelector("#gl-mark-notes").value;
        const feedback = container.querySelector("#gl-mark-feedback");
        const btn = markForm.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = "Saving...";

        try {
          const res = await apiAddMark({
            role: user.role,
            member,
            team,
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
