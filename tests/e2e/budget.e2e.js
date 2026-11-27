/**
 * Performance budget (AUDIT_v7 F12). Fails if the sign-in page grows more
 * than 10 % past tests/budget.json, or if signing in / saving takes more
 * than one request to the class server.
 *
 * To accept a deliberate increase: run `npm run budget:update` and commit
 * tests/budget.json with a note saying why.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { openApp } = require('./harness');
const { createBackend } = require('../gasFakes');

const BUDGET_FILE = path.join(__dirname, '..', 'budget.json');
const UPDATE = process.env.UPDATE_BUDGET === '1';
const SLACK = 1.1;

async function measureSignInPage() {
  const { browser, context, page } = await openApp({ demo: false, backend: (() => { const b = createBackend(); b.api.setup(); return b; })() });
  const files = new Map();
  context.on('requestfinished', async (req) => {
    const url = new URL(req.url());
    if (url.origin !== 'http://portal.test') return;
    const res = await req.response();
    const body = res ? await res.body().catch(() => Buffer.alloc(0)) : Buffer.alloc(0);
    files.set(url.pathname, body.length);
  });
  try {
    await page.reload();
    await page.waitForSelector('#form-login');
    await page.waitForLoadState('networkidle');
    const bytes = [...files.values()].reduce((a, b) => a + b, 0);
    return { requests: files.size, bytes };
  } finally {
    await browser.close();
  }
}

test('sign-in page stays within its size and request budget', { timeout: 60000 }, async () => {
  const now = await measureSignInPage();
  if (UPDATE) {
    fs.writeFileSync(BUDGET_FILE, JSON.stringify({ signInPage: now, measured: 'uncompressed bytes of this site\'s own files' }, null, 2) + '\n');
    return;
  }
  const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')).signInPage;
  assert.ok(now.bytes <= budget.bytes * SLACK, `sign-in page is ${now.bytes} bytes; budget ${budget.bytes} (+10%)`);
  assert.ok(now.requests <= Math.ceil(budget.requests * SLACK), `sign-in page makes ${now.requests} requests; budget ${budget.requests} (+10%)`);
});

test('signing in and saving each take exactly one request to the class server', { timeout: 60000 }, async () => {
  const backend = createBackend();
  backend.api.setup();
  backend.api.setPinForUser('Shehroz', '246810');
  const { browser, page, apiCalls } = await openApp({ demo: false, backend });
  try {
    await page.waitForSelector('#form-login');
    await page.waitForLoadState('networkidle');
    apiCalls.length = 0;
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    await page.click('#btn-submit-login');
    await page.waitForSelector('.kpi-grid .kpi-val');
    await page.waitForTimeout(300);
    assert.deepEqual(apiCalls, ['login']);
    apiCalls.length = 0;
    await page.click('.tab-btn[data-tab="updates"]');
    await page.fill('#ann-title', 'Budget');
    await page.fill('#ann-body', 'One request');
    await page.click('#form-add-announcement button[type=submit]');
    await page.waitForSelector('.announcement-item:has-text("Budget")');
    await page.waitForTimeout(300);
    assert.deepEqual(apiCalls, ['addAnnouncement']);
  } finally {
    await browser.close();
  }
});
