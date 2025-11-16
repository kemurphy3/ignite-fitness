# Cursor Prompts: Execution Summary & Quick Reference

## 🎯 EXECUTION ORDER (Critical Path to Git Commit Ready)

### Phase 1: Critical Test Fixes (Must Fix First)

1. **Load Calculation Engine** - Fix zone multiplier math
   (`CURSOR_TEST_FIXES.md` → TEST FIX 1)
2. **Load Guardrails** - Fix insufficient_data blocking logic
   (`CURSOR_TEST_FIXES.md` → TEST FIX 2)
3. **Connection Pool** - Add pg module fallback for tests
   (`CURSOR_TEST_FIXES.md` → TEST FIX 4)

### Phase 2: Code Quality (Required for git commit)

1. **Format Code** - Run prettier on 14 files (`CURSOR_CODE_QUALITY_FIXES.md` →
   QUALITY FIX 1)
2. **ESLint Errors** - Fix all linting issues (`CURSOR_CODE_QUALITY_FIXES.md` →
   QUALITY FIX 1)
3. **TypeScript Issues** - Add type safety (`CURSOR_CODE_QUALITY_FIXES.md` →
   QUALITY FIX 2)

### Phase 3: Security (Blocking git commit)

1. **Dependency Updates** - Fix 5 npm vulnerabilities
   (`CURSOR_SECURITY_FIXES.md` → SECURITY FIX 1)
2. **Build Warnings** - Fix webpack dynamic import
   (`CURSOR_CODE_QUALITY_FIXES.md` → QUALITY FIX 4)

## 🚀 QUICK START COMMANDS

### Immediate Execution (Copy/Paste Ready)

```bash
# 1. Fix missing dependency (already done)
npm install pg

# 2. Run validation to see current state
npm run quality:check
npm run test:ci

# 3. Apply formatting fixes
npx prettier --write js/ai/context-aware-ai.js js/app-modular-safe.js js/app-modular-secure.js js/app-modular.js js/core/data-store.js js/main.js js/modules/ai/CoachingEngine.js js/modules/auth/SessionManager.js js/modules/core/EventBus.js js/modules/ui/charts/ChartManager.js js/modules/ui/StravaImportUI.js js/modules/utils/htmlSanitizer.js js/training/seasonal-training.js test-results.json

# 4. Fix security vulnerabilities
npm audit fix

# 5. Validate fixes
npm run quality:check
npm run test:ci
npm run build
```

### Validation Script Creation

```bash
# Create the validation script
cat > validate-commit-readiness.js << 'EOF'
const { execSync } = require('child_process');

console.log('🔍 Validating commit readiness...\n');

const checks = [
  { name: 'Code Formatting', cmd: 'npm run format:check' },
  { name: 'ESLint', cmd: 'npm run lint:check' },
  { name: 'TypeScript', cmd: 'npm run typecheck' },
  { name: 'Unit Tests', cmd: 'npm run test:unit' },
  { name: 'Integration Tests', cmd: 'npm run test:integration' },
  { name: 'Build', cmd: 'npm run build' },
];

let allPassed = true;

for (const check of checks) {
  process.stdout.write(`${check.name}... `);
  try {
    execSync(check.cmd, { stdio: 'pipe' });
    console.log('✅ PASS');
  } catch (error) {
    console.log('❌ FAIL');
    console.log(error.stdout?.toString());
    console.log(error.stderr?.toString());
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n🎉 All checks passed! Ready for git commit.');
  process.exit(0);
} else {
  console.log('\n❌ Some checks failed. Fix issues before committing.');
  process.exit(1);
}
EOF

# Run validation
node validate-commit-readiness.js
```

## 📋 SPECIFIC FILE CHANGES REQUIRED

### 1. js/modules/load/LoadCalculationEngine.js

**Issue**: Zone calculations returning 50% of expected values  
**Root Cause**: Missing zone multiplier application  
**Fix**: Ensure `zoneLoad = duration * ZONE_MULTIPLIERS[zoneName]` not just
`duration`

### 2. js/modules/load/LoadGuardrails.js

**Issue**: Returning 'insufficient_data' instead of processing guardrails  
**Root Cause**: Data availability checks too strict for test environment  
**Fix**: Lower data requirements or enhance test mocks

