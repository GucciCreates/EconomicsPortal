/**
 * PWA checks: the service worker's app-shell list matches the files on disk,
 * it never handles API (cross-origin) or non-GET requests, and its cache
 * version matches the cache-busting version in index.html.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

function loadSw() {
  const listeners = {};
  const self = {
    location: { origin: 'https://guccicreates.github.io' },
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const ctx = { self, URL, Response: class {}, caches: {}, fetch: () => {}, Promise, console };
  vm.createContext(ctx);
  const exported = vm.runInContext(`${swSource}\n;({ APP_SHELL, CACHE_VERSION, shouldHandle })`, ctx);
  return { ...exported, listeners };
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

test('every app-shell entry exists, and every JS module is in the shell', () => {
  const { APP_SHELL } = loadSw();
  const shell = new Set(APP_SHELL.map((p) => p.replace(/^\.\//, '')));
  for (const entry of shell) {
    if (entry === '') continue;
    assert.ok(fs.existsSync(path.join(ROOT, entry)), `missing file for shell entry ${entry}`);
  }
  const jsFiles = walk(path.join(ROOT, 'js')).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
  for (const f of jsFiles) assert.ok(shell.has(f), `${f} is not in the service worker APP_SHELL`);
  for (const f of ['index.html', 'css/style.css', 'manifest.webmanifest']) assert.ok(shell.has(f));
});

test('manifest icons exist and are cached', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const { APP_SHELL } = loadSw();
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(ROOT, icon.src)), icon.src);
    assert.ok(APP_SHELL.includes('./' + icon.src), `${icon.src} not cached`);
  }
});

test('the service worker never handles API, cross-origin or non-GET requests', () => {
  const { shouldHandle } = loadSw();
  const req = (url, method = 'GET') => ({ url, method });
  assert.equal(shouldHandle(req('https://script.google.com/macros/s/abc/exec')), false);
  assert.equal(shouldHandle(req('https://script.google.com/macros/s/abc/exec', 'POST')), false);
  assert.equal(shouldHandle(req('https://fonts.googleapis.com/css2?family=x')), false);
  assert.equal(shouldHandle(req('https://guccicreates.github.io/EconomicsPortal/js/app.js?v=4.1.0', 'POST')), false);
  assert.equal(shouldHandle(req('https://guccicreates.github.io/EconomicsPortal/js/app.js?v=4.1.0')), true);
});

test('cache version matches the index.html cache-busting version', () => {
  const { CACHE_VERSION } = loadSw();
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const versions = [...html.matchAll(/\?v=([\d.]+)/g)].map((m) => m[1]);
  assert.ok(versions.length >= 2);
  versions.forEach((v) => assert.equal(`v${v}`, CACHE_VERSION));
});

test('build.js publishes everything the shell needs', () => {
  const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  for (const entry of ['index.html', 'manifest.webmanifest', 'sw.js', "'css'", "'js'", "'icons'"]) {
    assert.ok(build.includes(entry.startsWith("'") ? entry : `'${entry}'`), `build.js does not publish ${entry}`);
  }
});
