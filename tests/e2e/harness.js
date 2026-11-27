/**
 * Loads the app in Playwright without a web server: requests to
 * http://portal.test/ are answered from the repository (or docs/) on disk.
 * The live Apps Script URL is never contacted — tests force Demo Mode.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const ORIGIN = 'http://portal.test';

/**
 * @param {object} [opts]
 * @param {boolean} [opts.demo=true] - start in Demo Mode (sessionStorage flag)
 * @param {object} [opts.backend] - a createBackend() from ../gasFakes: requests
 *   to the Apps Script URL are answered by backend/Code.gs running in Node.
 *   `opts.latency` (ms) is added to each such request.
 */
async function openApp({ root = path.join(__dirname, '..', '..'), viewport = { width: 1280, height: 900 }, demo = true, backend = null, latency = 0 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport });
  const errors = [];
  const apiCalls = [];
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      if (/script\.google\.com/.test(url.host)) {
        if (!backend) return route.abort();
        const body = JSON.parse(route.request().postData() || '{}');
        apiCalls.push(body.action);
        if (latency) await new Promise((r) => setTimeout(r, latency));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(backend.post(body)) });
      }
      // Fonts: let them load if reachable, otherwise ignore.
      return route.continue().catch(() => route.abort());
    }
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  if (demo) await context.addInitScript(() => sessionStorage.setItem('economics_portal_demo', '1'));
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${ORIGIN}/index.html`);
  return { browser, context, page, errors, apiCalls, ORIGIN };
}

module.exports = { openApp, ORIGIN };
