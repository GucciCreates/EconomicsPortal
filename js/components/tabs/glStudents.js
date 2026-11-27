/**
 * Leaders' "Students" tab: charts, leaderboards and support plans.
 */

import { renderTeamAveragesChart, renderBandDistributionChart } from '../charts.js';
import { renderLeaderboard } from '../leaderboard.js';
import { renderMentorshipPanel } from '../mentorshipPanel.js';

export function renderStudentsTab(panel, ctx) {
  const { user, data, onRefresh } = ctx;
  const teamAverages = data.teamAverages || {};
  const memberMetrics = data.memberMetrics || {};
  const marks = data.marks || [];

  panel.innerHTML = `
    <div id="mentorship-shell"></div>
    <div class="grid-2">
      <section class="card">
        <div class="card-header"><h3 class="card-title">Team averages</h3></div>
        <div class="chart-box"><canvas id="chart-team-averages" aria-label="Bar chart of team average scores" role="img"></canvas></div>
      </section>
      <section class="card">
        <div class="card-header"><h3 class="card-title">Latest scores by band</h3></div>
        <div class="chart-box"><canvas id="chart-band-dist" aria-label="Doughnut chart of students in each score band" role="img"></canvas></div>
      </section>
    </div>
    <div id="leaderboard-shell"></div>
  `;

  renderMentorshipPanel(panel.querySelector('#mentorship-shell'), user, data.mentorship || [], data.atRiskMembers || [], memberMetrics, onRefresh);
  renderLeaderboard(panel.querySelector('#leaderboard-shell'), memberMetrics, teamAverages, user);
  renderTeamAveragesChart(panel.querySelector('#chart-team-averages'), teamAverages);
  renderBandDistributionChart(panel.querySelector('#chart-band-dist'), memberMetrics, marks);
}
