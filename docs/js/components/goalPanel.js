/**
 * EconomicsPortal — a student's personal target score and progress towards it.
 */

import { apiSetGoal } from "../api.js";
import { esc } from "../utils.js";
import { timeHtml } from "../dates.js";
import { bindActions, runAction, alertHtml, emptyState } from "./ui.js";

/**
 * @param {HTMLElement} container
 * @param {object} user
 * @param {object|null} goal   — { target, description, setAt }
 * @param {object|null} myMetrics — { avgScore, lastCycleScore, ... }
 * @param {Function} onRefresh
 */
export function renderGoalPanel(container, user, goal, myMetrics, onRefresh) {
  const avg = myMetrics ? Number(myMetrics.avgScore || 0) : 0;
  const lastScore = myMetrics ? Number(myMetrics.lastCycleScore || 0) : 0;
  const target = goal ? Number(goal.target) : null;
  const progressPct = target && target > 0 ? Math.min(100, Math.round((avg / target) * 100)) : 0;
  const achieved = target !== null && avg >= target;

  container.innerHTML = `
    <div class="goal-panel stack">
      ${
        goal
          ? `
        <section class="card">
          <div class="card-header">
            <h3 class="card-title">Your goal</h3>
            ${achieved ? `<span class="badge badge-done">Reached</span>` : ""}
          </div>
          <div class="goal-progress">
            <div class="goal-progress-head">
              <span>${esc(goal.description || `Average ${target} or more`)}</span>
              <strong class="num">${esc(avg.toFixed(1))} / ${esc(target)}</strong>
            </div>
            <div class="progress-bar-track" role="img" aria-label="${esc(progressPct)}% of your target">
              <div class="progress-bar-fill ${achieved ? "fill-done" : "fill-progress"}" style="width: ${esc(progressPct)}%;"></div>
            </div>
            <p class="muted small">${esc(progressPct)}% of the way there</p>
          </div>
          <dl class="fact-row">
            <div><dt>Last test</dt><dd class="num">${esc(lastScore || "—")}</dd></div>
            <div><dt>Still to gain</dt><dd class="num">${esc(achieved ? "Reached" : target ? Math.max(0, target - avg).toFixed(1) + " points" : "—")}</dd></div>
            <div><dt>Set</dt><dd>${goal.setAt ? timeHtml(goal.setAt) : "—"}</dd></div>
          </dl>
        </section>`
          : `<section class="card">${emptyState("You haven't set a goal yet.", "Pick a target average below and track your progress after every test.")}</section>`
      }

      <section class="card">
        <div class="card-header"><h3 class="card-title">${esc(goal ? "Change your goal" : "Set a goal")}</h3></div>
        <div id="goal-feedback" aria-live="polite"></div>
        <form id="form-set-goal" data-form="set-goal">
          <div class="form-grid form-grid-2">
            <div class="form-group">
              <label class="form-label" for="goal-target">Target average (0–100)</label>
              <input type="number" id="goal-target" class="form-control" min="0" max="100" step="1" placeholder="e.g. 85" value="${esc(goal ? goal.target : "")}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="goal-desc">In your words <span class="optional">optional</span></label>
              <input type="text" id="goal-desc" class="form-control" maxlength="200" placeholder="e.g. 85+ by the Unit 3 test" value="${esc(goal ? goal.description || "" : "")}" />
            </div>
          </div>
          <button type="submit" class="btn btn-primary">${esc(goal ? "Save goal" : "Set goal")}</button>
        </form>
      </section>

      <section class="card card-quiet">
        <h4 class="item-title">What helps most</h4>
        <ul class="tips-list">
          <li>Do the preview reading before each session.</li>
          <li>Submit on time: late work counts as not submitted.</li>
          <li>Ask a doubt as soon as you're stuck.</li>
          <li>Keep your streak: 50+ and work submitted, test after test.</li>
        </ul>
      </section>
    </div>
  `;

  const feedback = container.querySelector("#goal-feedback");
  bindActions(container, {
    submit: {
      "set-goal": (form) =>
        runAction(
          form.querySelector('button[type="submit"]'),
          "Saving…",
          () =>
            apiSetGoal({
              target: Number(form.querySelector("#goal-target").value),
              description: form.querySelector("#goal-desc").value.trim(),
            }),
          { success: "Goal saved.", onDone: onRefresh, onError: (m) => (feedback.innerHTML = alertHtml(m)) },
        ),
    },
  });
}
