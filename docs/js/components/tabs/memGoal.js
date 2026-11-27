/**
 * Student "Goal" tab.
 */

import { renderGoalPanel } from '../goalPanel.js';

export function renderMyGoalTab(panel, ctx) {
  renderGoalPanel(panel, ctx.user, ctx.data.myGoal || null, ctx.data.myMetrics || null, ctx.onRefresh);
}
