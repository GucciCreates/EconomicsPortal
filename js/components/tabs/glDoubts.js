/**
 * Leaders' "Doubts" tab: every student's questions, with replies.
 */

import { renderDoubtThreads } from '../doubtThread.js';

export function renderDoubtsTab(panel, ctx) {
  renderDoubtThreads(panel, {
    escalations: ctx.data.escalations || [],
    user: ctx.user,
    canReply: true,
    canResolve: ctx.canLead,
    since: ctx.seen.doubts,
    title: 'Doubts',
    emptyText: 'No doubts yet.',
    emptyHint: "When a student asks a question it shows up here for you to answer.",
    onRefresh: ctx.onRefresh,
  });
}
