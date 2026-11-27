/**
 * EconomicsPortal — Static build: syncs the app into /docs for GitHub Pages.
 *
 * Copies the files and folders listed below into docs/ and deletes anything
 * in docs/ that no longer exists in the source, so removed files never linger
 * on the live site. docs/.nojekyll is always kept.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DOCS = path.join(ROOT, 'docs');

// Everything the live site needs. Add new top-level files/folders here.
const ENTRIES = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];
const KEEP = new Set(['.nojekyll']);

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p)];
  });
}

function removeEmptyDirs(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    removeEmptyDirs(p);
    if (fs.readdirSync(p).length === 0) fs.rmdirSync(p);
  }
}

console.log('Building EconomicsPortal for GitHub Pages (/docs)...');
fs.mkdirSync(DOCS, { recursive: true });

const wanted = new Set();
for (const entry of ENTRIES) {
  const src = path.join(ROOT, entry);
  if (!fs.existsSync(src)) continue;
  const files = fs.statSync(src).isDirectory() ? listFiles(src).map((f) => path.join(entry, f)) : [entry];
  for (const rel of files) {
    const dest = path.join(DOCS, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(ROOT, rel), dest);
    wanted.add(rel);
  }
}

let removed = 0;
for (const rel of listFiles(DOCS)) {
  if (wanted.has(rel) || KEEP.has(rel)) continue;
  fs.unlinkSync(path.join(DOCS, rel));
  console.log(`  removed stale docs/${rel}`);
  removed++;
}
removeEmptyDirs(DOCS);

console.log(`✓ Build complete: ${wanted.size} files synced, ${removed} stale file(s) removed.`);
