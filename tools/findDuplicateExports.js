#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);
let problems = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (exts.has(path.extname(e.name))) checkFile(p);
  }
}

function checkFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  // Naive, but effective: repeated named exports
  const exportMatches = [...src.matchAll(/export\s+(const|function|class|type|interface)\s+([A-Za-z0-9_]+)/g)];
  const names = {};
  for (const m of exportMatches) {
    const name = m[2];
    names[name] = (names[name] || 0) + 1;
  }
  for (const [k, v] of Object.entries(names)) {
    if (v > 1) problems.push(`${file}: duplicate export '${k}'`);
  }
}

walk(ROOT);
if (problems.length) {
  console.error('❌ Duplicate exports found:');
  for (const p of problems) console.error(p);
  process.exit(1);
} else {
  console.log('✅ No duplicate exports detected.');
}
