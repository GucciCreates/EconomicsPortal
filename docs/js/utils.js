/**
 * EconomicsPortal — Shared helpers for safe HTML rendering.
 *
 * Every value that comes from a user or the API must go through escapeHtml()
 * before it is placed in an innerHTML template, and every link through
 * safeUrl().
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/** Escape a value for use in HTML text or a quoted attribute. null/undefined → "". */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPES[ch]);
}

/** Short alias used inside templates. */
export const esc = escapeHtml;

/**
 * Return the URL (escaped for an attribute) only if it is http(s); otherwise "".
 * Blocks javascript:, data: and other schemes.
 */
export function safeUrl(value) {
  const s = String(value == null ? '' : value).trim();
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return escapeHtml(u.href);
  } catch (e) {
    return '';
  }
}

/**
 * Render an external link, or `fallback` when the URL is missing or unsafe.
 * `label` is treated as trusted markup (pass escaped text).
 */
export function linkHtml(url, label, attrs = '', fallback = '') {
  const href = safeUrl(url);
  if (!href) return fallback;
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${attrs}>${label}</a>`;
}

/** Safe string for use in an id attribute / CSS selector. */
export function slug(value) {
  return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]+/g, '_');
}
