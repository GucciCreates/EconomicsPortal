/**
 * EconomicsPortal — student dashboard.
 *
 * Six tabs, each in its own module under ./tabs/:
 *   My scores · Tasks · Doubts · Updates · Leaderboard · Goal
 */

import { esc } from '../utils.js';
import { getScoreBand } from './metricsPanel.js';
import { createTabNav, openTabPanel } from './tabNav.js';
import { cleanupQuizCountdowns } from './quizScheduler.js';
import { countDoubtUpdates } from './doubtThread.js';
import { loadLastSeen, markSeen, isNewer } from '../lastSeen.js';
import { dueDeadline } from './submissionTracker.js';
import { renderMyScoresTab } from './tabs/memScores.js';
import { renderMyTasksTab } from './tabs/memTasks.js';
import { renderMyDoubtsTab } from './tabs/memDoubts.js';
import { renderMyUpdatesTab } from './tabs/memUpdates.js';
import { renderMyLeaderboardTab } from './tabs/memLeaderboard.js';
import { renderMyGoalTab } from './tabs/memGoal.js';

const TABS = {
  overview: renderMyScoresTab,
  tasks: renderMyTasksTab,
  doubts: renderMyDoubtsTab,
  updates: renderMyUpdatesTab,
  leaderboard: renderMyLeaderboardTab,
  goals: renderMyGoalTab,
};

export function renderMemberDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const tasks = data.tasks || [];
  const quizzes = data.quizzes || [];
  const announcements = data.announcements || [];
  const myEscalations = data.myEscalations || [];
  const mySubmissions = data.mySubmissions || [];
  const myMetrics = data.myMetrics || null;
  const teamAverage = data.teamAverage ?? null;
  const band = teamAverage !== null ? getScoreBand(teamAverage) : null;

  const submittedIds = new Set(mySubmissions.map((s) => String(s.taskId)));
  const now = new Date();
  const isOverdue = (t) => {
    const d = dueDeadline(t.dueDate);
    return t.status !== 'done' && !submittedIds.has(String(t.id)) && d && d < now;
  };
  const toDo = tasks.filter((t) => t.status !== 'done' && !submittedIds.has(String(t.id))).length;

  const ctx = { user, data, onRefresh, submittedIds, isOverdue };

  container.innerHTML = `
    <div class="page-head">
      <div>
        <p class="page-kicker">Team ${esc(user.team)}</p>
        <h1 class="page-title">${esc(user.name)}</h1>
        ${myMetrics && myMetrics.atRisk ? `<p class="page-sub"><span class="badge badge-atrisk">Needs support</span> Your last two tests were below 50 or work was missing. Talk to your team leader.</p>` : ''}
      </div>
      <div class="page-actions">
        <div class="page-stat">
          <div class="page-stat-label">My average</div>
          <div class="page-stat-val num">${esc(myMetrics && myMetrics.avgScore ? myMetrics.avgScore : '—')}</div>
          ${teamAverage !== null ? `<span class="muted small">Team ${esc(teamAverage)}${band ? ` · ${esc(band.label)}` : ''}</span>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-refresh-mem">Refresh</button>
      </div>
    </div>

    <div id="mem-tab-nav"></div>
    <div id="mem-tab-content"></div>
  `;

  const content = container.querySelector('#mem-tab-content');
  const tabs = [
    { id: 'overview', label: 'My scores' },
    { id: 'tasks', label: 'Tasks', count: toDo || undefined },
    { id: 'doubts', label: 'Doubts' },
    { id: 'updates', label: 'Updates', count: announcements.length + quizzes.length },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'goals', label: 'Goal' },
  ];

  ctx.seen = loadLastSeen(user, ['announcements', 'tasks', 'teamMessages', 'doubts']);
  const badges = {
    tasks: tasks.filter((t) => isNewer(t.timestamp, ctx.seen.tasks)).length,
    doubts: countDoubtUpdates(myEscalations, ctx.seen.doubts, user),
    updates: announcements.filter((a) => isNewer(a.timestamp, ctx.seen.announcements)).length,
  };

  function switchTab(id) {
    if (id === 'tasks') markSeen(user, 'tasks');
    if (id === 'doubts') markSeen(user, 'doubts');
    if (id === 'updates') markSeen(user, 'announcements');
    if (id in badges) tabNav.setBadge(id, 0);
    cleanupQuizCountdowns();
    const panel = openTabPanel(content, id, tabs);
    (TABS[id] || TABS.overview)(panel, ctx);
  }

  const tabNav = createTabNav(container.querySelector('#mem-tab-nav'), tabs, switchTab, {
    storageKey: `economics_portal_tab:${user.name}`,
  });
  Object.entries(badges).forEach(([id, n]) => tabNav.setBadge(id, n));
  switchTab(tabNav.initialTab);

  container.querySelector('#btn-refresh-mem').addEventListener('click', () => onRefresh());
}
