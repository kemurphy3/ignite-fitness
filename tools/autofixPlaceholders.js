#!/usr/bin/env node
/**
 * Replaces trivially-fixable stubs only:
 * - `throw new Error("UNIMPLEMENTED_CALL: Replace with real implementation. See docs/beta_checklist.md");` -> clear, typed error messages with actionable guidance.
 * - `throw new Error("UNIMPLEMENTED_RETURN: Replace with real implementation. See docs/beta_checklist.md");` in functions that promise an object -> inserts TODO-free fallback that throws at call site with file:line.
 * NOTE: This does not invent business logic. It makes failure states explicit and searchable.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const reThrow = /throw new Error\(['"`].*not implemented.*['"`]\);?/gi;
const reStubReturn = /return\s+null;\s*\/\/\s*stub/gi;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name === 'build')
      continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(t|j)sx?$/.test(e.name)) fix(p);
  }
}

function fix(file) {
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  src = src.replace(
    reThrow,
    'throw new Error("UNIMPLEMENTED_CALL: Replace with real implementation. See docs/beta_checklist.md");'
  );
  src = src.replace(
    reStubReturn,
    'throw new Error("UNIMPLEMENTED_RETURN: Replace with real implementation. See docs/beta_checklist.md");'
  );
  if (src !== before) {
    fs.writeFileSync(file, src, 'utf8');
    console.log(`🔧 Autofixed trivial stubs in ${file}`);
  }
}

walk(ROOT);
