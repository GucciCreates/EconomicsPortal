/**
 * EconomicsPortal — Metrics Panel & Scorecard Helpers (v2)
 */

export function getScoreBand(score) {
  const num = Number(score);
  if (isNaN(num)) return { label: "N/A", cls: "badge-attention" };
  if (num >= 85) return { label: "Outstanding", cls: "badge-outstanding" };
  if (num >= 70) return { label: "Strong", cls: "badge-strong" };
  if (num >= 60) return { label: "Needs attention", cls: "badge-attention" };
  return { label: "Support plan", cls: "badge-support" };
}

function getProgressFillClass(val) {
  if (val >= 80) return "fill-teal";
  if (val >= 50) return "fill-amber";
  return "fill-red";
}

/**
 * Render Member Metrics Card (used in Member View, Team Leader, and Group Leader/Instructor views)
 */
export function renderMemberMetricsHTML(metrics, options = {}) {
  if (!metrics) {
    return `<div class="card"><p style="color: var(--text-muted); padding: 1rem;">No performance metrics recorded yet.</p></div>`;
  }

  const {
    streak = 0,
    improvementDelta = null,
    mockDelta = null,
    avgPeerRating = null,
    previewRate = null,
    punctualityRate = null,
    doubtCount = 0,
    atRisk = false,
  } = metrics;

  let deltaHTML = `<span class="delta-zero">—</span>`;
  if (improvementDelta !== null) {
    if (improvementDelta > 0) {
      deltaHTML = `<span class="delta-pos">▲ +${improvementDelta}</span>`;
    } else if (improvementDelta < 0) {
      deltaHTML = `<span class="delta-neg">▼ ${improvementDelta}</span>`;
    } else {
      deltaHTML = `<span class="delta-zero">0.0</span>`;
    }
  }

  let mockDeltaHTML = "";
  if (mockDelta !== null) {
    const mockClass = mockDelta >= 0 ? "delta-pos" : "delta-neg";
    const sign = mockDelta > 0 ? "+" : "";
    mockDeltaHTML = `
      <div class="metric-box">
        <div class="metric-label">Mock 1 → Mock 2</div>
        <div class="metric-value ${mockClass}">${sign}${mockDelta}</div>
      </div>
    `;
  }

  return `
    <div class="metrics-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <div style="font-weight: 700; font-size: 0.95rem;">
          ${options.title || "Performance Overview"}
          ${atRisk ? `<span class="badge badge-atrisk" style="margin-left: 0.5rem;">Needs attention</span>` : ""}
        </div>
        <div>
          ${streak > 0 ? `<span class="badge badge-outstanding">🔥 ${streak}-cycle streak</span>` : `<span style="font-size: 0.75rem; color: var(--text-muted);">No current streak</span>`}
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-box">
          <div class="metric-label">Cycle Delta</div>
          <div class="metric-value">${deltaHTML}</div>
        </div>

        ${mockDeltaHTML}

        <div class="metric-box">
          <div class="metric-label">Peer Rating</div>
          <div class="metric-value">${avgPeerRating !== null ? `${avgPeerRating} <span style="font-size: 0.75rem; color: var(--text-muted);">/ 5</span>` : "—"}</div>
        </div>

        <div class="metric-box">
          <div class="metric-label">Doubts Raised</div>
          <div class="metric-value">${doubtCount}</div>
        </div>

        <div class="metric-box" style="grid-column: span 2;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
            <span class="metric-label">Preview Completion</span>
            <strong>${previewRate !== null ? previewRate + "%" : "—"}</strong>
          </div>
          ${
            previewRate !== null
              ? `<div class="progress-bar-wrap"><div class="progress-bar-fill ${getProgressFillClass(previewRate)}" style="width: ${previewRate}%;"></div></div>`
              : ""
          }
        </div>

        <div class="metric-box" style="grid-column: span 2;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
            <span class="metric-label">Punctuality Rate</span>
            <strong>${punctualityRate !== null ? punctualityRate + "%" : "—"}</strong>
          </div>
          ${
            punctualityRate !== null
              ? `<div class="progress-bar-wrap"><div class="progress-bar-fill ${getProgressFillClass(punctualityRate)}" style="width: ${punctualityRate}%;"></div></div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}
