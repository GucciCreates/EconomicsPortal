/**
 * EconomicsPortal — Member Dashboard Component (v3)
 */

import { apiAddSubmission, apiAddEscalation } from '../api.js';
import { getScoreBand, renderMemberMetricsHTML } from './metricsPanel.js';
import { renderSparkline } from './charts.js';
import { createTabNav } from './tabNav.js';
import { renderGoalPanel } from './goalPanel.js';
import { renderQuizScheduler, cleanupQuizCountdowns } from './quizScheduler.js';
import { renderLeaderboard } from './leaderboard.js';
import { renderAnnouncementsPanel } from './announcementsPanel.js';
import { openReportCardModal } from './reportCardModal.js';
import { esc, linkHtml } from '../utils.js';
import { renderDoubtThreads, countDoubtUpdates } from './doubtThread.js';
import { loadLastSeen, markSeen, isNewer, newPill } from '../lastSeen.js';
import { dueDeadline } from './submissionTracker.js';

export function renderMemberDashboard(container, user, data, onRefresh) {
  cleanupQuizCountdowns();

  const tasks = data.tasks || [];
  const myMarks = data.myMarks || [];
  const teamAverage = data.teamAverage;
  const teamAverages = data.teamAverages || {};
  const mySubmissions = data.mySubmissions || [];
  const myMetrics = data.myMetrics;
  const memberMetrics = data.memberMetrics || {};
  const quizzes = data.quizzes || [];
  const announcements = data.announcements || [];
  const myGoal = data.myGoal || null;
  const myEscalations = data.myEscalations || [];

  const avgBand = teamAverage !== null ? getScoreBand(teamAverage) : null;
  // Declared before the first switchTab() call below, which reads them.
  const teamMessages = data.teamMessages || [];
  const mentorshipPlans = data.mentorship || [];
  const myMentorship = mentorshipPlans.find(
    (p) =>
      p.student.toLowerCase() === user.name.toLowerCase() ||
      p.mentor.toLowerCase() === user.name.toLowerCase(),
  );

  container.innerHTML = `
    <!-- Header Banner -->
    <div class="card" style="margin-bottom: 1.25rem;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.35rem; font-weight: 700; color: var(--text-main);">${esc(user.name)}</h2>
          <p style="color: var(--text-muted); font-size: 0.875rem;">
            Student Workspace • Team <strong>${esc(user.team)}</strong>
            ${myMetrics && myMetrics.atRisk ? `<span class="badge badge-atrisk" style="margin-left: 0.5rem;">Requires attention</span>` : ''}
          </p>
        </div>
        <div style="display: flex; gap: 1.5rem; align-items: center;">
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Team Average</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: var(--teal);" class="num">
              ${esc(teamAverage !== null ? teamAverage : '—')}
            </div>
            ${avgBand ? `<span class="badge ${esc(avgBand.cls)}">${esc(avgBand.label)}</span>` : ''}
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-refresh-mem">↻ Refresh</button>
        </div>
      </div>
    </div>

    <!-- Tab bar and content live in separate elements so rendering a tab
         never wipes out the tab bar. -->
    <div id="mem-tab-nav"></div>
    <div id="mem-tab-content"></div>
  `;

  const contentShell = container.querySelector('#mem-tab-content');

  const tabs = [
    { id: 'overview', label: 'My Scorecard & Metrics', icon: '📊' },
    { id: 'goals', label: 'My Goal & Progress', icon: '🎯' },
    { id: 'tasks', label: `Tasks & Submit (${tasks.length})`, icon: '📝' },
    { id: 'quizzes', label: `Quizzes & Tests (${quizzes.length})`, icon: '⏱️' },
    { id: 'leaderboard', label: 'Class Leaderboard', icon: '🏆' },
    { id: 'doubts', label: 'Ask a Doubt & Replies', icon: '❓' },
    {
      id: 'announcements',
      label: `Announcements (${announcements.length})`,
      icon: '📢',
    },
  ];

  // "New since your last visit": snapshot taken once per render so items keep
  // their "New" pill while you're looking at them; a tab's badge clears when
  // you open it.
  const seen = loadLastSeen(user, ['announcements', 'tasks', 'teamMessages', 'doubts']);
  const badges = {
    tasks: tasks.filter((t) => isNewer(t.timestamp, seen.tasks)).length,
    doubts: countDoubtUpdates(myEscalations, seen.doubts, user),
    announcements: announcements.filter((a) => isNewer(a.timestamp, seen.announcements)).length,
  };

  // Deadlines: unsubmitted, still-open tasks for my team.
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const submittedIds = new Set(mySubmissions.map((s) => String(s.taskId)));
  const isOverdue = (t) => {
    const d = dueDeadline(t.dueDate);
    return t.status !== 'done' && !submittedIds.has(String(t.id)) && d && d < now;
  };

  function switchTab(tabId) {
    if (tabId in badges) {
      markSeen(user, tabId);
      tabNav.setBadge(tabId, 0);
    }
    if (tabId === 'overview') renderOverviewTab(contentShell);
    else if (tabId === 'goals') renderGoalsTab(contentShell);
    else if (tabId === 'tasks') renderTasksTab(contentShell);
    else if (tabId === 'quizzes') renderQuizzesTab(contentShell);
    else if (tabId === 'leaderboard') renderLeaderboardTab(contentShell);
    else if (tabId === 'doubts') renderDoubtsTab(contentShell);
    else if (tabId === 'announcements') renderAnnouncementsTab(contentShell);
  }

  const tabNav = createTabNav(container.querySelector('#mem-tab-nav'), tabs, switchTab, {
    storageKey: `economics_portal_tab:${user.name}`,
  });
  Object.entries(badges).forEach(([id, n]) => tabNav.setBadge(id, n));
  switchTab(tabNav.initialTab);

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: OVERVIEW & SCORECARD
  // ─────────────────────────────────────────────────────────────────────────
  function timeLeft(when) {
    const ms = when - new Date();
    if (ms <= 0) return 'Now';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `in ${d}d ${h}h`;
    if (h > 0) return `in ${h}h ${m}m`;
    return `in ${m}m`;
  }

  function renderDeadlineStrip() {
    const overdue = tasks.filter(isOverdue);
    const dueSoon = tasks
      .filter((t) => t.status !== 'done' && !submittedIds.has(String(t.id)))
      .map((t) => ({ t, when: dueDeadline(t.dueDate) }))
      .filter(({ when }) => when && when >= now && when <= weekAhead)
      .sort((a, b) => a.when - b.when);
    const quizSoon = quizzes
      .map((q) => ({ q, when: new Date(q.scheduledAt) }))
      .filter(({ when }) => when >= now && when <= weekAhead)
      .sort((a, b) => a.when - b.when);
    if (!overdue.length && !dueSoon.length && !quizSoon.length) {
      return `<div class="card" style="margin-bottom: 1.25rem;"><h3 class="card-title" style="margin-bottom: 0.25rem;">🗓️ This week</h3><p style="color: var(--text-muted); font-size: 0.85rem;">Nothing due in the next 7 days. 🎉</p></div>`;
    }
    const item = (kind, title, left, extra, cls = '') => `
      <div class="deadline-item ${cls}">
        <div class="deadline-kind">${kind}</div>
        <div class="deadline-title">${esc(title)}</div>
        <div class="deadline-left">${esc(left)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${esc(extra)}</div>
      </div>`;
    return `
      <div class="card" style="margin-bottom: 1.25rem;" aria-labelledby="deadline-strip-title">
        <div class="card-header" style="margin-bottom: 0.6rem;">
          <h3 class="card-title" id="deadline-strip-title">🗓️ This week</h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Tasks you still need to submit and quizzes in the next 7 days</span>
        </div>
        <div class="deadline-strip">
          ${overdue.map((t) => item('⚠️ Overdue task', t.title, 'Overdue', `Was due ${dueDeadline(t.dueDate).toLocaleDateString()} — submit as soon as you can`, 'overdue')).join('')}
          ${dueSoon.map(({ t, when }) => item('📝 Task due', t.title, timeLeft(when), `Due ${when.toLocaleDateString()}`)).join('')}
          ${quizSoon.map(({ q, when }) => item('⏱️ Quiz', q.title, timeLeft(when), when.toLocaleString())).join('')}
        </div>
      </div>`;
  }

  function renderOverviewTab(wrap) {
    const noticeIsNew = teamMessages.length > 0 && isNewer(teamMessages[0].timestamp, seen.teamMessages);
    markSeen(user, 'teamMessages');
    wrap.innerHTML = `
      ${renderDeadlineStrip()}

      <!-- Team Leader Notice (if any) -->
      ${
        teamMessages.length > 0
          ? `
        <div class="card" style="border-left: 4px solid var(--teal); background-color: var(--teal-soft); margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
            <strong style="color: var(--teal-text, var(--teal)); font-size: 0.95rem;">💬 Notice from Team Leader (${esc(teamMessages[0].author)})${noticeIsNew ? '<span class="new-pill">New</span>' : ''}</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${esc(new Date(teamMessages[0].timestamp).toLocaleDateString())}</span>
          </div>
          <p style="font-size: 0.9rem; color: var(--text-main); line-height: 1.45;">${esc(teamMessages[0].message)}</p>
        </div>
      `
          : ''
      }

      <!-- Active Mentorship Card (if student is mentee or mentor) -->
      ${
        myMentorship
          ? `
        <div class="card" style="border-left: 4px solid var(--purple); margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--purple);">
              🛡️ Active Academic Recovery & Peer Mentorship
            </h4>
            <span class="badge ${esc(myMentorship.status === 'resolved' ? 'badge-closed' : 'badge-support')}">${esc(myMentorship.status)}</span>
          </div>
          <p style="font-size: 0.85rem; margin-bottom: 0.5rem;">
            ${
              myMentorship.student.toLowerCase() === user.name.toLowerCase()
                ? `You have been paired with peer mentor <strong>${esc(myMentorship.mentor)}</strong> to help you achieve your recovery goals.`
                : `You are the assigned peer mentor supporting <strong>${esc(myMentorship.student)}</strong>.`
            }
          </p>
          <div style="background-color: var(--bg-subtle); padding: 0.65rem 0.85rem; border-radius: var(--radius); font-size: 0.8rem;">
            <strong>Target Milestones:</strong>
            <ul style="margin: 0.35rem 0 0 1rem; padding: 0; line-height: 1.6;">
              ${(myMentorship.milestones || ['Weekly concept review', 'Pre-check problem sets', 'Score 65+ in Mock 3']).map((m) => `<li>${esc(m)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `
          : ''
      }

      <div style="margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
          <h3 style="font-size: 1.05rem; font-weight: 700;">Performance & Growth Summary</h3>
          <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
            ${
              myMarks.length > 1
                ? `
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.75rem; color: var(--text-muted);">Quiz trend:</span>
                <canvas id="member-sparkline" width="140" height="38" style="vertical-align: middle;"></canvas>
              </div>
            `
                : ''
            }
            <button class="btn btn-primary btn-sm" id="btn-print-my-report">
              📄 View / Print Official Report Card
            </button>
          </div>
        </div>
        ${renderMemberMetricsHTML(myMetrics, { title: 'Metrics & Growth' })}
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">My Recorded Unit & Topic Scores</h3></div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tested Topic / Unit</th>
                <th>Mock #</th>
                <th>Score</th>
                <th>Submission</th>
                <th>Attendance</th>
                <th>Preview</th>
                <th>Peer Rating</th>
                <th>Punctual</th>
                <th>Band</th>
                <th>Feedback / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${
                myMarks.length === 0
                  ? `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No scores recorded yet.</td></tr>`
                  : myMarks
                      .map((m) => {
                        const band = getScoreBand(m.quizScore);
                        return `
                      <tr>
                        <td><strong>${esc(m.cycle)}</strong></td>
                        <td>${esc(m.mockNumber || '—')}</td>
                        <td><strong class="num" style="font-size: 1.05rem;">${esc(m.quizScore)}</strong></td>
                        <td>${esc(m.submission || '—')}</td>
                        <td>${esc(m.attendance || '—')}</td>
                        <td>${esc(m.previewDone || '—')}</td>
                        <td>${esc(m.peerRating || '—')}</td>
                        <td>${esc(m.punctual || '—')}</td>
                        <td><span class="badge ${esc(band.cls)}">${esc(band.label)}</span></td>
                        <td style="font-size: 0.8rem; color: var(--text-muted);">
                          ${esc(m.notes || '—')}
                          ${m.editedBy ? `<br/><span style="font-size: 0.7rem; color: var(--purple);">Verified by: ${esc(m.editedBy)}</span>` : ''}
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

    setTimeout(() => {
      if (myMarks.length > 1) {
        const scores = myMarks
          .map((m) => Number(m.quizScore))
          .filter((s) => !isNaN(s));
        renderSparkline('member-sparkline', scores);
      }
    }, 50);

    const reportBtn = wrap.querySelector('#btn-print-my-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        openReportCardModal(
          { name: user.name, team: user.team, role: 'member' },
          myMarks,
          myMetrics,
          user,
        );
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: GOALS
  // ─────────────────────────────────────────────────────────────────────────
  function renderGoalsTab(wrap) {
    wrap.innerHTML = `<div id="mem-goals-shell"></div>`;
    renderGoalPanel(
      wrap.querySelector('#mem-goals-shell'),
      user,
      myGoal,
      myMetrics,
      onRefresh,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3: TASKS & SUBMIT
  // ─────────────────────────────────────────────────────────────────────────
  function renderTasksTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Assigned Tasks (${esc(tasks.length)})</h3></div>
        <div id="tasks-list">
          ${
            tasks.length === 0
              ? `<p style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No active tasks assigned to your team.</p>`
              : tasks
                  .map((task) => {
                    const submission = mySubmissions.find(
                      (s) => s.taskId === task.id,
                    );
                    const isSubmitted = !!submission;
                    const isDone = task.status === 'done';
                    const overdue = isOverdue(task);

                    return `
                    <div class="task-item ${isDone ? 'done' : ''} ${overdue ? 'overdue' : ''}">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
                        <h4 style="font-size: 0.95rem; font-weight: 700;">${esc(task.title)}${newPill(task.timestamp, seen.tasks)}${overdue ? ' <span class="badge badge-atrisk">Overdue</span>' : ''}</h4>
                        <span class="badge ${esc(isDone ? 'badge-done' : 'badge-open')}">${esc(task.status)}</span>
                      </div>
                      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.6rem;">
                        ${esc(task.description || 'No description provided.')}
                      </p>
                      
                      <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.65rem;">
                        <span>Due: <strong>${esc(task.dueDate || 'Not set')}</strong></span>
                        <span>Scope: <strong>${esc(task.team === 'ALL' ? 'All Teams' : 'Team ' + task.team)}</strong></span>
                        ${linkHtml(task.fileUrl, 'View Attachment ↗', 'style="font-weight: 600;"')}
                      </div>

                      <div style="border-top: 1px dashed var(--border-color); padding-top: 0.6rem; margin-top: 0.5rem;">
                        ${
                          isSubmitted
                            ? `
                          <div style="font-size: 0.85rem; color: var(--teal); display: flex; justify-content: space-between; align-items: center;">
                            <span>✓ <strong>Submitted:</strong> ${esc(submission.content || 'Uploaded')}</span>
                            ${linkHtml(submission.fileUrl, 'View File ↗', 'style="font-size: 0.8rem; font-weight: 600;"')}
                          </div>
                        `
                            : `
                          <form class="form-submit-task" data-task-id="${esc(task.id)}">
                            <div class="form-group" style="margin-bottom: 0.5rem;">
                              <label class="form-label" style="font-size: 0.8rem;">Submission Notes / Answer summary</label>
                              <input type="text" class="form-control form-control-sm sub-content" placeholder="e.g. Completed IS-LM problem set questions 1 to 5" required />
                            </div>
                            <div class="form-group" style="margin-bottom: 0.65rem;">
                              <label class="form-label" style="font-size: 0.8rem;">Google Drive Link</label>
                              <input type="url" class="form-control form-control-sm sub-file" placeholder="https://drive.google.com/file/..." />
                            </div>
                            <button type="submit" class="btn btn-primary btn-sm">Turn In Assignment</button>
                          </form>
                        `
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

    wrap.querySelectorAll('.form-submit-task').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = form.getAttribute('data-task-id');
        const content = form.querySelector('.sub-content').value;
        const fileUrl = form.querySelector('.sub-file').value;
        const btn = form.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Submitting...';

        try {
          const res = await apiAddSubmission({
            taskId,
            member: user.name,
            team: user.team,
            content,
            fileUrl,
          });

          if (res.ok) {
            window.showEconomicsToast(
              'Assignment submitted successfully.',
              'success',
            );
            onRefresh();
          } else {
            window.showEconomicsToast(
              res.error || 'Failed to submit assignment.',
              'error',
            );
            btn.disabled = false;
            btn.textContent = 'Turn In Assignment';
          }
        } catch (err) {
          window.showEconomicsToast('Error: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Turn In Assignment';
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4: QUIZZES
  // ─────────────────────────────────────────────────────────────────────────
  function renderQuizzesTab(wrap) {
    wrap.innerHTML = `<div id="mem-quiz-shell"></div>`;
    renderQuizScheduler(
      wrap.querySelector('#mem-quiz-shell'),
      user,
      quizzes,
      onRefresh,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 5: LEADERBOARD
  // ─────────────────────────────────────────────────────────────────────────
  function renderLeaderboardTab(wrap) {
    wrap.innerHTML = `<div id="mem-lb-shell"></div>`;
    renderLeaderboard(
      wrap.querySelector('#mem-lb-shell'),
      memberMetrics,
      teamAverages,
      user,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 6: DOUBTS & ESCALATIONS
  // ─────────────────────────────────────────────────────────────────────────
  function renderDoubtsTab(wrap) {
    wrap.innerHTML = `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Ask a Doubt / Request Help</h3></div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Have a question on theory, upcoming mock exams, or assignment instructions? Raise it here for Dr. Numan and Shehroz.
        </p>

        <div id="escalation-feedback"></div>

        <form id="form-add-escalation">
          <div class="form-group">
            <label class="form-label" for="esc-topic">Topic / Question Subject</label>
            <input type="text" id="esc-topic" class="form-control" placeholder="e.g. Question 3 derivation on IS-LM curve" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="esc-details">Explanation / Details</label>
            <textarea id="esc-details" class="form-control" rows="3" placeholder="Describe the question or issue clearly..." required></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="esc-severity">Urgency Level</label>
            <select id="esc-severity" class="form-control">
              <option value="normal">Normal (Review before next session)</option>
              <option value="severe">Urgent (Blocks submission / conflict)</option>
            </select>
          </div>

          <button type="submit" class="btn btn-primary" id="btn-submit-esc" style="width: 100%;">
            Send Question to Instructor & Group Leader
          </button>
        </form>
      </div>
      <div id="my-doubts" style="margin-top: 1.25rem;"></div>
    `;

    renderDoubtThreads(wrap.querySelector('#my-doubts'), {
      escalations: myEscalations,
      user,
      since: seen.doubts,
      title: `My Questions (${myEscalations.length})`,
      emptyText: "You haven't asked anything yet.",
      onRefresh,
    });

    const escForm = wrap.querySelector('#form-add-escalation');
    if (escForm) {
      escForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = wrap.querySelector('#esc-topic').value;
        const details = wrap.querySelector('#esc-details').value;
        const severity = wrap.querySelector('#esc-severity').value;
        const feedback = wrap.querySelector('#escalation-feedback');
        const submitBtn = wrap.querySelector('#btn-submit-esc');

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
          const res = await apiAddEscalation({
            raisedBy: user.name,
            team: user.team,
            topic,
            details,
            severity,
          });

          if (res.ok) {
            feedback.innerHTML = `<div class="alert alert-success">Question sent to Dr. Numan and Shehroz!</div>`;
            window.showEconomicsToast(
              'Your question was sent successfully.',
              'success',
            );
            escForm.reset();
            setTimeout(() => {
              feedback.innerHTML = '';
              onRefresh();
            }, 2500);
          } else {
            feedback.innerHTML = `<div class="alert alert-error">${esc(res.error || 'Failed to submit.')}</div>`;
            window.showEconomicsToast(
              res.error || 'Failed to submit your question.',
              'error',
            );
          }
        } catch (err) {
          feedback.innerHTML = `<div class="alert alert-error">Error: ${esc(err.message)}</div>`;
          window.showEconomicsToast('Error: ' + err.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Question to Instructor & Group Leader';
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 7: ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────────────────────
  function renderAnnouncementsTab(wrap) {
    wrap.innerHTML = `<div id="mem-ann-shell"></div>`;
    renderAnnouncementsPanel(
      wrap.querySelector('#mem-ann-shell'),
      user,
      announcements,
      onRefresh,
      { since: seen.announcements },
    );
  }

  container.querySelector('#btn-refresh-mem').addEventListener('click', () => {
    onRefresh();
  });
}
