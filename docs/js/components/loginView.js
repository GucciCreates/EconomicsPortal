/**
 * EconomicsPortal — Secure Private Login Component
 *
 * Strict Privacy:
 * - No public directory or PIN exposure on the login page.
 * - Credentials are verified securely via the backend.
 * - Only the Group Leader has access to view/change PINs.
 */

import { apiLogin } from '../api.js';
import { setCurrentUser } from '../auth.js';
import { isDemoMode } from '../config.js';
import { esc, escapeHtml } from '../utils.js';

export function renderModernLogin(container, onSuccess, onForceDemo, options = {}) {
  const rememberedName =
    localStorage.getItem('economics_portal_remember_name') || '';

  container.innerHTML = `
    <div class="auth-wrapper">
      <section class="auth-intro" aria-labelledby="auth-title">
        <h1 class="auth-title" id="auth-title">Marks, tasks and deadlines in one place.</h1>
        <p class="auth-subtitle">The class portal for Dr. Numan's Economics class: four teams, seventeen students, every quiz and submission on the record.</p>
        <figure class="auth-figure" aria-hidden="true">
          <svg viewBox="0 0 440 280" role="presentation">
            <path class="axis" d="M40 16 V244 H428" />
            <path class="guide" d="M40 136 H214 V244" />
            <path class="curve-s draw" d="M64 228 C130 190, 230 110, 392 36" />
            <path class="curve-d draw" d="M64 40 C140 80, 270 170, 392 228" />
            <circle class="eq-dot" cx="214" cy="136" r="9" />
            <text class="label-s" x="398" y="34">S</text>
            <text class="label-d" x="398" y="234">D</text>
            <path class="guide" d="M214 58 V124" />
            <text class="label-eq" x="214" y="48" text-anchor="middle">Effort meets the deadline</text>
            <text x="44" y="268">Week</text>
            <text x="8" y="22">Marks</text>
          </svg>
        </figure>
      </section>

      <div class="auth-card">
        <h2 class="auth-card-title">Sign in</h2>
        <p class="auth-card-sub">Use your full name and the 4-digit PIN your group leader gave you.</p>

        <div id="login-error-box">${
          options.notice
            ? `<div class="alert alert-info" role="status">${escapeHtml(options.notice)}</div>`
            : ''
        }</div>

        ${isDemoMode() ? `<div class="quick-login-panel" aria-label="Demo accounts">
          <p class="quick-login-title">Demo mode: sign in as</p>
          <div class="quick-login-grid">
            <button type="button" class="quick-login-chip" data-demo-name="Dr. Numan" data-demo-pin="0000">Dr. Numan <small>instructor</small></button>
            <button type="button" class="quick-login-chip" data-demo-name="Shehroz" data-demo-pin="1111">Shehroz <small>group leader</small></button>
            <button type="button" class="quick-login-chip" data-demo-name="Amina" data-demo-pin="2001">Amina <small>team leader</small></button>
            <button type="button" class="quick-login-chip" data-demo-name="Ayesha (Quetta)" data-demo-pin="3001">Ayesha <small>team leader</small></button>
            <button type="button" class="quick-login-chip" data-demo-name="Ramesh" data-demo-pin="2002">Ramesh <small>student</small></button>
          </div>
        </div>` : ''}

        <form id="form-login" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="login-name">Full name</label>
            <input
              type="text"
              id="login-name"
              class="form-control auth-input"
              placeholder="As on the class list, e.g. Ayesha (Quetta)"
              value="${escapeHtml(rememberedName)}"
              autocomplete="name"
              required
            />
          </div>

          <div class="form-group">
            <div class="pin-row">
              <label class="form-label" for="login-pin">PIN</label>
              <button type="button" class="btn-text-toggle" id="btn-toggle-pin-visibility">Show PIN</button>
            </div>
            <input
              type="password"
              id="login-pin"
              class="form-control auth-input pin-input"
              maxlength="4"
              pattern="[0-9]{4}"
              inputmode="numeric"
              autocomplete="current-password"
              aria-describedby="pin-dots-hint"
              required
            />
            <div class="pin-dots-display" id="pin-dots" aria-hidden="true">
              <span class="pin-dot"></span>
              <span class="pin-dot"></span>
              <span class="pin-dot"></span>
              <span class="pin-dot"></span>
            </div>
            <span class="sr-only" id="pin-dots-hint">4 digits</span>
          </div>

          <div class="form-group auth-remember-row">
            <label class="custom-checkbox-label">
              <input type="checkbox" id="chk-remember" ${rememberedName ? 'checked' : ''} />
              <span>Remember my name on this device</span>
            </label>
          </div>

          <button type="submit" class="btn btn-primary auth-submit-btn" id="btn-submit-login">Sign in</button>
        </form>

        <p class="auth-footer-help">
          Forgot your PIN, or locked out? Ask Shehroz (group leader) to reset it.
        </p>
      </div>
    </div>
  `;

  // Element handles
  const formLogin = container.querySelector('#form-login');
  const nameInput = container.querySelector('#login-name');
  const pinInput = container.querySelector('#login-pin');
  const submitBtn = container.querySelector('#btn-submit-login');
  const errorBox = container.querySelector('#login-error-box');
  const pinDots = container.querySelectorAll('.pin-dot');
  const togglePinBtn = container.querySelector('#btn-toggle-pin-visibility');
  const rememberChk = container.querySelector('#chk-remember');
  const quickLoginButtons = container.querySelectorAll('.quick-login-chip');

  quickLoginButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.demoName || '';
      const pin = button.dataset.demoPin || '';
      nameInput.value = name;
      pinInput.value = pin;
      updatePinDots(pin);
      if (rememberChk) {
        rememberChk.checked = true;
        localStorage.setItem('economics_portal_remember_name', name);
      }
      submitBtn.classList.add('pulse');
      setTimeout(() => submitBtn.classList.remove('pulse'), 260);
      formLogin.requestSubmit();
    });
  });

  // PIN indicator dots
  function updatePinDots(val) {
    pinDots.forEach((dot, idx) => {
      if (idx < val.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  pinInput.addEventListener('input', (e) => {
    updatePinDots(e.target.value);
    if (e.target.value.length === 4) {
      submitBtn.classList.add('pulse');
    } else {
      submitBtn.classList.remove('pulse');
    }
  });

  // Show/Hide PIN toggle
  let isPinVisible = false;
  togglePinBtn.addEventListener('click', () => {
    isPinVisible = !isPinVisible;
    pinInput.type = isPinVisible ? 'text' : 'password';
    togglePinBtn.textContent = isPinVisible ? 'Hide PIN' : 'Show PIN';
  });

  // Submit Handler
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const pin = pinInput.value.trim();

    if (rememberChk.checked) {
      localStorage.setItem('economics_portal_remember_name', name);
    } else {
      localStorage.removeItem('economics_portal_remember_name');
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="auth-spinner" aria-hidden="true"></span> Signing in…`;
    errorBox.innerHTML = '';

    try {
      const res = await apiLogin(name, pin);
      if (res.ok && res.user) {
        setCurrentUser(res.user);
        try {
          sessionStorage.removeItem(`economics_portal_tab:${res.user.name}`); // start each login on the first tab
        } catch (e) {}
        onSuccess();
      } else {
        triggerError(
          res.error || 'That name and PIN don\'t match. Check the spelling of your name, or ask your group leader to reset your PIN.',
        );
      }
    } catch (err) {
      errorBox.innerHTML = `
        <div class="alert alert-error auth-error-alert">
          <strong>Couldn't reach the class server (${esc(err.message)}).</strong>
          <p style="font-size: 0.85rem; margin: 0.35rem 0;">
            Check your connection and try again, or explore the portal with sample data.
          </p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-force-demo-login" style="width: 100%; margin-top: 0.5rem;">
            Continue in Demo Mode
          </button>
        </div>
      `;

      const forceBtn = errorBox.querySelector('#btn-force-demo-login');
      if (forceBtn) {
        forceBtn.addEventListener('click', () => {
          localStorage.setItem('economics_portal_force_demo', 'true');
          onForceDemo();
        });
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });

  function triggerError(msg) {
    errorBox.innerHTML = `<div class="alert alert-error auth-error-alert">${esc(msg)}</div>`;
    const card = container.querySelector('.auth-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    pinInput.value = '';
    updatePinDots('');
    pinInput.focus();
  }
}
