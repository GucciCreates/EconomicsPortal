/**
 * Browser end-to-end tests (Playwright, Demo Mode, no server needed).
 *
 * For each role: log in, open every tab, do at least one write action,
 * confirm there are no console errors, and check that an announcement
 * containing HTML renders as plain text. Saves screenshots of each role's
 * dashboard at phone (390px) and desktop width to tests/e2e/screenshots/.
 *
 * Run: npm run test:e2e
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { openApp } = require('./harness');

const SHOTS = process.env.SCREENSHOT_DIR || path.join(__dirname, 'screenshots');
const XSS = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';

const ROLES = [
  {
    name: 'Shehroz',
    role: 'group_leader',
    async write(page) {
      await page.click('.tab-btn[data-tab="announcements"]');
      await page.fill('#ann-title', 'Heads up ' + XSS);
      await page.fill('#ann-body', 'Body ' + XSS);
      await page.click('#form-add-announcement button[type=submit]');
      await page.waitForSelector('.announcement-item:has-text("Heads up")');
    },
  },
  {
    name: 'Dr. Numan',
    role: 'instructor',
    async write(page) {
      await page.click('.tab-btn[data-tab="ledger"]');
      await page.selectOption('#gl-mark-member', 'Haseeb');
      await page.fill('#gl-mark-cycle', 'Unit 3: Trade');
      await page.fill('#gl-mark-quiz', '81');
      await page.click('#form-gl-add-mark button[type=submit]');
      await page.waitForSelector('#gl-marks-tbody td:has-text("Unit 3: Trade")');
    },
  },
  {
    name: 'Amina',
    role: 'team_leader',
    async write(page) {
      await page.click('.tab-btn[data-tab="noticeboard"]');
      await page.fill('#tm-body', 'Review call Thursday ' + XSS);
      await page.click('#btn-post-team-msg');
      await page.waitForSelector('.announcement-item:has-text("Review call Thursday")');
    },
  },
  {
    name: 'Ramesh',
    role: 'member',
    async write(page) {
      await page.click('.tab-btn[data-tab="doubts"]');
      await page.fill('#esc-topic', 'LM curve ' + XSS);
      await page.fill('#esc-details', 'Why does it slope upward?');
      await page.click('#btn-submit-esc');
      await page.waitForSelector('#my-doubts article:has-text("LM curve")');
    },
  },
];

async function login(page, name) {
  await page.click(`.quick-login-chip[data-demo-name="${name}"]`);
  await page.waitForSelector('.tab-nav');
}

async function logout(page) {
  await page.click('#btn-account-menu');
  await page.click('#btn-logout');
  await page.waitForSelector('#form-login');
}

test('every role can use every tab without errors, and HTML stays text', { timeout: 300000 }, async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { browser, page, errors } = await openApp();
  try {
    await page.evaluate(() => (window.__xss = 0));
    for (const r of ROLES) {
      await login(page, r.name);
      await r.write(page);
      await page.waitForTimeout(300);

      const tabs = await page.$$eval('.tab-btn', (b) => b.map((x) => x.dataset.tab));
      assert.ok(tabs.length >= 5, `${r.name} should have tabs`);
      for (const id of tabs) {
        await page.click(`.tab-btn[data-tab="${id}"]`);
        await page.waitForTimeout(150);
        const text = await page.textContent('main');
        assert.ok(!/Error connecting to API|Failed to load dashboard/.test(text), `${r.name}/${id} shows an error`);
      }

      if (tabs.includes('announcements')) {
        await page.click('.tab-btn[data-tab="announcements"]');
        const list = await page.textContent('main');
        assert.ok(list.includes('<img src=x onerror='), `${r.name}: the HTML announcement should render as text`);
        assert.equal(await page.$$eval('main .announcement-item img', (x) => x.length), 0);
      }

      await page.click(`.tab-btn[data-tab="${tabs[0]}"]`);
      await page.evaluate(() => window.scrollTo(0, 0));
      const slug = r.name.replace(/\W+/g, '-').toLowerCase();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: path.join(SHOTS, `${slug}-desktop.png`) });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      await page.evaluate(() => window.scrollTo(0, 0));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${r.name}: page scrolls sideways by ${overflow}px at 390px`);
      await page.screenshot({ path: path.join(SHOTS, `${slug}-phone.png`) });
      await page.setViewportSize({ width: 1280, height: 900 });

      await logout(page);
    }
    assert.equal(await page.evaluate(() => window.__xss), 0, 'an injected onerror handler ran');
    assert.deepEqual(errors, [], 'console errors');
  } finally {
    await browser.close();
  }
});

test('session handling: old sessions and bad tokens go back to login', { timeout: 120000 }, async () => {
  const { browser, page, errors } = await openApp();
  try {
    await page.evaluate(() =>
      localStorage.setItem('economics_portal_session_v1', JSON.stringify({ name: 'Shehroz', role: 'group_leader', team: 'Shehroz' })),
    );
    await page.reload();
    assert.ok(await page.isVisible('#form-login'), 'a pre-v4 session without a token is discarded');

    await login(page, 'Ramesh');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('economics_portal_session_v1'));
      s.token = 'demo.not-a-real-token';
      s.role = 'instructor';
      localStorage.setItem('economics_portal_session_v1', JSON.stringify(s));
    });
    await page.reload();
    await page.waitForSelector('#form-login');
    assert.match(await page.textContent('#login-error-box'), /session expired/i);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
