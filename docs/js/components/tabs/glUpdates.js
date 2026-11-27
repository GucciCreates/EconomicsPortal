/**
 * Leaders' "Updates" tab: announcements and the quiz schedule.
 */

import { renderAnnouncementsPanel } from '../announcementsPanel.js';
import { renderQuizScheduler } from '../quizScheduler.js';

export function renderUpdatesTab(panel, ctx) {
  const { user, data, onRefresh, seen } = ctx;
  panel.innerHTML = `
    <div class="split">
      <div><h2 class="section-title">Announcements</h2><div id="ann-shell"></div></div>
      <div><h2 class="section-title">Quizzes</h2><div id="quiz-sched-shell"></div></div>
    </div>
  `;
  renderAnnouncementsPanel(panel.querySelector('#ann-shell'), user, data.announcements || [], onRefresh, { since: seen.announcements });
  renderQuizScheduler(panel.querySelector('#quiz-sched-shell'), user, data.quizzes || [], onRefresh);
}
