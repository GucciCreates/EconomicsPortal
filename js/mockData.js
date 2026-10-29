/**
 * EconomicsPortal — Seed Mock Data (v3)
 * Used for instant preview, offline demo, and tests.
 */

export const MOCK_USERS = [
  { name: "Dr. Numan", role: "instructor", team: "-", pin: "0000" },
  { name: "Shehroz", role: "group_leader", team: "Shehroz", pin: "1111" },
  { name: "Sajal", role: "assistant", team: "Shehroz", pin: "1112" },
  { name: "Amina", role: "team_leader", team: "Amina", pin: "2001" },
  { name: "Ramesh", role: "member", team: "Amina", pin: "2002" },
  { name: "Mamoon", role: "member", team: "Amina", pin: "2003" },
  { name: "Tazneem", role: "member", team: "Amina", pin: "2004" },
  { name: "Ayesha (Quetta)", role: "team_leader", team: "Ayesha", pin: "3001" },
  { name: "Minal", role: "member", team: "Ayesha", pin: "3002" },
  { name: "Anika", role: "member", team: "Ayesha", pin: "3003" },
  { name: "Ahmed bin Nasir", role: "member", team: "Ayesha", pin: "3004" },
  { name: "Lareb", role: "team_leader", team: "Lareb", pin: "4001" },
  { name: "Shaiman", role: "member", team: "Lareb", pin: "4002" },
  { name: "Aisha Amjad", role: "member", team: "Lareb", pin: "4003" },
  { name: "Haseeb", role: "member", team: "Lareb", pin: "4004" },
  { name: "Gorsi", role: "member", team: "Shehroz", pin: "1113" },
  { name: "Haris", role: "member", team: "Shehroz", pin: "1114" },
];

export const MOCK_TASKS = [
  {
    id: "tsk-101",
    title: "Macroeconomics Cycle 1: IS-LM Equilibrium Notes",
    description: "Read Chapter 4 and summarize the monetary and fiscal policy shifts on interest rates and output.",
    team: "ALL",
    dueDate: "2026-11-01",
    fileUrl: "https://drive.google.com/drive/folders/economics-portal-demo",
    createdBy: "Shehroz",
    status: "open",
    timestamp: "2026-10-20T10:00:00.000Z"
  },
  {
    id: "tsk-102",
    title: "Inflation & Phillips Curve Case Analysis",
    description: "Analyze the 2020-2023 stagflation data across developing economies.",
    team: "Ayesha",
    dueDate: "2026-11-05",
    fileUrl: "https://drive.google.com/drive/folders/economics-portal-demo",
    createdBy: "Dr. Numan",
    status: "open",
    timestamp: "2026-10-21T14:30:00.000Z"
  },
  {
    id: "tsk-103",
    title: "Econometrics Problem Set 2",
    description: "Run OLS regressions on the provided GDP dataset and explain R-squared.",
    team: "Amina",
    dueDate: "2026-10-28",
    fileUrl: "",
    createdBy: "Amina",
    status: "done",
    timestamp: "2026-10-18T09:00:00.000Z"
  },
  {
    id: "tsk-104",
    title: "Monetary Policy Transmission Mechanism Presentation",
    description: "Prepare 5 slides on how interest rate hikes transmit to aggregate demand.",
    team: "Shehroz",
    dueDate: "2026-11-04",
    fileUrl: "https://drive.google.com/drive/folders/economics-portal-demo",
    createdBy: "Shehroz",
    status: "open",
    timestamp: "2026-10-22T11:15:00.000Z"
  }
];

