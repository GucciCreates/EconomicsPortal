/**
 * v6 browser tests: one-request sign-in and writes against the real
 * backend/Code.gs (run in Node), Demo Mode isolation, and every tab of every
 * role at phone width.
 *
 * Run: npm run test:e2e
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { openApp } = require('./harness');
const { createBackend } = require('../gasFakes');

function liveBackend() {
  const b = createBackend();
  b.api.setup();
  b.api.setPinForUser('Shehroz', '246810');
  b.api.setPinForUser('Ramesh', '1357');
  return b;
}

test('signing in and saving each take one request to the server', { timeout: 120000 }, async () => {
  const backend = liveBackend();
  const { browser, page, errors, apiCalls } = await openApp({ demo: false, backend });
  try {
    await page.waitForSelector('#form-login');
    assert.equal(await page.$$eval('.quick-login-chip', (x) => x.length), 0, 'no demo shortcuts on the live site');
    // The name field suggests first names from the public `names` action.
    await page.waitForFunction(() => document.querySelectorAll('#login-name-options option').length > 10);

    apiCalls.length = 0;
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    await page.click('#btn-submit-login');
    await page.waitForSelector('.kpi-grid .kpi-val');
    assert.deepEqual(apiCalls, ['login'], 'sign-in renders the dashboard that came back with login');
    assert.ok(!(await page.$('.pin-offer')), 'a 6-digit PIN gets no "choose a longer PIN" note');

    apiCalls.length = 0;
    await page.click('.tab-btn[data-tab="updates"]');
    await page.fill('#ann-title', 'One request');
    await page.fill('#ann-body', 'Saved and shown with a single call');
    await page.click('#form-add-announcement button[type=submit]');
    await page.waitForSelector('.announcement-item:has-text("One request")');
    assert.deepEqual(apiCalls, ['addAnnouncement'], 'a write returns the new dashboard');

    // Reloading shows the last dashboard at once, then refreshes it behind.
    apiCalls.length = 0;
    await page.reload();
    await page.waitForSelector('.announcement-item:has-text("One request")');
    await page.waitForTimeout(300);
    assert.deepEqual(apiCalls.filter((a) => a !== 'names'), ['dashboard']);
    assert.match(await page.textContent('#sync-status'), /Synced/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('first-name sign-in offers "Did you mean"; short PINs get a one-time note', { timeout: 120000 }, async () => {
  const backend = liveBackend();
  backend.api.setPinForUser('Ayesha (Quetta)', '3001');
  const { browser, page, errors } = await openApp({ demo: false, backend });
  try {
    await page.fill('#login-name', 'ayesha');
    await page.fill('#login-pin', '3001');
    await page.click('#btn-submit-login');
    await page.waitForSelector('#btn-use-suggestion');
    assert.match(await page.textContent('#login-error-box'), /Did you mean Ayesha \(Quetta\)\?/);
    await page.click('#btn-use-suggestion');
    await page.waitForSelector('.tab-nav');
    assert.ok(await page.isVisible('.pin-offer'), 'a 4-digit PIN gets the note');
    await page.click('[data-pin-offer="later"]');
    await page.click('#btn-account-menu');
    await page.click('#btn-logout');
    await page.fill('#login-name', 'Ayesha (Quetta)');
    await page.fill('#login-pin', '3001');
    await page.click('#btn-submit-login');
    await page.waitForSelector('.tab-nav');
    assert.ok(!(await page.$('.pin-offer')), 'shown only once');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('when the server is unreachable, sign-in offers Try again, not Demo Mode', { timeout: 60000 }, async () => {
  const { browser, page } = await openApp({ demo: false }); // no backend: requests fail
  try {
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    await page.click('#btn-submit-login');
    await page.waitForSelector('#btn-retry-login');
    const text = await page.textContent('#login-error-box');
    assert.match(text, /Can't reach the class server/);
    assert.doesNotMatch(text, /demo/i);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('economics_portal_demo')), null);
    assert.equal(await page.evaluate(() => localStorage.getItem('economics_portal_force_demo')), null);
  } finally {
    await browser.close();
  }
});

test('Demo Mode starts only from ?demo=1, lasts one tab, and is clearly marked', { timeout: 60000 }, async () => {
  const { browser, context, page } = await openApp({ demo: false });
  try {
    assert.ok(!(await page.$('.demo-banner')), 'the live site shows no demo bar');
    await page.goto('http://portal.test/index.html?demo=1');
    await page.waitForSelector('.demo-banner');
    assert.match(await page.textContent('.demo-banner'), /Nothing you do here is saved/);
    await page.click('.quick-login-chip[data-demo-name="Ramesh"]');
    await page.waitForSelector('.tab-nav');
    assert.equal(await page.evaluate(() => localStorage.getItem('economics_portal_session_v1')), null, 'demo session is not in localStorage');
    assert.ok(!(await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('demo_db')))), 'demo data is not in localStorage');

    await page.click('#btn-print-my-report');
    await page.waitForSelector('.report-sheet.is-sample');
    await page.click('#btn-close-report');

    const other = await context.newPage();
    await other.goto('http://portal.test/index.html');
    await other.waitForSelector('#form-login');
    assert.ok(!(await other.$('.demo-banner')), 'a new tab opens the live portal');
    await other.close();

    await page.click('#btn-exit-demo');
    await page.waitForSelector('#form-login');
    assert.ok(!(await page.$('.demo-banner')));
  } finally {
    await browser.close();
  }
});

test('every tab of every role fits a 390px phone screen', { timeout: 240000 }, async () => {
  const { browser, page, errors } = await openApp({ viewport: { width: 390, height: 844 } });
  try {
    for (const who of ['Shehroz', 'Dr. Numan', 'Amina', 'Ramesh']) {
      await page.click(`.quick-login-chip[data-demo-name="${who}"]`);
      await page.waitForSelector('.tab-nav');
      const tabs = await page.$$eval('.tab-btn', (b) => b.map((x) => x.dataset.tab));
      assert.ok(tabs.length <= 6, `${who} has ${tabs.length} tabs`);
      for (const id of tabs) {
        await page.click(`.tab-btn[data-tab="${id}"]`);
        await page.waitForTimeout(150);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(over <= 1, `${who}/${id} scrolls sideways by ${over}px`);
      }
      await page.click('#btn-account-menu');
      await page.click('#btn-logout');
      await page.waitForSelector('#form-login');
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('Google sign-in: link once after a PIN sign-in, then one tap and one request', { timeout: 120000 }, async () => {
  const backend = liveBackend();
  const CLIENT = '123-e2e.apps.googleusercontent.com';
  backend.props.GOOGLE_CLIENT_ID = CLIENT;
  const credential = 'h.ramesh-e2e.s';
  backend.google.tokens[credential] = {
    iss: 'accounts.google.com',
    aud: CLIENT,
    email: 'ramesh@gmail.com',
    email_verified: true,
    exp: String(Math.floor(Date.now() / 1000) + 3600),
  };
  const { browser, page, errors, apiCalls } = await openApp({ demo: false, backend, fakeGoogle: true, viewport: { width: 390, height: 844 } });
  try {
    await page.waitForSelector('#google-signin:not([hidden]) .fake-gsi-button');
    await page.evaluate((c) => (window.__fakeCredential = c), credential);

    // Not linked yet: a clear message, and the PIN form still works.
    await page.click('.fake-gsi-button');
    // Wait for the answer (role=alert), not the "Signing in…" status line.
    await page.waitForSelector('#login-error-box [role="alert"]');
    assert.match(await page.textContent('#login-error-box'), /isn't linked to anyone/);

    await page.fill('#login-name', 'Ramesh');
    await page.fill('#login-pin', '1357');
    await page.click('#btn-submit-login');
    await page.waitForSelector('.tab-nav');
    // A 4-digit PIN shows the PIN note first; link from the account menu instead.
    await page.click('#btn-account-menu');
    await page.click('#btn-google-link');
    await page.waitForSelector('#google-link-host .fake-gsi-button');
    await page.click('#google-link-host .fake-gsi-button');
    await page.waitForSelector('.toast:has-text("Next time, sign in with Google")');

    await page.click('#btn-account-menu');
    await page.click('#btn-logout');
    await page.waitForSelector('#google-signin:not([hidden]) .fake-gsi-button');
    await page.evaluate((c) => (window.__fakeCredential = c), credential);
    apiCalls.length = 0;
    await page.click('.fake-gsi-button');
    await page.waitForSelector('.tab-nav');
    assert.deepEqual(apiCalls.filter((a) => a !== 'names'), ['googleLogin'], 'one request signs in and loads the dashboard');
    assert.match(await page.textContent('#btn-account-menu'), /Ramesh/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true, 'no sideways scroll at 390 px');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('the Google button stays hidden in Demo Mode and when the server has no client ID', { timeout: 60000 }, async () => {
  const backend = liveBackend();
  const live = await openApp({ demo: false, backend, fakeGoogle: true });
  try {
    await live.page.waitForFunction(() => document.querySelectorAll('#login-name-options option').length > 10);
    assert.equal(await live.page.isVisible('#google-signin'), false);
  } finally {
    await live.browser.close();
  }
  const demo = await openApp({ demo: true, fakeGoogle: true });
  try {
    await demo.page.waitForSelector('.quick-login-chip');
    await demo.page.waitForTimeout(300);
    assert.equal(await demo.page.isVisible('#google-signin'), false);
  } finally {
    await demo.browser.close();
  }
});

test('the sign-in chart animates a demand shift, and stays still for reduced motion', { timeout: 60000 }, async () => {
  const { browser, context, page, errors } = await openApp({ demo: true });
  try {
    await page.waitForSelector('.auth-figure .eq-dot');
    const read = () =>
      page.evaluate(() => {
        const dot = document.querySelector('.auth-figure .eq-dot');
        const s = document.querySelector('.auth-figure .curve-s');
        const x = Number(dot.getAttribute('cx'));
        const y = Number(dot.getAttribute('cy'));
        // Distance from the dot to the supply curve: the dot must stay on it.
        let best = Infinity;
        const len = s.getTotalLength();
        for (let i = 0; i <= 400; i++) {
          const p = s.getPointAtLength((len * i) / 400);
          best = Math.min(best, Math.hypot(p.x - x, p.y - y));
        }
        return { x, y, off: best, shift: document.querySelector('.auth-figure .curve-d').getAttribute('transform') || '' };
      });
    await page.waitForTimeout(4600); // draw-in + hold + most of the first shift
    const moved = await read();
    assert.ok(moved.x > 220, `equilibrium moved right with demand (x=${moved.x})`);
    assert.ok(moved.off < 1.5, `dot stays on the supply curve (off by ${moved.off.toFixed(2)})`);
    assert.match(moved.shift, /translate\(\d/);
    assert.deepEqual(errors, []);

    const still = await context.newPage();
    await still.emulateMedia({ reducedMotion: 'reduce' });
    await still.goto('http://portal.test/index.html');
    await still.waitForSelector('.auth-figure .eq-dot');
    await still.waitForTimeout(4600);
    assert.equal(await still.getAttribute('.auth-figure .eq-dot', 'cx'), '216.03');
    assert.equal(await still.getAttribute('.auth-figure .curve-d', 'transform'), 'translate(0.00 0)');
  } finally {
    await browser.close();
  }
});
