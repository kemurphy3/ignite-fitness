# Pre-Flight Checks

Use these commands to catch syntax errors **before** running the app:

## Quick Commands

```bash
# Check for syntax errors (await, duplicates, etc.)
npm run test:syntax

# Check for case-sensitive import issues
npm run test:imports

# Run all pre-flight checks
npm run lint

# Full test suite
npm run test:all
```

## What Gets Checked

### Syntax Checker (`npm run test:syntax`)

- ✅ `await` outside async functions
- ✅ Duplicate `const`/`let` declarations
- ✅ Missing async keywords

### Import Checker (`npm run test:imports`)

- ✅ Case-sensitive file names
- ✅ Missing import files
- ✅ Broken module paths

## Common Issues Fixed Automatically

1. **`await` outside async** → Add `async` keyword to function
2. **Duplicate declarations** → Use unique namespaces (`window.testPrompts05`,
   etc.)
3. **Missing files** → Fix import paths or create missing files

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Pre-flight checks
  run: npm run lint
```

This will catch errors **before** deployment! 🚀
