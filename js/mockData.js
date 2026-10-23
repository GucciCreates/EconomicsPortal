/**
 * EconomicsPortal — Seed Mock Data
 * Used for instant preview and offline demo before Apps Script is deployed.
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
    title: "Inflation & Philips Curve Case Analysis",
    description: "Analyze the 2020-2023 stagflation data across developing economies.",
    team: "Ayesha",
    dueDate: "2026-11-05",
    fileUrl: "https://drive.google.com/drive/folders/economics-portal-demo",
    createdBy: "Shehroz",
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
  { id: "mk-1", member: "Ramesh", team: "Amina", cycle: "Cycle 1", quizScore: 88, submission: "100%", attendance: "95%", notes: "Great grasp of Keynesian cross", timestamp: "2026-10-15" },
  { id: "mk-2", member: "Mamoon", team: "Amina", cycle: "Cycle 1", quizScore: 74, submission: "85%", attendance: "90%", notes: "Review multiplier formula", timestamp: "2026-10-15" },
  { id: "mk-3", member: "Tazneem", team: "Amina", cycle: "Cycle 1", quizScore: 92, submission: "100%", attendance: "100%", notes: "Outstanding analytical work", timestamp: "2026-10-15" },
  
  { id: "mk-4", member: "Minal", team: "Ayesha", cycle: "Cycle 1", quizScore: 82, submission: "95%", attendance: "90%", notes: "Well structured argument", timestamp: "2026-10-15" },
  { id: "mk-5", member: "Anika", team: "Ayesha", cycle: "Cycle 1", quizScore: 68, submission: "80%", attendance: "85%", notes: "Needs focus on balance of payments", timestamp: "2026-10-15" },
  { id: "mk-6", member: "Ahmed bin Nasir", team: "Ayesha", cycle: "Cycle 1", quizScore: 78, submission: "90%", attendance: "88%", notes: "Solid overall effort", timestamp: "2026-10-15" },
  
  { id: "mk-7", member: "Shaiman", team: "Lareb", cycle: "Cycle 1", quizScore: 85, submission: "100%", attendance: "95%", notes: "Clear diagrams and math", timestamp: "2026-10-15" },
  { id: "mk-8", member: "Aisha Amjad", team: "Lareb", cycle: "Cycle 1", quizScore: 91, submission: "100%", attendance: "100%", notes: "Top paper in cohort", timestamp: "2026-10-15" },
  { id: "mk-9", member: "Haseeb", team: "Lareb", cycle: "Cycle 1", quizScore: 72, submission: "85%", attendance: "80%", notes: "Good, revise liquidity preference", timestamp: "2026-10-15" },
  
  { id: "mk-10", member: "Gorsi", team: "Shehroz", cycle: "Cycle 1", quizScore: 89, submission: "100%", attendance: "100%", notes: "Excellent consistency", timestamp: "2026-10-15" },
  { id: "mk-11", member: "Haris", team: "Shehroz", cycle: "Cycle 1", quizScore: 86, submission: "95%", attendance: "95%", notes: "Strong quantitative presentation", timestamp: "2026-10-15" },
];

export const MOCK_SUBMISSIONS = [
  { id: "sub-1", taskId: "tsk-101", member: "Ramesh", team: "Amina", content: "Submitted summary notes. Added key equilibrium shifts in Google Doc.", fileUrl: "https://drive.google.com", timestamp: "2026-10-21T18:00:00.000Z" },
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
