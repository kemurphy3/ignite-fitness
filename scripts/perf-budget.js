#!/usr/bin/env node

/**
 * Performance Budget Enforcement Script
 * Checks performance budgets and fails builds if exceeded
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Performance budgets
const BUDGETS = {
  // Core Web Vitals
  lcp: 2500, // Largest Contentful Paint (ms)
  fid: 100, // First Input Delay (ms)
  cls: 0.1, // Cumulative Layout Shift
  ttfb: 800, // Time to First Byte (ms)
  tbt: 300, // Total Blocking Time (ms)
  si: 3800, // Speed Index (ms)

  // Resource sizes
  jsSize: 500 * 1024, // JavaScript bundle size (bytes)
  cssSize: 100 * 1024, // CSS bundle size (bytes)
  imageSize: 200 * 1024, // Image bundle size (bytes)
  totalSize: 1000 * 1024, // Total bundle size (bytes)

  // Performance scores
  performanceScore: 90,
  accessibilityScore: 90,
  bestPracticesScore: 90,
  seoScore: 90,
  pwaScore: 90,
};

// Budget violation tracking
const violations = [];

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting performance budget enforcement...\n');

  try {
    // Check bundle sizes
    await checkBundleSizes();

    // Run Lighthouse CI
    await runLighthouseCI();

    // Check Lighthouse results
    await checkLighthouseResults();

    // Report results
    reportResults();
  } catch (error) {
    console.error('❌ Performance budget check failed:', error.message);
    process.exit(1);
  }
}

/**
 * Check bundle sizes
 */
async function checkBundleSizes() {
  console.log('📦 Checking bundle sizes...');

  const distPath = path.join(process.cwd(), 'dist');

  if (!fs.existsSync(distPath)) {
    throw new Error('Dist directory not found. Run build first.');
  }

  const files = fs.readdirSync(distPath, { recursive: true });

  let totalSize = 0;
  let jsSize = 0;
  let cssSize = 0;
  let imageSize = 0;

  files.forEach(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile()) {
      totalSize += stats.size;

      if (file.endsWith('.js')) {
        jsSize += stats.size;
      } else if (file.endsWith('.css')) {
        cssSize += stats.size;
      } else if (file.match(/\.(png|jpg|jpeg|gif|svg|webp|avif)$/)) {
        imageSize += stats.size;
      }
    }
  });

  // Check JavaScript size
  if (jsSize > BUDGETS.jsSize) {
    violations.push({
      type: 'bundle',
      metric: 'JavaScript Size',
      current: formatBytes(jsSize),
      budget: formatBytes(BUDGETS.jsSize),
      excess: formatBytes(jsSize - BUDGETS.jsSize),
    });
  }

  // Check CSS size
  if (cssSize > BUDGETS.cssSize) {
    violations.push({
      type: 'bundle',
      metric: 'CSS Size',
      current: formatBytes(cssSize),
      budget: formatBytes(BUDGETS.cssSize),
      excess: formatBytes(cssSize - BUDGETS.cssSize),
    });
  }

  // Check image size
  if (imageSize > BUDGETS.imageSize) {
    violations.push({
      type: 'bundle',
      metric: 'Image Size',
      current: formatBytes(imageSize),
      budget: formatBytes(BUDGETS.imageSize),
      excess: formatBytes(imageSize - BUDGETS.imageSize),
    });
  }

  // Check total size
  if (totalSize > BUDGETS.totalSize) {
    violations.push({
      type: 'bundle',
      metric: 'Total Size',
      current: formatBytes(totalSize),
      budget: formatBytes(BUDGETS.totalSize),
      excess: formatBytes(totalSize - BUDGETS.totalSize),
    });
  }

  console.log('✅ Bundle sizes checked:');
  console.log(`   JavaScript: ${formatBytes(jsSize)} (budget: ${formatBytes(BUDGETS.jsSize)})`);
  console.log(`   CSS: ${formatBytes(cssSize)} (budget: ${formatBytes(BUDGETS.cssSize)})`);
  console.log(`   Images: ${formatBytes(imageSize)} (budget: ${formatBytes(BUDGETS.imageSize)})`);
  console.log(`   Total: ${formatBytes(totalSize)} (budget: ${formatBytes(BUDGETS.totalSize)})\n`);
}

/**
 * Run Lighthouse CI
 */
async function runLighthouseCI() {
  console.log('🔍 Running Lighthouse CI...');

  try {
    // Check if lighthouse-ci is installed
    execSync('which lhci', { stdio: 'pipe' });
  } catch (error) {
    console.log('Installing Lighthouse CI...');
    execSync('npm install -g @lhci/cli', { stdio: 'inherit' });
  }

  try {
    execSync('lhci autorun', { stdio: 'inherit' });
    console.log('✅ Lighthouse CI completed\n');
  } catch (error) {
    console.log('⚠️  Lighthouse CI completed with warnings\n');
  }
}

/**
 * Check Lighthouse results
 */
async function checkLighthouseResults() {
  console.log('📊 Checking Lighthouse results...');

  const reportsPath = path.join(process.cwd(), 'lighthouse-reports');

  if (!fs.existsSync(reportsPath)) {
    throw new Error('Lighthouse reports not found');
  }

  const reports = fs
    .readdirSync(reportsPath)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(reportsPath, file));

  if (reports.length === 0) {
    throw new Error('No Lighthouse reports found');
  }

  // Process each report
  reports.forEach(reportPath => {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    checkLighthouseReport(report);
  });

  console.log('✅ Lighthouse results checked\n');
}

