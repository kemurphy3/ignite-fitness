# Cursor Implementation Prompts - IgniteFitness Critical Fixes

Execute these prompts in order to achieve a fully functional, production-ready
application.

## PROMPT 1: CRITICAL DEPENDENCY FIX

**Priority: CRITICAL - Must be completed first**

```
Fix the missing @neondatabase/serverless dependency that is causing 106 test failures.

REQUIREMENTS:
1. Add @neondatabase/serverless to package.json dependencies (NOT devDependencies)
2. Verify the package is compatible with the existing connection pool implementation
3. Run npm install to ensure clean installation
4. Test that netlify/functions/utils/connection-pool.js can import the package
5. Run npm test to verify the dependency fixes reduce test failures

VALIDATION:
- grep -r "@neondatabase/serverless" package.json shows the dependency
- npm test shows significantly fewer failing tests (target: <20 failures)
- No import errors in connection-pool.js

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 2: SYNTAX ERROR RESOLUTION

**Priority: HIGH - Blocking TypeScript checks**

```
Fix all 3 TypeScript syntax errors preventing type checking:

1. js/modules/ai/CoachChat.js(417,123): Fix expression error
2. tests/ai/why-panel.test.js(238,1): Fix declaration/statement error
3. tests/netlify/functions/ingest-strava.test.js(107,21): Fix comma expectation error

REQUIREMENTS:
1. Open each file and fix the specific syntax issues
2. Ensure all JavaScript syntax is valid and parseable
3. Maintain existing functionality while fixing syntax
4. Run npx tsc --noEmit --project jsconfig.json to verify fixes

VALIDATION:
- TypeScript check completes without syntax errors
- All affected files parse correctly
- No functional regressions in fixed code

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 3: DUPLICATE FUNCTION ELIMINATION

**Priority: HIGH - Critical code quality issue**

```
Remove all duplicate class methods and function definitions causing ESLint errors:

TARGET DUPLICATES:
- js/ai/context-aware-ai.js: 'getRecentWorkouts', 'selectOptimalModel', 'getAIResponse'
- js/app.js: 'generateWorkoutPlan' (parsing error)

REQUIREMENTS:
1. Identify all duplicate method definitions in each file
2. Keep the most complete/recent implementation of each method
3. Remove duplicate definitions completely
4. Ensure all remaining methods are functional and properly integrated
5. Verify no calls to removed methods exist elsewhere

VALIDATION:
- ESLint shows no "Duplicate name" errors
- npm run lint:check passes for affected files
- All functionality remains intact after deduplication

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 4: UNUSED VARIABLE AND FUNCTION CLEANUP

**Priority: HIGH - Code quality and maintainability**

```
Remove ALL unused variables and functions identified by ESLint (45+ instances):

MAJOR FILES TO CLEAN:
- js/app-modular.js: Remove 35+ unused functions (login, register, startWorkout, etc.)
- js/app-modular-safe.js: Remove unused render functions
- js/app-modular-secure.js: Remove unused modal functions
- js/main.js: Remove unused assignments and undefined references

REQUIREMENTS:
1. Remove each unused variable and function completely
2. If functions are meant to be used, properly integrate them or export them
3. Fix all 'not defined' errors by adding proper imports
4. Ensure no functionality is broken by removals
5. Clean up all dead code paths

VALIDATION:
- ESLint unused variable errors reduced to 0
- No 'not defined' errors remain
- All remaining code is actively used
- Application functionality unchanged

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 5: CONSOLE STATEMENT STANDARDIZATION

**Priority: MEDIUM - Production readiness**

```
Replace ALL console.log/console.warn/console.error statements with SafeLogger throughout the codebase (50+ instances):

FILES TO UPDATE:
- js/ai/context-aware-ai.js (11 console statements)
- js/app-modular.js (15+ console statements)
- js/core/data-store.js (7 console statements)
- All other files with console warnings

REQUIREMENTS:
1. Import SafeLogger properly in each file
2. Replace console.log with logger.info
3. Replace console.warn with logger.warn
4. Replace console.error with logger.error
5. Maintain the same logging information and context
6. Use SafeLogger's built-in sensitive data protection

VALIDATION:
- ESLint shows 0 "Unexpected console statement" warnings
- All logging functionality preserved
- SafeLogger properly imported in all files
- No console statements remain in production code

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 6: EVENTBUS DEPENDENCY RESOLUTION

**Priority: MEDIUM - Module integration**

```
Fix all EventBus 'not defined' errors in accessibility modules (40+ instances):