export const MOCK_MARKS = [
  // Cycle 1
  { id: "mk-1", member: "Ramesh", team: "Amina", cycle: "Cycle 1", mockNumber: "", quizScore: 88, submission: "Yes", attendance: "95%", previewDone: "Yes", peerRating: "4.5", punctual: "Yes", notes: "Great grasp of Keynesian cross", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-2", member: "Mamoon", team: "Amina", cycle: "Cycle 1", mockNumber: "", quizScore: 48, submission: "No", attendance: "80%", previewDone: "No", peerRating: "3.0", punctual: "No", notes: "Missed submission deadline", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-3", member: "Tazneem", team: "Amina", cycle: "Cycle 1", mockNumber: "", quizScore: 92, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "5.0", punctual: "Yes", notes: "Outstanding analytical work", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-4", member: "Minal", team: "Ayesha", cycle: "Cycle 1", mockNumber: "", quizScore: 82, submission: "Yes", attendance: "90%", previewDone: "Yes", peerRating: "4.0", punctual: "Yes", notes: "Well structured argument", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-5", member: "Anika", team: "Ayesha", cycle: "Cycle 1", mockNumber: "", quizScore: 45, submission: "No", attendance: "75%", previewDone: "No", peerRating: "3.2", punctual: "No", notes: "Needs focus on balance of payments", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-6", member: "Ahmed bin Nasir", team: "Ayesha", cycle: "Cycle 1", mockNumber: "", quizScore: 78, submission: "Yes", attendance: "88%", previewDone: "Yes", peerRating: "4.0", punctual: "Yes", notes: "Solid overall effort", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-7", member: "Shaiman", team: "Lareb", cycle: "Cycle 1", mockNumber: "", quizScore: 85, submission: "Yes", attendance: "95%", previewDone: "Yes", peerRating: "4.5", punctual: "Yes", notes: "Clear diagrams and math", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-8", member: "Aisha Amjad", team: "Lareb", cycle: "Cycle 1", mockNumber: "", quizScore: 91, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "5.0", punctual: "Yes", notes: "Top paper in cohort", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-9", member: "Haseeb", team: "Lareb", cycle: "Cycle 1", mockNumber: "", quizScore: 72, submission: "Yes", attendance: "80%", previewDone: "Yes", peerRating: "3.8", punctual: "Yes", notes: "Revise liquidity preference", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-10", member: "Gorsi", team: "Shehroz", cycle: "Cycle 1", mockNumber: "", quizScore: 89, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "4.8", punctual: "Yes", notes: "Excellent consistency", editedBy: "", timestamp: "2026-10-10" },
  { id: "mk-11", member: "Haris", team: "Shehroz", cycle: "Cycle 1", mockNumber: "", quizScore: 86, submission: "Yes", attendance: "95%", previewDone: "Yes", peerRating: "4.5", punctual: "Yes", notes: "Strong quantitative presentation", editedBy: "", timestamp: "2026-10-10" },

  // Cycle 2 (Recent - gives historical trend and delta)
  { id: "mk-12", member: "Ramesh", team: "Amina", cycle: "Cycle 2", mockNumber: "1", quizScore: 92, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "4.8", punctual: "Yes", notes: "+4 delta, mastered IS-LM shifts", editedBy: "Dr. Numan", timestamp: "2026-10-18" },
  { id: "mk-13", member: "Mamoon", team: "Amina", cycle: "Cycle 2", mockNumber: "1", quizScore: 46, submission: "No", attendance: "70%", previewDone: "No", peerRating: "2.8", punctual: "No", notes: "Support plan needed, second low cycle", editedBy: "Dr. Numan", timestamp: "2026-10-18" },
  { id: "mk-14", member: "Tazneem", team: "Amina", cycle: "Cycle 2", mockNumber: "1", quizScore: 95, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "5.0", punctual: "Yes", notes: "Consistent excellence", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-15", member: "Minal", team: "Ayesha", cycle: "Cycle 2", mockNumber: "1", quizScore: 88, submission: "Yes", attendance: "95%", previewDone: "Yes", peerRating: "4.5", punctual: "Yes", notes: "Strong improvement (+6)", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-16", member: "Anika", team: "Ayesha", cycle: "Cycle 2", mockNumber: "1", quizScore: 44, submission: "No", attendance: "65%", previewDone: "No", peerRating: "3.0", punctual: "No", notes: "At-risk; consult group leader", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-17", member: "Ahmed bin Nasir", team: "Ayesha", cycle: "Cycle 2", mockNumber: "1", quizScore: 82, submission: "Yes", attendance: "90%", previewDone: "Yes", peerRating: "4.2", punctual: "Yes", notes: "Solid advance (+4)", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-18", member: "Shaiman", team: "Lareb", cycle: "Cycle 2", mockNumber: "1", quizScore: 88, submission: "Yes", attendance: "95%", previewDone: "Yes", peerRating: "4.5", punctual: "Yes", notes: "High accuracy", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-19", member: "Aisha Amjad", team: "Lareb", cycle: "Cycle 2", mockNumber: "1", quizScore: 94, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "5.0", punctual: "Yes", notes: "Highest quiz score in cohort", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-20", member: "Haseeb", team: "Lareb", cycle: "Cycle 2", mockNumber: "1", quizScore: 76, submission: "Yes", attendance: "85%", previewDone: "Yes", peerRating: "4.0", punctual: "Yes", notes: "Good upward trend (+4)", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-21", member: "Gorsi", team: "Shehroz", cycle: "Cycle 2", mockNumber: "1", quizScore: 91, submission: "Yes", attendance: "100%", previewDone: "Yes", peerRating: "4.9", punctual: "Yes", notes: "Steady performance", editedBy: "", timestamp: "2026-10-18" },
  { id: "mk-22", member: "Haris", team: "Shehroz", cycle: "Cycle 2", mockNumber: "1", quizScore: 89, submission: "Yes", attendance: "95%", previewDone: "Yes", peerRating: "4.6", punctual: "Yes", notes: "Very thorough analysis", editedBy: "", timestamp: "2026-10-18" }
];

export const MOCK_SUBMISSIONS = [
  { id: "sub-1", taskId: "tsk-101", member: "Ramesh", team: "Amina", content: "Submitted summary notes on IS-LM model.", fileUrl: "https://drive.google.com", timestamp: "2026-10-21T18:00:00.000Z" },
  { id: "sub-2", taskId: "tsk-101", member: "Minal", team: "Ayesha", content: "IS-LM shifts analyzed with 4 scenarios.", fileUrl: "", timestamp: "2026-10-22T08:30:00.000Z" },
  { id: "sub-3", taskId: "tsk-101", member: "Gorsi", team: "Shehroz", content: "Completed and checked by team leader.", fileUrl: "https://drive.google.com", timestamp: "2026-10-22T19:45:00.000Z" }
];

export const MOCK_ESCALATIONS = [
  {
    id: "esc-1",
    raisedBy: "Anika",
    team: "Ayesha",
    topic: "Clarification on Quiz 2 Equation derivation",
    details: "Looking for guidance on whether the open economy exchange rate variable is exogenous or endogenous in Question 3.",
    severity: "normal",
    status: "open",
    timestamp: "2026-10-22T16:00:00.000Z"
  },
  {
    id: "esc-2",
    raisedBy: "Mamoon",
    team: "Amina",
    topic: "Midterm date conflict with lab session",
    details: "The announced presentation slot overlaps with the department econometrics software lab. Requesting team rescheduling.",
    severity: "severe",
    status: "open",
    timestamp: "2026-10-23T09:15:00.000Z"
  },
  {
    id: "esc-3",
    raisedBy: "Haseeb",
    team: "Lareb",
    topic: "Solved: Assignment 1 PDF permission",
    details: "Google Drive folder was set to restricted; now accessible.",
    severity: "normal",
    status: "closed",
    timestamp: "2026-10-19T11:20:00.000Z"
  }
];

export const MOCK_ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "Midterm Assessment Schedule & Coverage",
    body: "The Economics Midterm will cover IS-LM, Aggregate Supply/Demand, and Inflation dynamics. Review session scheduled for Thursday.",
    pinned: true,
    postedBy: "Dr. Numan",
    timestamp: "2026-10-24T10:00:00.000Z"
  },
  {
    id: "ann-2",
    title: "Cycle 2 Scorecard Audit Complete",
    body: "All cycle 2 marks and mock scores have been verified. Team leaders please check that all peer ratings have been logged.",
    pinned: false,
    postedBy: "Shehroz",
    timestamp: "2026-10-22T14:00:00.000Z"
  }
];

