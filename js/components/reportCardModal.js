/**
 * EconomicsPortal — Academic Student Progress Report Card Modal (v3)
 * Provides 1-click PDF export & printable report card with academic gradebook layout.
 */

import { getScoreBand } from "./metricsPanel.js";

/**
 * Open the printable report card modal for a student.
 * @param {object} studentInfo - { name, team, role }
 * @param {Array} studentMarks - all marks for this student
 * @param {object} studentMetrics - computed metrics { avgScore, streak, delta, atRisk, ... }
 * @param {object} currentUser - user viewing the report
 */
export function openReportCardModal(studentInfo, studentMarks = [], studentMetrics = {}, currentUser = {}) {
  const modalId = "report-card-modal-overlay";
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const info = typeof studentInfo === "string" 
    ? { name: studentInfo, team: studentMetrics.team || "-" } 
    : (studentInfo || { name: "Student", team: "-" });

  const sortedMarks = [...studentMarks].sort((a, b) => {
    const da = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const db = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return da - db;
  });

  const validScores = sortedMarks
    .filter((m) => m.quizScore !== "" && m.quizScore !== null && m.quizScore !== undefined && !isNaN(Number(m.quizScore)))
    .map((m) => Number(m.quizScore));

  const avg = validScores.length
    ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
    : 0;
  const band = getScoreBand(avg);

  const attRate = studentMetrics.punctualityRate !== null && studentMetrics.punctualityRate !== undefined
    ? studentMetrics.punctualityRate + "%"
    : "100%";
  const peerRating = studentMetrics.avgPeerRating ? studentMetrics.avgPeerRating + " / 5.0" : "—";
  const streak = studentMetrics.streak || 0;
  const delta = studentMetrics.delta || studentMetrics.improvementDelta || 0;

  // Auto-generate academic remarks based on performance
  let remarks = "";
  if (studentMetrics.atRisk) {
    remarks = "Student has faced difficulties meeting recent unit benchmarks. Mandatory attendance in mock prep sessions and active participation in the peer recovery plan are strongly advised to secure term passing criteria.";
  } else if (avg >= 85) {
    remarks = "Demonstrates exceptional mastery of macroeconomic principles and analytical rigor. Consistently produces top-tier analytical problem sets and maintains admirable cohort engagement.";
  } else if (avg >= 70) {
    remarks = "Consistent performance with sound conceptual comprehension. Continued focus on mathematical model derivations and timely submissions will ensure top score tier advancement.";
  } else {
    remarks = "Satisfactory progress noted with room for quantitative optimization. Encouraged to consult team leader during office hours for problem set reviews.";
  }

  const modalEl = document.createElement("div");
  modalEl.id = modalId;
  modalEl.className = "modal-overlay report-modal-overlay";

  modalEl.innerHTML = `
    <div class="modal-content report-card-modal-content">
      <!-- Toolbar (Hidden when printing) -->
      <div class="report-toolbar no-print">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button class="btn btn-primary btn-sm" id="btn-print-report">
            🖨️ Print / Save as PDF
          </button>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Format: Standard A4</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-close-report">✕ Close</button>
      </div>

      <!-- Printable Report Sheet -->
      <div class="report-sheet" id="printable-report">
        <!-- Institution Header -->
        <div class="report-header">
          <div class="report-inst-logo">📈</div>
          <div class="report-inst-info">
            <h2 class="report-inst-title">ECONOMICS ACADEMIC PORTAL</h2>
            <p class="report-inst-sub">Department of Economics • Term Evaluation & Gradebook Ledger</p>
            <p class="report-inst-teacher">Class Instructor: <strong>Dr. Numan</strong> • Group Coordinator: <strong>Shehroz</strong></p>
          </div>
          <div class="report-date-box">
            <div class="report-date-label">Audit Date</div>
            <div class="report-date-val">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
          </div>
        </div>

        <div class="report-divider"></div>

        <!-- Student Profile Box -->
        <div class="report-profile-grid">
          <div class="report-field">
            <span class="report-label">Student Name</span>
            <span class="report-val name">${info.name}</span>
          </div>
          <div class="report-field">
            <span class="report-label">Cohort Team</span>
            <span class="report-val">Team ${info.team}</span>
          </div>
          <div class="report-field">
            <span class="report-label">Class Standing</span>
            <span class="report-val"><span class="badge ${band.cls}">${band.label}</span></span>
          </div>
          <div class="report-field">
            <span class="report-label">Status</span>
            <span class="report-val">${studentMetrics.atRisk ? `<span class="badge badge-atrisk">Academic Support Plan</span>` : `<span class="badge badge-done">In Good Standing</span>`}</span>
          </div>
        </div>

        <!-- Key Metrics Highlights -->
        <div class="report-kpis">
          <div class="report-kpi">
            <span class="rk-label">Cumulative Average</span>
            <span class="rk-val num" style="color: ${band.barColor};">${avg.toFixed(1)}</span>
            <span class="rk-sub">Scale: 0–100</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Attendance Rate</span>
            <span class="rk-val num">${attRate}</span>
            <span class="rk-sub">Mock & lecture presence</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Assessment Streak</span>
            <span class="rk-val num">${streak > 0 ? "🔥 " + streak : "—"}</span>
            <span class="rk-sub">Consecutive passes</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Peer Evaluation</span>
            <span class="rk-val num">${peerRating}</span>
            <span class="rk-sub">Cohort rating</span>
          </div>
          <div class="report-kpi">
            <span class="rk-label">Score Trend</span>
            <span class="rk-val num" style="color: ${delta > 0 ? "var(--teal)" : delta < 0 ? "var(--red)" : "inherit"};">
              ${delta > 0 ? "▲ +" + delta : delta < 0 ? "▼ " + delta : "—"}
            </span>
            <span class="rk-sub">Mock-to-mock delta</span>
          </div>
        </div>

        <!-- Cycle Scores Ledger Table -->
        <div class="report-section">
          <h4 class="report-section-title">Assessment & Test History</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>Tested Topic / Unit</th>
                <th>Mock #</th>
                <th>Score</th>
                <th>Submission</th>
                <th>Attendance</th>
                <th>Preview Done</th>
                <th>Punctual</th>
                <th>Tier</th>
              </tr>
            </thead>
            <tbody>
              ${
                sortedMarks.length === 0
                  ? `<tr><td colspan="8" style="text-align: center; color: #666; padding: 1rem;">No assessment marks logged yet.</td></tr>`
                  : sortedMarks
                      .map((m) => {
                        const mBand = getScoreBand(m.quizScore);
                        return `
                      <tr>
                        <td><strong>${m.cycle}</strong></td>
                        <td>${m.mockNumber || "—"}</td>
                        <td><strong class="num">${m.quizScore}</strong> / 100</td>
                        <td>${m.submission || "Yes"}</td>
                        <td>${m.attendance || "100%"}</td>
                        <td>${m.previewDone || "Yes"}</td>
                        <td>${m.punctual || "Yes"}</td>
                        <td><span class="badge ${mBand.cls}">${mBand.label}</span></td>
                      </tr>
                    `;
                      })
                      .join("")
              }
            </tbody>
          </table>
        </div>

        <!-- Official Instructor Remarks -->
        <div class="report-section">
          <h4 class="report-section-title">Faculty Assessment & Growth Roadmap</h4>
          <div class="report-remarks-box">
            <p>${remarks}</p>
          </div>
        </div>

        <!-- Signatures & Verification -->
        <div class="report-signatures">
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Dr. Numan</div>
            <div class="sig-title">Class Instructor • Economics</div>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Shehroz</div>
            <div class="sig-title">Group Leader • Academic Operations</div>
          </div>
          <div class="sig-col">
            <div class="sig-line"></div>
            <div class="sig-name">Sajal</div>
            <div class="sig-title">Teaching Assistant • Test Auditor</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);

  const closeBtn = modalEl.querySelector("#btn-close-report");
  const printBtn = modalEl.querySelector("#btn-print-report");

  const closeModal = () => modalEl.remove();

  closeBtn.addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });

  printBtn.addEventListener("click", () => {
    window.print();
  });
}
