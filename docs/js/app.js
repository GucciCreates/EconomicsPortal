/**
 * EconomicsPortal — Main Application Controller
 */

import { API_URL, isDemoMode } from "./config.js";
import { getCurrentUser, setCurrentUser, clearCurrentUser } from "./auth.js";
import { apiLogin, apiGetDashboard, resetDemoData } from "./api.js";
import { renderMemberDashboard } from "./components/memberView.js";
import { renderTeamLeaderDashboard } from "./components/teamLeaderView.js";
import { renderGroupLeaderDashboard } from "./components/groupLeaderView.js";

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
          ⚡ <strong>Demo / Offline Mode Active</strong> — Simulated backend is running with instant sample data.
        </span>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <a href="./SETUP_GUIDE.md" target="_blank" style="font-weight: 600;">Connect Apps Script ↗</a>
          <button id="btn-reset-demo" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.5rem; font-size: 0.75rem;">Reset Data</button>
        </div>
      </div>
    `;
    bannerEl.style.display = "block";

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
        <div class="brand-icon">📈</div>
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
  mainEl.innerHTML = `
    <div class="login-screen">
      <div class="login-header">
        <div style="font-size: 2.75rem; margin-bottom: 0.5rem;">📈</div>
        <h1>EconomicsPortal</h1>
        <p>Sign in with your name and 4-digit PIN</p>
      </div>

      <div class="card">
        <div id="login-error-box"></div>

        <form id="form-login">
          <div class="form-group">
            <label class="form-label" for="login-name">Your Full Name</label>
            <input
              type="text"
              id="login-name"
              class="form-control"
              placeholder="e.g. Shehroz, Amina, or Ramesh"
              autocomplete="name"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="login-pin">4-Digit PIN</label>
            <input
              type="password"
              id="login-pin"
              class="form-control"
              placeholder="••••"
              maxlength="4"
              pattern="[0-9]{4}"
              inputmode="numeric"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" class="btn btn-primary" id="btn-submit-login" style="width: 100%; margin-top: 0.5rem;">
            Log In
          </button>
        </form>

        <!-- Quick Demo Profiles for instant testing -->
        <div class="quick-demo-login">
          <p>Quick Demo Logins (Click to test any role):</p>
          <div class="demo-chips">
            <button class="demo-chip" data-name="Shehroz" data-pin="1111">Shehroz (Group Leader)</button>
            <button class="demo-chip" data-name="Sajal" data-pin="1112">Sajal (Assistant)</button>
            <button class="demo-chip" data-name="Amina" data-pin="2001">Amina (Team Leader)</button>
            <button class="demo-chip" data-name="Ramesh" data-pin="2002">Ramesh (Member)</button>
            <button class="demo-chip" data-name="Ayesha (Quetta)" data-pin="3001">Ayesha (Team Leader)</button>
            <button class="demo-chip" data-name="Minal" data-pin="3002">Minal (Member)</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById("form-login");
  const errorBox = document.getElementById("login-error-box");
  const submitBtn = document.getElementById("btn-submit-login");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("login-name").value;
    const pin = document.getElementById("login-pin").value;

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
    errorBox.innerHTML = "";

    try {
      const res = await apiLogin(name, pin);
      if (res.ok && res.user) {
        setCurrentUser(res.user);
        refreshApp();
      } else {
        errorBox.innerHTML = `<div class="alert alert-error">${res.error || "Invalid name or PIN."}</div>`;
      }
    } catch (err) {
      errorBox.innerHTML = `<div class="alert alert-error">Connection error: ${err.message}</div>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In";
    }
  });

  // Demo chips click handlers
  document.querySelectorAll(".demo-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.getElementById("login-name").value = chip.getAttribute("data-name");
      document.getElementById("login-pin").value = chip.getAttribute("data-pin");
      form.requestSubmit();
    });
  });
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
      <div style="font-size: 2rem; margin-bottom: 0.5rem; animation: pulse 1.5s infinite;">⏳</div>
      <p style="color: var(--text-muted); font-size: 0.95rem;">Loading dashboard data for ${user.name}...</p>
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

    if (user.role === "group_leader" || user.role === "assistant") {
      renderGroupLeaderDashboard(mainEl, user, data, loadDashboard);
    } else if (user.role === "team_leader") {
      renderTeamLeaderDashboard(mainEl, user, data, loadDashboard);
    } else {
      // member or instructor
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
