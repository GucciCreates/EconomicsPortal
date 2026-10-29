/**
 * EconomicsPortal — Modern Responsive Auth / Login Component
 */

import { apiLogin } from "../api.js";
import { setCurrentUser } from "../auth.js";

const DIRECTORY = [
  { name: "Dr. Numan", role: "Instructor", team: "-", pin: "0000", tag: "Faculty", icon: "👨‍🏫" },
  { name: "Shehroz", role: "Group Leader", team: "Shehroz", pin: "1111", tag: "Lead", icon: "⭐" },
  { name: "Sajal", role: "Teaching Assistant", team: "Shehroz", pin: "1112", tag: "Assistant", icon: "📝" },
  { name: "Amina", role: "Team Leader", team: "Amina", pin: "2001", tag: "Team Amina", icon: "👩‍💼" },
  { name: "Ayesha (Quetta)", role: "Team Leader", team: "Ayesha", pin: "3001", tag: "Team Ayesha", icon: "👩‍💼" },
  { name: "Lareb", role: "Team Leader", team: "Lareb", pin: "4001", tag: "Team Lareb", icon: "👩‍💼" },
  { name: "Ramesh", role: "Member", team: "Amina", pin: "2002", tag: "Team Amina", icon: "👤" },
  { name: "Mamoon", role: "Member", team: "Amina", pin: "2003", tag: "Team Amina", icon: "👤" },
  { name: "Tazneem", role: "Member", team: "Amina", pin: "2004", tag: "Team Amina", icon: "👤" },
  { name: "Minal", role: "Member", team: "Ayesha", pin: "3002", tag: "Team Ayesha", icon: "👤" },
  { name: "Anika", role: "Member", team: "Ayesha", pin: "3003", tag: "Team Ayesha", icon: "👤" },
  { name: "Ahmed bin Nasir", role: "Member", team: "Ayesha", pin: "3004", tag: "Team Ayesha", icon: "👤" },
  { name: "Shaiman", role: "Member", team: "Lareb", pin: "4002", tag: "Team Lareb", icon: "👤" },
  { name: "Aisha Amjad", role: "Member", team: "Lareb", pin: "4003", tag: "Team Lareb", icon: "👤" },
  { name: "Haseeb", role: "Member", team: "Lareb", pin: "4004", tag: "Team Lareb", icon: "👤" },
  { name: "Gorsi", role: "Member", team: "Shehroz", pin: "1113", tag: "Team Shehroz", icon: "👤" },
  { name: "Haris", role: "Member", team: "Shehroz", pin: "1114", tag: "Team Shehroz", icon: "👤" },
];

