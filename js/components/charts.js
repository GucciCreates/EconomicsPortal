/**
 * EconomicsPortal — Chart.js charts.
 * Colours come from the page's CSS tokens so charts match the current theme
 * (graph paper or chalkboard): --teal outstanding, --purple strong,
 * --amber needs attention, --red support plan.
 */

function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

function palette() {
  return {
    outstanding: token("--teal", "#0b6b4b"),
    strong: token("--purple", "#2346b8"),
    attention: token("--amber", "#8a5300"),
    support: token("--red", "#b42318"),
    text: token("--text-muted", "#4a586c"),
    grid: token("--border-subtle", "#e4e9f0"),
    surface: token("--bg-surface", "#ffffff"),
  };
}

const FONT = "'Instrument Sans', sans-serif";

// Chart.js (MIT, v4.4.4) is served from this site and loaded only when a
// chart is about to be drawn, so pages without charts never download it.
let chartJsPromise = null;
export function loadChartJs() {
  if (typeof Chart !== "undefined") return Promise.resolve(true);
  if (!chartJsPromise) {
    chartJsPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = new URL("../vendor/chart.umd.js", import.meta.url).href;
      script.async = true;
      script.onload = () => resolve(typeof Chart !== "undefined");
      script.onerror = () => {
        chartJsPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }
  return chartJsPromise;
}

function canvasFor(target) {
  return typeof target === "string" ? document.getElementById(target) : target;
}

export function getBandColor(score) {
  const p = palette();
  const num = Number(score);
  if (isNaN(num)) return p.attention;
  if (num >= 85) return p.outstanding;
  if (num >= 70) return p.strong;
  if (num >= 60) return p.attention;
  return p.support;
}

/**
 * Horizontal Bar Chart: Team Averages Comparison
 */
export async function renderTeamAveragesChart(canvasId, teamAverages) {
  if (!(await loadChartJs())) return null;
  const canvas = canvasFor(canvasId);
  if (!canvas || !canvas.isConnected) return null;

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
          borderRadius: 3,
          barThickness: 18,
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
          grid: { color: palette().grid },
          ticks: { color: palette().text, font: { family: FONT } },
        },
        y: {
          grid: { display: false },
          ticks: { color: palette().text, font: { family: FONT, weight: "600" } },
        },
      },
    },
  });
}

/**
 * Donut Chart: Rating Band Distribution
 */
export async function renderBandDistributionChart(canvasId, memberMetrics, marks) {
  if (!(await loadChartJs())) return null;
  const canvas = canvasFor(canvasId);
  if (!canvas || !canvas.isConnected) return null;

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
          backgroundColor: [palette().outstanding, palette().strong, palette().attention, palette().support],
          borderWidth: 2,
          borderColor: palette().surface,
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
            color: palette().text,
            font: { family: FONT, size: 12 },
          },
        },
      },
      cutout: "68%",
    },
  });
}

/**
 * Sparkline: score trend over time.
 * @param {HTMLCanvasElement|string} target - canvas or its id
 * @param {Array<number|object>} values - scores, or mark rows (quizScore, cycle, timestamp)
 */
export async function renderSparkline(target, values) {
  const rows = (values || [])
    .map((v) => (typeof v === "object" && v !== null ? v : { quizScore: v }))
    .filter((m) => m.quizScore !== "" && m.quizScore !== null && !isNaN(Number(m.quizScore)));
  if (rows.length < 2) return null;
  if (rows.every((m) => m.timestamp)) rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (!(await loadChartJs())) return null;
  const canvas = canvasFor(target);
  if (!canvas || !canvas.isConnected) return null;

  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const labels = rows.map((m, i) => m.cycle || `Test ${i + 1}`);
  const data = rows.map((m) => Number(m.quizScore));
  const lineColor = getBandColor(data[data.length - 1]);

  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data,
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
      animation: false,
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
        y: { display: false, min: Math.max(0, Math.min(...data) - 10), max: 100 },
      },
    },
  });
}
