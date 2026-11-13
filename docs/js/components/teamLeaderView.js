/**
 * EconomicsPortal — Team Leader Dashboard Component (v3 Enhanced)
 */

import {
  apiUpdateTaskStatus,
  apiRequestGrading,
  apiAddTeamMessage,
  apiDeleteTeamMessage,
} from '../api.js';
import { getScoreBand, renderMemberMetricsHTML } from './metricsPanel.js';
import { renderSparkline } from './charts.js';
import { createTabNav } from './tabNav.js';
import { renderAnnouncementsPanel } from './announcementsPanel.js';
import { renderQuizScheduler, cleanupQuizCountdowns } from './quizScheduler.js';
import { renderLeaderboard } from './leaderboard.js';
import { openReportCardModal } from './reportCardModal.js';

export const TEAM_ROSTER = {
  Shehroz: ['Gorsi', 'Haris'],
  Amina: ['Amina', 'Ramesh', 'Mamoon', 'Tazneem'],
  Ayesha: ['Ayesha (Quetta)', 'Minal', 'Anika', 'Ahmed bin Nasir'],
  Lareb: ['Lareb', 'Shaiman', 'Aisha Amjad', 'Haseeb'],
};

export function renderTeamLeaderDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const tasks = data.tasks || [];
  const marks = data.marks || [];
  const submissions = data.submissions || [];
  const announcements = data.announcements || [];
  const quizzes = data.quizzes || [];
  const teamMessages = data.teamMessages || [];
  const teamAverage = data.teamAverage;
  const teamAverages = data.teamAverages || {};
  const memberMetrics = data.memberMetrics || {};
  const atRiskMembers = data.atRiskMembers || [];

  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;
  const teamMembers = (TEAM_ROSTER[user.team] || []).filter(
    (m) => m !== user.name,
  );

  // Compute team submission completion
  const teamSubmissions = submissions.filter((s) => s.team === user.team);
  const totalTasks = tasks.length || 1;
  const completedRate = Math.min(
    100,
    Math.round(
      (teamSubmissions.length / (teamMembers.length * totalTasks)) * 100,
    ),
  );

  container.innerHTML = `
    <!-- Top Header -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700;">Team Leader Command — ${user.name}</h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            Squad Leader: <strong>Team ${user.team}</strong> • ${teamMembers.length} active students
          </p>
        </div>
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Team Average</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--teal);" class="num">
              ${teamAverage !== null ? teamAverage : '—'}
            </div>
            ${avgBand ? `<span class="badge ${avgBand.cls}">${avgBand.label}</span>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-tl">↻ Refresh</button>
        </div>
      </div>
    </div>

    <!-- Team Health KPI Banner -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Team Members</span>
        <span class="kpi-val num">${teamMembers.length}</span>
        <span class="kpi-sub">Students under guidance</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Submission Activity</span>
        <span class="kpi-val num">${teamSubmissions.length}</span>
        <span class="kpi-sub">${completedRate}% completion rate</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">At-Risk Alerts</span>
        <span class="kpi-val num" style="color: ${atRiskMembers.length > 0 ? 'var(--red)' : 'var(--teal)'};">${atRiskMembers.length}</span>
        <span class="kpi-sub">${atRiskMembers.length > 0 ? 'Requires team support' : 'All passing'}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Pending Grading</span>
        <span class="kpi-val num" style="color: var(--purple);">${teamSubmissions.filter((s) => !s.gradingRequested).length}</span>
        <span class="kpi-sub">Submissions ready to forward</span>
      </div>
    </div>

    <!-- At-Risk Alert Banner (if any) -->
    ${
      atRiskMembers.length > 0
        ? `
      <div class="at-risk-panel" style="margin-bottom: 1.25rem;">
        <div class="at-risk-title">⚠️ At-Risk Team Members (${atRiskMembers.length})</div>
        <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">
          These members need guidance on upcoming problem sets and mock reviews:
        </p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${atRiskMembers
            .map((m) => {
              const name = m.member || m.name;
              return `<span class="badge badge-support" style="padding: 0.35rem 0.65rem;">${name} (Follow up)</span>`;
            })
            .join(' ')}
        </div>
      </div>
    `
        : ''
    }

    <!-- Tab Content Shell -->
    <div id="tl-tab-content"></div>
    <div id="tl-modal-shell"></div>
  `;

  const contentShell = container.querySelector('#tl-tab-content');
  const modalShell = container.querySelector('#tl-modal-shell');

  const tabs = [
    { id: 'members', label: 'Team Roster & Reports', icon: '👥' },
    {
      id: 'submissions',
      label: `Submissions & Request Grading (${teamSubmissions.length})`,
      icon: '📬',
    },
    {
      id: 'noticeboard',
      label: `Team Noticeboard (${teamMessages.length})`,
      icon: '💬',
    },
    { id: 'tasks', label: `Team Tasks (${tasks.length})`, icon: '📋' },
    { id: 'quizzes', label: `Quizzes & Tests (${quizzes.length})`, icon: '⏱️' },
    { id: 'leaderboard', label: 'Class Leaderboard', icon: '🏆' },
    {
      id: 'announcements',
      label: `Class Announcements (${announcements.length})`,
      icon: '📢',
    },
  ];

  function switchTab(tabId) {
    if (tabId === 'members') renderMembersTab(contentShell);
    else if (tabId === 'submissions') renderSubmissionsTab(contentShell);
    else if (tabId === 'noticeboard') renderNoticeboardTab(contentShell);
    else if (tabId === 'tasks') renderTasksTab(contentShell);
    else if (tabId === 'quizzes') renderQuizzesTab(contentShell);
    else if (tabId === 'leaderboard') renderLeaderboardTab(contentShell);
    else if (tabId === 'announcements') renderAnnouncementsTab(contentShell);
  }

  createTabNav(container.querySelector('.kpi-grid'), tabs, switchTab);
  switchTab('members');

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: MEMBERS & REPORT CARDS
  // ─────────────────────────────────────────────────────────────────────────
  function renderMembersTab(wrap) {
    wrap.innerHTML = `
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header">
          <h3 class="card-title">Team ${user.team} Member Roster</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Click "Report Card" to view or print official summaries</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${teamMembers
            .map((memberName) => {
              const memData = memberMetrics[memberName] || {};
              const memMarks = marks.filter(
                (m) => m.member.toLowerCase() === memberName.toLowerCase(),
              );
              return `
              <div style="border: 1px solid var(--border-color); border-radius: var(--radius); padding: 1rem; background-color: var(--bg-surface);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <div>
                    <h4 style="font-size: 1.05rem; font-weight: 700;">${memberName}</h4>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Team ${user.team}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                    ${memMarks.length > 1 ? `<canvas id="sparkline-${memberName.replace(/\s+/g, '_')}" width="120" height="32"></canvas>` : ''}
                    <button class="btn btn-secondary btn-sm btn-view-report" data-name="${memberName}">
                      📄 Report Card
                    </button>
                    <button class="btn btn-secondary btn-sm btn-nudge-member" data-name="${memberName}" title="Copy check-in reminder">
                      🔔 Nudge
                    </button>
                  </div>
                </div>
                ${renderMemberMetricsHTML(memData, { compact: true })}
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;

    setTimeout(() => {
      teamMembers.forEach((memberName) => {
        const memMarks = marks.filter(
          (m) => m.member.toLowerCase() === memberName.toLowerCase(),
        );
        if (memMarks.length > 1) {
          const scores = memMarks
            .map((m) => Number(m.quizScore))
            .filter((s) => !isNaN(s));
          const canvasId = `sparkline-${memberName.replace(/\s+/g, '_')}`;
          renderSparkline(canvasId, scores);
        }
      });
    }, 50);

    // Open Report Card Modal
    wrap.querySelectorAll('.btn-view-report').forEach((btn) => {
      btn.addEventListener('click', () => {
        const memName = btn.getAttribute('data-name');
        const memMarks = marks.filter(
          (m) => m.member.toLowerCase() === memName.toLowerCase(),
        );
        const memData = memberMetrics[memName] || {};
        openReportCardModal(
          { name: memName, team: user.team, role: 'member' },
          memMarks,
          memData,
          user,
        );
      });
    });

    // Nudge Member
    wrap.querySelectorAll('.btn-nudge-member').forEach((btn) => {
      btn.addEventListener('click', () => {
        const memName = btn.getAttribute('data-name');
        const nudgeText = `Hi ${memName}! Just checking in from Team ${user.team} for Dr. Numan's Economics class. Please ensure your problem set is submitted so I can forward it for grading!`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard
            .writeText(nudgeText)
            .then(() => {
              btn.textContent = 'Copied! ✓';
              setTimeout(() => (btn.textContent = '🔔 Nudge'), 2000);
            })
            .catch(() => {
              prompt('Copy reminder message for ' + memName + ':', nudgeText);
            });
        } else {
          prompt('Copy reminder message for ' + memName + ':', nudgeText);
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: REVIEW SUBMISSIONS & REQUEST GRADING (Core Requested Power)
  // ─────────────────────────────────────────────────────────────────────────
  function renderSubmissionsTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 class="card-title">Team ${user.team} Submissions & Test Review</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              Inspect submitted work and request official evaluation from Group Leader Shehroz or Sajal.
            </span>
          </div>
        </div>

        <div class="alert" style="background-color: var(--teal-soft); color: var(--teal); font-size: 0.85rem; margin-bottom: 1rem;">
          🔍 <strong>Team Leader Quality Check:</strong> Inspect the attachment to verify completeness, then click <strong>"Request Grading"</strong> to queue it for Sajal & Shehroz.
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Task ID</th>
                <th>Submission Content</th>
                <th>Drive Attachment</th>
                <th>Submitted Date</th>
                <th>Grading Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                teamSubmissions.length === 0
                  ? `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No submissions turned in yet by Team ${user.team}.</td></tr>`
                  : teamSubmissions
                      .map((s) => {
                        const isRequested = Boolean(s.gradingRequested);
                        return `
                      <tr>
                        <td><strong>${s.member}</strong></td>
                        <td style="font-family: monospace; font-size: 0.8rem;">${s.taskId}</td>
                        <td style="font-size: 0.85rem;">${s.content || 'Completed assignment'}</td>
                        <td>
                          ${
                            s.fileUrl
                              ? `<a href="${s.fileUrl}" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">View Drive File ↗</a>`
                              : `<span style="color: var(--text-muted); font-size: 0.8rem;">Text only</span>`
                          }
                        </td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);">${new Date(s.timestamp).toLocaleDateString()}</td>
                        <td>
                          ${
                            isRequested
                              ? `<span class="badge badge-done" title="${s.reviewNotes || 'Forwarded by leader'}">⏳ Forwarded to Sajal</span>`
                              : `<span class="badge badge-open">Pending Leader Review</span>`
                          }
                        </td>
                        <td>
                          ${
                            !isRequested
                              ? `
                            <button class="btn btn-primary btn-sm btn-request-grading" data-id="${s.id}" data-member="${s.member}">
                              Forward for Grading ↗
                            </button>
                          `
                              : `
                            <span style="font-size: 0.75rem; color: var(--text-muted);">✓ Requested</span>
                          `
                          }
                        </td>
                      </tr>
                    `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Request Grading Action
    wrap.querySelectorAll('.btn-request-grading').forEach((btn) => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-id');
        const member = btn.getAttribute('data-member');

        modalShell.innerHTML = `
          <div class="modal-overlay" id="req-grading-overlay">
            <div class="modal-content" style="max-width: 440px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <h3 style="font-size: 1.15rem; font-weight: 700;">Request Official Grading</h3>
                  <p style="font-size: 0.85rem; color: var(--text-muted);">
                    Forwarding submission by <strong>${member}</strong> to Group Leader & Sajal
                  </p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-close-req-modal">✕</button>
              </div>

              <form id="form-confirm-grading">
                <div class="form-group">
                  <label class="form-label">Team Leader Review Notes (Optional)</label>
                  <textarea id="req-grading-notes" class="form-control" rows="3" placeholder="e.g. Checked problem set, questions 1-4 completed with good diagrams. Ready for score entry."></textarea>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                  <button type="button" class="btn btn-secondary" id="btn-cancel-req-modal" style="flex: 1;">Cancel</button>
                  <button type="submit" class="btn btn-primary" id="btn-submit-req-grading" style="flex: 2;">Confirm & Forward</button>
                </div>
              </form>
            </div>
          </div>
        `;

        const overlay = modalShell.querySelector('#req-grading-overlay');
        const form = modalShell.querySelector('#form-confirm-grading');
        const notesInput = modalShell.querySelector('#req-grading-notes');
        const submitBtn = modalShell.querySelector('#btn-submit-req-grading');

        const closeModal = () => (modalShell.innerHTML = '');

        modalShell
          .querySelector('#btn-close-req-modal')
          .addEventListener('click', closeModal);
        modalShell
          .querySelector('#btn-cancel-req-modal')
          .addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) closeModal();
        });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          submitBtn.disabled = true;
          submitBtn.textContent = 'Forwarding...';

          try {
            const res = await apiRequestGrading({
              submissionId: subId,
              leaderName: user.name,
              reviewNotes: notesInput.value.trim(),
            });

            if (res.ok) {
              closeModal();
              window.showEconomicsToast(
                'Grading request forwarded successfully.',
                'success',
              );
              onRefresh();
            } else {
              window.showEconomicsToast(
                res.error || 'Failed to forward grading request.',
                'error',
              );
              submitBtn.disabled = false;
              submitBtn.textContent = 'Confirm & Forward';
            }
          } catch (err) {
            window.showEconomicsToast(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirm & Forward';
          }
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: TEAM NOTICEBOARD (Leader Communication Power)
  // ─────────────────────────────────────────────────────────────────────────
  function renderNoticeboardTab(wrap) {
    wrap.innerHTML = `
      <div class="card" style="margin-bottom: 1.25rem;">
        <div class="card-header"><h3 class="card-title">💬 Post Team Announcement</h3></div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          Messages posted here are displayed directly to members of <strong>Team ${user.team}</strong> on their dashboard.
        </p>

        <div id="tm-feedback"></div>

        <form id="form-add-team-msg">
          <div class="form-group">
            <label class="form-label">Message for Team ${user.team}</label>
            <textarea id="tm-body" class="form-control" rows="3" placeholder="e.g. Reminder: Group review call on Thursday at 5 PM. Bring questions on IS-LM model!" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary" id="btn-post-team-msg">Send to Team ${user.team}</button>
        </form>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Active Team Noticeboard (${teamMessages.length})</h3></div>
        <div>
          ${
            teamMessages.length === 0
              ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No team notices posted yet.</p>`
              : teamMessages
                  .map(
                    (msg) => `
                <div class="announcement-item" style="margin-bottom: 0.75rem; border-left: 4px solid var(--teal);">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <strong style="font-size: 0.95rem;">Notice from ${msg.author}</strong>
                    <button class="btn btn-danger btn-sm btn-delete-tm" data-id="${msg.id}" title="Remove notice">🗑️</button>
                  </div>
                  <p class="ann-body">${msg.message}</p>
                  <div class="ann-meta">${new Date(msg.timestamp).toLocaleString()}</div>
                </div>
              `,
                  )
                  .join('')
          }
        </div>
      </div>
    `;

    const form = wrap.querySelector('#form-add-team-msg');
    const feedback = wrap.querySelector('#tm-feedback');
    const submitBtn = wrap.querySelector('#btn-post-team-msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = wrap.querySelector('#tm-body').value.trim();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';

      try {
        const res = await apiAddTeamMessage({
          team: user.team,
          author: user.name,
          message,
        });

        if (res.ok) {
          feedback.innerHTML = `<div class="alert alert-success">Notice posted to Team ${user.team}!</div>`;
          window.showEconomicsToast(
            'Team notice posted successfully.',
            'success',
          );
          form.reset();
          setTimeout(() => {
            feedback.innerHTML = '';
            onRefresh();
          }, 1500);
        } else {
          feedback.innerHTML = `<div class="alert alert-error">${res.error || 'Failed to post message.'}</div>`;
          window.showEconomicsToast(
            res.error || 'Failed to post message.',
            'error',
          );
        }
      } catch (err) {
        feedback.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
        window.showEconomicsToast('Error: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = `Send to Team ${user.team}`;
      }
    });

    wrap.querySelectorAll('.btn-delete-tm').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!window.confirmEconomicsAction('Delete this team notice?')) return;
        const msgId = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await apiDeleteTeamMessage({
            id: msgId,
            role: user.role,
          });
          if (res.ok) {
            window.showEconomicsToast('Team notice removed.', 'success');
            onRefresh();
          } else {
            window.showEconomicsToast(
              res.error || 'Failed to remove notice.',
              'error',
            );
          }
        } catch (err) {
          window.showEconomicsToast(err.message, 'error');
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4: TEAM TASKS
  // ─────────────────────────────────────────────────────────────────────────
  function renderTasksTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Team Tasks (${tasks.length})</h3></div>
        <div id="tl-tasks-list">
          ${
            tasks.length === 0
              ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No tasks assigned.</p>`
              : tasks
                  .map((task) => {
                    const isDone = task.status === 'done';
                    return `
                  <div class="task-item ${isDone ? 'done' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.35rem;">
                      <h4 style="font-size: 0.95rem; font-weight: 700;">${task.title}</h4>
                      <span class="badge ${isDone ? 'badge-done' : 'badge-open'}">${task.status}</span>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.45rem;">
                      ${task.description || 'No description provided.'}
                    </p>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                      <span>Due: <strong>${task.dueDate || 'Not set'}</strong></span>
                      <div>
                        ${
                          !isDone
                            ? `<button class="btn btn-teal btn-sm btn-relay-task" data-id="${task.id}">
                                Relayed to team ✓
                              </button>`
                            : `<span style="color: var(--teal); font-weight: 600;">Completed</span>`
                        }
                      </div>
                    </div>
                  </div>
                `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    wrap.querySelectorAll('.btn-relay-task').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const taskId = btn.getAttribute('data-id');
        btn.disabled = true;
        try {
          const res = await apiUpdateTaskStatus(taskId, 'done', user.role);
          if (res.ok) {
            window.showEconomicsToast('Task marked as complete.', 'success');
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

  function renderQuizzesTab(wrap) {
    wrap.innerHTML = `<div id="tl-quiz-shell"></div>`;
    renderQuizScheduler(
      wrap.querySelector('#tl-quiz-shell'),
      user,
      quizzes,
      onRefresh,
    );
  }

  function renderLeaderboardTab(wrap) {
    wrap.innerHTML = `<div id="tl-lb-shell"></div>`;
    renderLeaderboard(
      wrap.querySelector('#tl-lb-shell'),
      memberMetrics,
      teamAverages,
      user,
    );
  }

  function renderAnnouncementsTab(wrap) {
    wrap.innerHTML = `<div id="tl-ann-shell"></div>`;
    renderAnnouncementsPanel(
      wrap.querySelector('#tl-ann-shell'),
      user,
      announcements,
      onRefresh,
    );
  }

  container.querySelector('#btn-refresh-tl').addEventListener('click', () => {
    onRefresh();
  });
}
