/**
 * EconomicsPortal — upcoming quizzes with live countdowns.
 * The instructor and group leader can schedule and remove quizzes.
 */

import { apiAddQuiz, apiDeleteQuiz } from "../api.js";
import { esc } from "../utils.js";
import { timeHtml, countdown } from "../dates.js";
import { bindActions, runAction, alertHtml, emptyState, teamOptions, teamChip } from "./ui.js";

let timer = null;

export function renderQuizScheduler(container, user, quizzes, onRefresh) {
  cleanupQuizCountdowns();

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
    <div class="quiz-scheduler stack">
      ${
        canManage
          ? `
        <section class="card">
          <div class="card-header"><h3 class="card-title">Schedule a quiz or test</h3></div>
          <div id="quiz-feedback" aria-live="polite"></div>
          <form id="form-add-quiz" data-form="add-quiz">
            <div class="form-group">
              <label class="form-label" for="quiz-title">Title</label>
              <input type="text" id="quiz-title" class="form-control" maxlength="200" placeholder="e.g. Mock 3: open economy" required />
            </div>
            <div class="form-grid form-grid-2">
              <div class="form-group">
                <label class="form-label" for="quiz-datetime">Date and time</label>
                <input type="datetime-local" id="quiz-datetime" class="form-control" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="quiz-scope">For</label>
                <select id="quiz-scope" class="form-control">${teamOptions("ALL")}</select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="quiz-notes">Topics or notes <span class="optional">optional</span></label>
              <input type="text" id="quiz-notes" class="form-control" maxlength="1000" placeholder="Chapters, format, length" />
            </div>
            <button type="submit" class="btn btn-primary">Schedule quiz</button>
          </form>
        </section>`
          : ""
      }

      ${
        upcoming.length === 0
          ? `<section class="card">${emptyState(
              "No quizzes coming up.",
              canManage ? "Schedule one above; everyone sees a countdown." : "When a quiz is scheduled you'll see a countdown here.",
            )}</section>`
          : upcoming
              .map(
                (q) => `
        <article class="card quiz-countdown-card">
          <div class="quiz-row">
            <div>
              <h4 class="item-title">${esc(q.title)}</h4>
              <p class="item-meta">${timeHtml(q.scheduledAt)} · ${teamChip(q.scope || "ALL")}${q.notes ? ` · ${esc(q.notes)}` : ""}</p>
            </div>
            <div class="quiz-countdown">
              <div class="countdown-timer" data-countdown="${esc(q.scheduledAt)}">${esc(countdown(q.scheduledAt))}</div>
              <div class="muted small">to go</div>
              ${canManage ? `<button type="button" class="btn btn-danger btn-sm" data-action="delete-quiz" data-id="${esc(q.id)}">Remove</button>` : ""}
            </div>
          </div>
        </article>`,
              )
              .join("")
      }

      ${
        past.length
          ? `
        <section class="card">
          <div class="card-header"><h3 class="card-title">Recent quizzes</h3></div>
          <div class="table-responsive">
            <table class="data-table data-table-cards">
              <thead><tr><th>Title</th><th>When</th><th>For</th><th>Notes</th></tr></thead>
              <tbody>
                ${past
                  .map(
                    (q) => `
                <tr>
                  <td data-label="Title"><strong>${esc(q.title)}</strong></td>
                  <td data-label="When">${timeHtml(q.scheduledAt)}</td>
                  <td data-label="For">${teamChip(q.scope || "ALL")}</td>
                  <td data-label="Notes" class="muted">${esc(q.notes || "—")}</td>
                </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </section>`
          : ""
      }
    </div>
  `;

  if (upcoming.length) {
    const tick = () => {
      const cells = container.querySelectorAll("[data-countdown]");
      if (!cells.length) return cleanupQuizCountdowns();
      cells.forEach((el) => {
        const left = countdown(el.dataset.countdown);
        el.textContent = left;
        el.classList.toggle("is-now", left === "now");
      });
    };
    timer = setInterval(tick, 30 * 1000);
  }

  if (!canManage) return;
  const feedback = container.querySelector("#quiz-feedback");
  bindActions(container, {
    submit: {
      "add-quiz": (form) => {
        const when = new Date(form.querySelector("#quiz-datetime").value);
        if (isNaN(when.getTime())) {
          feedback.innerHTML = alertHtml("Choose a date and time.");
          return;
        }
        runAction(
          form.querySelector('button[type="submit"]'),
          "Scheduling…",
          () =>
            apiAddQuiz({
              title: form.querySelector("#quiz-title").value.trim(),
              scheduledAt: when.toISOString(),
              scope: form.querySelector("#quiz-scope").value,
              notes: form.querySelector("#quiz-notes").value.trim(),
            }),
          { success: "Quiz scheduled.", onDone: onRefresh, onError: (m) => (feedback.innerHTML = alertHtml(m)) },
        );
      },
    },
    click: {
      "delete-quiz": (btn) => {
        if (!window.confirmEconomicsAction("Remove this quiz from the schedule?")) return;
        runAction(btn, "", () => apiDeleteQuiz({ id: btn.dataset.id }), { success: "Quiz removed.", onDone: onRefresh });
      },
    },
  });
}

/** Stop countdown updates (called whenever a dashboard is redrawn). */
export function cleanupQuizCountdowns() {
  if (timer) clearInterval(timer);
  timer = null;
}
