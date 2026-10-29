/**
 * EconomicsPortal — Leaderboard Component (v3)
 *
 * Displays ranked Team leaderboard (by average quiz score) and
 * Individual Member leaderboard with medals for top 3.
 */

import { getScoreBand } from "./metricsPanel.js";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * @param {HTMLElement} container
 * @param {object} memberMetrics  — { memberName: { avgScore, team, streak, ... } }
 * @param {object} teamAverages   — { teamName: avgScore }
 * @param {object} user
 */
export function renderLeaderboard(container, memberMetrics, teamAverages, user) {
  // ── Team Rankings ──────────────────────────────────────
  const teamRows = Object.entries(teamAverages)
    .map(([team, avg]) => ({ team, avg: Number(avg) }))
    .sort((a, b) => b.avg - a.avg);

  // ── Individual Rankings ────────────────────────────────
  const memberRows = Object.entries(memberMetrics)
    .map(([name, m]) => ({
      name,
      team: m.team,
      avg: Number(m.avgScore || 0),
      streak: Number(m.streak || 0),
      delta: Number(m.delta || 0),
      atRisk: Boolean(m.atRisk),
    }))
    .filter((m) => m.avg > 0)
    .sort((a, b) => b.avg - a.avg);

  container.innerHTML = `
    <div class="leaderboard">
      <!-- Team Leaderboard -->
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header">
          <h3 class="card-title">🏆 Team Leaderboard</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Ranked by mean quiz score across all cycles</span>
        </div>
        <div class="leaderboard-list">
          ${
            teamRows.length === 0
              ? `<p style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No scores recorded yet.</p>`
              : teamRows
                  .map((t, i) => {
                    const band = getScoreBand(t.avg);
                    const pct = Math.min(100, Math.round(t.avg));
                    return `
                  <div class="lb-row ${i === 0 ? "lb-first" : ""}">
                    <div class="lb-rank">${MEDALS[i] || `#${i + 1}`}</div>
                    <div class="lb-name">
                      <strong>Team ${t.team}</strong>
                      <span class="badge ${band.cls}" style="margin-left: 0.4rem;">${band.label}</span>
                    </div>
                    <div class="lb-bar-wrap">
                      <div class="lb-bar" style="width: ${pct}%; background: ${band.barColor};"></div>
                    </div>
                    <div class="lb-score num">${t.avg.toFixed(1)}</div>
                  </div>
                `;
                  })
                  .join("")
          }
        </div>
      </div>

      <!-- Individual Leaderboard -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🎖️ Member Leaderboard</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Individual average — all cycles</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Member</th>
                <th>Team</th>
                <th>Avg Score</th>
                <th>Streak</th>
                <th>Trend</th>
                <th>Band</th>
              </tr>
            </thead>
            <tbody>
              ${
                memberRows.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No data yet.</td></tr>`
                  : memberRows
                      .map((m, i) => {
                        const band = getScoreBand(m.avg);
                        const trendIcon =
                          m.delta > 0
                            ? `<span style="color: var(--teal);">▲ ${m.delta.toFixed(1)}</span>`
                            : m.delta < 0
                            ? `<span style="color: var(--red);">▼ ${Math.abs(m.delta).toFixed(1)}</span>`
                            : `<span style="color: var(--text-muted);">—</span>`;
                        const isMe = m.name === user.name;
                        return `
                      <tr ${isMe ? 'style="background: var(--primary-soft);"' : ""}>
                        <td style="font-weight: 700; font-size: 1rem;">${MEDALS[i] || `#${i + 1}`}</td>
                        <td>
                          <strong>${m.name}</strong>
                          ${isMe ? `<span style="font-size: 0.7rem; color: var(--purple); margin-left: 0.3rem;">(You)</span>` : ""}
                          ${m.atRisk ? `<span class="badge badge-atrisk" style="margin-left: 0.3rem; font-size: 0.65rem;">At Risk</span>` : ""}
                        </td>
                        <td><span class="badge" style="background: var(--bg-subtle);">${m.team}</span></td>
                        <td><strong class="num">${m.avg.toFixed(1)}</strong></td>
                        <td>
                          ${m.streak > 0 ? `<span title="Consecutive good cycles">🔥 ${m.streak}</span>` : `<span style="color: var(--text-muted);">—</span>`}
                        </td>
                        <td>${trendIcon}</td>
                        <td><span class="badge ${band.cls}">${band.label}</span></td>
                      </tr>
                    `;
                      })
                      .join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
