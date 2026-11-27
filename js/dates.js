/**
 * EconomicsPortal — one date formatter for the whole app.
 *
 * Show dates relative to now ("in 2 days", "yesterday", "3 hours ago") and
 * keep the full date in a tooltip. Use timeHtml() inside templates.
 */
import { escapeHtml } from './utils.js';

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  : null;

/** Parse Date | ISO string | "yyyy-MM-dd" (read as local midnight). Invalid → null. */
export function toDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "Mon, 30 Nov 2026, 2:30 pm" (or without the time for date-only values). */
export function formatFull(value) {
  const d = toDate(value);
  if (!d) return '';
  const opts = isDateOnly(value)
    ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' };
  return d.toLocaleString('en-GB', opts);
}

/** "today", "tomorrow", "in 3 days", "2 hours ago", "12 Nov" for far-off dates. */
export function formatRelative(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return '';
  if (isDateOnly(value)) {
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const days = Math.round((d.getTime() - startToday.getTime()) / 86400000);
    if (Math.abs(days) <= 13) return rtf ? rtf.format(days, 'day') : `${days} days`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
  }
  const diff = d.getTime() - now;
  const abs = Math.abs(diff);
  const pick = (n, unit) => (rtf ? rtf.format(Math.round(n), unit) : `${Math.round(n)} ${unit}s`);
  if (abs < 45 * 1000) return 'just now';
  if (abs < 45 * 60 * 1000) return pick(diff / 60000, 'minute');
  if (abs < 22 * 3600 * 1000) return pick(diff / 3600000, 'hour');
  if (abs < 13 * 86400 * 1000) return pick(diff / 86400000, 'day');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

/** <time> element: relative text, full date as tooltip. Safe for innerHTML. */
export function timeHtml(value, { prefix = '' } = {}) {
  const d = toDate(value);
  if (!d) return '';
  const iso = isDateOnly(value) ? value : d.toISOString();
  return `<time datetime="${escapeHtml(iso)}" title="${escapeHtml(formatFull(value))}">${escapeHtml(prefix + formatRelative(value))}</time>`;
}

/** Short countdown like "2d 3h" or "45m" until a moment (negative → "now"). */
export function countdown(value, now = Date.now()) {
  const d = toDate(value);
  if (!d) return '';
  let ms = d.getTime() - now;
  if (ms <= 0) return 'now';
  const days = Math.floor(ms / 86400000);
  ms -= days * 86400000;
  const hours = Math.floor(ms / 3600000);
  ms -= hours * 3600000;
  const mins = Math.floor(ms / 60000);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
