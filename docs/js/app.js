/**
 * EconomicsPortal — Main Application Controller (v2)
 */

import { isDemoMode } from './config.js';
import { getCurrentUser, clearCurrentUser } from './auth.js';
import { apiGetDashboard, resetDemoData } from './api.js';
import { renderMemberDashboard } from './components/memberView.js';
import { renderTeamLeaderDashboard } from './components/teamLeaderView.js';
import { renderGroupLeaderDashboard } from './components/groupLeaderView.js';
import { renderModernLogin } from './components/loginView.js';
import { esc } from './utils.js';
import { renderAccountMenu } from './components/accountMenu.js';
import { enhanceModal } from './components/modal.js';

// DOM Root Elements
const headerEl = document.getElementById('site-header');
const bannerEl = document.getElementById('demo-banner');
const mainEl = document.getElementById('main-content');
const footerEl = document.getElementById('site-footer');

// ─────────────────────────────────────────────────────────────────────────────
// THEME SETUP
// ─────────────────────────────────────────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem('economics_portal_theme') || 'dark';
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  localStorage.setItem('economics_portal_theme', theme);
}

function toggleTheme() {
  const current = localStorage.getItem('economics_portal_theme') || 'auto';
  const next =
    current === 'dark' ? 'light' : current === 'light' ? 'auto' : 'dark';
  applyTheme(next);
  renderHeader();
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER & BANNER
// ─────────────────────────────────────────────────────────────────────────────
function renderBanner() {
  if (isDemoMode()) {
    bannerEl.innerHTML = `
      <div class="demo-banner">
        <span>
          ⚡ <strong>Demo / Offline Mode Active</strong> — Running with interactive sample data.
        </span>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${
            localStorage.getItem('economics_portal_force_demo') === 'true'
              ? `<button id="btn-retry-live" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Try Live API</button>`
              : `<a href="https://github.com/GucciCreates/EconomicsPortal/blob/main/SETUP_GUIDE.md" target="_blank" rel="noopener noreferrer" style="font-weight: 600;">Connect the live backend ↗</a>`
          }
          <button id="btn-reset-demo" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Reset Demo Data</button>
        </div>
      </div>
    `;
    bannerEl.style.display = 'block';

    const retryLiveBtn = document.getElementById('btn-retry-live');
    if (retryLiveBtn) {
      retryLiveBtn.addEventListener('click', () => {
        localStorage.removeItem('economics_portal_force_demo');
        refreshApp();
      });
    }

    const resetBtn = document.getElementById('btn-reset-demo');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset demo data back to default sample state?')) {
          resetDemoData();
          window.location.reload();
        }
      });
    }
  } else {
    bannerEl.innerHTML = ``;
    bannerEl.style.display = 'none';
  }
}

function renderHeader() {
  const user = getCurrentUser();
  const theme = localStorage.getItem('economics_portal_theme') || 'dark';
  const themeIcons = { auto: '🌓', light: '☀️', dark: '🌙' };

  headerEl.innerHTML = `
    <div class="header-container">
      <a href="#" class="brand-wrapper" id="brand-link">
        <div class="brand-mark">E</div>
        <div class="brand-copy">
          <span>EconomicsPortal</span>
          <small>Academic Ops</small>
        </div>
      </a>

      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-theme-toggle" title="Switch Theme (Current: ${esc(theme)})">
          ${themeIcons[theme] || '🌓'}
        </button>

        ${user ? `<div id="account-menu-host"></div>` : ''}
      </div>
    </div>
  `;

  document
    .getElementById('btn-theme-toggle')
    .addEventListener('click', toggleTheme);

  const brandLink = document.getElementById('brand-link');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      refreshApp();
    });
  }

  const menuHost = document.getElementById('account-menu-host');
  if (menuHost && user) {
    renderAccountMenu(menuHost, user, () => {
      clearCurrentUser();
      refreshApp();
    });
  }
}

