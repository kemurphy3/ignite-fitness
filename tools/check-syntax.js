#!/usr/bin/env node

/**
 * JavaScript Syntax Checker
 * Proactively detects common JavaScript syntax errors:
 * - await outside async functions
 * - duplicate const/let declarations
 * - missing async keywords
 * - other common syntax issues
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// File extensions to check
const JS_EXTENSIONS = ['.js', '.mjs'];

// Simplified - check functions are defined inline

let errors = [];
let warnings = [];
let fileCount = 0;

/**
 * Check a single file
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    fileCount++;

    // Check for await outside async
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (/^\s*await\s+/.test(line)) {
        // Check context - simple check for async keyword in preceding lines
        const beforeLine = content.substring(0, content.indexOf(line));
        const linesBefore = beforeLine.split('\n').slice(-20); // Check last 20 lines

        let foundAsync = false;
        let braceLevel = 0;

        // Walk backwards to find function declaration
        for (let i = linesBefore.length - 1; i >= 0; i--) {
          const currentLine = linesBefore[i];

          // Count braces
          braceLevel += (currentLine.match(/{/g) || []).length;
          braceLevel -= (currentLine.match(/}/g) || []).length;

          // Check for async function
          if (/async\s+(?:function|\(|[\w]+)/.test(currentLine)) {
            foundAsync = true;
            break;
          }

          // Check for regular function (not async)
          if (/function\s+\w+|^\s*[\w]+\s*\([^)]*\)\s*=>|^\s*\([^)]*\)\s*=>/.test(currentLine)) {
            if (braceLevel <= 0) {
              break; // We're outside any function
            }
          }
        }

        if (!foundAsync) {
          errors.push({
            file: filePath.replace(projectRoot, ''),
            line: index + 1,
            issue: 'await outside async function',
            code: line.trim(),
            suggestion: 'Add async keyword to containing function',
          });
        }
      }
    });

    // Check for duplicate const/let declarations at top level
    const topLevelConsts = new Set();
    const topLevelLets = new Set();

    // Simple pattern - find const/let at start of lines (likely top-level)
    lines.forEach((line, index) => {
      const constMatch = line.match(/^const\s+(\w+)\s*=/);
      if (constMatch) {
        const varName = constMatch[1];
        if (topLevelConsts.has(varName)) {
          warnings.push({
            file: filePath.replace(projectRoot, ''),
            line: index + 1,
            issue: `Duplicate const declaration: ${varName}`,
            code: line.trim(),
            suggestion: 'Use unique namespace or wrap in IIFE',
          });
        }
        topLevelConsts.add(varName);
      }

      const letMatch = line.match(/^let\s+(\w+)\s*=/);
      if (letMatch) {
        const varName = letMatch[1];
        if (topLevelLets.has(varName)) {
          warnings.push({
            file: filePath.replace(projectRoot, ''),
            line: index + 1,
            issue: `Duplicate let declaration: ${varName}`,
            code: line.trim(),
            suggestion: 'Use unique namespace or wrap in IIFE',
          });
        }
        topLevelLets.add(varName);
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error.message);
  }
}

/**
 * Get all files recursively
 */
function getAllFiles(dir, extensions = JS_EXTENSIONS) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and other common directories
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry)) {
          files.push(...getAllFiles(fullPath, extensions));
        }
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking JavaScript files for common syntax errors...\n');

  // Get all JavaScript files
  const jsFiles = getAllFiles(projectRoot, JS_EXTENSIONS);
  console.log(`Found ${jsFiles.length} JavaScript files\n`);

  // Check all files
  for (const file of jsFiles) {
    checkFile(file);
  }

  // Report results
  if (errors.length > 0) {
    console.log('❌ Syntax Errors Found:');
    errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.file}:${error.line}`);
      console.log(`   Issue: ${error.issue}`);
      console.log(`   Code: ${error.code}`);
      if (error.suggestion) {
        console.log(`   💡 Fix: ${error.suggestion}`);
      }
    });
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:');
    warnings.forEach((warning, index) => {
      console.log(`\n${index + 1}. ${warning.file}:${warning.line}`);
      console.log(`   ${warning.issue}`);
      console.log(`   Code: ${warning.code}`);
      if (warning.suggestion) {
        console.log(`   💡 Fix: ${warning.suggestion}`);
      }
    });
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ No syntax errors found!');
  }

  console.log(
    `\n📊 Summary: ${fileCount} files checked, ${errors.length} errors, ${warnings.length} warnings`
  );

  // Exit with error code if there are errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkFile, getAllFiles };
