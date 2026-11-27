/**
 * Student "Updates" tab: class announcements and upcoming quizzes.
 */

import { renderAnnouncementsPanel } from '../announcementsPanel.js';
import { renderQuizScheduler } from '../quizScheduler.js';

export function renderMyUpdatesTab(panel, ctx) {
  const { user, data, onRefresh, seen } = ctx;
  panel.innerHTML = `
    <div class="split">
      <div><h3 class="section-title">Quizzes</h3><div id="mem-quiz-shell"></div></div>
      <div><h3 class="section-title">Announcements</h3><div id="mem-ann-shell"></div></div>
    </div>
  `;
  renderQuizScheduler(panel.querySelector('#mem-quiz-shell'), user, data.quizzes || [], onRefresh);
  renderAnnouncementsPanel(panel.querySelector('#mem-ann-shell'), user, data.announcements || [], onRefresh, { since: seen.announcements });
}