function renderFooter() {
  footerEl.innerHTML = `
    <div class="site-footer">
      <p>Class portal for Dr. Numan's Economics class — built by Shehroz's team.</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN VIEW
// ─────────────────────────────────────────────────────────────────────────────
function renderLogin(notice = '') {
  renderModernLogin(
    mainEl,
    () => refreshApp(),
    () => refreshApp(),
    { notice },
  );
}

// The API client clears the session and fires this when the server rejects
// the token (expired, PIN changed, or signed in from an old version).
window.addEventListener('economics:session-expired', () => {
  renderHeader();
  renderLogin('Your session expired, please sign in again.');
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD VIEW LOADER
// ─────────────────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const user = getCurrentUser();
  if (!user) {
    renderLogin();
    return;
  }

  mainEl.innerHTML = `
    <div class="dashboard-loader-wrap">
      <div class="kpi-grid" style="margin-bottom: 1.25rem;">
        <div class="kpi-card skeleton-tile"><div class="skeleton-shimmer" style="height: 12px; width: 60px; margin-bottom: 8px;"></div><div class="skeleton-shimmer" style="height: 28px; width: 90px;"></div></div>
        <div class="kpi-card skeleton-tile"><div class="skeleton-shimmer" style="height: 12px; width: 70px; margin-bottom: 8px;"></div><div class="skeleton-shimmer" style="height: 28px; width: 80px;"></div></div>
        <div class="kpi-card skeleton-tile"><div class="skeleton-shimmer" style="height: 12px; width: 65px; margin-bottom: 8px;"></div><div class="skeleton-shimmer" style="height: 28px; width: 85px;"></div></div>
        <div class="kpi-card skeleton-tile"><div class="skeleton-shimmer" style="height: 12px; width: 80px; margin-bottom: 8px;"></div><div class="skeleton-shimmer" style="height: 28px; width: 75px;"></div></div>
      </div>
      <div class="card skeleton-tile" style="padding: 1.5rem; text-align: center;">
        <div class="auth-spinner" style="border: 3px solid rgba(83, 74, 183, 0.2); border-top-color: var(--purple); width: 32px; height: 32px; margin: 1rem auto;"></div>
        <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">Loading Economics Ledger</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem;">Authenticating session for <strong>${esc(user.name)}</strong>...</p>
      </div>
    </div>
  `;

  try {
    const res = await apiGetDashboard();
    if (res.code === 'AUTH') return; // login screen already shown
    if (!res.ok) {
      mainEl.innerHTML = `
        <div class="alert alert-error" style="max-width: 600px; margin: 2rem auto;">
          Failed to load dashboard: ${esc(res.error)}
          <div style="margin-top: 0.75rem;">
            <button class="btn btn-secondary btn-sm" id="btn-retry-load">Retry</button>
          </div>
        </div>
      `;
      document
        .getElementById('btn-retry-load')
        .addEventListener('click', loadDashboard);
      return;
    }

    const data = res.data || {};

    if (
      user.role === 'instructor' ||
      user.role === 'group_leader' ||
      user.role === 'assistant'
    ) {
      renderGroupLeaderDashboard(mainEl, user, data, loadDashboard);
    } else if (user.role === 'team_leader') {
      renderTeamLeaderDashboard(mainEl, user, data, loadDashboard);
    } else {
      // member
      renderMemberDashboard(mainEl, user, data, loadDashboard);
    }
  } catch (err) {
    mainEl.innerHTML = `
      <div class="alert alert-error" style="max-width: 600px; margin: 2rem auto;">
        ${
          navigator.onLine === false
            ? "You're offline. Reconnect to the internet to load your latest data."
            : `Error connecting to API: ${esc(err.message)}`
        }
        <div style="margin-top: 0.75rem;">
          <button class="btn btn-secondary btn-sm" id="btn-retry-load">Retry</button>
        </div>
      </div>
    `;
    document
      .getElementById('btn-retry-load')
      .addEventListener('click', loadDashboard);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// APP REFRESH & INIT
// ─────────────────────────────────────────────────────────────────────────────
function refreshApp() {
  renderHeader();
  renderBanner();
  renderFooter();

  const user = getCurrentUser();
  if (user) {
    loadDashboard();
  } else {
    renderLogin();
  }
}

function ensureToastHost() {
  let host = document.getElementById('economics-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'economics-toast-host';
    host.className = 'toast-stack';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-atomic', 'false');
    document.body.appendChild(host);
  }
  return host;
}

window.showEconomicsToast = function showEconomicsToast(
  message,
  type = 'info',
) {
  const host = ensureToastHost();
  const toast = document.createElement('div');
  toast.className = `toast toast-${esc(type)}`;
  toast.textContent = message;
  host.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 260);
  }, 2800);
};

window.confirmEconomicsAction = function confirmEconomicsAction(message) {
  return window.confirm(message);
};

// Installable app / offline shell. Service workers need HTTPS (or localhost).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker not registered:', err));
  });
}

// Accessibility: every modal on the page (including ones built by older
// components) gets dialog semantics, a focus trap, Esc to close and focus
// restore; icon-only "✕" buttons get an accessible name.
new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return;
      const overlays = node.matches('.modal-overlay') ? [node] : [...node.querySelectorAll('.modal-overlay')];
      overlays.forEach((overlay) => {
        overlay.querySelectorAll('button').forEach((b) => {
          if (b.textContent.trim() === '✕' && !b.hasAttribute('aria-label')) b.setAttribute('aria-label', 'Close');
        });
        enhanceModal(overlay);
      });
    });
  }
}).observe(document.body, { childList: true, subtree: true });

// Run on page load
initTheme();
refreshApp();
