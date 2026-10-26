/**
 * EconomicsPortal — Chart.js Visualizations (v2)
 * Pinned to tokens: #0F6E56 (teal), #534AB7 (purple), #854F0B (amber), #9B2C2C (red)
 */

export function getBandColor(score) {
  const num = Number(score);
  if (isNaN(num)) return "#854F0B";
  if (num >= 85) return "#0F6E56"; // Teal
  if (num >= 70) return "#0F6E56"; // Strong Teal
  if (num >= 60) return "#854F0B"; // Amber
  return "#9B2C2C";               // Red
}

/**
 * Horizontal Bar Chart: Team Averages Comparison
 */
export function renderTeamAveragesChart(canvasId, teamAverages) {
  if (typeof Chart === "undefined") return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const labels = Object.keys(teamAverages);
  const data = labels.map((team) => teamAverages[team]);
  const colors = data.map((score) => getBandColor(score));

  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: labels.map((l) => "Team " + l),
      datasets: [
        {
          data: data,
          backgroundColor: colors,
          borderRadius: 6,
          barThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Average: ${ctx.parsed.x} / 100`,
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: { font: { family: "Public Sans, sans-serif" } },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: "Public Sans, sans-serif", weight: "600" } },
        },
      },
    },
  });
}

/**
 * Donut Chart: Rating Band Distribution
 */
export function renderBandDistributionChart(canvasId, memberMetrics, marks) {
  if (typeof Chart === "undefined") return null;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  // Compute latest score for each member
  const latestScores = {};
  marks.forEach((m) => {
    if (!latestScores[m.member] || new Date(m.timestamp) > new Date(latestScores[m.member].timestamp)) {
      latestScores[m.member] = m;
    }
  });

  let outstanding = 0; // 85+
  let strong = 0;      // 70-84
  let attention = 0;   // 60-69
  let support = 0;     // <60

  Object.values(latestScores).forEach((m) => {
    const s = Number(m.quizScore);
    if (isNaN(s)) return;
    if (s >= 85) outstanding++;
    else if (s >= 70) strong++;
    else if (s >= 60) attention++;
    else support++;
  });

  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Outstanding (85+)", "Strong (70-84)", "Attention (60-69)", "Support (<60)"],
      datasets: [
        {
          data: [outstanding, strong, attention, support],
          backgroundColor: ["#0F6E56", "#149576", "#854F0B", "#9B2C2C"],
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            font: { family: "Public Sans, sans-serif", size: 11 },
          },
        },
      },
      cutout: "68%",
    },
  });
}

/**
 * Sparkline Line Chart: Member Score Trend Across Cycles
 */
export function renderSparkline(canvas, memberMarks) {
  if (typeof Chart === "undefined" || !canvas) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const sorted = memberMarks
    .filter((m) => m.quizScore !== "" && !isNaN(Number(m.quizScore)))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (sorted.length === 0) return null;

  const labels = sorted.map((m) => m.cycle || "C");
  const data = sorted.map((m) => Number(m.quizScore));

  const latestScore = data[data.length - 1];
  const lineColor = getBandColor(latestScore);

  return new Chart(canvas, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          borderColor: lineColor,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 2.5,
          pointBackgroundColor: lineColor,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (ctx) => `Score: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: { display: false },
        y: {
          display: false,
          min: Math.max(0, Math.min(...data) - 10),
          max: 100,
        },
      },
    },
  });
}