AFFECTED FILES:
- js/modules/accessibility/CognitiveAccessibilityManager.js (9 instances)
- js/modules/accessibility/FocusTrapManager.js (8 instances)
- js/modules/accessibility/FormValidationManager.js (3 instances)
- js/modules/accessibility/LiveRegionManager.js (5 instances)
- js/modules/accessibility/ScreenReaderWorkflowManager.js (6+ instances)

REQUIREMENTS:
1. Import EventBus properly at the top of each file
2. Verify EventBus exists in js/modules/core/EventBus.js
3. If EventBus doesn't exist, create a functional EventBus implementation
4. Ensure all EventBus.emit and EventBus.on calls work correctly
5. Maintain all accessibility functionality

VALIDATION:
- ESLint shows no 'EventBus not defined' errors
- All accessibility features function correctly
- EventBus events properly trigger throughout the app
- No functional regressions in accessibility modules

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 7: SECURITY VULNERABILITY PATCH

**Priority: MEDIUM - Security**

```
Update esbuild dependency to fix moderate security vulnerability:

VULNERABILITY: esbuild <=0.24.2 enables any website to send requests to development server

REQUIREMENTS:
1. Update esbuild to latest secure version (>0.24.2)
2. Update all dependent packages (vite, vite-node, vitest, @vitest/coverage-v8)
3. Verify all build processes still work correctly
4. Run npm audit to confirm vulnerability is resolved
5. Test development server security is improved

VALIDATION:
- npm audit shows 0 moderate or high vulnerabilities
- npm run build completes successfully
- npm run dev starts without errors
- All build and test scripts function normally

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 8: APP.JS PARSING ERROR FIX

**Priority: MEDIUM - Core functionality**

```
Fix the parsing error in js/app.js preventing proper loading:

ERROR: Identifier 'generateWorkoutPlan' has already been declared

REQUIREMENTS:
1. Locate the duplicate 'generateWorkoutPlan' function declarations
2. Merge the functions if they have different implementations
3. Remove the duplicate declaration completely
4. Ensure the remaining function is complete and functional
5. Verify all calls to generateWorkoutPlan work correctly
6. Test that app.js loads without parsing errors

VALIDATION:
- ESLint parses js/app.js without errors
- generateWorkoutPlan function works as expected
- No duplicate function declarations remain
- Application loads successfully

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 9: USELESS ESCAPE CHARACTER FIX

**Priority: LOW - Code quality**

```
Fix regex escape character issues in form validation:

TARGET: js/modules/accessibility/FormValidationManager.js line 68

REQUIREMENTS:
1. Fix the unnecessary escape character in regex: \+
2. Ensure the regex still validates correctly
3. Test that form validation continues to work
4. Check for similar issues in other files

VALIDATION:
- ESLint shows no "Unnecessary escape character" warnings
- Form validation works correctly
- Regex patterns function as intended

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 10: PREFER-DESTRUCTURING WARNINGS

**Priority: LOW - Code style**

```
Update object property access to use destructuring in js/core/auth.js:

REQUIREMENTS:
1. Replace property access with destructuring assignment
2. Maintain exact same functionality
3. Improve code readability and modern JavaScript practices
4. Ensure all variables remain properly assigned

VALIDATION:
- ESLint shows no "prefer-destructuring" warnings
- All functionality remains identical
- Code follows modern JavaScript patterns

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## PROMPT 11: TEST STABILITY IMPROVEMENT

**Priority: MEDIUM - Quality assurance**

```
Fix the remaining test failures after dependency resolution:

FOCUS AREAS:
1. Load calculation test expectation mismatches
2. Guardrail test dependency issues
3. Integration test database connectivity
4. Unhandled error resolution

REQUIREMENTS:
1. Debug each failing test individually
2. Fix mathematical expectations to match implementations
3. Ensure all test dependencies are properly mocked or available
4. Resolve the 1 unhandled error in the test suite
5. Achieve >95% test pass rate

VALIDATION:
- npm test shows <5% failure rate
- No unhandled errors during test runs
- All core functionality tests pass
- Test suite runs reliably

COMPLETE IMPLEMENTATION - NO PLACEHOLDERS
```

## EXECUTION ORDER

Execute these prompts in numerical order. Each prompt must be completed and
validated before proceeding to the next. This will result in a fully functional,
production-ready IgniteFitness application with:

- ✅ All dependencies resolved
- ✅ Clean code with no ESLint errors
- ✅ Type-safe TypeScript compilation
- ✅ Security vulnerabilities patched
- ✅ >95% test pass rate
- ✅ Production-ready logging
- ✅ No dead code or placeholders

## SUCCESS CRITERIA

After all prompts are completed:

1. `npm run quality:check` passes completely
2. `npm test` shows >95% pass rate
3. `npm audit` shows no moderate+ vulnerabilities
4. Application loads and functions correctly
5. All features work as designed
