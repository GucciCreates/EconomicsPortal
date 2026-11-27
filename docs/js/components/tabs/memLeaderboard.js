/**
 * Student "Leaderboard" tab.
 */

import { renderLeaderboard } from '../leaderboard.js';

export function renderMyLeaderboardTab(panel, ctx) {
  renderLeaderboard(panel, ctx.data.memberMetrics || {}, ctx.data.teamAverages || {}, ctx.user, { size: ctx.data.leaderboardSize });
}
