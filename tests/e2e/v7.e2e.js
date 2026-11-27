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
    await page.waitForSelector('.pin-reveal');
    await page.click('.modal-overlay [data-action="done"]');
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

test('F6: a student sees the top 5 and their own place, at phone width too', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await openApp({ demo: true, viewport: { width: 390, height: 844 } });
  try {
    await page.fill('#login-name', 'Danish'); // sample student near the bottom
    await page.fill('#login-pin', '2003');
    await page.click('#btn-submit-login');
    await page.click('.tab-btn[data-tab="leaderboard"]');
    await page.waitForSelector('.row-me');
    const rows = await page.$$eval('table.data-table tbody tr:not(.lb-gap)', (r) => r.length);
    assert.ok(rows <= 6, `${rows} students shown`);
    assert.ok(await page.$('.lb-gap'), 'a gap marks the students who are not shown');
    assert.match(await page.textContent('.row-me'), /Danish/);
    assert.match(await page.textContent('.card-note >> nth=1'), /top 5 and your place, out of \d+ students/);
    assert.doesNotMatch(await page.textContent('main'), /Iqra/, 'the lowest score is not shown to other students');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= 390), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('F13: deadline cards show the countdown once and the real date under it', { timeout: 60000 }, async () => {
  const { browser, page, errors } = await openApp({ demo: true });
  try {
    await page.click('.quick-login-chip[data-demo-name="Bilal"]');
    await page.waitForSelector('.deadline-item');
    const items = await page.$$eval('.deadline-item', (els) =>
      els.map((el) => ({ left: el.querySelector('.deadline-left').textContent.trim(), when: el.querySelector('.small').textContent.trim() })),
    );
    assert.ok(items.length > 0);
    for (const { left, when } of items) {
      assert.doesNotMatch(when, /\bin \d+ (day|hour|minute)|tomorrow|today/i, `"${when}" repeats "${left}"`);
      assert.match(when, /\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/, `"${when}" names the date`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('F14: on every tab of every role, heading levels never skip (h1 → h2 → h3)', { timeout: 180000 }, async () => {
  const { browser, page, errors } = await openApp({ demo: true });
  const skips = [];
  try {
    for (const who of ['Dr. Numan', 'Shehroz', 'Amina', 'Bilal']) {
      await page.click(`.quick-login-chip[data-demo-name="${who}"]`);
      await page.waitForSelector('.tab-nav');
      const tabs = await page.$$eval('.tab-btn', (b) => b.map((x) => x.dataset.tab));
      for (const tab of tabs) {
        await page.click(`.tab-btn[data-tab="${tab}"]`);
        await page.waitForTimeout(150);
        const levels = await page.$$eval('main h1, main h2, main h3, main h4, main h5, main h6', (hs) =>
          hs.filter((h) => h.offsetParent !== null || h.classList.contains('sr-only')).map((h) => [Number(h.tagName[1]), h.textContent.trim().slice(0, 30)]),
        );
        let prev = 0;
        for (const [lvl, text] of levels) {
          if (prev && lvl > prev + 1) skips.push(`${who}/${tab}: h${prev} → h${lvl} "${text}"`);
          prev = lvl;
        }
      }
      await page.click('#btn-account-menu');
      await page.click('#btn-logout');
      await page.waitForSelector('#form-login');
    }
    assert.deepEqual(skips, []);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('F17: the Demo Mode bar is inside a named landmark (screen readers can find and skip it)', { timeout: 60000 }, async () => {
  const { browser, page } = await openApp({ demo: true });
  try {
    await page.waitForSelector('.demo-banner');
    const inLandmark = await page.$eval('.demo-banner', (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const role = n.getAttribute('role');
        if (['banner', 'main', 'contentinfo', 'navigation', 'complementary'].includes(role)) return true;
        if (role === 'region' || n.tagName === 'SECTION') return Boolean(n.getAttribute('aria-label') || n.getAttribute('aria-labelledby'));
        if (['HEADER', 'MAIN', 'FOOTER', 'NAV', 'ASIDE'].includes(n.tagName)) return true;
      }
      return false;
    });
    assert.equal(inLandmark, true);
  } finally {
    await browser.close();
  }
});

// ── PIN reset (reported not working: old server code + 2-second dialog) ──

test('PIN reset: the new PIN stays on screen with Copy until Done, and works', { timeout: 60000 }, async () => {
  const { createBackend } = require('../gasFakes');
  const backend = createBackend();
  backend.api.setup();
  backend.api.setPinForUser('Shehroz', '246810');
  const { browser, page, errors } = await openApp({ demo: false, backend });
  try {
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    await page.click('#btn-submit-login');
    await page.click('.tab-btn[data-tab="admin"]');
    await page.click('#pins-tbody [data-action="reset"][data-name="Ramesh"]');
    await page.click('.modal-overlay [data-action="random"]');
    await page.click('#btn-save-pin');
    await page.waitForSelector('.pin-reset-done .pin-reveal');
    const shown = (await page.textContent('.pin-reveal')).replace(/\s/g, '');
    assert.match(shown, /^\d{6}$/);
    await page.waitForTimeout(3000);
    assert.ok(await page.isVisible('.pin-reveal'), 'still shown after 3 s: nothing disappears on its own');
    assert.ok(await page.isVisible('.modal-overlay [data-action="copy-pin"]'));
    await page.click('.modal-overlay [data-action="done"]');
    await page.waitForSelector('.modal-overlay', { state: 'detached' });
    assert.equal(backend.post({ action: 'login', name: 'Ramesh', pin: shown }).ok, true, 'the shown PIN signs in');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('PIN reset: leaders are told when the class server runs old code, and why a reset failed', { timeout: 60000 }, async () => {
  const { createBackend } = require('../gasFakes');
  const backend = createBackend();
  backend.api.setup();
  backend.api.setPinForUser('Shehroz', '246810');
  // Behave like the pre-v6 server: no version in replies, only 4-digit PINs.
  const old = (body) => {
    if (body.action === 'updatePin' && !/^\d{4}$/.test(String(body.newPin))) {
      return { ok: false, code: 'VALIDATION', error: 'PIN must be exactly 4 numeric digits.' };
    }
    const res = backend.post(body);
    if (res && res.data) delete res.data.serverVersion;
    return res;
  };
  const { browser, page } = await openApp({
    demo: false,
    apiHandler: (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(old(body)) }),
  });
  try {
    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '246810');
    await page.click('#btn-submit-login');
    await page.waitForSelector('.server-outdated');
    assert.match(await page.textContent('.server-outdated'), /old version|out of date/i);
    await page.click('.tab-btn[data-tab="admin"]');
    await page.click('#pins-tbody [data-action="reset"][data-name="Ramesh"]');
    await page.click('.modal-overlay [data-action="random"]');
    await page.click('#btn-save-pin');
    await page.waitForSelector('#pin-modal-feedback .alert-error');
    assert.match(await page.textContent('#pin-modal-feedback'), /Code\.gs|server.*old|update/i);
  } finally {
    await browser.close();
  }
});

test('Show PINs: the instructor sees PINs leaders set, and "Chosen by them" once a student picks their own', { timeout: 90000 }, async () => {
  const { browser, page, errors } = await openApp({ demo: true });
  const pinOf = (name) => page.textContent(`#pins-tbody tr[data-member="${name}"] td[data-label="PIN"]`).then((t) => t.trim());
  const openPins = async () => {
    await page.click('.tab-btn[data-tab="admin"]');
    await page.waitForSelector('#pins-tbody [data-action="reset"][data-name="Bilal"]');
    await page.click('#btn-show-pins');
    await page.waitForSelector('#btn-show-pins[aria-pressed="true"]');
  };
  const signOut = async () => {
    await page.click('#btn-account-menu');
    await page.click('#btn-logout');
  };
  try {
    await page.click('.quick-login-chip[data-demo-name="Dr. Numan"]');
    await openPins();
    assert.equal(await pinOf('Bilal'), '2002');

    // A reset while PINs are shown updates the row.
    await page.click('#pins-tbody [data-action="reset"][data-name="Bilal"]');
    await page.fill('#input-new-pin', '5317');
    await page.click('#btn-save-pin');
    await page.click('.modal-overlay [data-action="done"]');
    assert.equal(await pinOf('Bilal'), '5317');
    await page.click('#btn-show-pins');
    assert.equal(await pinOf('Bilal'), 'Set');
    await signOut();

    // Bilal chooses his own PIN.
    await page.fill('#login-name', 'Bilal');
    await page.fill('#login-pin', '5317');
    await page.click('#btn-submit-login');
    await page.click('#btn-account-menu');
    await page.click('#btn-change-my-pin');
    await page.fill('#my-pin-current', '5317');
    await page.fill('#my-pin-new', '8642');
    await page.fill('#my-pin-confirm', '8642');
    await page.click('#btn-save-my-pin');
    await page.waitForSelector('#form-change-my-pin', { state: 'detached' });
    assert.equal(await page.$('.tab-btn[data-tab="admin"]'), null);
    await signOut();

    await page.fill('#login-name', 'Shehroz');
    await page.fill('#login-pin', '111222');
    await page.click('#btn-submit-login');
    await openPins();
    assert.equal(await pinOf('Bilal'), 'Chosen by them');
    assert.equal(await pinOf('Amina'), '2101');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
