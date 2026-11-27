/**
 * Live health check (AUDIT_v7 F10). Run daily by .github/workflows/health.yml.
 *
 * 1. Calls the public `health` action of the live Apps Script server.
 * 2. Loads the live sign-in page in Chromium and waits for the form.
 *
 * Never signs in and never reads or writes class data. Exits 1 with a short
 * report on stdout if anything is wrong.
 *
 *   node scripts/health-check.js [siteUrl]
 */
const fs = require('fs');
const path = require('path');

const SITE = process.argv[2] || 'https://guccicreates.github.io/EconomicsPortal/';
const config = fs.readFileSync(path.join(__dirname, '..', 'js', 'config.js'), 'utf8');
const API_URL = (/export const API_URL = "([^"]+)"/.exec(config) || [])[1];

async function checkServer() {
  if (!API_URL) return 'API_URL not found in js/config.js';
  const started = Date.now();
  try {
    const res = await fetch(`${API_URL}?action=health`, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      return `server replied with non-JSON (HTTP ${res.status}): ${text.replace(/\s+/g, ' ').slice(0, 160)}`;
    }
    if (!body.ok) return `server said not ok: ${JSON.stringify(body).slice(0, 200)}`;
    console.log(`server ok: version ${body.version}, ${Date.now() - started} ms`);
    return null;
  } catch (err) {
    return `server unreachable after ${Date.now() - started} ms: ${err.message}`;
  }
}

async function checkSite() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    return 'playwright is not installed (npm install --no-save playwright)';
  }
  const browser = await chromium.launch();
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const started = Date.now();
    const res = await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!res || !res.ok()) return `site returned HTTP ${res ? res.status() : 'no response'}`;
    await page.waitForSelector('#form-login', { timeout: 30000 });
    if (errors.length) return `site loaded but threw errors: ${errors.join(' | ').slice(0, 300)}`;
    console.log(`site ok: sign-in form shown in ${Date.now() - started} ms`);
    return null;
  } catch (err) {
    return `site check failed: ${err.message.split('\n')[0]}`;
  } finally {
    await browser.close();
  }
}

(async () => {
  const problems = [await checkServer(), await checkSite()].filter(Boolean);
  if (problems.length) {
    console.log(problems.map((p) => `- ${p}`).join('\n'));
    process.exit(1);
  }
})();
