// tests/run-tests.js
// Test runner script for IgniteFitness

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

console.log('🧪 IgniteFitness Test Runner\n');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL not set. Please set it first:');
  console.log(
    '   $env:DATABASE_URL = "postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"'
  );
  process.exit(1);
}

// Check if .env.test exists
const envTestPath = join(process.cwd(), '.env.test');
if (!existsSync(envTestPath)) {
  console.log('⚠️  .env.test not found. Creating from .env...');

  try {
    const fs = await import('fs');
    const envContent = fs.readFileSync('.env', 'utf8');
    fs.writeFileSync(envTestPath, envContent);
    console.log('✅ .env.test created');
  } catch (error) {
    console.log('⚠️  Could not create .env.test, continuing with existing DATABASE_URL');
  }
}

console.log('🚀 Starting tests...\n');

try {
  // Run unit tests
  console.log('📊 Running Unit Tests...');
  execSync('npm run test:run -- tests/unit/', { stdio: 'inherit' });
  console.log('✅ Unit tests completed\n');

  // Run integration tests
  console.log('📊 Running Integration Tests...');
  execSync('npm run test:run -- tests/integration/', { stdio: 'inherit' });
  console.log('✅ Integration tests completed\n');

  // Run coverage report
  console.log('📊 Generating Coverage Report...');
  execSync('npm run test:coverage', { stdio: 'inherit' });
  console.log('✅ Coverage report generated\n');

  console.log('🎉 All tests completed successfully!');
} catch (error) {
  console.error('❌ Test run failed:', error.message);
  process.exit(1);
}
