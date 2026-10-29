/**
 * EconomicsPortal — Goal Setting Panel (v3)
 *
 * Members can set a personal performance target (e.g. "Score 85+ in Cycle 3").
 * Displays progress vs. current average and recent trend.
 */

import { apiSetGoal } from "../api.js";

/**
 * @param {HTMLElement} container
 * @param {object} user
 * @param {object|null} goal   — { target, description, setAt } or null
 * @param {object|null} myMetrics — member metrics with avgScore, delta, lastCycleScore
 * @param {Function} onRefresh
 */
export function renderGoalPanel(container, user, goal, myMetrics, onRefresh) {
  const avg = myMetrics ? Number(myMetrics.avgScore || 0) : 0;
  const lastScore = myMetrics ? Number(myMetrics.lastCycleScore || 0) : 0;
  const target = goal ? Number(goal.target) : null;
  const progressPct = target && target > 0 ? Math.min(100, Math.round((avg / target) * 100)) : 0;
  const achieved = target !== null && avg >= target;

  container.innerHTML = `
    <div class="goal-panel">
      ${
        goal
          ? `
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-header">
            <h3 class="card-title">🎯 Your Current Goal</h3>
            ${achieved ? `<span class="badge badge-done" style="font-size: 0.8rem;">✅ Achieved!</span>` : ""}
          </div>

          <div style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem; font-size: 0.9rem;">
              <span>${goal.description || "Score " + target + " or above"}</span>
              <strong class="num">${avg.toFixed(1)} / ${target}</strong>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill ${achieved ? "fill-done" : "fill-progress"}"
                   style="width: ${progressPct}%; transition: width 0.6s ease;">
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">
              <span>Current avg: <strong class="num">${avg.toFixed(1)}</strong></span>
              <span>Target: <strong class="num">${target}</strong></span>
              <span>${progressPct}% there</span>
            </div>
          </div>

          <div style="display: flex; gap: 1.25rem; font-size: 0.85rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
            <div>
              <div style="color: var(--text-muted); font-size: 0.75rem;">Last Cycle Score</div>
              <div class="num" style="font-weight: 700; font-size: 1.05rem;">${lastScore || "—"}</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.75rem;">Needed per Cycle</div>
              <div class="num" style="font-weight: 700; font-size: 1.05rem;">
                ${target && !achieved ? Math.max(0, target - avg).toFixed(1) + " more avg" : achieved ? "Done! 🎉" : "—"}
              </div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.75rem;">Goal Set</div>
              <div style="font-size: 0.85rem;">${goal.setAt ? new Date(goal.setAt).toLocaleDateString() : "—"}</div>
            </div>
          </div>
        </div>
      `
          : `<div class="card" style="margin-bottom: 1rem; border-left: 3px solid var(--amber);">
              <p style="color: var(--text-muted); padding: 0.5rem 0;">You haven't set a performance goal yet. Set one below to track your progress! 🎯</p>
             </div>`
      }

      <!-- Set / Update Goal Form -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${goal ? "Update Goal" : "Set a Goal"}</h3>
        </div>
        <div id="goal-feedback"></div>
        <form id="form-set-goal">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div class="form-group">
              <label class="form-label">Target Score (0–100)</label>
              <input
                type="number" id="goal-target" class="form-control"
                min="0" max="100" step="1"
                placeholder="e.g. 85"
                value="${goal ? goal.target : ""}"
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">Goal Description</label>
              <input
                type="text" id="goal-desc" class="form-control"
                placeholder="e.g. Score 85+ by end of Cycle 3"
                value="${goal ? goal.description || "" : ""}"
              />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%;">
            ${goal ? "Update Goal" : "Set Goal"}
          </button>
        </form>
      </div>

      <!-- Tips Panel -->
      <div class="card" style="margin-top: 1rem; background: var(--teal-soft); border: none;">
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--teal);">💡 Tips to Hit Your Target</h4>
        <ul style="font-size: 0.85rem; padding-left: 1.25rem; color: var(--text-main); line-height: 1.7;">
          <li>Complete all preview readings before each session.</li>
          <li>Submit all assignments on time — late = 0 for submission score.</li>
          <li>Ask questions via the escalation panel — don't struggle alone.</li>
          <li>Peer-rated high? Keep collaborating — it boosts your overall metric.</li>
          <li>Attend every mock session to maintain your streak 🔥.</li>
        </ul>
      </div>
    </div>
  `;

  const form = container.querySelector("#form-set-goal");
  const feedback = container.querySelector("#goal-feedback");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const res = await apiSetGoal({
        name: user.name,
        team: user.team,
        target: Number(container.querySelector("#goal-target").value),
        description: container.querySelector("#goal-desc").value.trim(),
      });
      if (res.ok) {
        feedback.innerHTML = `<div class="alert alert-success">Goal saved!</div>`;
        setTimeout(() => {
          feedback.innerHTML = "";
          onRefresh();
        }, 1500);
      } else {
        feedback.innerHTML = `<div class="alert alert-error">${res.error}</div>`;
      }
    } catch (err) {
      feedback.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = goal ? "Update Goal" : "Set Goal";
    }
  });
}
