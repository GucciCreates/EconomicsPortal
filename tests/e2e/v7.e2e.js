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
