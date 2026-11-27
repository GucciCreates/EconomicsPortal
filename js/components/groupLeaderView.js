/**
 * EconomicsPortal — Group Leader & Instructor Dashboard Component (v3)
 */

import {
  apiAddTask,
  apiEditTask,
  apiAddMark,
  apiEditMark,
  apiDeleteMark,
  apiUpdateTaskStatus,
  apiUpdateEscalationStatus,
  apiUpdatePin,
  apiGetUsers,
} from '../api.js';
import { getScoreBand } from './metricsPanel.js';
import { esc, linkHtml, slug } from '../utils.js';
import { TEAM_ROSTER } from './teamLeaderView.js';
import {
  renderTeamAveragesChart,
  renderBandDistributionChart,
} from './charts.js';
import { openEditMarkModal, openEditTaskModal } from './editModals.js';
import { createTabNav } from './tabNav.js';
import { renderAnnouncementsPanel } from './announcementsPanel.js';
import { renderQuizScheduler, cleanupQuizCountdowns } from './quizScheduler.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderExportToolbar } from './exportUtils.js';
import { openReportCardModal } from './reportCardModal.js';
import { renderMentorshipPanel } from './mentorshipPanel.js';
import { renderActivityLog } from './activityLog.js';

export function renderGroupLeaderDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const isInstructor = user.role === 'instructor';
  const isAssistant = user.role === 'assistant';
  const isGroupLeader = user.role === 'group_leader';
  const canEdit = isInstructor || isGroupLeader || isAssistant;
  // Matches the server: only the instructor and group leader manage tasks
  // and resolve doubts (the assistant grades but does not assign work).
  const canLead = isInstructor || isGroupLeader;

  const tasks = data.tasks || [];
  const marks = data.marks || [];
  const submissions = data.submissions || [];
  const escalations = data.escalations || [];
  const announcements = data.announcements || [];
  const quizzes = data.quizzes || [];
  const teamAverages = data.teamAverages || {};
  const atRiskMembers = data.atRiskMembers || [];
  const memberMetrics = data.memberMetrics || {};

  const teams = ['Shehroz', 'Amina', 'Ayesha', 'Lareb'];

  // ── Executive Summary KPIs ───────────────────────────────────
  const validScores = marks
    .map((m) => Number(m.quizScore))
    .filter((s) => !isNaN(s) && s > 0);
  const classAvg = validScores.length
    ? Math.round(
        (validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10,
      ) / 10
    : '—';

  const subYesCount = marks.filter(
    (m) => String(m.submission).toLowerCase() === 'yes',
  ).length;
  const subRate = marks.length
    ? Math.round((subYesCount / marks.length) * 100)
    : 0;

  const attYesCount = marks.filter(
    (m) =>
      String(m.attendance).includes('100') ||
      String(m.attendance).toLowerCase() === 'yes',
  ).length;
  const attRate = marks.length
    ? Math.round((attYesCount / marks.length) * 100)
    : 0;

  const openDoubts = escalations.filter((e) => e.status === 'open').length;
  const openTasks = tasks.filter((t) => t.status === 'open').length;

  container.innerHTML = `
    <!-- Top Header Banner -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700;">
            ${esc(isInstructor ? 'Instructor Workspace — Dr. Numan' : isAssistant ? 'Teaching Assistant — ' + user.name : 'Group Leader — ' + user.name)}
          </h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            ${
              isInstructor
                ? 'Academic Oversight & Verification • Audit and Direct Edit Rights Enabled'
                : isAssistant
                  ? 'Teaching Assistant Workspace — Test Evaluation & Score Editing Rights Enabled'
                  : 'Full Class Operations • 17 Members • 4 Teams'
            }
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${
            isInstructor
              ? `<span class="badge" style="background-color: var(--purple-soft); color: var(--purple); font-weight: 600;">Instructor View</span>`
              : isAssistant
                ? `<span class="badge" style="background-color: var(--teal-soft); color: var(--teal); font-weight: 600;">Assistant Grading Mode</span>`
                : ''
          }
          <button class="btn btn-secondary btn-sm" id="btn-refresh-gl">↻ Refresh Data</button>
        </div>
      </div>
    </div>

    <!-- Executive Summary KPI Tiles -->
    <div class="dashboard-hero">
      <div class="dashboard-hero-row">
        <div class="dashboard-hero-copy">
          <h3>Today’s executive focus</h3>
          <p>${atRiskMembers.length > 0 ? `${esc(atRiskMembers.length)} students need support attention today.` : 'Everything is tracking smoothly. Focus on momentum and review.'}</p>
        </div>
        <div class="dashboard-microstats">
          <div class="microstat-box">
            <span>Strongest</span>
            <strong>${esc(Object.keys(teamAverages).length ? Object.entries(teamAverages).sort((a, b) => b[1] - a[1])[0][0] : 'N/A')}</strong>
          </div>
          <div class="microstat-box">
            <span>Open</span>
            <strong>${esc(openTasks + openDoubts)}</strong>
          </div>
          <div class="microstat-box">
            <span>Completion</span>
            <strong>${esc(subRate)}%</strong>
          </div>
        </div>
      </div>
      <div class="quick-action-row">
        <span class="quick-action-chip"><strong>⚡</strong> Review at-risk list</span>
        <span class="quick-action-chip"><strong>📝</strong> Check pending tasks</span>
        <span class="quick-action-chip"><strong>📤</strong> Export current ledger</span>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Class Avg Score</span>
        <span class="kpi-val num" style="color: var(--teal);">${esc(classAvg)}</span>
        <span class="kpi-sub">Across ${esc(validScores.length)} recorded tests</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Submission Rate</span>
        <span class="kpi-val num">${esc(subRate)}%</span>
        <span class="kpi-sub">${esc(subYesCount)} on-time assignments</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Avg Attendance</span>
        <span class="kpi-val num">${esc(attRate)}%</span>
        <span class="kpi-sub">Mock & lecture presence</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">At-Risk Students</span>
        <span class="kpi-val num" style="color: ${esc(atRiskMembers.length > 0 ? 'var(--red)' : 'var(--teal);')}">${esc(atRiskMembers.length)}</span>
        <span class="kpi-sub">${esc(atRiskMembers.length > 0 ? 'Require intervention' : 'All on track')}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Open Tasks</span>
        <span class="kpi-val num">${esc(openTasks)}</span>
        <span class="kpi-sub">Pending completion</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Pending Doubts</span>
        <span class="kpi-val num" style="color: ${esc(openDoubts > 0 ? 'var(--amber)' : 'var(--text-main);')}">${esc(openDoubts)}</span>
        <span class="kpi-sub">Awaiting instructor reply</span>
      </div>
    </div>

    <!-- Tab Content Shell -->
    <div id="gl-tab-content"></div>
  `;

  const contentShell = container.querySelector('#gl-tab-content');

  const mentorshipPlans = data.mentorship || [];

  // Define tabs
  const tabs = [
    { id: 'ledger', label: 'Ledger & Scores', icon: '📊' },
    {
      id: 'mentorship',
      label: `Recovery & Mentorship (${atRiskMembers.length})`,
      icon: '🛡️',
    },
    { id: 'analytics', label: 'Analytics & Leaderboard', icon: '🏆' },
    {
      id: 'quizzes',
      label: `Quizzes & Scheduler (${quizzes.length})`,
      icon: '⏱️',
    },
    {
      id: 'announcements',
      label: `Announcements (${announcements.length})`,
      icon: '📢',
    },
    { id: 'tasks', label: `Tasks & Submissions (${tasks.length})`, icon: '📝' },
    { id: 'doubts', label: `Doubts & Escalations (${openDoubts})`, icon: '❓' },
    { id: 'export', label: 'Export CSV', icon: '📥' },
  ];

  if (canLead) {
    tabs.push({ id: 'activity', label: 'Activity Log', icon: '🧾' });
  }
  if (isGroupLeader) {
    tabs.push({ id: 'pins', label: 'Member Access & PINs', icon: '🔑' });
  }

  function switchTab(tabId) {
    if (tabId === 'ledger') renderLedgerTab(contentShell);
    else if (tabId === 'mentorship') renderMentorshipTab(contentShell);
    else if (tabId === 'analytics') renderAnalyticsTab(contentShell);
    else if (tabId === 'quizzes') renderQuizzesTab(contentShell);
    else if (tabId === 'announcements') renderAnnouncementsTab(contentShell);
    else if (tabId === 'tasks') renderTasksTab(contentShell);
    else if (tabId === 'doubts') renderDoubtsTab(contentShell);
    else if (tabId === 'export') renderExportTab(contentShell);
    else if (tabId === 'pins') renderPinsTab(contentShell);
    else if (tabId === 'activity') renderActivityLog(contentShell);
  }

  createTabNav(container.querySelector('.kpi-grid'), tabs, switchTab);
  switchTab('ledger');

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: LEDGER & OVERVIEW
  // ─────────────────────────────────────────────────────────────────────────
  function renderLedgerTab(wrap) {
    wrap.innerHTML = `
      <!-- At-Risk Alert Banner -->
      ${
        atRiskMembers.length > 0
          ? `
        <div class="at-risk-panel">
          <div class="at-risk-title">⚠️ At-Risk Alert (${esc(atRiskMembers.length)} members require immediate support)</div>
          <p style="font-size: 0.85rem; margin-bottom: 0.6rem;">
            These students scored below 50 or missed submissions in consecutive units. Click to highlight in ledger:
          </p>
          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
            ${atRiskMembers
              .map((m) => {
                const name = m.member || m.name;
                return `
                <span class="badge badge-support" style="padding: 0.35rem 0.65rem; cursor: pointer;" data-followup="${esc(name)}">
                  ${esc(name)} (Team ${esc(m.team)}) • Jump to entry ↗
                </span>
              `;
              })
              .join(' ')}
          </div>
        </div>
      `
          : ''
      }

      <!-- 4 Teams Overview Tiles -->
      <div style="margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Teams Overview</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Click any team to filter the scorecard</span>
        </div>
        <div class="grid-4" id="team-cards-grid">
          ${teams
            .map((t) => {
              const avg =
                teamAverages[t] !== undefined ? teamAverages[t] : null;
              const band = avg !== null ? getScoreBand(avg) : null;
              const count = (TEAM_ROSTER[t] || []).length;
              return `
              <div class="stat-tile team-filter-card" data-team="${esc(t)}">
                <div class="stat-title">Team ${esc(t)}</div>
                <div class="stat-val num">${esc(avg !== null ? avg : '—')}</div>
                <div style="margin-top: 0.35rem;">
                  ${band ? `<span class="badge ${esc(band.cls)}">${esc(band.label)}</span>` : `<span style="color: var(--text-muted); font-size: 0.75rem;">No scores</span>`}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">
                  ${esc(count)} registered members
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>

      <!-- Class Marks Ledger -->
      <div class="card" style="margin-bottom: 1.5rem;" id="ledger-card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.65rem;">
          <h3 class="card-title" id="marks-panel-title">Class Scorecard Ledger</h3>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <div class="auth-tabs" style="margin-bottom: 0; padding: 0.15rem; gap: 0.2rem;">
              <button type="button" class="filter-chip active" id="btn-filter-cycle-all" style="font-size: 0.75rem;">All Topics</button>
              <button type="button" class="filter-chip" id="btn-filter-cycle-1" style="font-size: 0.75rem;">Unit 1</button>
              <button type="button" class="filter-chip" id="btn-filter-cycle-2" style="font-size: 0.75rem;">Unit 2</button>
            </div>
            <input type="text" id="gl-search-member" class="form-control" placeholder="🔍 Search student / topic..." style="width: 170px; padding: 0.3rem 0.6rem; font-size: 0.8rem; min-height: 32px;" />
            <button class="btn btn-secondary btn-sm" id="btn-show-all-marks">Show All Teams</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Team</th>
                <th>Tested Topic / Unit</th>
                <th>Score</th>
                <th>Sub</th>
                <th>Att</th>
                <th>Preview</th>
                <th>Peer</th>
                <th>Punctual</th>
                <th>Band</th>
                <th>Notes / Audit</th>
                ${canEdit ? `<th>Actions</th>` : ''}
              </tr>
            </thead>
            <tbody id="gl-marks-tbody">
              ${renderMarksRows(marks)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Enter Marks Form -->
      ${
        canEdit
          ? `
        <div class="card" style="margin-bottom: 1.5rem;">
          <div class="card-header">
            <h3 class="card-title">Enter New Student Marks</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Logged under: ${esc(user.name)}</span>
          </div>
          <div id="gl-mark-feedback"></div>
          <form id="form-gl-add-mark">
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Student</label>
                <select id="gl-mark-member" class="form-control" required>
                  <option value="">-- Choose Member --</option>
                  ${Object.keys(TEAM_ROSTER)
                    .map(
                      (teamName) => `
                    <optgroup label="Team ${esc(teamName)}">
                      ${TEAM_ROSTER[teamName]
                        .map(
                          (mem) =>
                            `<option value="${esc(mem)}" data-team="${esc(teamName)}">${esc(mem)} (Team ${esc(teamName)})</option>`,
                        )
                        .join('')}
                    </optgroup>
                  `,
                    )
                    .join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Tested Topic / Unit</label>
                <input type="text" id="gl-mark-cycle" class="form-control" placeholder="e.g. Unit 2: Monetary Policy" value="Unit 2: Monetary Policy" required />
              </div>
              <div class="form-group">
                <label class="form-label">Mock #</label>
                <input type="number" id="gl-mark-mock" class="form-control" placeholder="Optional" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Quiz Score (0-100)</label>
                <input type="number" id="gl-mark-quiz" class="form-control" min="0" max="100" placeholder="e.g. 88" required />
              </div>
              <div class="form-group">
                <label class="form-label">Submission</label>
                <select id="gl-mark-sub" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Attendance</label>
                <input type="text" id="gl-mark-att" class="form-control" value="100%" />
              </div>
              <div class="form-group">
                <label class="form-label">Preview Done</label>
                <select id="gl-mark-prev" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Peer Rating (1-5)</label>
                <input type="number" step="0.1" min="1" max="5" id="gl-mark-peer" class="form-control" placeholder="4.5" />
              </div>
              <div class="form-group">
                <label class="form-label">Punctual</label>
                <select id="gl-mark-punctual" class="form-control">
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Performance Notes</label>
                <input type="text" id="gl-mark-notes" class="form-control" placeholder="Strengths, focus areas..." />
              </div>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Record Student Mark</button>
          </form>
        </div>
      `
          : ''
      }
    `;

    // Follow-up scroll shortcut
    wrap.querySelectorAll('[data-followup]').forEach((badge) => {
      badge.addEventListener('click', () => {
        const memName = badge.getAttribute('data-followup');
        const targetRow = wrap.querySelector(`tr[data-member="${CSS.escape(memName)}"]`);
        if (targetRow) {
          targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetRow.classList.add('row-updated');
          setTimeout(() => targetRow.classList.remove('row-updated'), 2000);
        }
      });
    });

    // Team filtering & search
    const teamCards = wrap.querySelectorAll('.team-filter-card');
    const marksTbody = wrap.querySelector('#gl-marks-tbody');
    const marksTitle = wrap.querySelector('#marks-panel-title');
    const searchInput = wrap.querySelector('#gl-search-member');

    let currentCycleFilter = 'all';
    let currentTeamFilter = null;

    const applyLedgerFilters = () => {
      let filtered = marks;
      if (currentTeamFilter) {
        filtered = filtered.filter((m) => m.team === currentTeamFilter);
      }
      if (currentCycleFilter !== 'all') {
        filtered = filtered.filter((m) =>
          String(m.cycle).toLowerCase().includes(currentCycleFilter),
        );
      }
      const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
      if (q) {
        filtered = filtered.filter(
          (m) =>
            (m.member && m.member.toLowerCase().includes(q)) ||
            (m.team && m.team.toLowerCase().includes(q)) ||
            (m.cycle && String(m.cycle).toLowerCase().includes(q)) ||
            (m.notes && m.notes.toLowerCase().includes(q)),
        );
      }
      marksTbody.innerHTML = renderMarksRows(filtered);
      attachMarksActions();
    };

    wrap
      .querySelectorAll(
        '#btn-filter-cycle-all, #btn-filter-cycle-1, #btn-filter-cycle-2',
      )
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          wrap
            .querySelectorAll(
              '#btn-filter-cycle-all, #btn-filter-cycle-1, #btn-filter-cycle-2',
            )
            .forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          if (btn.id === 'btn-filter-cycle-1') currentCycleFilter = '1';
          else if (btn.id === 'btn-filter-cycle-2') currentCycleFilter = '2';
          else currentCycleFilter = 'all';
          applyLedgerFilters();
        });
      });

    teamCards.forEach((card) => {
      card.addEventListener('click', () => {
        teamCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        currentTeamFilter = card.getAttribute('data-team');
        marksTitle.textContent = `Scorecard Ledger — Team ${currentTeamFilter}`;
        applyLedgerFilters();
      });
    });

    wrap.querySelector('#btn-show-all-marks').addEventListener('click', () => {
      teamCards.forEach((c) => c.classList.remove('active'));
      currentTeamFilter = null;
      marksTitle.textContent = `Class Scorecard Ledger (All Teams)`;
      applyLedgerFilters();
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        applyLedgerFilters();
      });
    }

    attachMarksActions();

    // Add mark form submission
    if (canEdit) {
      const markForm = wrap.querySelector('#form-gl-add-mark');
      if (markForm) {
        markForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const selectEl = wrap.querySelector('#gl-mark-member');
          const member = selectEl.value;
          const selectedOption = selectEl.options[selectEl.selectedIndex];
          const team = selectedOption.getAttribute('data-team');
          const cycle = wrap.querySelector('#gl-mark-cycle').value;
          const mockNumber = wrap.querySelector('#gl-mark-mock').value;
          const quizScore = wrap.querySelector('#gl-mark-quiz').value;
          const submission = wrap.querySelector('#gl-mark-sub').value;
          const attendance = wrap.querySelector('#gl-mark-att').value;
          const previewDone = wrap.querySelector('#gl-mark-prev').value;
          const peerRating = wrap.querySelector('#gl-mark-peer').value;
          const punctual = wrap.querySelector('#gl-mark-punctual').value;
          const notes = wrap.querySelector('#gl-mark-notes').value;
          const feedback = wrap.querySelector('#gl-mark-feedback');
          const btn = markForm.querySelector('button[type="submit"]');

          btn.disabled = true;
          btn.textContent = 'Saving...';

          try {
            const res = await apiAddMark({
              role: user.role,
              name: user.name,
              member,
              team,
              cycle,
              mockNumber,
              quizScore: Number(quizScore),
              submission,
              attendance,
              previewDone,
              peerRating,
              punctual,
              notes,
            });

            if (res.ok) {
              feedback.innerHTML = `<div class="alert alert-success">Mark recorded for ${esc(member)}!</div>`;
              window.showEconomicsToast(
                `Mark recorded for ${member}.`,
                'success',
              );
              markForm.reset();
              setTimeout(() => (feedback.innerHTML = ''), 3000);
              onRefresh();
            } else {
              feedback.innerHTML = `<div class="alert alert-error">${esc(res.error || 'Failed to save mark.')}</div>`;
              window.showEconomicsToast(
                res.error || 'Failed to save mark.',
                'error',
              );
            }
          } catch (err) {
            feedback.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
            window.showEconomicsToast(err.message, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Record Student Mark';
          }
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: ANALYTICS & LEADERBOARD
  // ─────────────────────────────────────────────────────────────────────────
  function renderAnalyticsTab(wrap) {
    wrap.innerHTML = `
      <div class="grid-2" style="margin-bottom: 1.5rem;">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Team Performance Comparison</h3></div>
          <div style="height: 190px; position: relative;">
            <canvas id="chart-team-averages"></canvas>
          </div>
          <p class="form-hint" style="text-align: center; margin-top: 0.5rem;">
            Mean score comparison across the 4 student cohorts
          </p>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Cohort Rating Distribution</h3></div>
          <div style="height: 190px; position: relative;">
            <canvas id="chart-band-dist"></canvas>
          </div>
          <p class="form-hint" style="text-align: center; margin-top: 0.5rem;">
            Distribution across performance tiers
          </p>
        </div>
      </div>

      <div id="leaderboard-shell"></div>
    `;

    setTimeout(() => {
      renderTeamAveragesChart('chart-team-averages', teamAverages);
      renderBandDistributionChart('chart-band-dist', memberMetrics, marks);
    }, 50);

    renderLeaderboard(
      wrap.querySelector('#leaderboard-shell'),
      memberMetrics,
      teamAverages,
      user,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: QUIZZES & SCHEDULER
  // ─────────────────────────────────────────────────────────────────────────
  function renderQuizzesTab(wrap) {
    wrap.innerHTML = `<div id="quiz-sched-shell"></div>`;
    renderQuizScheduler(
      wrap.querySelector('#quiz-sched-shell'),
      user,
      quizzes,
      onRefresh,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4: ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  function renderAnnouncementsTab(wrap) {
    wrap.innerHTML = `<div id="ann-shell"></div>`;
    renderAnnouncementsPanel(
      wrap.querySelector('#ann-shell'),
      user,
      announcements,
      onRefresh,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 5: TASKS & SUBMISSIONS
  // ─────────────────────────────────────────────────────────────────────────
  function renderTasksTab(wrap) {
    wrap.innerHTML = `
      ${
        canLead
          ? `
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header"><h3 class="card-title">Assign New Class Task</h3></div>
          <div id="task-feedback"></div>
          <form id="form-gl-add-task">
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label class="form-label">Task Title</label>
                <input type="text" id="gl-task-title" class="form-control" placeholder="e.g. Problem Set: Monetary Policy Transmission" required />
              </div>
              <div class="form-group">
                <label class="form-label">Assign To</label>
                <select id="gl-task-team" class="form-control" required>
                  <option value="ALL">All Teams (Class-wide)</option>
                  <option value="Shehroz">Team Shehroz</option>
                  <option value="Amina">Team Amina</option>
                  <option value="Ayesha">Team Ayesha</option>
                  <option value="Lareb">Team Lareb</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Due Date</label>
                <input type="date" id="gl-task-due" class="form-control" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Description / Instructions</label>
              <textarea id="gl-task-desc" class="form-control" rows="2" placeholder="Task requirements, questions, and expectations..." required></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Google Drive Link (Resource)</label>
              <input type="url" id="gl-task-file" class="form-control" placeholder="https://drive.google.com/..." />
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%;">Create & Distribute Task</button>
          </form>
        </div>
      `
          : ''
      }

      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header"><h3 class="card-title">All Assigned Tasks (${esc(tasks.length)})</h3></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Team</th>
                <th>Due</th>
                <th>Status</th>
                ${canLead ? `<th>Actions</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${
                tasks.length === 0
                  ? `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No tasks assigned yet.</td></tr>`
                  : tasks
                      .map((task) => {
                        const isDone = task.status === 'done';
                        return `
                      <tr>
                        <td>
                          <strong>${esc(task.title)}</strong>
                          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${esc(task.description || '')}</p>
                          ${linkHtml(task.fileUrl, 'Drive Link ↗', 'style="font-size: 0.75rem;"')}
                        </td>
                        <td><span class="badge" style="background-color: var(--bg-subtle);">${esc(task.team)}</span></td>
                        <td style="font-size: 0.8rem; white-space: nowrap;">${esc(task.dueDate || '—')}</td>
                        <td><span class="badge ${esc(isDone ? 'badge-done' : 'badge-open')}">${esc(task.status)}</span></td>
                        ${
                          canLead
                            ? `
                          <td>
                            <div style="display: flex; gap: 0.35rem; align-items: center;">
                              <button class="btn btn-secondary btn-sm btn-edit-task" data-id="${esc(task.id)}" title="Edit task">✏️</button>
                              <button class="btn btn-secondary btn-sm btn-toggle-task" data-id="${esc(task.id)}" data-current="${esc(task.status)}">
                                ${esc(isDone ? 'Reopen' : 'Done')}
                              </button>
                            </div>
                          </td>
                        `
                            : ''
                        }
                      </tr>
                    `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Student Submissions Log (${esc(submissions.length)})</h3></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Team</th>
                <th>Task ID</th>
                <th>Submission Details</th>
                <th>Attachment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${
                submissions.length === 0
                  ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No submissions yet.</td></tr>`
                  : submissions
                      .map(
                        (s) => `
                    <tr>
                      <td><strong>${esc(s.member)}</strong></td>
                      <td><span class="badge" style="background-color: var(--bg-subtle);">${esc(s.team)}</span></td>
                      <td style="font-size: 0.8rem; font-family: monospace;">${esc(s.taskId)}</td>
                      <td>${esc(s.content || 'Completed')}</td>
                      <td>${linkHtml(s.fileUrl, 'Drive Link ↗', '', '—')}</td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${esc(new Date(s.timestamp).toLocaleDateString())}</td>
                    </tr>
                  `,
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Attach task handlers
    if (canLead) {
      const taskForm = wrap.querySelector('#form-gl-add-task');
      if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const title = wrap.querySelector('#gl-task-title').value;
          const description = wrap.querySelector('#gl-task-desc').value;
          const team = wrap.querySelector('#gl-task-team').value;
          const dueDate = wrap.querySelector('#gl-task-due').value;
          const fileUrl = wrap.querySelector('#gl-task-file').value;
          const feedback = wrap.querySelector('#task-feedback');
          const btn = taskForm.querySelector('button[type="submit"]');

          btn.disabled = true;
          btn.textContent = 'Assigning...';

          try {
            const res = await apiAddTask({
              role: user.role,
              createdBy: user.name,
              title,
              description,
              team,
              dueDate,
              fileUrl,
            });

            if (res.ok) {
              feedback.innerHTML = `<div class="alert alert-success">Task assigned successfully!</div>`;
              window.showEconomicsToast(
                'Task assigned successfully.',
                'success',
              );
              taskForm.reset();
              setTimeout(() => (feedback.innerHTML = ''), 3000);
              onRefresh();
            } else {
              feedback.innerHTML = `<div class="alert alert-error">${esc(res.error || 'Failed to create task.')}</div>`;
              window.showEconomicsToast(
                res.error || 'Failed to create task.',
                'error',
              );
            }
          } catch (err) {
            feedback.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
            window.showEconomicsToast(err.message, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Create & Distribute Task';
          }
        });
      }

      wrap.querySelectorAll('.btn-edit-task').forEach((btn) => {
        btn.addEventListener('click', () => {
          const taskId = btn.getAttribute('data-id');
          const task = tasks.find((t) => t.id === taskId);
          if (!task) return;

          openEditTaskModal(task, async (fields) => {
            try {
              const res = await apiEditTask({
                role: user.role,
                id: taskId,
                fields,
              });
              if (res.ok) {
                window.showEconomicsToast(
                  'Task updated successfully.',
                  'success',
                );
                onRefresh();
              } else {
                window.showEconomicsToast(
                  res.error || 'Task edit failed.',
                  'error',
                );
              }
            } catch (err) {
              window.showEconomicsToast(err.message, 'error');
            }
          });
        });
      });

      wrap.querySelectorAll('.btn-toggle-task').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const taskId = btn.getAttribute('data-id');
          const current = btn.getAttribute('data-current');
          const next = current === 'done' ? 'open' : 'done';
          btn.disabled = true;

          try {
            const res = await apiUpdateTaskStatus(taskId, next, user.role);
            if (res.ok) {
              window.showEconomicsToast(`Task marked as ${next}.`, 'success');
              onRefresh();
            } else {
              window.showEconomicsToast(res.error || 'Update failed.', 'error');
            }
          } catch (err) {
            window.showEconomicsToast(err.message, 'error');
          }
        });
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 6: DOUBTS & ESCALATIONS
  // ─────────────────────────────────────────────────────────────────────────
  function renderDoubtsTab(wrap) {
    const sorted = [...escalations].sort((a, b) => {
      if (a.severity === 'severe' && b.severity !== 'severe') return -1;
      if (a.severity !== 'severe' && b.severity === 'severe') return 1;
      if (a.status === 'open' && b.status === 'closed') return -1;
      if (a.status === 'closed' && b.status === 'open') return 1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    wrap.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Student Doubts & Escalations Log (${esc(escalations.length)})</h3>
        </div>
        <div>
          ${
            sorted.length === 0
              ? `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No questions or issues reported.</p>`
              : sorted
                  .map((item) => {
                    const isSevere = item.severity === 'severe';
                    const isClosed = item.status === 'closed';
                    return `
                  <div class="escalation-item ${esc(isSevere ? 'severe' : '')}" style="margin-bottom: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
                      <h4 style="font-size: 0.95rem; font-weight: 700;">${esc(item.topic)}</h4>
                      <div style="display: flex; gap: 0.35rem; align-items: center;">
                        ${isSevere ? `<span class="badge badge-atrisk">URGENT</span>` : ''}
                        <span class="badge ${esc(isClosed ? 'badge-closed' : 'badge-open')}">${esc(item.status)}</span>
                      </div>
                    </div>
                    <p style="font-size: 0.85rem; margin-bottom: 0.45rem;">${esc(item.details)}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-muted);">
                      <span>From: <strong>${esc(item.raisedBy)}</strong> (Team ${esc(item.team)}) • ${esc(new Date(item.timestamp).toLocaleDateString())}</span>
                      ${
                        !isClosed && canLead
                          ? `
                        <button class="btn btn-teal btn-sm btn-resolve-esc" data-id="${esc(item.id)}">
                          Mark Resolved ✓
                        </button>
                      `
                          : ''
                      }
                    </div>
                  </div>
                `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    wrap.querySelectorAll('.btn-resolve-esc').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const escId = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await apiUpdateEscalationStatus(
            escId,
            'closed',
            user.role,
          );
          if (res.ok) {
            window.showEconomicsToast(
              'Escalation marked as resolved.',
              'success',
            );
            onRefresh();
          } else {
            window.showEconomicsToast(res.error || 'Update failed.', 'error');
          }
        } catch (err) {
          window.showEconomicsToast(err.message, 'error');
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 7: EXPORT CSV
  // ─────────────────────────────────────────────────────────────────────────
  function renderExportTab(wrap) {
    wrap.innerHTML = `<div id="export-shell"></div>`;
    renderExportToolbar(wrap.querySelector('#export-shell'), {
      marks,
      submissions,
      memberMetrics,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 7.5: AT-RISK RECOVERY & MENTORSHIP
  // ─────────────────────────────────────────────────────────────────────────
  function renderMentorshipTab(wrap) {
    wrap.innerHTML = `<div id="mentorship-shell"></div>`;
    renderMentorshipPanel(
      wrap.querySelector('#mentorship-shell'),
      user,
      mentorshipPlans,
      atRiskMembers,
      memberMetrics,
      onRefresh,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 8: MEMBER ACCESS & PIN MANAGEMENT (Group Leader Only)
  // ─────────────────────────────────────────────────────────────────────────
  async function renderPinsTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 class="card-title">🔑 Member Access & PIN Resets</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Group Leader administrative rights</span>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label class="sr-only" for="pins-search">Search members</label>
            <input type="search" id="pins-search" class="form-control" placeholder="🔍 Search member..." style="width: 170px; padding: 0.35rem 0.65rem; font-size: 0.8rem;" />
          </div>
        </div>

        <div class="alert alert-info" style="font-size: 0.85rem; margin-bottom: 1.25rem;">
          🛡️ <strong>PINs are stored encrypted (hashed) and nobody — including you — can see them.</strong>
          If someone forgets theirs, reset it here and tell them the new PIN in person. Resetting signs them out everywhere.
          Everyone can also change their own PIN from the account menu.
        </div>

        <div id="pins-table-loading" style="text-align: center; padding: 2rem;">
          <p style="color: var(--text-muted); font-size: 0.9rem;">Loading member roster...</p>
        </div>

        <div class="table-responsive" id="pins-table-wrap" style="display: none;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Role</th>
                <th>Team</th>
                <th>PIN</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="pins-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- PIN Reset Modal Container -->
      <div id="pin-modal-shell"></div>
    `;

    let roster = data.users || [];
    if (!roster.length) {
      try {
        const uRes = await apiGetUsers();
        if (uRes.ok && uRes.users) roster = uRes.users;
      } catch (e) {
        console.warn('Could not fetch users list:', e);
      }
    }

    const loadingEl = wrap.querySelector('#pins-table-loading');
    const tableWrap = wrap.querySelector('#pins-table-wrap');
    const tbody = wrap.querySelector('#pins-tbody');
    const searchInput = wrap.querySelector('#pins-search');

    loadingEl.style.display = 'none';
    tableWrap.style.display = 'block';

    function renderRosterRows(list) {
      if (!list.length) {
        return `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No members found.</td></tr>`;
      }
      return list
        .map(
          (m) => `
          <tr data-member="${esc(m.name)}">
            <td><strong>${esc(m.name)}</strong></td>
            <td><span class="role-pill role-${esc(m.role)}">${esc(String(m.role).replace('_', ' '))}</span></td>
            <td><span class="badge" style="background-color: var(--bg-subtle);">${esc(m.team)}</span></td>
            <td>${
              m.hasPin
                ? `<span class="badge badge-done">Set ✓</span>`
                : `<span class="badge badge-atrisk">Not set</span>`
            }</td>
            <td>
              <button class="btn btn-primary btn-sm btn-change-member-pin" data-name="${esc(m.name)}" data-team="${esc(m.team)}">
                🔑 Reset PIN
              </button>
            </td>
          </tr>
        `,
        )
        .join('');
    }

    function refreshRosterTable() {
      const q = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const filtered = roster.filter(
        (m) =>
          String(m.name).toLowerCase().includes(q) ||
          String(m.team).toLowerCase().includes(q) ||
          String(m.role).toLowerCase().includes(q),
      );
      tbody.innerHTML = renderRosterRows(filtered);
      tbody.querySelectorAll('.btn-change-member-pin').forEach((btn) => {
        btn.addEventListener('click', () =>
          openChangePinModal(btn.getAttribute('data-name'), btn.getAttribute('data-team')),
        );
      });
    }

    refreshRosterTable();
    if (searchInput) searchInput.addEventListener('input', refreshRosterTable);

    function openChangePinModal(targetName, targetTeam) {
      const modalShell = wrap.querySelector('#pin-modal-shell');
      modalShell.innerHTML = `
        <div class="modal-overlay" id="pin-modal-overlay">
          <div class="modal-content" style="max-width: 420px;" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
              <div>
                <h3 id="pin-modal-title" style="font-size: 1.15rem; font-weight: 700;">Reset PIN</h3>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.15rem;">
                  New PIN for <strong>${esc(targetName)}</strong> (${esc(targetTeam)})
                </p>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-close-pin-modal" aria-label="Close">✕</button>
            </div>

            <div id="pin-modal-feedback"></div>

            <form id="form-update-pin">
              <div class="form-group">
                <label class="form-label" for="input-new-pin">New 4-Digit PIN</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input
                    type="text"
                    id="input-new-pin"
                    class="form-control"
                    placeholder="e.g. 5821"
                    maxlength="4"
                    pattern="[0-9]{4}"
                    inputmode="numeric"
                    autocomplete="off"
                    style="font-family: monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.2em; text-align: center;"
                    required
                  />
                  <button type="button" class="btn btn-secondary" id="btn-gen-random-pin" title="Generate random PIN">
                    🎲 Random
                  </button>
                </div>
                <p class="form-hint" style="margin-top: 0.35rem;">
                  Write it down now — it can't be shown again after you save.
                </p>
              </div>

              <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem;">
                <button type="button" class="btn btn-secondary" id="btn-cancel-pin-modal" style="flex: 1;">Cancel</button>
                <button type="submit" class="btn btn-primary" id="btn-save-pin" style="flex: 2;">Save New PIN</button>
              </div>
            </form>
          </div>
        </div>
      `;

      const overlay = modalShell.querySelector('#pin-modal-overlay');
      const pinInput = modalShell.querySelector('#input-new-pin');
      const saveBtn = modalShell.querySelector('#btn-save-pin');
      const feedback = modalShell.querySelector('#pin-modal-feedback');
      const form = modalShell.querySelector('#form-update-pin');
      const closeModal = () => (modalShell.innerHTML = '');

      modalShell.querySelector('#btn-close-pin-modal').addEventListener('click', closeModal);
      modalShell.querySelector('#btn-cancel-pin-modal').addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
      modalShell.querySelector('#btn-gen-random-pin').addEventListener('click', () => {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        pinInput.value = String(buf[0] % 10000).padStart(4, '0');
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPin = pinInput.value.trim();
        if (!/^\d{4}$/.test(newPin)) {
          feedback.innerHTML = `<div class="alert alert-error">PIN must be exactly 4 digits.</div>`;
          return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
          const res = await apiUpdatePin({ targetMember: targetName, newPin });
          if (res.ok) {
            feedback.innerHTML = `<div class="alert alert-success">PIN reset for ${esc(targetName)}. Tell them the new PIN privately.</div>`;
            const found = roster.find((u) => u.name.toLowerCase() === targetName.toLowerCase());
            if (found) found.hasPin = true;
            refreshRosterTable();
            setTimeout(closeModal, 1800);
          } else {
            feedback.innerHTML = `<div class="alert alert-error">${esc(res.error || 'Failed to update PIN.')}</div>`;
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save New PIN';
          }
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-error">Error: ${esc(err.message)}</div>`;
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save New PIN';
        }
      });

      pinInput.focus();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MARKS TABLE RENDERER & ACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  function renderMarksRows(marksList) {
    if (!marksList || marksList.length === 0) {
      return `<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No marks recorded.</td></tr>`;
    }
    return marksList
      .map((m) => {
        const band = getScoreBand(m.quizScore);
        return `
        <tr id="mark-row-${esc(m.id)}" data-member="${esc(m.member)}">
          <td><strong>${esc(m.member)}</strong></td>
          <td><span class="badge" style="background-color: var(--bg-subtle);">${esc(m.team)}</span></td>
          <td>${esc(m.cycle)}</td>
          <td><strong class="num" style="font-size: 0.95rem;">${esc(m.quizScore)}</strong></td>
          <td>${esc(m.submission || '—')}</td>
          <td>${esc(m.attendance || '—')}</td>
          <td>${esc(m.previewDone || '—')}</td>
          <td>${esc(m.peerRating || '—')}</td>
          <td>${esc(m.punctual || '—')}</td>
          <td><span class="badge ${esc(band.cls)}">${esc(band.label)}</span></td>
          <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 180px;">
            ${esc(m.notes || '—')}
            ${m.editedBy ? `<br/><span style="font-size: 0.7rem; color: var(--purple);">Edited by: ${esc(m.editedBy)}</span>` : ''}
          </td>
          ${
            canEdit
              ? `
            <td>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                <button class="btn btn-secondary btn-sm btn-report-card" data-member="${esc(m.member)}" data-team="${esc(m.team)}" title="Print student progress report card">📄</button>
                <button class="btn btn-secondary btn-sm btn-edit-mark" data-id="${esc(m.id)}" title="Edit mark">✏️</button>
                ${
                  isInstructor
                    ? `<button class="btn btn-danger btn-sm btn-delete-mark" data-id="${esc(m.id)}" data-member="${esc(m.member)}" title="Delete mark entry">🗑️</button>`
                    : ''
                }
              </div>
            </td>
          `
              : ''
          }
        </tr>
      `;
      })
      .join('');
  }

  function attachMarksActions() {
    container.querySelectorAll('.btn-report-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const memName = btn.getAttribute('data-member');
        const memTeam = btn.getAttribute('data-team');
        const memMarks = marks.filter(
          (m) => m.member.toLowerCase() === memName.toLowerCase(),
        );
        const memData = memberMetrics[memName] || {};
        openReportCardModal(
          { name: memName, team: memTeam, role: 'member' },
          memMarks,
          memData,
          user,
        );
      });
    });

    container.querySelectorAll('.btn-edit-mark').forEach((btn) => {
      btn.addEventListener('click', () => {
        const markId = btn.getAttribute('data-id');
        const mark = marks.find((m) => m.id === markId);
        if (!mark) return;

        openEditMarkModal(mark, async (fields) => {
          try {
            const res = await apiEditMark({
              role: user.role,
              name: user.name,
              id: markId,
              fields,
            });
            if (res.ok) {
              window.showEconomicsToast(
                'Mark updated successfully.',
                'success',
              );
              onRefresh();
            } else {
              window.showEconomicsToast(res.error || 'Edit failed.', 'error');
            }
          } catch (err) {
            window.showEconomicsToast(err.message, 'error');
          }
        });
      });
    });

    container.querySelectorAll('.btn-delete-mark').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const markId = btn.getAttribute('data-id');
        const member = btn.getAttribute('data-member');
        if (
          window.confirmEconomicsAction(
            `Delete mark entry for ${member}? This cannot be undone.`,
          )
        ) {
          try {
            const res = await apiDeleteMark({ role: user.role, id: markId });
            if (res.ok) {
              window.showEconomicsToast(
                'Mark deleted successfully.',
                'success',
              );
              onRefresh();
            } else {
              window.showEconomicsToast(res.error || 'Delete failed.', 'error');
            }
          } catch (err) {
            window.showEconomicsToast(err.message, 'error');
          }
        }
      });
    });
  }

  // Refresh
  container.querySelector('#btn-refresh-gl').addEventListener('click', () => {
    onRefresh();
  });
}