export const MOCK_QUIZZES = [
  {
    id: "qz-1",
    title: "Mock 3: Monetary Policy & Open Economy Macro",
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    scope: "ALL",
    notes: "Duration: 45 mins. 20 MCQs and 1 structured problem.",
    timestamp: "2026-10-25T09:00:00.000Z"
  },
  {
    id: "qz-2",
    title: "Cycle 3 Flash Quiz: Exchange Rate Regimes",
    scheduledAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    scope: "Amina",
    notes: "Covers Mundell-Fleming model equations.",
    timestamp: "2026-10-25T11:00:00.000Z"
  }
];

export const MOCK_GOALS = [
  {
    name: "Ramesh",
    team: "Amina",
    target: 95,
    description: "Maintain score above 90 and achieve 95 in Mock 3",
    setAt: "2026-10-20T12:00:00.000Z"
  },
  {
    name: "Mamoon",
    team: "Amina",
    target: 70,
    description: "Recover from at-risk status and hit 70+ in Cycle 3",
    setAt: "2026-10-21T15:00:00.000Z"
  }
];

// Helper to compute team averages
export function computeMockTeamAverages(marks) {
  const byTeam = {};
  marks.forEach(m => {
    const score = Number(m.quizScore);
    if (isNaN(score)) return;
    if (!byTeam[m.team]) byTeam[m.team] = [];
    byTeam[m.team].push(score);
  });
  const result = {};
  Object.keys(byTeam).forEach(team => {
    const arr = byTeam[team];
    result[team] = Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  });
  return result;
}

