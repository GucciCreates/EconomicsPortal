/**
 * Runs `node --check` on every JavaScript file under js/ (and the build/test scripts).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.js') ? [p] : [];
  });
}

const files = [...walk(path.join(ROOT, 'js')), path.join(ROOT, 'build.js'), path.join(ROOT, 'sw.js')].filter(fs.existsSync);
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`✗ ${path.relative(ROOT, file)}\n${err.stderr}`);
  }
}
if (failed) {
  console.error(`${failed} file(s) failed the syntax check.`);
  process.exit(1);
}
console.log(`✓ Syntax check passed for ${files.length} files.`);
