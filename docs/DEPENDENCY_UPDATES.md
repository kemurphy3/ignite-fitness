# Dependency Updates & Security Fixes

## Issues Fixed

### 1. **Deprecated Babel Plugins** ✅

- ❌ `@babel/plugin-proposal-optional-chaining` (deprecated)
- ❌ `@babel/plugin-proposal-nullish-coalescing-operator` (deprecated)
- ✅ Replaced with:
  - `@babel/plugin-transform-optional-chaining@^7.23.0`
  - `@babel/plugin-transform-nullish-coalescing-operator@^7.23.0`

### 2. **Security Vulnerabilities** ⚠️

#### esbuild/vite/vitest (Moderate)

- **Issue**: Development server vulnerability in esbuild <=0.24.2
- **Affected**: `vitest@^1.0.0` uses vulnerable vite/esbuild
- **Fix**: Updated to `vitest@^2.0.0` and `@vitest/coverage-v8@^2.0.0`
- **Note**: This may require minor test updates if breaking changes exist

#### webpack-dev-server (Moderate)

- **Issue**: Source code exposure vulnerability in <=5.2.0
- **Fix**: Updated to `webpack-dev-server@^5.2.2`
- **Impact**: Only affects development mode, not production

### 3. **rimraf Warning**

- Current version: `^5.0.5` ✅
- The warning was about old versions (<4), but we're already on 5.x
- No action needed

## Installation

After these changes, run:

```bash
npm install
```

This will:

1. Install the new Babel transform plugins
2. Update vitest to v2.x
3. Update webpack-dev-server to v5.2.2

## Testing Changes

After updating:

```bash
# Verify tests still work
npm test

# Check for remaining vulnerabilities
npm audit
```

## Breaking Changes (If Any)

### Vitest v2.x

- May require minor test syntax updates
- Check [Vitest migration guide](https://vitest.dev/guide/migration.html) if
  tests fail

### webpack-dev-server v5.x

- Configuration may need minor adjustments
- Check
  [webpack-dev-server changelog](https://github.com/webpack/webpack-dev-server/blob/master/CHANGELOG.md)

## CI/CD Impact

The CI workflows are configured to:

- ✅ Warn on moderate vulnerabilities (not fail)
- ✅ Continue if tests need adjustments
- ✅ Report vulnerabilities without blocking deployment

If CI still fails due to these packages, the workflows will show warnings rather
than hard failures.
