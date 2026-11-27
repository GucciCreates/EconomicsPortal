/**
 * EconomicsPortal — team and student leaderboards.
 */

import { getScoreBand } from "./metricsPanel.js";
import { esc } from "../utils.js";
import { emptyState, teamChip, sameName } from "./ui.js";

/**
 * @param {HTMLElement} container
 * @param {object} memberMetrics  — { name: { avgScore, team, streak, delta, atRisk? } }
 * @param {object} teamAverages   — { team: average }
 * @param {object} user
 */
export function renderLeaderboard(container, memberMetrics, teamAverages, user) {
  const teamRows = Object.entries(teamAverages)
    .map(([team, avg]) => ({ team, avg: Number(avg) }))
    .sort((a, b) => b.avg - a.avg);

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

  const trend = (d) =>
    d > 0
      ? `<span class="delta-pos">▲ ${esc(d.toFixed(1))}</span>`
      : d < 0
        ? `<span class="delta-neg">▼ ${esc(Math.abs(d).toFixed(1))}</span>`
        : `<span class="delta-zero">—</span>`;

  container.innerHTML = `
    <section class="card">
      <div class="card-header">
        <h3 class="card-title">Teams</h3>
        <span class="card-note">Average quiz score, all units</span>
      </div>
      ${
        teamRows.length === 0
          ? emptyState("No scores yet.", "Teams are ranked once marks are recorded.")
          : `<ol class="leaderboard-list">
          ${teamRows
            .map((t, i) => {
              const band = getScoreBand(t.avg);
              const pct = Math.min(100, Math.round(t.avg));
              return `
            <li class="lb-row ${i === 0 ? "lb-first" : ""}">
              <span class="lb-rank">${esc(i + 1)}</span>
              <span class="lb-name">Team ${esc(t.team)} <span class="badge ${esc(band.cls)}">${esc(band.label)}</span></span>
              <span class="lb-bar-wrap" aria-hidden="true"><span class="lb-bar" style="width: ${esc(pct)}%; background: ${esc(band.barColor)};"></span></span>
              <span class="lb-score num">${esc(t.avg.toFixed(1))}</span>
            </li>`;
            })
            .join("")}
        </ol>`
      }
    </section>

    <section class="card">
      <div class="card-header">
        <h3 class="card-title">Students</h3>
        <span class="card-note">Average of each student's tests</span>
      </div>
      ${
        memberRows.length === 0
          ? emptyState("No scores yet.", "Students appear here after their first marked test.")
          : `<div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead>
            <tr><th>Rank</th><th>Student</th><th>Team</th><th>Average</th><th>In a row</th><th>Trend</th><th>Band</th></tr>
          </thead>
          <tbody>
            ${memberRows
              .map((m, i) => {
                const band = getScoreBand(m.avg);
                const isMe = sameName(m.name, user.name);
                return `
              <tr class="${isMe ? "row-me" : ""}">
                <td data-label="Rank" class="cell-strong">${esc(i + 1)}</td>
                <td data-label="Student">
                  <strong>${esc(m.name)}</strong>
                  ${isMe ? `<span class="chip chip-accent">You</span>` : ""}
                  ${m.atRisk ? `<span class="badge badge-atrisk">Needs support</span>` : ""}
                </td>
                <td data-label="Team">${teamChip(m.team)}</td>
                <td data-label="Average"><strong class="num">${esc(m.avg.toFixed(1))}</strong></td>
                <td data-label="In a row">${m.streak > 0 ? esc(m.streak) : `<span class="muted">—</span>`}</td>
                <td data-label="Trend">${trend(m.delta)}</td>
                <td data-label="Band"><span class="badge ${esc(band.cls)}">${esc(band.label)}</span></td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`
      }
    </section>
  `;
}
