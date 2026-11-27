/**
 * EconomicsPortal — dashboard for the instructor, group leader and assistant.
 *
 * Six tabs, each in its own module under ./tabs/:
 *   Scores · Students · Tasks · Updates · Doubts · Admin (Export for the assistant)
 */

import { esc } from '../utils.js';
import { createTabNav, openTabPanel } from './tabNav.js';
import { cleanupQuizCountdowns } from './quizScheduler.js';
import { countDoubtUpdates } from './doubtThread.js';
import { loadLastSeen, markSeen, isNewer } from '../lastSeen.js';
import { renderScoresTab } from './tabs/glScores.js';
import { renderStudentsTab } from './tabs/glStudents.js';
import { renderTasksTab } from './tabs/glTasks.js';
import { renderUpdatesTab } from './tabs/glUpdates.js';
import { renderDoubtsTab } from './tabs/glDoubts.js';
import { renderAdminTab } from './tabs/glAdmin.js';

const TABS = {
  scores: renderScoresTab,
  students: renderStudentsTab,
  tasks: renderTasksTab,
  updates: renderUpdatesTab,
  doubts: renderDoubtsTab,
  admin: renderAdminTab,
};

export function renderGroupLeaderDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const isInstructor = user.role === 'instructor';
  const isAssistant = user.role === 'assistant';
  const isGroupLeader = user.role === 'group_leader';
  const ctx = {
    user,
    data,
    onRefresh,
    isInstructor,
    isAssistant,
    isGroupLeader,
    canEdit: true, // all three roles can enter and edit marks
    canLead: isInstructor || isGroupLeader, // tasks, announcements, resolving doubts
  };

  const marks = data.marks || [];
  const tasks = data.tasks || [];
  const escalations = data.escalations || [];
  const announcements = data.announcements || [];
  const quizzes = data.quizzes || [];
  const atRisk = data.atRiskMembers || [];

  const scores = marks.filter((m) => m.quizScore !== '' && m.quizScore != null && !isNaN(Number(m.quizScore))).map((m) => Number(m.quizScore));
  const classAvg = scores.length ? (Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10).toFixed(1) : '—';
  const submitted = marks.filter((m) => String(m.submission).toLowerCase() === 'yes').length;
  const subRate = marks.length ? Math.round((submitted / marks.length) * 100) : null;
  const openTasks = tasks.filter((t) => t.status === 'open').length;
  const openDoubts = escalations.filter((e) => e.status === 'open').length;

  container.innerHTML = `
    <div class="page-head">
      <div>
        <p class="page-kicker">${esc(isInstructor ? 'Instructor' : isAssistant ? 'Teaching assistant' : 'Group leader')}</p>
        <h1 class="page-title">${esc(user.name)}</h1>
        <p class="page-sub">The whole class: 4 teams.${
          atRisk.length ? ` <strong class="text-red">${esc(atRisk.length)} ${atRisk.length === 1 ? 'student needs' : 'students need'} support.</strong>` : ''
        }</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" id="btn-refresh-gl">Refresh</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Class average</span>
        <span class="kpi-val num">${esc(classAvg)}</span>
        <span class="kpi-sub">${esc(scores.length)} marks recorded</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Work submitted</span>
        <span class="kpi-val num">${esc(subRate === null ? '—' : subRate + '%')}</span>
        <span class="kpi-sub">of marked tests</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Needing support</span>
        <span class="kpi-val num ${atRisk.length ? 'text-red' : ''}">${esc(atRisk.length)}</span>
        <span class="kpi-sub">${esc(atRisk.length ? 'see the Students tab' : 'everyone on track')}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Open tasks</span>
        <span class="kpi-val num">${esc(openTasks)}</span>
        <span class="kpi-sub">not marked done</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Open doubts</span>
        <span class="kpi-val num ${openDoubts ? 'text-amber' : ''}">${esc(openDoubts)}</span>
        <span class="kpi-sub">waiting for an answer</span>
      </div>
    </div>

    <div id="gl-tab-nav"></div>
    <div id="gl-tab-content"></div>
  `;

  const content = container.querySelector('#gl-tab-content');
  const tabs = [
    { id: 'scores', label: 'Scores' },
    { id: 'students', label: 'Students', count: atRisk.length || undefined },
    { id: 'tasks', label: 'Tasks', count: tasks.length },
    { id: 'updates', label: 'Updates', count: announcements.length + quizzes.length },
    { id: 'doubts', label: 'Doubts', count: openDoubts },
    { id: 'admin', label: ctx.canLead ? 'Admin' : 'Export' },
  ];

  // "New since your last visit": a snapshot per render, so "New" pills stay
  // while you read; a tab's badge clears when you open it.
  ctx.seen = loadLastSeen(user, ['announcements', 'doubts']);
  const badges = {
    updates: announcements.filter((a) => a.postedBy !== user.name && isNewer(a.timestamp, ctx.seen.announcements)).length,
    doubts: countDoubtUpdates(escalations, ctx.seen.doubts, user),
  };

  function switchTab(id) {
    if (id === 'updates') markSeen(user, 'announcements');
    if (id === 'doubts') markSeen(user, 'doubts');
    if (id in badges) tabNav.setBadge(id, 0);
    cleanupQuizCountdowns();
    const panel = openTabPanel(content, id, tabs);
    (TABS[id] || TABS.scores)(panel, ctx);
  }

  const tabNav = createTabNav(container.querySelector('#gl-tab-nav'), tabs, switchTab, {
    storageKey: `economics_portal_tab:${user.name}`,
  });
  Object.entries(badges).forEach(([id, n]) => tabNav.setBadge(id, n));
  switchTab(tabNav.initialTab);

  container.querySelector('#btn-refresh-gl').addEventListener('click', () => onRefresh());
}
