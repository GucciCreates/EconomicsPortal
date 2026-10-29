/**
 * EconomicsPortal — Main Application Controller (v2)
 */

import { API_URL, isDemoMode } from "./config.js";
import { getCurrentUser, setCurrentUser, clearCurrentUser } from "./auth.js";
import { apiLogin, apiGetDashboard, resetDemoData } from "./api.js";
import { renderMemberDashboard } from "./components/memberView.js";
import { renderTeamLeaderDashboard } from "./components/teamLeaderView.js";
import { renderGroupLeaderDashboard } from "./components/groupLeaderView.js";
import { renderModernLogin } from "./components/loginView.js";

// DOM Root Elements
const headerEl = document.getElementById("site-header");
const bannerEl = document.getElementById("demo-banner");
const mainEl = document.getElementById("main-content");
const footerEl = document.getElementById("site-footer");

// ─────────────────────────────────────────────────────────────────────────────
// THEME SETUP
// ─────────────────────────────────────────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem("economics_portal_theme") || "auto";
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("economics_portal_theme", theme);
}

function toggleTheme() {
  const current = localStorage.getItem("economics_portal_theme") || "auto";
  const next = current === "dark" ? "light" : current === "light" ? "auto" : "dark";
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
            localStorage.getItem("economics_portal_force_demo") === "true"
              ? `<button id="btn-retry-live" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Try Live API</button>`
              : `<a href="./SETUP_GUIDE.md" target="_blank" style="font-weight: 600;">Upgrade to v2 ↗</a>`
          }
          <button id="btn-reset-demo" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Reset Demo Data</button>
        </div>
      </div>
    `;
    bannerEl.style.display = "block";

    const retryLiveBtn = document.getElementById("btn-retry-live");
    if (retryLiveBtn) {
      retryLiveBtn.addEventListener("click", () => {
        localStorage.removeItem("economics_portal_force_demo");
        refreshApp();
      });
    }

    const resetBtn = document.getElementById("btn-reset-demo");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (confirm("Reset demo data back to default sample state?")) {
          resetDemoData();
          window.location.reload();
        }
      });
    }
  } else {
    bannerEl.innerHTML = ``;
    bannerEl.style.display = "none";
  }
}

function renderHeader() {
  const user = getCurrentUser();
  const theme = localStorage.getItem("economics_portal_theme") || "auto";
  const themeIcons = { auto: "🌓", light: "☀️", dark: "🌙" };

  headerEl.innerHTML = `
    <div class="header-container">
      <a href="#" class="brand-wrapper" id="brand-link">
        <div class="brand-mark">E</div>
        <span>EconomicsPortal</span>
      </a>

      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-theme-toggle" title="Switch Theme (Current: ${theme})">
          ${themeIcons[theme] || "🌓"}
        </button>

        ${
          user
            ? `
          <div class="user-badge">
            <span>${user.name}</span>
            <span class="role-pill role-${user.role}">${user.role.replace("_", " ")}</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-logout" title="Log out">
            Log out
          </button>
        `
            : ""
        }
      </div>
    </div>
  `;

  document.getElementById("btn-theme-toggle").addEventListener("click", toggleTheme);

  const brandLink = document.getElementById("brand-link");
  if (brandLink) {
    brandLink.addEventListener("click", (e) => {
      e.preventDefault();
      refreshApp();
    });
  }

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
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
function renderLogin() {
  renderModernLogin(
    mainEl,
    () => refreshApp(),
    () => refreshApp()
  );
}

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
    <div style="text-align: center; padding: 4rem 1rem;">
      <div style="font-size: 1.75rem; margin-bottom: 0.5rem;">📊</div>
      <p style="color: var(--text-muted); font-size: 0.95rem;">Loading ledger for ${user.name}...</p>
    </div>
  `;

  try {
    const res = await apiGetDashboard(user.role, user.team, user.name);
    if (!res.ok) {
      mainEl.innerHTML = `
        <div class="alert alert-error" style="max-width: 600px; margin: 2rem auto;">
          Failed to load dashboard: ${res.error}
          <div style="margin-top: 0.75rem;">
            <button class="btn btn-secondary btn-sm" id="btn-retry-load">Retry</button>
          </div>
        </div>
      `;
      document.getElementById("btn-retry-load").addEventListener("click", loadDashboard);
      return;
    }

    const data = res.data || {};

    if (user.role === "instructor" || user.role === "group_leader" || user.role === "assistant") {
      renderGroupLeaderDashboard(mainEl, user, data, loadDashboard);
    } else if (user.role === "team_leader") {
      renderTeamLeaderDashboard(mainEl, user, data, loadDashboard);
    } else {
      // member
      renderMemberDashboard(mainEl, user, data, loadDashboard);
    }
  } catch (err) {
    mainEl.innerHTML = `
      <div class="alert alert-error" style="max-width: 600px; margin: 2rem auto;">
        Error connecting to API: ${err.message}
        <div style="margin-top: 0.75rem;">
          <button class="btn btn-secondary btn-sm" id="btn-retry-load">Retry</button>
        </div>
      </div>
    `;
    document.getElementById("btn-retry-load").addEventListener("click", loadDashboard);
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

// Run on page load
initTheme();
refreshApp();
