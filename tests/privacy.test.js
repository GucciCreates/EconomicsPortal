/**
 * Privacy: what the public site ships must not put real students' names on
 * made-up data. Demo Mode uses a fictional class (AUDIT_v7 F1), and the
 * live roster comes only from the server (F3).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Students in the real class (from the seed roster in backend/Code.gs).
function realStudents() {
  const gs = fs.readFileSync(path.join(ROOT, 'backend', 'Code.gs'), 'utf8');
  return [...gs.matchAll(/^\s*\["([^"]+)",\s*"member",/gm)].map((m) => m[1]);
}

function shippedJs() {
  const out = [];
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === 'vendor' ? null : walk(p);
      if (p.endsWith('.js')) out.push(p);
    });
  walk(path.join(ROOT, 'js'));
  return out;
}

test('the seed roster is readable (guards the test itself)', () => {
  assert.ok(realStudents().length >= 10, 'expected the real student list from Code.gs');
});

test('no shipped JavaScript names a real student', () => {
  const names = realStudents();
  const hits = [];
  for (const file of shippedJs()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const n of names) {
      if (new RegExp(`\\b${n.replace(/[()]/g, '\\$&')}\\b`).test(src)) hits.push(`${path.relative(ROOT, file)}: ${n}`);
    }
  }
  assert.deepEqual(hits, []);
});
