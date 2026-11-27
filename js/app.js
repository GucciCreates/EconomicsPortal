/**
 * EconomicsPortal — Main application controller
 *
 * Dashboards render from, in order of preference:
 *   1. the dashboard that came back with the last sign-in or write (no request),
 *   2. the last dashboard this tab saw (shown instantly, then refreshed),
 *   3. a fresh request, behind a loading skeleton.
 */

import { isDemoMode, exitDemo, REQUIRED_SERVER_VERSION } from './config.js';
import { getCurrentUser, clearCurrentUser } from './auth.js';
import {
  apiGetDashboard,
  resetDemoData,
  takeFreshDashboard,
  getCachedDashboard,
  lastSyncedAt,
  forgetDashboards,
  describeApiError,
} from './api.js';
import { formatRelative, formatFull } from './dates.js';
// Dashboards are loaded only after sign-in, so the sign-in page stays small.
const VIEWS = {
  leader: () => import('./components/groupLeaderView.js').then((m) => m.renderGroupLeaderDashboard),
  team: () => import('./components/teamLeaderView.js').then((m) => m.renderTeamLeaderDashboard),
  member: () => import('./components/memberView.js').then((m) => m.renderMemberDashboard),
};
const loadedViews = {};
function viewFor(role) {
  if (role === 'instructor' || role === 'group_leader' || role === 'assistant') return 'leader';
  if (role === 'team_leader') return 'team';
  return 'member';
}
async function ensureView(role) {
  const key = viewFor(role);
  if (!loadedViews[key]) loadedViews[key] = await VIEWS[key]();
  return loadedViews[key];
}
import { renderModernLogin } from './components/loginView.js';
import { esc } from './utils.js';
import { renderAccountMenu, openChangeMyPinModal, openGoogleLinkModal } from './components/accountMenu.js';
import { cachedGoogleClientId } from './googleSignIn.js';
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
  const savedTheme = localStorage.getItem('economics_portal_theme') || 'auto';
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
      <section class="demo-banner" aria-label="Demo Mode">
        <span><strong>Sample data.</strong> Nothing you do here is saved, and it disappears when you close this tab.</span>
        <div class="demo-banner-actions">
          <button id="btn-reset-demo" class="btn btn-secondary btn-sm">Reset sample data</button>
          <button id="btn-exit-demo" class="btn btn-secondary btn-sm">Leave demo</button>
        </div>
      </section>
    `;
    bannerEl.style.display = 'block';
    document.body.classList.add('is-demo');

    document.getElementById('btn-exit-demo').addEventListener('click', () => {
      clearCurrentUser();
      forgetDashboards();
      exitDemo();
    });
    document.getElementById('btn-reset-demo').addEventListener('click', async () => {
      if (confirm('Reset the sample data to how it started?')) {
        await resetDemoData();
        forgetDashboards();
        window.location.reload();
      }
    });
  } else {
    bannerEl.innerHTML = ``;
    bannerEl.style.display = 'none';
    document.body.classList.remove('is-demo');
  }
}

function renderHeader() {
  const user = getCurrentUser();
  const theme = localStorage.getItem('economics_portal_theme') || 'auto';
  const themeNames = { auto: 'Auto', light: 'Light', dark: 'Dark' };

  headerEl.innerHTML = `
    <div class="header-container">
      <a href="#" class="brand-wrapper" id="brand-link">
        <div class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M4 5 C9 14, 14 18, 22 21" />
            <path d="M4 21 C10 18, 15 12, 22 5" />
            <circle cx="13" cy="14.6" r="2.6" fill="var(--marker)" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </div>
        <div class="brand-copy">
          <span>EconomicsPortal</span>
          <small>Dr. Numan's Economics class</small>
        </div>
      </a>

      <div class="header-actions">
        <button class="btn btn-secondary btn-sm theme-toggle" id="btn-theme-toggle" title="Change theme" aria-label="Theme: ${esc(themeNames[theme] || 'Auto')}. Click to change.">
          ${esc(themeNames[theme] || 'Auto')}
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
      forgetDashboards();
      refreshApp();
    });
  }
}