### 3. netlify/functions/utils/connection-pool.js

**Issue**: pg module not found in test environment  
**Root Cause**: Missing graceful fallback for tests  
**Fix**: Add try/catch around pg import with MockPool fallback

### 4. js/app.js (line ~45)

**Issue**: Webpack warning about dynamic import expression  
**Root Cause**: `import(modulePath)` using variable  
**Fix**: Replace with static import map

## 🔧 CURSOR PROMPT USAGE

### For Each Issue, Copy the Exact Prompt:

1. **Load Calculation**: Use `CURSOR_TEST_FIXES.md` → TEST FIX 1 verbatim
2. **Load Guardrails**: Use `CURSOR_TEST_FIXES.md` → TEST FIX 2 verbatim
3. **Connection Pool**: Use `CURSOR_TEST_FIXES.md` → TEST FIX 4 verbatim
4. **Code Formatting**: Use `CURSOR_CODE_QUALITY_FIXES.md` → QUALITY FIX 1
5. **Security Fixes**: Use `CURSOR_SECURITY_FIXES.md` → SECURITY FIX 1

### Cursor AI Instructions:

```
Paste the complete prompt text from the corresponding section. Execute exactly as written - no modifications, no placeholders, no "vibe coding". Focus on the specific file and line numbers mentioned. Make the exact changes described.
```

## 📊 SUCCESS METRICS

### ✅ Git Commit Ready Checklist:

- [ ] `npm run format:check` passes (no formatting issues)
- [ ] `npm run lint:check` passes (no ESLint errors)
- [ ] `npm run typecheck` passes (no TypeScript errors)
- [ ] `npm run test:unit` passes (0 failing unit tests)
- [ ] `npm run test:integration` passes (0 failing integration tests)
- [ ] `npm run build` completes (no webpack errors)
- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] `git add . && git commit` succeeds

### 🎯 Key Test Targets:

- **LoadCalculationEngine tests**: 3 specific zone math failures → PASS
- **LoadGuardrails tests**: 3 insufficient_data failures → PASS
- **Connection Pool test**: 1 pg module failure → PASS
- **Total test count**: 17 failures → 0 failures

## 🚨 CRITICAL WARNINGS

### DO NOT:

- Skip the formatting step (will block git commit)
- Ignore security vulnerabilities (will block production)
- Add placeholders or TODO comments (requirement: real fixes only)
- Refactor code structure (focus on fixing existing issues)
- Add new features (this is bug fixing only)

### DO:

- Execute prompts exactly as written
- Test after each major change
- Use the validation script frequently
- Fix one category completely before moving to next
- Commit when validation script passes

## 🔄 TROUBLESHOOTING

### If Tests Still Fail After Fixes:

1. Check the exact error message matches the original issue
2. Verify the file path and line numbers are correct
3. Re-run `npm install` to ensure dependencies are clean
4. Clear any cached test results: `rm -rf coverage/ test-results.json`
5. Run individual test files to isolate issues

### If Git Commit Still Blocked:

1. Run `git status` to see what's uncommitted
2. Check for unformatted files: `npm run format:check`
3. Check for lint errors: `npm run lint`
4. Verify all tests pass: `npm test`

### Emergency Recovery:

```bash
# Reset to clean state if needed
git stash
npm ci
node validate-commit-readiness.js
```

## 📈 PROGRESS TRACKING

Use this checklist to track progress through the prompts:

**Phase 1 - Test Fixes** (Critical):

- [ ] Load Calculation Engine math fixed
- [ ] Load Guardrails data logic fixed
- [ ] Connection Pool mock implemented
- [ ] `npm run test:unit` passes

**Phase 2 - Code Quality** (Required):

- [ ] All files formatted with Prettier
- [ ] ESLint errors resolved
- [ ] TypeScript issues resolved
- [ ] `npm run quality:check` passes

**Phase 3 - Security** (Blocking):

- [ ] npm vulnerabilities patched
- [ ] Webpack warnings resolved
- [ ] `npm audit` clean
- [ ] `npm run build` succeeds

**Final Validation**:

- [ ] All checks pass in validation script
- [ ] Git commit succeeds
- [ ] Repository is production-ready

Execute each phase completely before proceeding to the next. This ensures issues
don't compound and makes debugging easier.
