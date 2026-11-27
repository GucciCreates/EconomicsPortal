/**
 * EconomicsPortal — "Sign in with Google" (Google Identity Services, free).
 *
 * Google's script is only loaded when the class server has a client ID set
 * (Script Property GOOGLE_CLIENT_ID), so the sign-in page costs nothing extra
 * until the owner turns it on. The button hands us a signed ID token, which
 * the server checks with Google before trusting it.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_KEY = 'economics_portal_google_client_v1';

let gsiPromise = null;

/** Client ID from the last visit, so the button can appear before the server answers. */
export function cachedGoogleClientId() {
  try {
    return localStorage.getItem(CLIENT_KEY) || '';
  } catch (e) {
    return '';
  }
}

/** Remember (or forget, with '') the client ID the server sent. */
export function rememberGoogleClientId(id) {
  try {
    if (id) localStorage.setItem(CLIENT_KEY, id);
    else localStorage.removeItem(CLIENT_KEY);
  } catch (e) {
    /* ignore */
  }
}

function loadGsi() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(window.google);
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => (window.google && window.google.accounts ? resolve(window.google) : reject(new Error('Google sign-in did not load.')));
    script.onerror = () => {
      gsiPromise = null;
      reject(new Error('Google sign-in could not load.'));
    };
    document.head.appendChild(script);
  });
  return gsiPromise;
}

/**
 * Render Google's button into `host`. `onCredential(idToken)` runs after the
 * person picks an account. Resolves false if Google's script can't load.
 */
export async function renderGoogleButton(host, clientId, onCredential, { text = 'signin_with' } = {}) {
  if (!host || !clientId) return false;
  try {
    const google = await loadGsi();
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response && response.credential) onCredential(response.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
    });
    host.replaceChildren();
    google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text,
      logo_alignment: 'left',
      width: Math.max(200, Math.min(400, Math.round(host.getBoundingClientRect().width) || 320)),
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** Stop Google from offering automatic sign-in after someone logs out. */
export function disableGoogleAutoSelect() {
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) window.google.accounts.id.disableAutoSelect();
  } catch (e) {
    /* ignore */
  }
}
