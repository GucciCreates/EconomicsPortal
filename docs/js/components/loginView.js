/**
 * EconomicsPortal — Sign-in screen
 *
 * - Name field suggests first names (from the public `names` action).
 *   Typing just a first name that belongs to one person offers
 *   "Did you mean …?".
 * - PINs are 4 to 8 digits.
 * - Signing in is one request: the response carries the dashboard.
 * - "Sign in with Google" appears above the PIN form once the owner sets
 *   GOOGLE_CLIENT_ID on the server (never in Demo Mode). It is also one
 *   request: the response carries the dashboard.
 * - If the class server can't be reached, the screen says so and offers
 *   Retry. It never switches to Demo Mode on its own.
 */

import { apiLogin, apiGoogleLogin, apiNames, acceptLoginDashboard } from '../api.js';
import { cachedGoogleClientId, rememberGoogleClientId, renderGoogleButton } from '../googleSignIn.js';
import { setCurrentUser } from '../auth.js';
import { isDemoMode } from '../config.js';
import { esc, escapeHtml } from '../utils.js';
import { animateAuthFigure } from './authFigure.js';

export function renderModernLogin(container, onSuccess, options = {}) {
  const rememberedName =
    localStorage.getItem('economics_portal_remember_name') || '';

  container.innerHTML = `
    <div class="auth-wrapper">
      <section class="auth-intro" aria-labelledby="auth-title">
        <h1 class="auth-title" id="auth-title">Marks, tasks and deadlines in one place.</h1>
        <p class="auth-subtitle">The class portal for Dr. Numan's Economics class: four teams, seventeen students, every quiz and submission on the record.</p>
        <figure class="auth-figure" aria-hidden="true">
          <svg viewBox="0 0 440 280" role="presentation">
            <path class="area area-cs" d="" />
            <path class="area area-ps" d="" />
            <path class="axis" d="M40 16 V244 H428" />
            <path class="guide guide-eq" d="M40 130.45 H216.03 V244" />
            <clipPath id="auth-plot-area"><rect x="42" y="0" width="398" height="242" /></clipPath>
            <path class="curve-d-ghost" d="M64 40 C140 80, 270 170, 392 228" />
            <path class="curve-s draw" d="M64 228 C130 190, 230 110, 392 36" />
            <g clip-path="url(#auth-plot-area)"><path class="curve-d draw" d="M64 40 C140 80, 270 170, 392 228" /></g>
            <text class="area-label area-label-cs" x="115" y="96" text-anchor="middle"><tspan x="115" dy="0">Consumer</tspan><tspan x="115" dy="12">surplus</tspan></text>
            <text class="area-label area-label-ps" x="115" y="158" text-anchor="middle"><tspan x="115" dy="0">Producer</tspan><tspan x="115" dy="12">surplus</tspan></text>
            <g class="axis-mark mark-p" transform="translate(0 130.45)">
              <path d="M34 0 H46" />
              <text x="30" y="4" text-anchor="end">P*</text>
            </g>
            <g class="axis-mark mark-q" transform="translate(216.03 0)">
              <path d="M0 238 V250" />
              <text x="0" y="262" text-anchor="middle">Q*</text>
            </g>
            <circle class="eq-halo" cx="216.03" cy="130.45" r="9" />
            <circle class="eq-dot" cx="216.03" cy="130.45" r="9" />
            <text class="label-s" x="398" y="34">S</text>
            <text class="label-d" x="398" y="234">D</text>
            <path class="guide guide-label" d="M216.03 58 V118.45" />
            <rect class="label-eq-bg" x="130" y="33" width="172" height="21" rx="3" />
            <text class="label-eq" x="216.03" y="48" text-anchor="middle">Effort meets the deadline</text>
            <text x="44" y="268">Week</text>
            <text x="8" y="22">Marks</text>
          </svg>
          <figcaption class="auth-figure-caption">
            <span class="hint-hover">Move across the chart to shift demand.</span>
            <span class="hint-touch">Drag across the chart to shift demand.</span>
          </figcaption>
        </figure>
      </section>

      <div class="auth-card">
        <h2 class="auth-card-title">Sign in</h2>
        <p class="auth-card-sub" id="auth-card-sub">Use your full name and the PIN your group leader gave you.</p>

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

        <div class="google-signin" id="google-signin" hidden>
          <div class="google-btn-host" id="google-btn-host"></div>
          <p class="auth-divider"><span>or use your name and PIN</span></p>
        </div>

        <form id="form-login" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="login-name">Full name</label>
            <input
              type="text"
              id="login-name"
              class="form-control auth-input"
              placeholder="Start typing your name"
              value="${escapeHtml(rememberedName)}"
              autocomplete="username"
              list="login-name-options"
              required
            />
            <datalist id="login-name-options"></datalist>
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
              minlength="4"
              maxlength="8"
              pattern="[0-9]{4,8}"
              inputmode="numeric"
              autocomplete="current-password"
              aria-describedby="pin-dots-hint"
              required
            />
            <div class="pin-dots-display" id="pin-dots" aria-hidden="true"></div>
            <span class="form-hint" id="pin-dots-hint">4 to 8 digits</span>
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

  animateAuthFigure(container.querySelector('.auth-figure svg'));

  // Element handles
  const formLogin = container.querySelector('#form-login');
  const nameInput = container.querySelector('#login-name');
  const pinInput = container.querySelector('#login-pin');
  const submitBtn = container.querySelector('#btn-submit-login');
  const errorBox = container.querySelector('#login-error-box');
  const pinDots = container.querySelector('#pin-dots');
  const togglePinBtn = container.querySelector('#btn-toggle-pin-visibility');
  const rememberChk = container.querySelector('#chk-remember');

  // ── Sign in with Google (only when the server has a client ID) ──────────
  const googleBox = container.querySelector('#google-signin');
  const googleHost = container.querySelector('#google-btn-host');
  let googleShownFor = '';
  async function showGoogle(clientId) {
    if (isDemoMode() || !clientId || clientId === googleShownFor) return;
    googleShownFor = clientId;
    googleBox.hidden = false;
    const ok = await renderGoogleButton(googleHost, clientId, signInWithGoogle);
    if (!ok) {
      // Google's script is blocked or offline: the PIN form still works.
      googleBox.hidden = true;
      googleShownFor = '';
      return;
    }
    container.querySelector('#auth-card-sub').textContent = 'Use your Google account, or your full name and PIN.';
  }
  function hideGoogle() {
    googleBox.hidden = true;
    googleHost.replaceChildren();
    googleShownFor = '';
    container.querySelector('#auth-card-sub').textContent = 'Use your full name and the PIN your group leader gave you.';
  }
  if (!isDemoMode()) showGoogle(cachedGoogleClientId());

  async function signInWithGoogle(credential) {
    errorBox.innerHTML = `<div class="alert alert-info" role="status"><span class="auth-spinner" aria-hidden="true"></span> Signing in with Google…</div>`;
    try {
      const res = await apiGoogleLogin(credential);
      if (res.ok && res.user) return finishSignIn(res);
      if (res.code === 'NOT_CONFIGURED') {
        rememberGoogleClientId('');
        hideGoogle();
      }
      errorBox.innerHTML = `<div class="alert ${res.code === 'GOOGLE_NOT_LINKED' ? 'alert-info' : 'alert-error'}" role="alert">${esc(
        res.error || "Google sign-in didn't work. Use your name and PIN.",
      )}</div>`;
    } catch (err) {
      errorBox.innerHTML = `<div class="alert alert-error auth-error-alert" role="alert"><strong>Can't reach the class server right now.</strong>
        <p class="alert-text">Wait a moment, then press the Google button again.</p></div>`;
    }
  }

  // First-name suggestions (and the Google client ID). Best effort: the form works without them.
  apiNames()
    .then((res) => {
      if (!res || !res.ok || !Array.isArray(res.names)) return;
      container.querySelector('#login-name-options').innerHTML = res.names
        .map((n) => `<option value="${escapeHtml(n)}"></option>`)
        .join('');
      if (isDemoMode()) return;
      const clientId = String(res.googleClientId || '');
      if (clientId !== cachedGoogleClientId()) rememberGoogleClientId(clientId);
      if (clientId) showGoogle(clientId);
      else hideGoogle();
    })
    .catch(() => {});

  function finishSignIn(res) {
    setCurrentUser(res.user);
    acceptLoginDashboard(res);
    try {
      sessionStorage.removeItem(`economics_portal_tab:${res.user.name}`); // start each login on the first tab
    } catch (e) {}
    onSuccess(res);
  }

  container.querySelectorAll('.quick-login-chip').forEach((button) => {
    button.addEventListener('click', () => {
      nameInput.value = button.dataset.demoName || '';
      pinInput.value = button.dataset.demoPin || '';
      updatePinDots(pinInput.value);
      formLogin.requestSubmit();
    });
  });

  // One bar per digit typed (at least four, at most eight).
  function updatePinDots(val) {
    const n = Math.min(8, Math.max(4, val.length));
    pinDots.innerHTML = Array.from({ length: n }, (_, i) => `<span class="pin-dot${i < val.length ? ' filled' : ''}"></span>`).join('');
  }
  updatePinDots('');
  pinInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
    updatePinDots(e.target.value);
  });

  let isPinVisible = false;
  togglePinBtn.addEventListener('click', () => {
    isPinVisible = !isPinVisible;
    pinInput.type = isPinVisible ? 'text' : 'password';
    togglePinBtn.textContent = isPinVisible ? 'Hide PIN' : 'Show PIN';
  });

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
        finishSignIn(res);
      } else if (res.code === 'DID_YOU_MEAN' && res.suggestion) {
        errorBox.innerHTML = `
          <div class="alert alert-info" role="status">
            Did you mean <strong>${esc(res.suggestion)}</strong>?
            <div class="btn-row">
              <button type="button" class="btn btn-primary btn-sm" id="btn-use-suggestion">Sign in as ${esc(res.suggestion)}</button>
            </div>
          </div>`;
        errorBox.querySelector('#btn-use-suggestion').addEventListener('click', () => {
          nameInput.value = res.suggestion;
          formLogin.requestSubmit();
        });
      } else {
        triggerError(
          res.error || "That name and PIN don't match. Check the spelling of your name, or ask your group leader to reset your PIN.",
        );
      }
    } catch (err) {
      errorBox.innerHTML = `
        <div class="alert alert-error auth-error-alert" role="alert">
          <strong>Can't reach the class server right now.</strong>
          <p class="alert-text">${
            navigator.onLine === false
              ? "You're offline. Reconnect to the internet, then try again."
              : 'It may be busy or your connection dropped. Wait a moment, then try again.'
          }</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-retry-login">Try again</button>
        </div>
      `;
      errorBox.querySelector('#btn-retry-login').addEventListener('click', () => formLogin.requestSubmit());
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });

  function triggerError(msg) {
    errorBox.innerHTML = `<div class="alert alert-error auth-error-alert" role="alert">${esc(msg)}</div>`;
    const card = container.querySelector('.auth-card');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    pinInput.value = '';
    updatePinDots('');
    pinInput.focus();
  }
}
