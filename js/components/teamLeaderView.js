/**
 * EconomicsPortal — team leader dashboard.
 *
 * Six tabs, each in its own module under ./tabs/:
 *   Team · Submissions · Tasks · Noticeboard · Doubts · Class
 */

import { esc } from '../utils.js';
import { getScoreBand } from './metricsPanel.js';
import { createTabNav } from './tabNav.js';
import { cleanupQuizCountdowns } from './quizScheduler.js';
import { countDoubtUpdates } from './doubtThread.js';
import { loadLastSeen, markSeen, isNewer } from '../lastSeen.js';
import { TEAM_ROSTER } from './ui.js';
import { renderTeamTab } from './tabs/tlTeam.js';
import { renderSubmissionsTab } from './tabs/tlSubmissions.js';
import { renderTeamTasksTab } from './tabs/tlTasks.js';
import { renderNoticeboardTab } from './tabs/tlNoticeboard.js';
import { renderTeamDoubtsTab } from './tabs/tlDoubts.js';
import { renderClassTab } from './tabs/tlClass.js';

// Kept for older imports; the server's roster is preferred.
export { TEAM_ROSTER };

const TABS = {
  members: renderTeamTab,
  submissions: renderSubmissionsTab,
  tasks: renderTeamTasksTab,
  noticeboard: renderNoticeboardTab,
  doubts: renderTeamDoubtsTab,
  class: renderClassTab,
};

export function renderTeamLeaderDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const roster = (data.roster || []).filter((r) => r.team === user.team).map((r) => r.name);
  const teamMembers = (roster.length ? roster : TEAM_ROSTER[user.team] || []).filter((m) => m !== user.name);
  const submissions = (data.submissions || []).filter((s) => s.team === user.team);
  const escalations = data.escalations || [];
  const announcements = data.announcements || [];
  const quizzes = data.quizzes || [];
  const atRisk = data.atRiskMembers || [];
  const teamAverage = data.teamAverage ?? null;
  const band = teamAverage !== null ? getScoreBand(teamAverage) : null;
  const waiting = submissions.filter((s) => !s.gradingRequested).length;
  const ctx = { user, data, onRefresh, teamMembers, submissions };

  container.innerHTML = `
    <div class="page-head">
      <div>
        <p class="page-kicker">Team leader, Team ${esc(user.team)}</p>
        <h1 class="page-title">${esc(user.name)}</h1>
        <p class="page-sub">${esc(teamMembers.length)} students in your team.${
          atRisk.length ? ` <strong class="text-red">${esc(atRisk.map((m) => m.member || m.name).join(', '))} ${atRisk.length === 1 ? 'needs' : 'need'} support.</strong>` : ''
        }</p>
      </div>
      <div class="page-actions">
        <div class="page-stat">
          <div class="page-stat-label">Team average</div>
          <div class="page-stat-val num">${esc(teamAverage !== null ? teamAverage : '—')}</div>
          ${band ? `<span class="badge ${esc(band.cls)}">${esc(band.label)}</span>` : ''}
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-refresh-tl">Refresh</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><span class="kpi-label">Students</span><span class="kpi-val num">${esc(teamMembers.length)}</span><span class="kpi-sub">in Team ${esc(user.team)}</span></div>
      <div class="kpi-card"><span class="kpi-label">Submissions</span><span class="kpi-val num">${esc(submissions.length)}</span><span class="kpi-sub">from your team</span></div>
      <div class="kpi-card"><span class="kpi-label">To forward</span><span class="kpi-val num ${waiting ? 'text-accent' : ''}">${esc(waiting)}</span><span class="kpi-sub">not yet sent for grading</span></div>
      <div class="kpi-card"><span class="kpi-label">Needing support</span><span class="kpi-val num ${atRisk.length ? 'text-red' : ''}">${esc(atRisk.length)}</span><span class="kpi-sub">${esc(atRisk.length ? 'check in with them' : 'everyone on track')}</span></div>
    </div>

    <div id="tl-tab-nav"></div>
    <div id="tl-tab-content"></div>
  `;

  const content = container.querySelector('#tl-tab-content');
  const tabs = [
    { id: 'members', label: 'Team' },
    { id: 'submissions', label: 'Submissions', count: waiting || undefined },
    { id: 'tasks', label: 'Tasks', count: (data.tasks || []).length },
    { id: 'noticeboard', label: 'Noticeboard' },
    { id: 'doubts', label: 'Doubts', count: escalations.filter((d) => d.status === 'open').length },
    { id: 'class', label: 'Class', count: announcements.length + quizzes.length },
  ];

  ctx.seen = loadLastSeen(user, ['announcements', 'doubts']);
  const badges = {
    class: announcements.filter((a) => isNewer(a.timestamp, ctx.seen.announcements)).length,
    doubts: countDoubtUpdates(escalations, ctx.seen.doubts, user),
  };

  function switchTab(id) {
    if (id === 'class') markSeen(user, 'announcements');
    if (id === 'doubts') markSeen(user, 'doubts');
    if (id in badges) tabNav.setBadge(id, 0);
    cleanupQuizCountdowns();
    const panel = document.createElement('div');
    panel.className = 'tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    content.replaceChildren(panel);
    (TABS[id] || TABS.members)(panel, ctx);
  }

  const tabNav = createTabNav(container.querySelector('#tl-tab-nav'), tabs, switchTab, {
    storageKey: `economics_portal_tab:${user.name}`,
  });
  Object.entries(badges).forEach(([id, n]) => tabNav.setBadge(id, n));
  switchTab(tabNav.initialTab);

  container.querySelector('#btn-refresh-tl').addEventListener('click', () => onRefresh());
}
