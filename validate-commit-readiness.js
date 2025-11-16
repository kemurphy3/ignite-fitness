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
