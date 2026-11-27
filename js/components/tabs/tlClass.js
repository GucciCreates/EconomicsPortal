/**
 * Team leader "Class" tab: class announcements, quizzes and the leaderboard.
 */

import { renderAnnouncementsPanel } from '../announcementsPanel.js';
import { renderQuizScheduler } from '../quizScheduler.js';
import { renderLeaderboard } from '../leaderboard.js';

export function renderClassTab(panel, ctx) {
  const { user, data, onRefresh, seen } = ctx;
  panel.innerHTML = `
    <div class="split">
      <div><h2 class="section-title">Announcements</h2><div id="tl-ann-shell"></div></div>
      <div><h2 class="section-title">Quizzes</h2><div id="tl-quiz-shell"></div></div>
    </div>
    <h2 class="section-title">Leaderboard</h2>
    <div id="tl-lb-shell"></div>
  `;
  renderAnnouncementsPanel(panel.querySelector('#tl-ann-shell'), user, data.announcements || [], onRefresh, { since: seen.announcements });
  renderQuizScheduler(panel.querySelector('#tl-quiz-shell'), user, data.quizzes || [], onRefresh);
  renderLeaderboard(panel.querySelector('#tl-lb-shell'), data.memberMetrics || {}, data.teamAverages || {}, user);
}
