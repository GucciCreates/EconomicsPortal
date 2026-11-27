/**
 * Team leader "Doubts" tab: your team's questions; you can reply.
 */

import { renderDoubtThreads } from '../doubtThread.js';

export function renderTeamDoubtsTab(panel, ctx) {
  renderDoubtThreads(panel, {
    escalations: ctx.data.escalations || [],
    user: ctx.user,
    canReply: true,
    canResolve: false,
    since: ctx.seen.doubts,
    title: `Team ${ctx.user.team} doubts`,
    emptyText: 'Nobody on your team has asked anything yet.',
    emptyHint: 'You can reply to your team’s questions here. Dr. Numan or Shehroz marks them resolved.',
    onRefresh: ctx.onRefresh,
  });
}
