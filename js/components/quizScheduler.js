/**
 * EconomicsPortal — Quiz Scheduler with Live Countdown (v3)
 *
 * Displays upcoming quizzes/tests. Instructor can schedule new ones.
 * A live countdown ticks every second for each future event.
 */

import { apiAddQuiz, apiDeleteQuiz } from "../api.js";

let _countdownIntervals = [];

export function renderQuizScheduler(container, user, quizzes, onRefresh) {
  // Clear any previous countdown timers
  _countdownIntervals.forEach(clearInterval);
  _countdownIntervals = [];

  const canManage = user.role === "instructor" || user.role === "group_leader";
  const now = new Date();

  const upcoming = quizzes
    .filter((q) => new Date(q.scheduledAt) > now)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

  const past = quizzes
    .filter((q) => new Date(q.scheduledAt) <= now)
    .sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))
    .slice(0, 5);

  container.innerHTML = `
    <div class="quiz-scheduler">
      ${
        canManage
          ? `
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-header"><h3 class="card-title">🗓️ Schedule a Quiz / Test</h3></div>
          <div id="quiz-feedback"></div>
          <form id="form-add-quiz">
            <div class="form-group">
              <label class="form-label">Quiz / Test Title</label>
              <input type="text" id="quiz-title" class="form-control" placeholder="e.g. Mock 3 — Macroeconomics" required />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Date & Time</label>
                <input type="datetime-local" id="quiz-datetime" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label">Scope</label>
                <select id="quiz-scope" class="form-control">
                  <option value="ALL">All Teams (Class-wide)</option>
                  <option value="Shehroz">Team Shehroz</option>
                  <option value="Amina">Team Amina</option>
                  <option value="Ayesha">Team Ayesha</option>
                  <option value="Lareb">Team Lareb</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Topics / Notes</label>
              <input type="text" id="quiz-notes" class="form-control" placeholder="Chapters covered, format, duration..." />
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">Schedule Quiz</button>
          </form>
        </div>
      `
          : ""
      }

      ${
        upcoming.length === 0
          ? `<div class="card" style="margin-bottom: 1rem;"><p style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No upcoming quizzes scheduled.</p></div>`
          : upcoming
              .map(
                (q, i) => `
          <div class="card quiz-countdown-card" style="margin-bottom: 0.75rem;" data-scheduled="${q.scheduledAt}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
              <div>
                <div style="font-size: 0.75rem; color: var(--teal); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 0.25rem;">Upcoming</div>
                <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.2rem;">${escHtml(q.title)}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                  ${new Date(q.scheduledAt).toLocaleString()} · Scope: <strong>${q.scope || "ALL"}</strong>
                  ${q.notes ? ` · ${escHtml(q.notes)}` : ""}
                </div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                <div class="countdown-timer" id="countdown-${i}" style="font-size: 1.4rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--purple); white-space: nowrap;">
                  —
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.1rem;">remaining</div>
                ${
                  canManage
                    ? `<button class="btn btn-danger btn-sm btn-delete-quiz" data-id="${q.id}" style="margin-top: 0.5rem;">Remove</button>`
                    : ""
                }
              </div>
            </div>
          </div>
        `
              )
              .join("")
      }

      ${
        past.length > 0
          ? `
        <div class="card" style="margin-top: 0.5rem;">
          <div class="card-header"><h3 class="card-title">Past Quizzes (Recent 5)</h3></div>
          <div class="table-responsive">
            <table class="data-table">
              <thead><tr><th>Title</th><th>Date</th><th>Scope</th><th>Notes</th></tr></thead>
              <tbody>
                ${past
                  .map(
                    (q) => `
                  <tr>
                    <td><strong>${escHtml(q.title)}</strong></td>
                    <td style="font-size: 0.8rem; white-space: nowrap;">${new Date(q.scheduledAt).toLocaleDateString()}</td>
                    <td><span class="badge" style="background: var(--bg-subtle);">${q.scope || "ALL"}</span></td>
                    <td style="font-size: 0.8rem; color: var(--text-muted);">${escHtml(q.notes) || "—"}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  // Start countdown timers
  upcoming.forEach((q, i) => {
    const el = document.getElementById(`countdown-${i}`);
    if (!el) return;

    const update = () => {
      const diff = new Date(q.scheduledAt) - new Date();
      if (diff <= 0) {
        el.textContent = "NOW";
        el.style.color = "var(--red)";
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent =
        d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    update();
    _countdownIntervals.push(setInterval(update, 1000));
  });

  // Form
  if (canManage) {
    const form = container.querySelector("#form-add-quiz");
    const feedback = container.querySelector("#quiz-feedback");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "Scheduling...";
        try {
          const res = await apiAddQuiz({
            role: user.role,
            name: user.name,
            title: container.querySelector("#quiz-title").value.trim(),
            scheduledAt: new Date(container.querySelector("#quiz-datetime").value).toISOString(),
            scope: container.querySelector("#quiz-scope").value,
            notes: container.querySelector("#quiz-notes").value.trim(),
          });
          if (res.ok) {
            feedback.innerHTML = `<div class="alert alert-success">Quiz scheduled!</div>`;
            form.reset();
            setTimeout(() => (feedback.innerHTML = ""), 3000);
            onRefresh();
          } else {
            feedback.innerHTML = `<div class="alert alert-error">${res.error}</div>`;
          }
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        } finally {
          btn.disabled = false;
          btn.textContent = "Schedule Quiz";
        }
      });
    }

    container.querySelectorAll(".btn-delete-quiz").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this scheduled quiz?")) return;
        const id = btn.getAttribute("data-id");
        btn.disabled = true;
        try {
          const res = await apiDeleteQuiz({ role: user.role, id });
          if (res.ok) onRefresh();
          else alert(res.error || "Failed.");
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }
}

/** Cleanup countdowns when navigating away */
export function cleanupQuizCountdowns() {
  _countdownIntervals.forEach(clearInterval);
  _countdownIntervals = [];
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
