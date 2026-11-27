/**
 * EconomicsPortal — printable report card for one student.
 * Everything on it comes from recorded marks; nothing is made up.
 */

import { getScoreBand } from "./metricsPanel.js";
import { esc } from "../utils.js";
import { isDemoMode } from "../config.js";
import { enhanceModal } from "./modal.js";

const MODAL_ID = "report-card-modal-overlay";

/** Average of values like "95%" or "90"; null if none can be read. */
function averagePercent(values) {
  const nums = values.map((v) => parseFloat(String(v || "").replace("%", ""))).filter((n) => !isNaN(n));
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

/**
 * @param {{ name: string, team: string }} studentInfo
 * @param {Array} studentMarks
 * @param {object} studentMetrics
 */
export function openReportCardModal(studentInfo, studentMarks = [], studentMetrics = {}) {
  const existing = document.getElementById(MODAL_ID);
  if (existing) existing.remove();

  const info = studentInfo || { name: "Student", team: "-" };
  const metrics = studentMetrics || {};
  const marks = [...studentMarks].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
  const scores = marks.filter((m) => m.quizScore !== "" && m.quizScore != null && !isNaN(Number(m.quizScore))).map((m) => Number(m.quizScore));
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const band = getScoreBand(avg === null ? "" : avg);
  const attendance = averagePercent(marks.map((m) => m.attendance));
  const delta = metrics.improvementDelta ?? null;
  const notes = marks.filter((m) => String(m.notes || "").trim());

  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  overlay.className = "modal-overlay report-modal-overlay";
  overlay.innerHTML = `
    <div class="modal-content report-card-modal-content" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div class="report-toolbar no-print">
        <button type="button" class="btn btn-primary btn-sm" id="btn-print-report">Print or save as PDF</button>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-close-report">Close</button>
      </div>

      <div class="report-sheet ${isDemoMode() ? "is-sample" : ""}" id="printable-report">
        <div class="report-header">
          <div class="report-inst-info">
            <p class="report-inst-sub">EconomicsPortal · Dr. Numan's Economics class</p>
            <h2 class="report-inst-title" id="report-title">Report card: ${esc(info.name)}</h2>
            <p class="report-inst-teacher">Team ${esc(info.team)}</p>
          </div>
          <div class="report-date-box">
            <div class="report-date-label">Printed</div>
            <div class="report-date-val">${esc(new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>
          </div>
        </div>
        <div class="report-divider"></div>

        <div class="report-kpis">
          <div class="report-kpi">
            <span class="rk-label">Average score</span>
            <span class="rk-val num" style="color: ${esc(band.barColor)};">${esc(avg === null ? "—" : avg.toFixed(1))}</span>
            <span class="rk-sub">${avg === null ? "No scores yet" : `<span class="badge ${esc(band.cls)}">${esc(band.label)}</span>`}</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Tests recorded</span>
            <span class="rk-val num">${esc(scores.length)}</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Attendance</span>
            <span class="rk-val num">${esc(attendance === null ? "—" : attendance + "%")}</span>
            <span class="rk-sub">Average of recorded values</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Peer rating</span>
            <span class="rk-val num">${esc(metrics.avgPeerRating ? metrics.avgPeerRating + " / 5" : "—")}</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Since last test</span>
            <span class="rk-val num">${delta === null ? "—" : delta > 0 ? `▲ +${esc(delta)}` : delta < 0 ? `▼ ${esc(delta)}` : "0"}</span>
          </div>
        </div>

        ${metrics.atRisk ? `<p class="report-flag">On a support plan: the last two tests were below 50 or work was missing.</p>` : ""}

        <div class="report-section">
          <h4 class="report-section-title">Tests</h4>
          ${
            marks.length === 0
              ? `<p>No marks recorded yet.</p>`
              : `<table class="report-table">
            <thead><tr><th>Topic or unit</th><th>Mock</th><th>Score</th><th>Submitted</th><th>Attendance</th><th>Preview</th><th>On time</th><th>Band</th></tr></thead>
            <tbody>
              ${marks
                .map((m) => {
                  const b = getScoreBand(m.quizScore);
                  return `<tr>
                <td><strong>${esc(m.cycle)}</strong></td>
                <td>${esc(m.mockNumber || "—")}</td>
                <td><strong class="num">${esc(m.quizScore)}</strong></td>
                <td>${esc(m.submission || "—")}</td>
                <td>${esc(m.attendance || "—")}</td>
                <td>${esc(m.previewDone || "—")}</td>
                <td>${esc(m.punctual || "—")}</td>
                <td><span class="badge ${esc(b.cls)}">${esc(b.label)}</span></td>
              </tr>`;
                })
                .join("")}
            </tbody>
          </table>`
          }
        </div>

        <div class="report-section">
          <h4 class="report-section-title">Notes from markers</h4>
          ${
            notes.length
              ? `<ul class="report-notes">${notes
                  .map((m) => `<li><strong>${esc(m.cycle)}:</strong> ${esc(m.notes)}${m.editedBy ? ` <span class="report-by">(${esc(m.editedBy)})</span>` : ""}</li>`)
                  .join("")}</ul>`
              : `<p>No notes were written with these marks.</p>`
          }
        </div>

        <div class="report-signatures">
          <div class="sig-col"><div class="sig-line"></div><div class="sig-name">Dr. Numan</div><div class="sig-title">Instructor</div></div>
          <div class="sig-col"><div class="sig-line"></div><div class="sig-name">Shehroz</div><div class="sig-title">Group leader</div></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector("#btn-close-report").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#btn-print-report").addEventListener("click", () => window.print());
  enhanceModal(overlay, close);
}
