#!/usr/bin/env node

/**
 * Security Validation Script
 * Scans codebase for security vulnerabilities
 */

const fs = require('fs');
const path = require('path');

class SecurityValidator {
  constructor() {
    this.issues = [];
  }

  checkForHardcodedSecrets() {
    const secretPatterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i,
    ];

    // Exclude test files and templates
    const excludeDirs = ['node_modules', '.git', 'dist', 'tests', 'archive'];
    const excludeFiles = ['setup-env', 'env-template', 'validate-security'];

    this.scanFiles('js/', secretPatterns, 'Potential hardcoded secret', excludeDirs, excludeFiles);
    this.scanFiles(
      'netlify/functions/',
      secretPatterns,
      'Potential hardcoded secret',
      excludeDirs,
      excludeFiles
    );
  }

  checkForXSSVulnerabilities() {
    const xssPatterns = [
      /innerHTML\s*=\s*[^'"]/, // Unescaped innerHTML
      /document\.write\s*\(/, // document.write usage
      /eval\s*\(/, // eval usage
      /Function\s*\(/, // Function constructor
    ];

    // Exclude test files
    const excludeDirs = ['node_modules', '.git', 'dist', 'tests', 'archive'];
    const excludeFiles = ['validate-security'];

    this.scanFiles('js/', xssPatterns, 'Potential XSS vulnerability', excludeDirs, excludeFiles);
  }

  checkForSQLInjection() {
    const sqlPatterns = [
      /query\s*\(\s*['"`][^'"`]*\$\{/, // String interpolation in queries
      /query\s*\(\s*['"`][^'"`]*\+/, // String concatenation in queries
    ];

    // Exclude test files
    const excludeDirs = ['node_modules', '.git', 'dist', 'tests', 'archive'];
    const excludeFiles = ['sql-injection-security.test', 'validate-security'];

    this.scanFiles(
      'netlify/functions/',
      sqlPatterns,
      'Potential SQL injection',
      excludeDirs,
      excludeFiles
    );
  }

  scanFiles(dir, patterns, issueType, excludeDirs = [], excludeFiles = []) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const files = this.getAllFiles(dir, excludeDirs, excludeFiles);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
          }

          patterns.forEach(pattern => {
            if (pattern.test(line)) {
              // Additional check: exclude if it's in a comment
              const commentIndex = line.indexOf('//');
              const testLine = commentIndex > 0 ? line.substring(0, commentIndex) : line;

              if (pattern.test(testLine)) {
                this.issues.push({
                  type: issueType,
                  file: file,
                  line: index + 1,
                  content: line.trim(),
                });
              }
            }
          });
        });
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Warning: Could not read ${file}: ${error.message}`);
      }
    }
  }

  getAllFiles(dir, excludeDirs = [], excludeFiles = []) {
    const files = [];

    function traverse(currentDir) {
      if (!fs.existsSync(currentDir)) {
        return;
      }

      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        // Skip excluded directories
        if (excludeDirs.some(excluded => item.includes(excluded))) {
          continue;
        }

        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (stat.isFile() && item.endsWith('.js')) {
          // Skip excluded files
          if (!excludeFiles.some(excluded => item.includes(excluded))) {
            files.push(fullPath);
          }
        }
      }
    }

    traverse(dir);
    return files;
  }

  validate() {
    console.log('🔒 Security Validation Starting...\n');

    this.checkForHardcodedSecrets();
    this.checkForXSSVulnerabilities();
    this.checkForSQLInjection();

    if (this.issues.length === 0) {
      console.log('✅ No security issues detected');
      return true;
    } else {
      console.log(`❌ Found ${this.issues.length} potential security issues:\n`);

      // Group by type
      const grouped = {};
      this.issues.forEach(issue => {
        if (!grouped[issue.type]) {
          grouped[issue.type] = [];
        }
        grouped[issue.type].push(issue);
      });

      Object.entries(grouped).forEach(([type, issues]) => {
        console.log(`\n${type} (${issues.length}):`);
        issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${path.relative(process.cwd(), issue.file)}:${issue.line}`);
          console.log(
            `     ${issue.content.substring(0, 80)}${issue.content.length > 80 ? '...' : ''}`
          );
        });
      });

      return false;
    }
  }
}

const validator = new SecurityValidator();
const isSecure = validator.validate();

process.exit(isSecure ? 0 : 1);