export function renderModernLogin(container, onSuccess, onForceDemo) {
  const rememberedName = localStorage.getItem("economics_portal_remember_name") || "";
  let activeTab = rememberedName ? "direct" : "quick";

  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        <!-- Auth Header -->
        <div class="auth-header">
          <div class="auth-logo-badge">📈</div>
          <h1 class="auth-title">EconomicsPortal</h1>
          <p class="auth-subtitle">Dr. Numan's Economics Class • Academic Ledger</p>
        </div>

        <!-- Mode Toggle Tabs -->
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab-btn ${activeTab === "quick" ? "active" : ""}" id="tab-quick">
            ⚡ Quick Select
          </button>
          <button type="button" class="auth-tab-btn ${activeTab === "direct" ? "active" : ""}" id="tab-direct">
            ✍️ Direct Login
          </button>
        </div>

        <div id="login-error-box"></div>

        <!-- Quick Select View -->
        <div id="view-quick" style="display: ${activeTab === "quick" ? "block" : "none"};">
          <div class="auth-quick-filters">
            <span class="auth-filter-label">Filter:</span>
            <button class="filter-chip active" data-filter="all">All</button>
            <button class="filter-chip" data-filter="Faculty">Faculty & Leads</button>
            <button class="filter-chip" data-filter="Team Amina">Amina</button>
            <button class="filter-chip" data-filter="Team Ayesha">Ayesha</button>
            <button class="filter-chip" data-filter="Team Lareb">Lareb</button>
            <button class="filter-chip" data-filter="Team Shehroz">Shehroz</button>
          </div>

          <div class="auth-avatar-grid" id="avatar-grid">
            ${renderAvatarChips("all")}
          </div>
        </div>

        <!-- Direct Login Form -->
        <form id="form-login" class="auth-form" style="display: ${activeTab === "direct" ? "block" : "none"};">
          <div class="form-group">
            <label class="form-label" for="login-name">Your Full Name</label>
            <div class="input-icon-wrap">
              <span class="input-icon">👤</span>
              <input
                type="text"
                id="login-name"
                class="form-control auth-input"
                placeholder="e.g. Dr. Numan, Shehroz, or Ramesh"
                value="${rememberedName}"
                autocomplete="name"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <label class="form-label" for="login-pin" style="margin-bottom: 0;">4-Digit PIN</label>
              <button type="button" class="btn-text-toggle" id="btn-toggle-pin-visibility">Show PIN</button>
            </div>
            
            <div class="input-icon-wrap">
              <span class="input-icon">🔒</span>
              <input
                type="password"
                id="login-pin"
                class="form-control auth-input pin-input"
                placeholder="••••"
                maxlength="4"
                pattern="[0-9]{4}"
                inputmode="numeric"
                autocomplete="current-password"
                required
              />
            </div>

            <!-- PIN Digit Boxes Indicator -->
            <div class="pin-dots-display" id="pin-dots">
              <span class="pin-dot"></span>
              <span class="pin-dot"></span>
              <span class="pin-dot"></span>
              <span class="pin-dot"></span>
            </div>
          </div>

          <div class="form-group auth-remember-row">
            <label class="custom-checkbox-label">
              <input type="checkbox" id="chk-remember" ${rememberedName ? "checked" : ""} />
              <span>Remember my name on this device</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary auth-submit-btn" id="btn-submit-login">
            <span>Log In to Portal</span>
            <span class="btn-arrow">→</span>
          </button>
        </form>

        <!-- Quick Keypad Helper for Touch Screens -->
        <div class="auth-footer-help">
          <span>Protected class workspace • Session stored locally</span>
        </div>
      </div>
    </div>
  `;

  // Element handles
  const tabQuick = container.querySelector("#tab-quick");
  const tabDirect = container.querySelector("#tab-direct");
  const viewQuick = container.querySelector("#view-quick");
  const formLogin = container.querySelector("#form-login");
  const nameInput = container.querySelector("#login-name");
  const pinInput = container.querySelector("#login-pin");
  const submitBtn = container.querySelector("#btn-submit-login");
  const errorBox = container.querySelector("#login-error-box");
  const pinDots = container.querySelectorAll(".pin-dot");
  const togglePinBtn = container.querySelector("#btn-toggle-pin-visibility");
  const rememberChk = container.querySelector("#chk-remember");

  // Tabs switch
  tabQuick.addEventListener("click", () => {
    tabQuick.classList.add("active");
    tabDirect.classList.remove("active");
    viewQuick.style.display = "block";
    formLogin.style.display = "none";
  });

  tabDirect.addEventListener("click", () => {
    tabDirect.classList.add("active");
    tabQuick.classList.remove("active");
    viewQuick.style.display = "none";
    formLogin.style.display = "block";
    nameInput.focus();
  });

  // Filter chips in Quick Select
  container.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.getAttribute("data-filter");
      container.querySelector("#avatar-grid").innerHTML = renderAvatarChips(f);
      attachAvatarEvents();
    });
  });

  function renderAvatarChips(filter) {
    const list = DIRECTORY.filter((u) => {
      if (filter === "all") return true;
      if (filter === "Faculty") return u.tag === "Faculty" || u.tag === "Lead" || u.tag === "Assistant";
      return u.tag === filter;
    });

    return list
      .map(
        (u) => `
      <button type="button" class="avatar-card-chip" data-name="${u.name}" data-pin="${u.pin}">
        <span class="avatar-icon">${u.icon}</span>
        <div class="avatar-info">
          <div class="avatar-name">${u.name}</div>
          <div class="avatar-role">${u.role}</div>
        </div>
        <span class="avatar-tag">${u.tag}</span>
      </button>
    `
      )
      .join("");
  }

  function attachAvatarEvents() {
    container.querySelectorAll(".avatar-card-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const name = chip.getAttribute("data-name");
        const pin = chip.getAttribute("data-pin");

        nameInput.value = name;
        pinInput.value = pin;
        updatePinDots(pin);

        // Switch to direct form and submit smoothly
        tabDirect.click();
        submitBtn.focus();
        formLogin.requestSubmit();
      });
    });
  }

  attachAvatarEvents();

  // Pin input dots synchronization
  function updatePinDots(val) {
    pinDots.forEach((dot, idx) => {
      if (idx < val.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    });
  }

  pinInput.addEventListener("input", (e) => {
    updatePinDots(e.target.value);
    if (e.target.value.length === 4) {
      submitBtn.classList.add("pulse");
    } else {
      submitBtn.classList.remove("pulse");
    }
  });

  // Show/Hide PIN toggle
  let isPinVisible = false;
  togglePinBtn.addEventListener("click", () => {
    isPinVisible = !isPinVisible;
    pinInput.type = isPinVisible ? "text" : "password";
    togglePinBtn.textContent = isPinVisible ? "Hide PIN" : "Show PIN";
  });

  // Form Submit
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();

    if (rememberChk.checked) {
      localStorage.setItem("economics_portal_remember_name", name);
    } else {
      localStorage.removeItem("economics_portal_remember_name");
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="auth-spinner"></span> Authenticating...`;
    errorBox.innerHTML = "";

    try {
      const res = await apiLogin(name, pin);
      if (res.ok && res.user) {
        setCurrentUser(res.user);
        onSuccess();
      } else {
        triggerError(res.error || "Invalid name or PIN.");
      }
    } catch (err) {
      errorBox.innerHTML = `
        <div class="alert alert-error auth-error-alert">
          <strong>Connection error: ${err.message}</strong>
          <p style="font-size: 0.8rem; margin: 0.35rem 0;">
            Could not reach Google Apps Script. You can continue in interactive demo mode.
          </p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-force-demo-login" style="width: 100%; margin-top: 0.5rem; background: #fff; font-weight: 600;">
            ⚡ Continue in Demo Mode
          </button>
        </div>
      `;

      const forceBtn = errorBox.querySelector("#btn-force-demo-login");
      if (forceBtn) {
        forceBtn.addEventListener("click", () => {
          localStorage.setItem("economics_portal_force_demo", "true");
          onForceDemo();
        });
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Log In to Portal</span><span class="btn-arrow">→</span>`;
    }
  });

  function triggerError(msg) {
    errorBox.innerHTML = `<div class="alert alert-error auth-error-alert">${msg}</div>`;
    const card = container.querySelector(".auth-card");
    card.classList.remove("shake");
    void card.offsetWidth; // trigger reflow
    card.classList.add("shake");
    pinInput.value = "";
    updatePinDots("");
    pinInput.focus();
  }
}
