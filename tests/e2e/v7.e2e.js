/**
 * v7 browser tests: fixes from AUDIT_v7.md.
 * Run: npm run test:e2e
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('./harness');

test('F2: Demo Mode refuses a PIN that was published in the first README, like the server', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await openApp({ demo: true });
  try {
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '1111');
    await page.click('#btn-submit-login');
    await page.waitForSelector('#login-error-box [role="alert"]');
    assert.match(await page.textContent('#login-error-box'), /published online/);
    // The demo's own shortcut still works with its new PIN.
    await page.click('.quick-login-chip[data-demo-name="Shehroz"]');
    await page.waitForSelector('.tab-nav');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

const json = (route, obj) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj) });

test('F4: a server that never answers gets a clear message and Try again, not an endless spinner', { timeout: 60000 }, async () => {
  let hang = true;
  const { browser, page } = await openApp({
    demo: false,
    apiTimeoutMs: 1500,
    apiHandler: (route, body) => {
      if (body.action === 'names') return json(route, { ok: true, names: [] });
      if (hang) return new Promise(() => {}); // never answers
      return json(route, { ok: false, code: 'LOGIN_FAILED', error: "That name and PIN don't match." });
    },
  });
  try {
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    const t0 = Date.now();
    await page.click('#btn-submit-login');
    await page.waitForSelector('#btn-retry-login', { timeout: 6000 });
    assert.ok(Date.now() - t0 < 5000, 'gives up after the time limit');
    assert.match(await page.textContent('#login-error-box'), /taking too long/i);
    assert.equal((await page.textContent('#btn-submit-login')).trim(), 'Sign in', 'button is usable again');
    hang = false;
    await page.click('#btn-retry-login');
    await page.waitForSelector('#login-error-box .auth-error-alert:has-text("don\'t match")');
  } finally {
    await browser.close();
  }
});

test('F5: a Google quota page instead of data is explained as such', { timeout: 60000 }, async () => {
  const { browser, page } = await openApp({
    demo: false,
    apiHandler: (route, body) =>
      body.action === 'names'
        ? json(route, { ok: true, names: [] })
        : route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Service invoked too many times for one day: urlfetch.</body></html>' }),
  });
  try {
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    await page.click('#btn-submit-login');
    await page.waitForSelector('#btn-retry-login');
    const text = await page.textContent('#login-error-box');
    assert.match(text, /daily limit/i);
    assert.doesNotMatch(text, /connection/i);
  } finally {
    await browser.close();
  }
});

test('F7: the instructor can reset a PIN from Admin (Demo Mode, same rule as the server)', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await openApp({ demo: true });
  try {
    await page.click('.quick-login-chip[data-demo-name="Dr. Numan"]');
    await page.click('.tab-btn[data-tab="admin"]');
    await page.waitForSelector('#pins-tbody [data-action="reset"][data-name="Bilal"]');
    await page.click('#pins-tbody [data-action="reset"][data-name="Bilal"]');
    await page.fill('#input-new-pin', '5317');
    await page.click('#btn-save-pin');
    await page.waitForSelector('#pin-modal-feedback .alert-success');
    await page.waitForSelector('.modal-overlay', { state: 'detached' });
    await page.click('#btn-account-menu');
    await page.click('#btn-logout');
    await page.fill('#login-name', 'Bilal');
    await page.fill('#login-pin', '5317');
    await page.click('#btn-submit-login');
    await page.waitForSelector('.tab-nav');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
