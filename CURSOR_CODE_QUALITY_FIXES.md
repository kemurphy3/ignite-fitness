# Cursor Prompts: Code Quality & Security Fixes

## QUALITY FIX 1: ESLint Issues Resolution

````
CONTEXT: ESLint errors preventing git commit in specific files

TASK: Fix all ESLint errors without changing functionality

FILES TO CHECK AND FIX:
- js/ai/context-aware-ai.js
- js/app-modular-safe.js
- js/app-modular-secure.js
- js/app-modular.js
- js/core/data-store.js
- js/main.js
- js/modules/ai/CoachingEngine.js
- js/modules/auth/SessionManager.js
- js/modules/core/EventBus.js
- js/modules/ui/charts/ChartManager.js
- js/modules/ui/StravaImportUI.js
- js/modules/utils/htmlSanitizer.js
- js/training/seasonal-training.js

COMMON ESLINT FIXES:
1. Missing semicolons: Add ; at end of statements
2. Unused variables: Remove or prefix with underscore _unusedVar
3. Console statements: Replace console.log with proper logging
4. Undefined variables: Add proper imports or declarations
5. Wrong quotes: Use consistent quote style (single or double)
6. Missing const/let: Add proper variable declarations

SPECIFIC PATTERNS TO FIX:
```javascript
// WRONG:
console.log('debug info')
var oldVar = 'value'
function func() { return 'value' }
import { unused } from 'module'

// CORRECT:
// console.log('debug info'); // Remove or use proper logger
const newVar = 'value';
const func = () => { return 'value'; };
import { needed } from 'module'; // Remove unused imports
````

RUN FIRST: npm run lint to see specific errors FIX: Each specific error reported
by ESLint VERIFY: npm run lint:check passes

```

## QUALITY FIX 2: TypeScript Configuration Issues

```

CONTEXT: TypeScript check failing on JS files with type errors

FILES: Check jsconfig.json and all JS files for type issues

COMMON TYPESCRIPT FIXES:

1. Missing JSDoc types for function parameters
2. Incorrect property access on potentially null objects
3. Missing return type annotations
4. Inconsistent parameter types

SPECIFIC PATTERNS TO FIX:

```javascript
// WRONG:
function calculateLoad(session) {
  return session.duration * session.rpe;
}

// CORRECT:
/**
 * @param {Object} session - Session data
 * @param {number} session.duration - Duration in minutes
 * @param {number} session.rpe - RPE value 1-10
 * @returns {number} Calculated load value
 */
function calculateLoad(session) {
  if (!session?.duration || !session?.rpe) {
    throw new Error('Invalid session data');
  }
  return session.duration * session.rpe;
}
```

SAFETY CHECKS TO ADD:

```javascript
// Add null/undefined checks:
const result = data?.property || defaultValue;

// Add type validation:
if (typeof value !== 'number') {
  throw new TypeError(`Expected number, got ${typeof value}`);
}

// Use optional chaining:
const nested = obj?.deep?.property;
```

RUN FIRST: npm run typecheck to see specific errors FIX: Each type error with
proper null checks and type annotations VERIFY: npm run typecheck passes

```

## QUALITY FIX 3: Security Dependency Updates

```

CONTEXT: 5 npm security vulnerabilities (3 moderate, 2 critical) need fixes

STEP 1: Identify specific vulnerabilities

```bash
npm audit --audit-level moderate
```

STEP 2: Apply automatic fixes

```bash
npm audit fix
```

STEP 3: Force fixes if needed (test after each)

```bash
npm audit fix --force
```

STEP 4: Manual dependency updates if audit fix insufficient

COMMON VULNERABLE PACKAGES TO UPDATE:

- webpack-dev-server: Update to latest stable
- @babel/traverse: Update to latest
- postcss: Update to latest
- terser: Update to latest

MANUAL UPDATE PROCESS:

```bash
# Check current versions
npm list --depth=0

# Update specific packages
npm install package-name@latest

# Test after each update
npm test
npm run build
```

CRITICAL: Test application functionality after each security update

VALIDATION:

```bash
npm audit # Should show 0 vulnerabilities
npm run build # Must still work
npm test # Must still pass
```

```

## QUALITY FIX 4: Build Warning Resolution

```

CONTEXT: Webpack build warning about dynamic import expression

FILE: js/app.js (line 45, dynamic import)

CURRENT PROBLEMATIC CODE:

```javascript
const module = await import(modulePath);
```

WEBPACK-FRIENDLY REPLACEMENT:

```javascript
// Create static import mapping
const moduleImportMap = {
  './modules/ai/context-aware-ai.js': () =>
    import('./modules/ai/context-aware-ai.js'),
  './training/seasonal-training.js': () =>
    import('./training/seasonal-training.js'),
  './modules/core/data-store.js': () => import('./modules/core/data-store.js'),
  './training/workout-generator.js': () =>
    import('./training/workout-generator.js'),
  './ai/pattern-detector.js': () => import('./ai/pattern-detector.js'),
  './modules/ai/CoachingEngine.js': () =>
    import('./modules/ai/CoachingEngine.js'),
  './modules/auth/SessionManager.js': () =>
    import('./modules/auth/SessionManager.js'),
  './modules/ui/Router.js': () => import('./modules/ui/Router.js'),
};

