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
    let s = String(v == null ? "" : v);
    // Stop spreadsheet apps from running text that looks like a formula.
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    s = s.replace(/"/g, '""');
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
 * Render the export buttons into a container element.
 * @param {HTMLElement} container
 * @param {object} data - { marks, submissions, memberMetrics }
 */
export function renderExportToolbar(container, data) {
  const count = {
    marks: (data.marks || []).length,
    subs: (data.submissions || []).length,
    metrics: Object.keys(data.memberMetrics || {}).length,
  };
  container.innerHTML = `
    <section class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">Download data</h3>
          <p class="card-note">CSV files open in Excel or Google Sheets.</p>
        </div>
      </div>
      <div class="btn-group btn-group-wrap">
        <button type="button" class="btn btn-secondary" data-export="marks" ${count.marks ? "" : "disabled"}>Marks (${count.marks})</button>
        <button type="button" class="btn btn-secondary" data-export="subs" ${count.subs ? "" : "disabled"}>Submissions (${count.subs})</button>
        <button type="button" class="btn btn-secondary" data-export="metrics" ${count.metrics ? "" : "disabled"}>Student metrics (${count.metrics})</button>
      </div>
      <p class="form-hint">Files contain what's on screen now. Use Refresh first if someone may have just made changes.</p>
    </section>
  `;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-export]");
    if (!btn) return;
    if (btn.dataset.export === "marks") exportMarksCSV(data.marks);
    if (btn.dataset.export === "subs") exportSubmissionsCSV(data.submissions);
    if (btn.dataset.export === "metrics") exportMemberMetricsCSV(data.memberMetrics);
  });
}

function dateStr() {
  return new Date().toISOString().slice(0, 10);
}
