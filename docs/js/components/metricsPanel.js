/**
 * EconomicsPortal — score bands and the per-student metrics card.
 */

import { esc } from "../utils.js";

export function getScoreBand(score) {
  const num = Number(score);
  if (score === "" || score === null || score === undefined || isNaN(num)) {
    return { label: "No score", cls: "badge-attention", barColor: "var(--amber)" };
  }
  if (num >= 85) return { label: "Outstanding", cls: "badge-outstanding", barColor: "var(--teal)" };
  if (num >= 70) return { label: "Strong", cls: "badge-strong", barColor: "var(--purple)" };
  if (num >= 60) return { label: "Needs attention", cls: "badge-attention", barColor: "var(--amber)" };
  return { label: "Support plan", cls: "badge-support", barColor: "var(--red)" };
}

function fillClass(val) {
  if (val >= 80) return "fill-teal";
  if (val >= 50) return "fill-amber";
  return "fill-red";
}

function deltaHtml(value) {
  if (value === null || value === undefined) return `<span class="delta-zero">—</span>`;
  if (value > 0) return `<span class="delta-pos">▲ +${esc(value)}</span>`;
  if (value < 0) return `<span class="delta-neg">▼ ${esc(value)}</span>`;
  return `<span class="delta-zero">0</span>`;
}

function rateBox(label, rate) {
  return `
    <div class="metric-box metric-box-wide">
      <div class="metric-rate-head">
        <span class="metric-label">${esc(label)}</span>
        <strong>${esc(rate !== null && rate !== undefined ? rate + "%" : "—")}</strong>
      </div>
      ${
        rate !== null && rate !== undefined
          ? `<div class="progress-bar-wrap" role="img" aria-label="${esc(label)} ${esc(rate)}%"><div class="progress-bar-fill ${esc(fillClass(rate))}" style="width: ${esc(rate)}%;"></div></div>`
          : ""
      }
    </div>`;
}

/**
 * Metrics card used in the student view, the team roster and report pages.
 * @param {object|null} metrics
 * @param {{ title?: string }} [options]
 */
export function renderMemberMetricsHTML(metrics, options = {}) {
  if (!metrics) {
    return `<div class="metrics-card"><p class="muted">No marks recorded yet. Your metrics appear after your first marked test.</p></div>`;
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

  return `
    <div class="metrics-card">
      <div class="metrics-head">
        <h4 class="metrics-title">
          ${esc(options.title || "Performance")}
          ${atRisk ? `<span class="badge badge-atrisk">Needs support</span>` : ""}
        </h4>
        ${streak > 0 ? `<span class="badge badge-outstanding" title="Tests in a row with 50+ and work submitted">${esc(streak)} in a row</span>` : `<span class="muted small">No streak yet</span>`}
      </div>
      <div class="metrics-grid">
        <div class="metric-box">
          <div class="metric-label">Change since last test</div>
          <div class="metric-value">${deltaHtml(improvementDelta)}</div>
        </div>
        ${
          mockDelta !== null
            ? `<div class="metric-box"><div class="metric-label">Change between mocks</div><div class="metric-value">${deltaHtml(mockDelta)}</div></div>`
            : ""
        }
        <div class="metric-box">
          <div class="metric-label">Peer rating</div>
          <div class="metric-value">${avgPeerRating !== null ? `${esc(avgPeerRating)} <span class="metric-unit">/ 5</span>` : "—"}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Doubts asked</div>
          <div class="metric-value">${esc(doubtCount)}</div>
        </div>
        ${rateBox("Preview done", previewRate)}
        ${rateBox("On time", punctualityRate)}
      </div>
    </div>
  `;
}
