#!/usr/bin/env node

/**
 * DOM Safety Checker
 * Finds unsafe DOM operations that could cause null reference errors
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const JS_EXTENSIONS = ['.js'];
const HTML_FILES = ['index.html'];

let issues = [];

/**
 * Check JavaScript files for unsafe DOM operations
 */
function checkJSFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Pattern: getElementById(...).property without null check
      const unsafePattern =
        /getElementById\([^)]+\)\.(innerHTML|textContent|value|classList|style|disabled|checked)/;
      if (unsafePattern.test(line)) {
        // Check if there's a null check in the lines above (within same function)
        const beforeLine = content.substring(0, content.indexOf(line));
        const functionStart = beforeLine.lastIndexOf('function');
        const context = content.substring(
          Math.max(0, functionStart),
          content.indexOf(line) + line.length
        );

        // Extract element ID
        const idMatch = line.match(/getElementById\(['"]([^'"]+)['"]\)/);
        const elementId = idMatch ? idMatch[1] : 'unknown';

        // Check if there's a guard check for this element
        const hasGuard =
          new RegExp(`getElementById\\(['"]${elementId}['"]\\)\\s*(&&|\\?|if)`).test(context) ||
          new RegExp(`const\\s+\\w+\\s*=\\s*getElementById\\(['"]${elementId}['"]\\)`).test(
            context
          );

        if (!hasGuard) {
          issues.push({
            file: filePath.replace(projectRoot, ''),
            line: lineNum,
            severity: 'error',
            issue: 'Unsafe DOM operation without null check',
            code: line.trim(),
            element: elementId,
            suggestion: `Add null check: const el = document.getElementById('${elementId}'); if (el) el.property = value;`,
          });
        }
      }

      // Pattern: querySelector(...).property without null check
      const unsafeQueryPattern =
        /querySelector\([^)]+\)\.(innerHTML|textContent|value|classList|style|disabled|checked|appendChild|removeChild)/;
      if (unsafeQueryPattern.test(line) && !line.includes('if') && !line.includes('?')) {
        issues.push({
          file: filePath.replace(projectRoot, ''),
          line: lineNum,
          severity: 'warning',
          issue: 'Unsafe querySelector operation without null check',
          code: line.trim(),
          suggestion: 'Add null check before accessing element properties',
        });
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
  }
}

/**
 * Check HTML files for unsafe inline scripts
 */
function checkHTMLFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Find inline script blocks
      if (line.includes('<script>') || (line.includes('function') && !line.includes('src='))) {
        // Look ahead for unsafe operations in this script block
        let inScript = false;
        let scriptLines = [];
        let braceCount = 0;

        for (let i = index; i < Math.min(lines.length, index + 100); i++) {
          const currentLine = lines[i];

          if (currentLine.includes('<script>')) inScript = true;
          if (currentLine.includes('</script>')) break;

          if (inScript) {
            scriptLines.push(currentLine);
            braceCount += (currentLine.match(/{/g) || []).length;
            braceCount -= (currentLine.match(/}/g) || []).length;

            const unsafePattern =
              /getElementById\([^)]+\)\.(innerHTML|textContent|value|classList)/;
            if (unsafePattern.test(currentLine)) {
              const idMatch = currentLine.match(/getElementById\(['"]([^'"]+)['"]\)/);
              if (idMatch) {
                // Check if there's a guard in the script block
                const scriptContent = scriptLines.join('\n');
                const elementId = idMatch[1];
                const hasGuard = new RegExp(
                  `getElementById\\(['"]${elementId}['"]\\)\\s*(&&|\\?|if|const\\s+\\w+\\s*=)`
                ).test(scriptContent);

                if (!hasGuard) {
                  issues.push({
                    file: filePath.replace(projectRoot, ''),
                    line: i + 1,
                    severity: 'error',
                    issue: 'Unsafe DOM operation in inline script',
                    code: currentLine.trim(),
                    element: elementId,
                    suggestion: `Add null check before accessing ${elementId}`,
                  });
                }
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.warn(`Warning: Could not read ${filePath}:`, error.message);
  }
}

/**
 * Get all files
 */
function getAllFiles(dir, extensions, files = []) {
  try {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry)) {
          getAllFiles(fullPath, extensions, files);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(entry);
        if (extensions.includes(ext) || HTML_FILES.includes(entry)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return files;
}

/**
 * Main
 */
function main() {
  console.log('🔍 Checking for unsafe DOM operations...\n');

  // Check JS files
  const jsFiles = getAllFiles(path.join(projectRoot, 'js'), JS_EXTENSIONS);
  console.log(`Checking ${jsFiles.length} JavaScript files...`);
  jsFiles.forEach(checkJSFile);

  // Check HTML files
  const htmlFiles = HTML_FILES.map(f => path.join(projectRoot, f)).filter(f => fs.existsSync(f));
  console.log(`Checking ${htmlFiles.length} HTML files...`);
  htmlFiles.forEach(checkHTMLFile);

  // Report
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  if (errors.length > 0) {
    console.log(`\n❌ Found ${errors.length} unsafe DOM operations:\n`);
    errors.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.file}:${issue.line}`);
      console.log(`   ${issue.issue}`);
      if (issue.element) console.log(`   Element: ${issue.element}`);
      console.log(`   Code: ${issue.code}`);
      console.log(`   💡 ${issue.suggestion}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️  Found ${warnings.length} potential issues:\n`);
    warnings.slice(0, 10).forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.file}:${issue.line} - ${issue.issue}`);
    });
    if (warnings.length > 10) {
      console.log(`   ... and ${warnings.length - 10} more`);
    }
  }

  if (issues.length === 0) {
    console.log('\n✅ No unsafe DOM operations found!');
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { checkJSFile, checkHTMLFile };
