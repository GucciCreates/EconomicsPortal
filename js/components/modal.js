/**
 * EconomicsPortal — Accessible modal helpers
 *
 * openModal() builds a dialog with role="dialog", aria-modal, a labelled
 * title, a focus trap, Esc-to-close and focus restore.
 * enhanceModal() adds the same keyboard behaviour to existing
 * `.modal-overlay` markup (used by app.js for every modal on the page).
 */

import { esc } from '../utils.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalSeq = 0;

/**
 * @param {HTMLElement} overlay - the .modal-overlay element
 * @param {Function} close - closes the modal
 */
export function enhanceModal(overlay, close) {
  if (!overlay || overlay.dataset.a11yEnhanced) return;
  overlay.dataset.a11yEnhanced = 'true';
  const dialog = overlay.querySelector('.modal-content') || overlay;
  if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (!dialog.hasAttribute('aria-labelledby')) {
    const heading = dialog.querySelector('h2, h3, h4');
    if (heading) {
      if (!heading.id) heading.id = `modal-title-${++modalSeq}`;
      dialog.setAttribute('aria-labelledby', heading.id);
    }
  }

  const previouslyFocused = document.activeElement;
  const doClose =
    close ||
    (() => {
      const btn = overlay.querySelector('[data-modal-close], [id^="btn-close"], [id^="btn-cancel"]');
      if (btn) btn.click();
      else overlay.remove();
    });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      doClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  overlay.addEventListener('keydown', onKey);

  // Restore focus once the overlay leaves the page, however it was closed.
  const observer = new MutationObserver(() => {
    if (!overlay.isConnected) {
      observer.disconnect();
      if (previouslyFocused && previouslyFocused.isConnected && previouslyFocused.focus) previouslyFocused.focus();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (!dialog.contains(document.activeElement)) {
    const target = dialog.querySelector('[autofocus]') || dialog.querySelector('input, select, textarea') || dialog.querySelector(FOCUSABLE);
    if (target) setTimeout(() => target.focus(), 0);
  }
}

/**
 * @param {{ title: string, bodyHtml: string, maxWidth?: string }} opts
 *   bodyHtml is trusted markup (escape any data you put in it).
 * @returns {{ overlay: HTMLElement, dialog: HTMLElement, close: () => void }}
 */
export function openModal({ title, bodyHtml, maxWidth = '440px' }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const titleId = `modal-title-${++modalSeq}`;
  overlay.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="${titleId}" style="max-width: ${esc(maxWidth)};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem;">
        <h3 id="${titleId}" style="font-size: 1.15rem; font-weight: 700;">${esc(title)}</h3>
        <button type="button" class="btn btn-secondary btn-sm" data-modal-close aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
    </div>
  `;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-modal-close]')) close();
  });
  document.body.appendChild(overlay);
  enhanceModal(overlay, close);
  return { overlay, dialog: overlay.querySelector('.modal-content'), close };
}
