/**
 * EconomicsPortal — Configuration
 *
 * API_URL is the Google Apps Script web app.
 *
 * Demo Mode (sample data, nothing saved) only starts from a link with
 * `?demo=1`, and it lasts for this browser tab only (sessionStorage), so the
 * live portal is never silently swapped for the demo.
 */
/** The site needs backend/Code.gs at least this new (its SCHEMA_VERSION). */
export const REQUIRED_SERVER_VERSION = 8;

export const API_URL = "https://script.google.com/macros/s/AKfycbzvSmJSbA03qG2fL5wGR0AVJyTAnHJsVWEcqEwOrFKqFAv6glbgMjfEtVK-K1iTupsp/exec";

const DEMO_KEY = "economics_portal_demo";

(function readDemoParam() {
  try {
    // Older versions remembered demo mode forever; forget that.
    localStorage.removeItem("economics_portal_force_demo");
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "1") sessionStorage.setItem(DEMO_KEY, "1");
    if (params.get("demo") === "0") sessionStorage.removeItem(DEMO_KEY);
  } catch (e) {
    /* storage unavailable */
  }
})();

const hasLiveApi = () => Boolean(API_URL) && !API_URL.includes("PASTE_YOUR_APPS_SCRIPT_URL_HERE");

/** True when this tab is running the demo (or no live backend is configured). */
export const isDemoMode = () => {
  if (!hasLiveApi()) return true;
  try {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch (e) {
    return false;
  }
};

/** Leave the demo and reload the live portal. */
export function exitDemo() {
  try {
    sessionStorage.removeItem(DEMO_KEY);
  } catch (e) {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.delete("demo");
  location.href = url.toString();
}

/** Link that opens the demo in this tab. */
export function demoUrl() {
  const url = new URL(location.href);
  url.searchParams.set("demo", "1");
  return url.toString();
}