function renderFooter() {
  footerEl.innerHTML = `
    <div class="site-footer">
      <p>Class portal for Dr. Numan's Economics class, built by Shehroz's team.</p>
      <p class="sync-status" id="sync-status" aria-live="off"></p>
    </div>
  `;
  updateSyncStatus();
}

/** Footer line: "Synced 2 minutes ago" (full time in the tooltip). */
function updateSyncStatus() {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const at = getCurrentUser() ? lastSyncedAt() : null;
  if (!at) {
    el.textContent = '';
    el.removeAttribute('title');
    return;
  }
  const rel = formatRelative(new Date(at));
  el.textContent = `${isDemoMode() ? 'Sample data loaded' : 'Synced'} ${rel === 'just now' ? 'just now' : rel}`;
  el.title = formatFull(new Date(at));
}
window.addEventListener('economics:synced', updateSyncStatus);
setInterval(updateSyncStatus, 30 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN VIEW
// ─────────────────────────────────────────────────────────────────────────────
let pinUpgradeOffer = null; // set right after a sign-in with a short PIN
let googleOffer = false; // set right after a PIN sign-in when Google sign-in is on but not linked

function renderLogin(notice = '') {
  renderModernLogin(
    mainEl,
    (res) => {
      pinUpgradeOffer = res && res.pinUpgrade ? { minLength: res.pinMinLength || 4 } : null;
      googleOffer = Boolean(
        res && res.method !== 'google' && !isDemoMode() && cachedGoogleClientId() &&
          !(res.data && res.data.me && res.data.me.googleEmail),
      );
      refreshApp();
    },
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
function renderSkeleton(user) {
  mainEl.innerHTML = `
    <div class="dashboard-loader-wrap" aria-busy="true">
      <div class="page-head">
        <div>
          <div class="skeleton-shimmer skeleton-line skeleton-line-sm"></div>
          <div class="skeleton-shimmer skeleton-line skeleton-line-lg"></div>
        </div>
      </div>
      <div class="kpi-grid">
        ${'<div class="kpi-card"><div class="skeleton-shimmer skeleton-line skeleton-line-sm"></div><div class="skeleton-shimmer skeleton-line skeleton-line-md"></div></div>'.repeat(4)}
      </div>
      <p class="loading-note">Loading ${esc(user.name)}'s dashboard…</p>
    </div>
  `;
}

function renderErrorScreen(message) {
  mainEl.innerHTML = `
    <div class="card error-screen" role="alert">
      <h2 class="card-title">Can't load your dashboard</h2>
      <p>${esc(message)}</p>
      <button class="btn btn-primary btn-sm" id="btn-retry-load">Try again</button>
    </div>
  `;
  document.getElementById('btn-retry-load').addEventListener('click', () => loadDashboard());
}

/** True while the person is typing or has a dialog open: don't redraw under them. */
function userIsBusy() {
  const active = document.activeElement;
  if (active && mainEl.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
  if (document.querySelector('.modal-overlay')) return true;
  return [...mainEl.querySelectorAll('input, textarea')].some(
    (el) => el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'search' && el.value !== el.defaultValue,
  );
}

let lastRenderedJson = '';

async function renderDashboard(user, data) {
  const render = await ensureView(user.role);
  const scrollY = window.scrollY;
  lastRenderedJson = JSON.stringify(data);
  render(mainEl, user, data, loadDashboard);
  showServerOutdated(user, data);
  if (pinUpgradeOffer) showPinUpgradeOffer(user);
  else if (googleOffer) showGoogleOffer(user);
  window.scrollTo(0, scrollY);
  updateSyncStatus();
}

/**
 * Leaders are told when the Apps Script server runs older code than this
 * site needs; otherwise things like PIN resets fail with confusing errors.
 */
const LEADER_ROLES = ['instructor', 'group_leader', 'assistant'];
function showServerOutdated(user, data) {
  if (!LEADER_ROLES.includes(user.role)) return;
  const version = Number(data && data.serverVersion);
  if (version >= REQUIRED_SERVER_VERSION) return;
  const box = document.createElement('div');
  box.className = 'alert alert-warning server-outdated';
  box.setAttribute('role', 'status');
  box.innerHTML = `
    <strong>The class server is out of date${version ? ` (version ${esc(version)})` : ''}.</strong>
    The website was updated but the Apps Script code wasn't, so some actions, such as resetting PINs, will fail.
    The sheet owner needs to paste the new <code>backend/Code.gs</code> into Apps Script and deploy a new version
    (SETUP_GUIDE.md, "Upgrading to v7").`;
  mainEl.prepend(box);
}

/**
 * One-time suggestion after signing in with a short PIN. Not a dialog:
 * nobody is blocked from using the portal.
 */
function showPinUpgradeOffer(user) {
  const offer = pinUpgradeOffer;
  pinUpgradeOffer = null;
  const key = 'economics_portal_pin_offer_v1:' + String(user.name).toLowerCase();
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
  } catch (e) {
    /* show it anyway */
  }
  const leader = offer.minLength > 4;
  const box = document.createElement('div');
  box.className = 'alert alert-info pin-offer';
  box.setAttribute('role', 'status');
  box.innerHTML = `
    <strong>Choose a longer PIN.</strong>
    ${leader
      ? 'Your account can change marks, so your next PIN must be at least 6 digits. A longer PIN is much harder to guess.'
      : 'PINs can now be up to 8 digits. A longer PIN is much harder to guess.'}
    <div class="btn-row">
      <button type="button" class="btn btn-primary btn-sm" data-pin-offer="change">Change my PIN</button>
      <button type="button" class="btn btn-secondary btn-sm" data-pin-offer="later">Not now</button>
    </div>`;
  mainEl.prepend(box);
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pin-offer]');
    if (!btn) return;
    box.remove();
    if (btn.dataset.pinOffer === 'change') openChangeMyPinModal();
  });
}