async function loadModule(modulePath, className, options = {}) {
  const cacheKey = `${modulePath}:${className}`;

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey);
  }

  if (loadingStates.has(cacheKey)) {
    return loadingStates.get(cacheKey);
  }

  if (options.showLoading) {
    showLoading(options.loadingMessage || `Loading ${className}...`);
  }

  try {
    const loadingPromise = (async () => {
      // Use static import map instead of dynamic expression
      const importFunction = moduleImportMap[modulePath];
      if (!importFunction) {
        throw new Error(`Module not found in import map: ${modulePath}`);
      }

      const module = await importFunction();
      const instance = new module[className]();

      moduleCache.set(cacheKey, instance);
      loadingStates.delete(cacheKey);

      return instance;
    })();

    loadingStates.set(cacheKey, loadingPromise);
    return await loadingPromise;
  } finally {
    if (options.showLoading) {
      hideLoading();
    }
  }
}
```

VERIFICATION: Build should complete without warnings

```

## QUALITY FIX 5: Performance Optimization

```

CONTEXT: Optimize bundle size and loading performance

WEBPACK CONFIG OPTIMIZATION (webpack.config.js):

1. Add bundle analysis:

```javascript
const BundleAnalyzerPlugin =
  require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  // existing config...

  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        ai: {
          test: /[\\/]modules[\\/]ai[\\/]/,
          name: 'ai-modules',
          chunks: 'all',
        },
      },
    },
  },

  plugins: [
    // existing plugins...
    ...(process.env.ANALYZE ? [new BundleAnalyzerPlugin()] : []),
  ],
};
```

2. Optimize CSS extraction:

```javascript
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css',
      chunkFilename: '[id].[contenthash].css',
    }),
  ],

  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },
};
```

VERIFICATION:

```bash
npm run build # Should complete without warnings
npm run analyze # Check bundle size
```

```

## QUALITY FIX 6: Test Coverage Improvement

```

CONTEXT: Ensure critical paths have proper test coverage

PRIORITY TEST ADDITIONS:

1. Error boundary tests:

```javascript
// tests/unit/error-boundary.test.js
import { ErrorBoundary } from '../../js/modules/core/ErrorBoundary.js';

describe('ErrorBoundary', () => {
  test('should catch and handle errors gracefully', () => {
    const errorBoundary = new ErrorBoundary();
    const error = new Error('Test error');

    const result = errorBoundary.handleError(error);

    expect(result.handled).toBe(true);
    expect(result.userMessage).toBeDefined();
  });
});
```

2. Security tests for sanitization:

```javascript
// tests/security/sanitization.test.js
import { htmlSanitizer } from '../../js/modules/utils/htmlSanitizer.js';

describe('HTML Sanitizer', () => {
  test('should remove XSS vectors', () => {
    const malicious = '<script>alert("xss")</script><p>safe content</p>';
    const result = htmlSanitizer.sanitize(malicious);

    expect(result).not.toContain('<script>');
    expect(result).toContain('safe content');
  });
});
```

3. Critical user flow tests:

```javascript
// tests/integration/user-flow.test.js
describe('Critical User Flows', () => {
  test('should complete workout session without errors', async () => {
    const session = await createWorkoutSession();
    const result = await completeWorkout(session);

    expect(result.status).toBe('completed');
    expect(result.errors).toHaveLength(0);
  });
});
```

TARGET: >90% coverage on critical modules RUN: npm run test:coverage to verify

```

## FINAL VALIDATION SCRIPT

```

CONTEXT: Comprehensive validation of all quality fixes

FILE: validate-production-readiness.js

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

const runCheck = (name, command, required = true) => {
  process.stdout.write(`${name}... `);
  try {
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    console.log('✅ PASS');
    return { passed: true, output };
  } catch (error) {
    console.log(required ? '❌ FAIL (REQUIRED)' : '⚠️  WARN (OPTIONAL)');
    if (error.stdout) console.log('STDOUT:', error.stdout);
    if (error.stderr) console.log('STDERR:', error.stderr);
    return { passed: false, error: error.message };
  }
};

console.log('🔍 Production Readiness Check\n');

const results = [
  runCheck('Code Formatting', 'npm run format:check'),
  runCheck('ESLint', 'npm run lint:check'),
  runCheck('TypeScript', 'npm run typecheck'),
  runCheck('Security Audit', 'npm audit --audit-level high'),
  runCheck('Unit Tests', 'npm run test:unit'),
  runCheck('Integration Tests', 'npm run test:integration'),
  runCheck('Build Process', 'npm run build'),
  runCheck('Performance Budget', 'npm run perf:budget', false),
];

const passed = results.filter(r => r.passed).length;
const total = results.length;
const criticalPassed = results.slice(0, -1).filter(r => r.passed).length;
const criticalTotal = results.length - 1;

console.log(`\n📊 Results: ${passed}/${total} checks passed`);
console.log(
  `📊 Critical: ${criticalPassed}/${criticalTotal} required checks passed`
);

if (criticalPassed === criticalTotal) {
  console.log('\n🎉 PRODUCTION READY! All critical checks passed.');

  // Check git status
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      console.log('\n📝 Ready for git commit:');
      console.log('git add .');
      console.log('git commit -m "fix: resolve all quality and test issues"');
    } else {
      console.log('\n✨ Repository is clean and ready for deployment!');
    }
  } catch (e) {
    console.log('\n📝 Ready for git operations');
  }

  process.exit(0);
} else {
  console.log('\n❌ NOT READY: Fix critical issues before production');
  process.exit(1);
}
```

RUN: node validate-production-readiness.js

```

```
