/**
 * Student "My scores" tab: what's due this week, the latest team notice,
 * any support plan, metrics and every recorded mark.
 */

import { esc } from '../../utils.js';
import { timeHtml, dateHtml, countdown } from '../../dates.js';
import { getScoreBand, renderMemberMetricsHTML } from '../metricsPanel.js';
import { renderSparkline } from '../charts.js';
import { openReportCardModal } from '../reportCardModal.js';
import { dueDeadline } from '../submissionTracker.js';
import { isNewer, markSeen } from '../../lastSeen.js';
import { bindActions, emptyState, sameName } from '../ui.js';

export function renderMyScoresTab(panel, ctx) {
  const { user, data, submittedIds, isOverdue, seen } = ctx;
  const tasks = data.tasks || [];
  const quizzes = data.quizzes || [];
  const myMarks = [...(data.myMarks || [])].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const myMetrics = data.myMetrics || null;
  const notice = [...(data.teamMessages || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
  const plan = (data.mentorship || []).find((p) => (sameName(p.student, user.name) || sameName(p.mentor, user.name)) && p.status !== 'resolved');
  const noticeIsNew = notice && isNewer(notice.timestamp, seen.teamMessages);
  markSeen(user, 'teamMessages');

  panel.innerHTML = `
    ${deadlineStrip(tasks, quizzes, submittedIds, isOverdue)}

    ${
      notice
        ? `<section class="card notice-card">
        <div class="item-head">
          <h3 class="item-title">From ${esc(notice.author)}, your team leader ${noticeIsNew ? '<span class="new-pill">New</span>' : ''}</h3>
          <span class="muted small">${timeHtml(notice.timestamp)}</span>
        </div>
        <p class="pre-wrap">${esc(notice.message)}</p>
      </section>`
        : ''
    }

    ${
      plan
        ? `<section class="card plan-card">
        <div class="item-head">
          <h3 class="item-title">Your support plan</h3>
          <span class="badge badge-support">Active</span>
        </div>
        <p>${
          sameName(plan.student, user.name)
            ? `<strong>${esc(plan.mentor)}</strong> is your mentor for this plan.`
            : `You're mentoring <strong>${esc(plan.student)}</strong>.`
        }</p>
        ${(plan.milestones || []).length ? `<ol class="milestones">${plan.milestones.map((m) => `<li>${esc(m)}</li>`).join('')}</ol>` : ''}
      </section>`
        : ''
    }

    <div class="section-head">
      <h3 class="section-title">How you're doing</h3>
      <div class="btn-group">
        ${myMarks.length > 1 ? `<canvas id="member-sparkline" class="sparkline" width="140" height="38" role="img" aria-label="Your score trend"></canvas>` : ''}
        <button type="button" class="btn btn-primary btn-sm" id="btn-print-my-report" data-action="report">View report card</button>
      </div>
    </div>
    ${renderMemberMetricsHTML(myMetrics, { title: 'Your metrics' })}

    <section class="card">
      <div class="card-header"><h3 class="card-title">My marks</h3><span class="card-note">Newest first</span></div>
      ${
        myMarks.length === 0
          ? emptyState('No marks yet.', 'Your marks appear here as soon as your team leader or Shehroz records them.')
          : `<div class="table-responsive">
        <table class="data-table data-table-cards">
          <thead><tr><th>Topic or unit</th><th>Score</th><th>Band</th><th>Submitted</th><th>Attendance</th><th>Preview</th><th>Peer</th><th>On time</th><th>Notes</th></tr></thead>
          <tbody>
            ${myMarks
              .map((m) => {
                const band = getScoreBand(m.quizScore);
                return `
            <tr>
              <td data-label="Topic or unit"><strong>${esc(m.cycle)}</strong>${m.mockNumber ? ` <span class="muted small">mock ${esc(m.mockNumber)}</span>` : ''}</td>
              <td data-label="Score"><strong class="num score-cell">${esc(m.quizScore)}</strong></td>
              <td data-label="Band"><span class="badge ${esc(band.cls)}">${esc(band.label)}</span></td>
              <td data-label="Submitted" class="cell-minor">${esc(m.submission || '—')}</td>
              <td data-label="Attendance" class="cell-minor">${esc(m.attendance || '—')}</td>
              <td data-label="Preview" class="cell-minor">${esc(m.previewDone || '—')}</td>
              <td data-label="Peer" class="cell-minor">${esc(m.peerRating || '—')}</td>
              <td data-label="On time" class="cell-minor">${esc(m.punctual || '—')}</td>
              <td data-label="Notes" class="notes-cell">${esc(m.notes || '—')}${m.editedBy ? `<span class="by-line">by ${esc(m.editedBy)}</span>` : ''}</td>
            </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`
      }
    </section>
  `;

  if (myMarks.length > 1) renderSparkline(panel.querySelector('#member-sparkline'), myMarks);
  bindActions(panel, {
    click: {
      report: () => openReportCardModal({ name: user.name, team: user.team }, myMarks, myMetrics || {}),
    },
  });
}

function deadlineStrip(tasks, quizzes, submittedIds, isOverdue) {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
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
    return `<section class="card" aria-labelledby="deadline-strip-title">
      <h3 class="card-title" id="deadline-strip-title">This week</h3>
      <p class="muted">Nothing due in the next 7 days.</p>
    </section>`;
  }
  const item = (kind, title, left, whenHtml, cls = '') => `
    <div class="deadline-item ${cls}">
      <div class="deadline-kind">${esc(kind)}</div>
      <div class="deadline-title">${esc(title)}</div>
      <div class="deadline-left">${esc(left)}</div>
      <div class="muted small">${whenHtml}</div>
    </div>`;
  return `
    <section class="card" aria-labelledby="deadline-strip-title">
      <div class="card-header">
        <h3 class="card-title" id="deadline-strip-title">This week</h3>
        <span class="card-note">Work you still need to submit, and quizzes in the next 7 days</span>
      </div>
      <div class="deadline-strip">
        ${overdue.map((t) => item('Task overdue', t.title, 'Overdue', `Was due ${timeHtml(String(t.dueDate).slice(0, 10))}. Submit it as soon as you can.`, 'overdue')).join('')}
        ${dueSoon.map(({ t }) => item('Task', t.title, `in ${countdown(dueDeadline(t.dueDate))}`, dateHtml(String(t.dueDate).slice(0, 10), { prefix: 'Due ' }))).join('')}
        ${quizSoon.map(({ q }) => item('Quiz', q.title, `in ${countdown(q.scheduledAt)}`, dateHtml(q.scheduledAt))).join('')}
      </div>
    </section>`;
}