/** One-time suggestion to link Google after a PIN sign-in. */
function showGoogleOffer(user) {
  googleOffer = false;
  const key = 'economics_portal_google_offer_v1:' + String(user.name).toLowerCase();
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, String(Date.now()));
  } catch (e) {
    /* show it anyway */
  }
  const box = document.createElement('div');
  box.className = 'alert alert-info pin-offer';
  box.setAttribute('role', 'status');
  box.innerHTML = `
    <strong>Skip the PIN next time.</strong>
    Link your Google account and sign in with one tap.
    <div class="btn-row">
      <button type="button" class="btn btn-primary btn-sm" data-google-offer="link">Use Google to sign in</button>
      <button type="button" class="btn btn-secondary btn-sm" data-google-offer="later">Not now</button>
    </div>`;
  mainEl.prepend(box);
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-google-offer]');
    if (!btn) return;
    box.remove();
    if (btn.dataset.googleOffer === 'link') openGoogleLinkModal();
  });
}

async function loadDashboard() {
  const user = getCurrentUser();
  if (!user) {
    renderLogin();
    return;
  }

  // 1. Fresh data from the sign-in or write that just happened: no request.
  const fresh = takeFreshDashboard();
  if (fresh) {
    await renderDashboard(user, fresh);
    return;
  }

  // 2. Show what this tab last saw straight away, then refresh behind it.
  const cached = getCachedDashboard();
  if (cached) await renderDashboard(user, cached.data);
  else {
    renderSkeleton(user);
    ensureView(user.role).catch(() => {}); // fetch the code while the data loads
  }

  try {
    const res = await apiGetDashboard();
    if (res.code === 'AUTH') return; // login screen already shown
    if (!res.ok) {
      if (!cached) renderErrorScreen(res.error || 'The class server returned an error.');
      else window.showEconomicsToast && window.showEconomicsToast(`Couldn't refresh: ${res.error}`, 'error');
      return;
    }
    takeFreshDashboard(); // consumed here
    const current = getCurrentUser();
    if (!current || current.name !== user.name) return; // signed out meanwhile
    if (JSON.stringify(res.data || {}) === lastRenderedJson) return updateSyncStatus();
    if (cached && userIsBusy()) {
      window.showEconomicsToast && window.showEconomicsToast('New data is available. It will show after you finish.', 'info');
      return;
    }
    await renderDashboard(user, res.data || {});
  } catch (err) {
    const msg = describeApiError(err);
    if (!cached) renderErrorScreen(msg);
    else window.showEconomicsToast && window.showEconomicsToast(msg + ' Showing what you saw last.', 'error');
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