/**
 * Check individual Lighthouse report
 * @param {Object} report - Lighthouse report
 */
function checkLighthouseReport(report) {
  const { audits, categories } = report;

  // Check Core Web Vitals
  checkCoreWebVitals(audits);

  // Check category scores
  checkCategoryScores(categories);

  // Check specific audits
  checkSpecificAudits(audits);
}

/**
 * Check Core Web Vitals
 * @param {Object} audits - Lighthouse audits
 */
function checkCoreWebVitals(audits) {
  const metrics = {
    'largest-contentful-paint': {
      value: audits['largest-contentful-paint']?.numericValue,
      budget: BUDGETS.lcp,
    },
    'first-input-delay': { value: audits['first-input-delay']?.numericValue, budget: BUDGETS.fid },
    'cumulative-layout-shift': {
      value: audits['cumulative-layout-shift']?.numericValue,
      budget: BUDGETS.cls,
    },
    'server-response-time': {
      value: audits['server-response-time']?.numericValue,
      budget: BUDGETS.ttfb,
    },
    'total-blocking-time': {
      value: audits['total-blocking-time']?.numericValue,
      budget: BUDGETS.tbt,
    },
    'speed-index': { value: audits['speed-index']?.numericValue, budget: BUDGETS.si },
  };

  Object.entries(metrics).forEach(([metric, data]) => {
    if (data.value && data.value > data.budget) {
      violations.push({
        type: 'core-web-vitals',
        metric,
        current: formatValue(data.value, metric),
        budget: formatValue(data.budget, metric),
        excess: formatValue(data.value - data.budget, metric),
      });
    }
  });
}

/**
 * Check category scores
 * @param {Object} categories - Lighthouse categories
 */
function checkCategoryScores(categories) {
  const categoryBudgets = {
    performance: BUDGETS.performanceScore,
    accessibility: BUDGETS.accessibilityScore,
    'best-practices': BUDGETS.bestPracticesScore,
    seo: BUDGETS.seoScore,
    pwa: BUDGETS.pwaScore,
  };

  Object.entries(categoryBudgets).forEach(([category, budget]) => {
    const score = categories[category]?.score * 100;
    if (score && score < budget) {
      violations.push({
        type: 'category-score',
        metric: category,
        current: `${score.toFixed(1)}%`,
        budget: `${budget}%`,
        excess: `${(budget - score).toFixed(1)}%`,
      });
    }
  });
}

/**
 * Check specific audits
 * @param {Object} audits - Lighthouse audits
 */
function checkSpecificAudits(audits) {
  const criticalAudits = [
    'unused-javascript',
    'unused-css-rules',
    'render-blocking-resources',
    'unminified-javascript',
    'unminified-css',
    'uses-http2',
    'uses-text-compression',
    'uses-responsive-images',
    'uses-webp-images',
    'uses-optimized-images',
    'efficient-animated-content',
    'preload-lcp-image',
    'uses-rel-preconnect',
    'uses-rel-preload',
  ];

  criticalAudits.forEach(audit => {
    const auditData = audits[audit];
    if (auditData && auditData.score < 0.9) {
      violations.push({
        type: 'audit',
        metric: audit,
        current: `${(auditData.score * 100).toFixed(1)}%`,
        budget: '90%',
        excess: `${(90 - auditData.score * 100).toFixed(1)}%`,
      });
    }
  });
}

/**
 * Format value based on metric type
 * @param {number} value - Value to format
 * @param {string} metric - Metric name
 * @returns {string} Formatted value
 */
function formatValue(value, metric) {
  if (metric.includes('layout-shift')) {
    return value.toFixed(3);
  } else if (metric.includes('time') || metric.includes('paint') || metric.includes('delay')) {
    return `${value.toFixed(0)}ms`;
  } else {
    return value.toString();
  }
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Report results
 */
function reportResults() {
  console.log('📋 Performance Budget Results:\n');

  if (violations.length === 0) {
    console.log('✅ All performance budgets met!');
    console.log('🎉 Build can proceed to deployment.\n');
    return;
  }

  console.log(`❌ ${violations.length} budget violation(s) detected:\n`);

  // Group violations by type
  const groupedViolations = violations.reduce((acc, violation) => {
    if (!acc[violation.type]) {
      acc[violation.type] = [];
    }
    acc[violation.type].push(violation);
    return acc;
  }, {});

  // Report each type
  Object.entries(groupedViolations).forEach(([type, violations]) => {
    console.log(`${type.toUpperCase()} VIOLATIONS:`);
    violations.forEach(violation => {
      console.log(
        `  ❌ ${violation.metric}: ${violation.current} (budget: ${violation.budget}, excess: ${violation.excess})`
      );
    });
    console.log('');
  });

  // Provide recommendations
  console.log('💡 Recommendations:');
  console.log('  • Reduce JavaScript bundle size by code splitting');
  console.log('  • Optimize images and use modern formats (WebP/AVIF)');
  console.log('  • Implement lazy loading for non-critical resources');
  console.log('  • Use HTTP/2 and enable compression');
  console.log('  • Minimize and compress CSS/JavaScript');
  console.log('  • Preload critical resources');
  console.log('  • Remove unused code and dependencies\n');

  // Fail the build
  console.log('🚫 Build failed due to performance budget violations.');
  console.log('   Fix the issues above before deploying.\n');

  process.exit(1);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Performance budget check failed:', error);
    process.exit(1);
  });
}

module.exports = { main, BUDGETS };
