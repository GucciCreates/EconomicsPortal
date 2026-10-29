/**
 * EconomicsPortal — CSV Export Utilities (v3)
 *
 * Provides one-click CSV download for:
 *  - Marks ledger (full class)
 *  - Submissions log
 *  - Member metrics summary
 */

/**
 * Convert array-of-objects to CSV string.
 * @param {Array<object>} rows
 * @param {string[]} [cols] — column keys to include (in order). If omitted, uses all keys of first row.
 */
function toCSV(rows, cols) {
  if (!rows || rows.length === 0) return "";
  const headers = cols || Object.keys(rows[0]);
  const escape = (v) => {
    const s = String(v == null ? "" : v).replace(/"/g, '""');
    return /[,"\n\r]/.test(s) ? `"${s}"` : s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * Trigger a browser download of a CSV string.
 * @param {string} csvString
 * @param {string} filename
 */
function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export full marks ledger */
export function exportMarksCSV(marks) {
  const cols = [
    "id", "member", "team", "cycle", "mockNumber",
    "quizScore", "submission", "attendance",
    "previewDone", "peerRating", "punctual",
    "notes", "editedBy", "timestamp",
  ];
  const csv = toCSV(marks, cols);
  downloadCSV(csv, `economics-marks-${dateStr()}.csv`);
}

/** Export submissions log */
export function exportSubmissionsCSV(submissions) {
  const cols = ["id", "taskId", "member", "team", "content", "fileUrl", "timestamp"];
  const csv = toCSV(submissions, cols);
  downloadCSV(csv, `economics-submissions-${dateStr()}.csv`);
}

/** Export member metrics summary */
export function exportMemberMetricsCSV(memberMetrics) {
  const rows = Object.entries(memberMetrics).map(([name, m]) => ({
    member: name,
    team: m.team,
    avgScore: m.avgScore,
    streak: m.streak,
    delta: m.delta,
    atRisk: m.atRisk ? "Yes" : "No",
    lastCycleScore: m.lastCycleScore,
    cycles: m.cycles,
  }));
  const csv = toCSV(rows, ["member", "team", "avgScore", "streak", "delta", "atRisk", "lastCycleScore", "cycles"]);
  downloadCSV(csv, `economics-member-metrics-${dateStr()}.csv`);
}

/**
 * Render an export toolbar into a container element.
 * @param {HTMLElement} container
 * @param {object} data - { marks, submissions, memberMetrics }
 */
export function renderExportToolbar(container, data) {
  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">📥 Export Data</h3>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Downloads a CSV file directly to your device</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0.25rem 0;">
        <button class="btn btn-secondary" id="btn-export-marks">
          📋 Export Marks Ledger
        </button>
        <button class="btn btn-secondary" id="btn-export-subs">
          📤 Export Submissions Log
        </button>
        <button class="btn btn-secondary" id="btn-export-metrics">
          📊 Export Member Metrics
        </button>
      </div>
      <p class="form-hint" style="margin-top: 0.5rem;">
        All exports include the current dataset. Refresh the page to get the latest data before exporting.
      </p>
    </div>
  `;

  container.querySelector("#btn-export-marks").addEventListener("click", () => {
    if (!data.marks || data.marks.length === 0) return alert("No marks data to export.");
    exportMarksCSV(data.marks);
  });

  container.querySelector("#btn-export-subs").addEventListener("click", () => {
    if (!data.submissions || data.submissions.length === 0)
      return alert("No submissions data to export.");
    exportSubmissionsCSV(data.submissions);
  });

  container.querySelector("#btn-export-metrics").addEventListener("click", () => {
    if (!data.memberMetrics || Object.keys(data.memberMetrics).length === 0)
      return alert("No metrics data to export.");
    exportMemberMetricsCSV(data.memberMetrics);
  });
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}
