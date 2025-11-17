#!/usr/bin/env node

/**
 * Case-sensitive imports audit script (CommonJS version)
 * Checks all import paths and verifies exact filename case on disk
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// File extensions to check
const JS_EXTENSIONS = ['.js', '.mjs', '.ts', '.tsx', '.jsx'];
const HTML_EXTENSIONS = ['.html', '.htm'];

// Patterns to match imports
const IMPORT_PATTERNS = [
  /import\s+.*?from\s+['"]([^'"]+)['"]/g,
  /import\s+['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /src\s*=\s*['"]([^'"]+)['"]/g,
  /href\s*=\s*['"]([^'"]+)['"]/g,
];

let errors = [];
let warnings = [];

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
        if (
          !['node_modules', '.git', 'dist', 'build', '.next', 'dev-scripts', 'netlify'].includes(
            entry
          )
        ) {
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
 * Check if a file exists with exact case
 */
function checkFileExists(basePath, importPath) {
  // Skip external URLs and data URLs
  if (importPath.startsWith('http') || importPath.startsWith('data:')) {
    return true;
  }

  // Skip relative paths that start with ./
  if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
    return true; // Assume external module
  }

  const fullPath = path.join(path.dirname(basePath), importPath);

  try {
    // Check if file exists
    fs.statSync(fullPath);
    return true;
  } catch (error) {
    // File doesn't exist, check if it's a case issue
    const dir = path.dirname(fullPath);
    const filename = path.basename(fullPath);

    try {
      const files = fs.readdirSync(dir);
      const lowerFiles = files.map(f => f.toLowerCase());
      const lowerFilename = filename.toLowerCase();

      if (lowerFiles.includes(lowerFilename)) {
        const actualFile = files.find(f => f.toLowerCase() === lowerFilename);
        return {
          exists: false,
          caseMismatch: true,
          actualFile,
          expectedFile: filename,
        };
      }
    } catch (dirError) {
      // Directory doesn't exist
    }

    return {
      exists: false,
      caseMismatch: false,
    };
  }
}

/**
 * Extract imports from file content
 */
function extractImports(content) {
  const imports = [];

  for (const pattern of IMPORT_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Check a single file
 */
function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = extractImports(content);

    for (const importPath of imports) {
      const result = checkFileExists(filePath, importPath);

      if (result === true) {
        // File exists, all good
        continue;
      }

      if (result.exists === false) {
        if (result.caseMismatch) {
          errors.push({
            file: filePath.replace(projectRoot, ''),
            import: importPath,
            issue: 'case_mismatch',
            actual: result.actualFile,
            expected: result.expectedFile,
          });
        } else {
          warnings.push({
            file: filePath.replace(projectRoot, ''),
            import: importPath,
            issue: 'file_not_found',
          });
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error.message);
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Checking case-sensitive imports...\n');
  console.log('Project root:', projectRoot);

  // Get all JavaScript files
  const jsFiles = getAllFiles(projectRoot, JS_EXTENSIONS);
  console.log(`Found ${jsFiles.length} JavaScript files`);

  // Get all HTML files
  const htmlFiles = getAllFiles(projectRoot, HTML_EXTENSIONS);
  console.log(`Found ${htmlFiles.length} HTML files\n`);

  // Check all files
  const allFiles = [...jsFiles, ...htmlFiles];
  for (const file of allFiles) {
    checkFile(file);
  }

  // Report results
  if (errors.length > 0) {
    console.log('❌ Case mismatch errors found:');
    for (const error of errors) {
      console.log(`  ${error.file}`);
      console.log(`    Import: ${error.import}`);
      console.log(`    Expected: ${error.expected}`);
      console.log(`    Actual: ${error.actual}`);
      console.log('');
    }
  }

  if (warnings.length > 0) {
    console.log('⚠️  File not found warnings:');
    for (const warning of warnings) {
      console.log(`  ${warning.file}`);
      console.log(`    Import: ${warning.import}`);
      console.log('');
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All imports are case-correct!');
  }

  // Exit with error code if there are case mismatches
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