function isYes(v) {
  const s = String(v).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "done" || s === "1" || s === "on time" || s === "100%";
}

function rateOfYes(rows, field) {
  const relevant = rows.filter(r => r[field] !== "" && r[field] !== undefined && r[field] !== null);
  if (!relevant.length) return null;
  const yesCount = relevant.filter(r => isYes(r[field])).length;
  return Math.round((yesCount / relevant.length) * 100);
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function computeMockMemberMetrics(marks, escalations) {
  const byMember = {};
  marks.forEach(m => {
    if (!byMember[m.member]) byMember[m.member] = [];
    byMember[m.member].push(m);
  });

  const result = {};
  Object.keys(byMember).forEach(member => {
    const rows = byMember[member].slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const team = rows[rows.length - 1].team;

    let streak = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const passed = Number(rows[i].quizScore) >= 50 && isYes(rows[i].submission);
      if (passed) streak++; else break;
    }

    const scored = rows.filter(r => r.quizScore !== "" && !isNaN(Number(r.quizScore)));
    const avgScore = scored.length ? round1(scored.reduce((sum, r) => sum + Number(r.quizScore), 0) / scored.length) : 0;
    const lastCycleScore = scored.length ? Number(scored[scored.length - 1].quizScore) : 0;

    let improvementDelta = null;
    if (scored.length >= 2) {
      improvementDelta = round1(Number(scored[scored.length - 1].quizScore) - Number(scored[scored.length - 2].quizScore));
    }

    let mockDelta = null;
    const mocks = rows.filter(r => r.mockNumber !== "" && r.mockNumber !== undefined && r.mockNumber !== null)
      .sort((a, b) => Number(a.mockNumber) - Number(b.mockNumber));
    if (mocks.length >= 2) {
      mockDelta = round1(Number(mocks[mocks.length - 1].quizScore) - Number(mocks[mocks.length - 2].quizScore));
    }

    const ratings = rows.map(r => Number(r.peerRating)).filter(v => !isNaN(v) && v > 0);
    const avgPeerRating = ratings.length ? round1(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;

    const previewRate = rateOfYes(rows, "previewDone");
    const punctualityRate = rateOfYes(rows, "punctual");

    const doubtCount = escalations.filter(es => es.raisedBy === member).length;

    const lastTwo = rows.slice(-2);
    const atRisk = lastTwo.length === 2 && lastTwo.every(r =>
      !isYes(r.submission) || (r.quizScore !== "" && Number(r.quizScore) < 50)
    );

    result[member] = {
      member,
      team,
      streak,
      avgScore,
      lastCycleScore,
      delta: improvementDelta !== null ? improvementDelta : 0,
      improvementDelta,
      mockDelta,
      avgPeerRating,
      previewRate,
      punctualityRate,
      doubtCount,
      atRisk,
      cycles: rows.length
    };
  });
  return result;
}
