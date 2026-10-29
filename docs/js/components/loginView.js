/**
 * EconomicsPortal — Secure Private Login Component
 * 
 * Strict Privacy:
 * - No public directory or PIN exposure on the login page.
 * - Credentials are verified securely via the backend.
 * - Only the Group Leader has access to view/change PINs.
 */

import { apiLogin } from "../api.js";
import { setCurrentUser } from "../auth.js";

export function renderModernLogin(container, onSuccess, onForceDemo) {
  const rememberedName = localStorage.getItem("economics_portal_remember_name") || "";

  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        <!-- Auth Header -->
        <div class="auth-header">
          <div class="auth-logo-badge">📈</div>
          <h1 class="auth-title">EconomicsPortal</h1>
          <p class="auth-subtitle">Dr. Numan's Economics Class • Academic Ledger</p>
          <div style="margin-top: 0.65rem;">
            <span class="badge" style="background-color: var(--bg-subtle); color: var(--text-muted); font-size: 0.75rem;">
              🔒 Secure Private Access • Confidential Ledger
            </span>
          </div>
        </div>

        <div id="login-error-box"></div>

        <!-- Secure Login Form -->
        <form id="form-login" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="login-name">Full Name</label>
            <div class="input-icon-wrap">
              <span class="input-icon">👤</span>
              <input
                type="text"
                id="login-name"
                class="form-control auth-input"
                placeholder="e.g. Shehroz, Sajal, or Ramesh"
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

            <!-- PIN Digit Dots Indicator -->
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

        <div class="auth-footer-help">
          <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">
            Need your PIN or locked out? Contact Group Leader <strong>Shehroz</strong> to reset or issue your private PIN.
          </p>
        </div>
      </div>
    </div>
  `;

  // Element handles
  const formLogin = container.querySelector("#form-login");
  const nameInput = container.querySelector("#login-name");
  const pinInput = container.querySelector("#login-pin");
  const submitBtn = container.querySelector("#btn-submit-login");
  const errorBox = container.querySelector("#login-error-box");
  const pinDots = container.querySelectorAll(".pin-dot");
  const togglePinBtn = container.querySelector("#btn-toggle-pin-visibility");
  const rememberChk = container.querySelector("#chk-remember");

  // PIN indicator dots
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

  // Submit Handler
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
        triggerError(res.error || "Invalid name or PIN. Please verify with Group Leader.");
      }
    } catch (err) {
      errorBox.innerHTML = `
        <div class="alert alert-error auth-error-alert">
          <strong>Connection error: ${err.message}</strong>
          <p style="font-size: 0.8rem; margin: 0.35rem 0;">
            Could not reach Google Apps Script. You can continue in offline demo mode.
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
    void card.offsetWidth;
    card.classList.add("shake");
    pinInput.value = "";
    updatePinDots("");
    pinInput.focus();
  }
}
