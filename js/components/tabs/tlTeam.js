/**
 * Team leader "Team" tab: each student's metrics, trend, report card and a
 * ready-to-send check-in message.
 */

import { esc, slug } from '../../utils.js';
import { renderMemberMetricsHTML } from '../metricsPanel.js';
import { renderSparkline } from '../charts.js';
import { openReportCardModal } from '../reportCardModal.js';
import { bindActions, emptyState, copyText, sameName } from '../ui.js';

export function renderTeamTab(panel, ctx) {
  const { user, data, teamMembers } = ctx;
  const marks = data.marks || [];
  const metrics = data.memberMetrics || {};
  const marksFor = (name) => marks.filter((m) => sameName(m.member, name));

  panel.innerHTML = `
    <section class="card">
      <div class="card-header">
        <h3 class="card-title">Team ${esc(user.team)}</h3>
        <span class="card-note">Report cards can be printed or saved as PDF</span>
      </div>
      ${
        teamMembers.length === 0
          ? emptyState('No students on this team yet.')
          : `<div class="stack">${teamMembers
              .map((name) => {
                const mine = marksFor(name);
                return `
          <article class="member-card">
            <div class="item-head">
              <div>
                <h4 class="item-title">${esc(name)}</h4>
                <p class="item-meta">${esc(mine.length)} ${mine.length === 1 ? 'mark' : 'marks'} recorded</p>
              </div>
              <div class="btn-group">
                ${mine.length > 1 ? `<canvas id="sparkline-${esc(slug(name))}" class="sparkline" width="120" height="32" role="img" aria-label="${esc(name)}'s score trend"></canvas>` : ''}
                <button type="button" class="btn btn-secondary btn-sm btn-view-report" data-action="report" data-name="${esc(name)}">Report card</button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="nudge" data-name="${esc(name)}">Copy check-in</button>
              </div>
            </div>
            ${renderMemberMetricsHTML(metrics[name] || null, { title: 'Performance' })}
          </article>`;
              })
              .join('')}</div>`
      }
    </section>
  `;

  teamMembers.forEach((name) => {
    const mine = marksFor(name);
    if (mine.length > 1) renderSparkline(panel.querySelector(`#sparkline-${CSS.escape(slug(name))}`), mine);
  });

  bindActions(panel, {
    click: {
      report: (btn) => openReportCardModal({ name: btn.dataset.name, team: user.team }, marksFor(btn.dataset.name), metrics[btn.dataset.name] || {}),
      nudge: async (btn) => {
        const name = btn.dataset.name;
        const text = `Hi ${name}, a quick check-in from Team ${user.team}: please submit your latest work in EconomicsPortal so I can forward it for grading. Ask me if you're stuck.`;
        const label = btn.textContent;
        if (await copyText(text, `Copy this message for ${name}:`)) {
          btn.textContent = 'Copied';
          setTimeout(() => btn.isConnected && (btn.textContent = label), 2000);
        }
      },
    },
  });
}
