/**
 * EconomicsPortal — Static Build & Sync Script
 * Syncs source files to /docs folder for direct GitHub Pages deployment from main branch.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DOCS = path.join(ROOT, "docs");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("Building EconomicsPortal for GitHub Pages (/docs)...");

// Copy index.html
fs.copyFileSync(path.join(ROOT, "index.html"), path.join(DOCS, "index.html"));

// Copy css & js directories
copyDirRecursive(path.join(ROOT, "css"), path.join(DOCS, "css"));
copyDirRecursive(path.join(ROOT, "js"), path.join(DOCS, "js"));

console.log("✓ Build complete! /docs is updated and ready for GitHub Pages.");
