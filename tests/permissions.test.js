/**
 * Permission matrix (AUDIT_v7 F9): every action × every role, run against
 * BOTH backend/Code.gs and js/demoServer.js. The table below is the rule;
 * if either server allows or refuses something the table doesn't say, or
 * the two servers disagree, this fails.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { createBackend } = require('./gasFakes');

const ROLES = ['instructor', 'group_leader', 'assistant', 'team_leader', 'member'];
const ALL = 'iglatm'; // i=instructor g=group_leader a=assistant t=team_leader m=member
const LEADS = 'ig';
const RULES = {
  dashboard: ALL,
  users: LEADS,
  auditLog: LEADS,
  addMark: 'igat',
  editMark: 'iga',
  deleteMark: 'i',
  addTask: LEADS,
  editTask: LEADS,
  updateTaskStatus: 'igt',
  addSubmission: 'gatm',
  addEscalation: ALL,
  updateEscalationStatus: LEADS,
  addEscalationReply: 'igat',
  addAnnouncement: LEADS,
  deleteAnnouncement: LEADS,
  pinAnnouncement: LEADS,
  addQuiz: LEADS,
  deleteQuiz: LEADS,
  setGoal: ALL,
  updatePin: LEADS,
  issuedPins: LEADS,
  changeMyPin: ALL,
  setReminders: ALL,
  linkGoogle: ALL,
  unlinkGoogle: ALL,
  requestGrading: 'gt',
  addTeamMessage: 'gt',
  deleteTeamMessage: 'gt',
  createMentorshipPlan: LEADS,
  updateMentorshipStatus: LEADS,
};
const LETTER = { instructor: 'i', group_leader: 'g', assistant: 'a', team_leader: 't', member: 'm' };
const allowedByRule = (action, role) => RULES[action].includes(LETTER[role]);

// One person per role, with a PIN that is valid for both servers.
const REAL = { instructor: ['Dr. Numan', '010203'], group_leader: ['Shehroz', '120100'], assistant: ['Sajal', '120200'], team_leader: ['Amina', '2101'], member: ['Ramesh', '2102'] };
const DEMO = { instructor: ['Dr. Numan', '100200'], group_leader: ['Shehroz', '111222'], assistant: ['Sajal', '111333'], team_leader: ['Amina', '2101'], member: ['Bilal', '2002'] };
const refused = (res) => Boolean(res && res.code === 'FORBIDDEN');

function codeGsActions() {
  const src = require('fs').readFileSync(path.join(__dirname, '..', 'backend', 'Code.gs'), 'utf8');
  const block = src.slice(src.indexOf('const ACTIONS = {'), src.indexOf('\n};', src.indexOf('const ACTIONS = {')));
  return [...block.matchAll(/^\s+(\w+):\s*\{/gm)].map((m) => m[1]);
}

test('the table lists exactly the actions Code.gs has', () => {
  assert.deepEqual(codeGsActions().sort(), Object.keys(RULES).sort());
});

test('Code.gs allows and refuses exactly what the table says', () => {
  const wrong = [];
  for (const role of ROLES) {
    const b = createBackend();
    b.api.setup();
    const [name, pin] = REAL[role];
    b.api.setPinForUser(name, pin);
    const token = b.post({ action: 'login', name, pin }).token;
    assert.ok(token, `login ${role}`);
    for (const action of Object.keys(RULES)) {
      const ok = !refused(b.post({ action, token }));
      if (ok !== allowedByRule(action, role)) wrong.push(`${action} as ${role}: server ${ok ? 'allows' : 'refuses'}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('Demo Mode allows and refuses exactly what the table says', async () => {
  const mem = () => {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  };
  globalThis.sessionStorage = mem();
  globalThis.localStorage = mem();
  const demo = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'demoServer.js')).href);
  const wrong = [];
  for (const role of ROLES) {
    const [name, pin] = DEMO[role];
    const login = await demo.handleDemoRequest({ action: 'login', name, pin });
    assert.ok(login.token, `demo login ${role}: ${login.error}`);
    for (const action of Object.keys(RULES)) {
      const ok = !refused(await demo.handleDemoRequest({ action, token: login.token }));
      if (ok !== allowedByRule(action, role)) wrong.push(`${action} as ${role}: demo ${ok ? 'allows' : 'refuses'}`);
    }
  }
  assert.deepEqual(wrong, []);
});
