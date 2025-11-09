#!/usr/bin/env node

/**
 * Beta Setup Script
 * Prepares repository for beta testing with all quality gates
 */

const { execSync } = require('child_process');

class BetaSetup {
  async setup() {
    console.log('🚀 Setting up beta testing environment...\n');

    await this.installHooks();
    await this.runQualityChecks();
    await this.seedDemoData();
    await this.runBetaValidation();

    this.showSummary();
  }

  async installHooks() {
    console.log('🪝 Installing Git hooks...');
    try {
      execSync('npx husky install', { stdio: 'inherit' });
      execSync('npx husky add .husky/pre-commit "npm run pre-commit"', { stdio: 'inherit' });
      console.log('✅ Git hooks installed');
    } catch (error) {
      console.log('⚠️  Unable to install husky hooks automatically');
      console.log('   Run "npx husky install" manually to enable git hooks.');
    }
  }

  async runQualityChecks() {
    console.log('\n🔍 Running quality checks...');
    try {
      execSync('npm run quality:check', { stdio: 'inherit' });
      console.log('✅ Code quality checks passed');
    } catch (error) {
      console.log('❌ Code quality checks failed. Run "npm run quality:fix" to resolve issues.');
      throw error;
    }
  }

  async seedDemoData() {
    console.log('\n🎬 Seeding demo environment...');
    try {
      execSync('npm run demo:seed', { stdio: 'inherit' });
      console.log('✅ Demo data seeded');
    } catch (error) {
      console.log('⚠️  Demo data seeding failed. Demo mode may be limited.');
    }
  }

  async runBetaValidation() {
    console.log('\n🧪 Running beta validation...');
    try {
      execSync('npm run beta:validate', { stdio: 'inherit' });
      console.log('✅ Beta validation passed');
    } catch (error) {
      console.log('❌ Beta validation failed. Review docs/beta_checklist.md');
      throw error;
    }
  }

  showSummary() {
    console.log('\n🎉 Beta setup complete!');
    console.log('========================');
    console.log('\nNext Steps:');
    console.log('1. Run "npm run demo" to launch the demo environment');
    console.log('2. Follow docs/beta_checklist.md for full validation');
    console.log('3. Test on multiple browsers and devices');
    console.log('4. Report issues with detailed reproduction steps');

    console.log('\nHelpful Commands:');
    console.log('• npm run quality:check  → Run lint, format, typecheck');
    console.log('• npm run test:ci        → Run unit + integration tests');
    console.log('• npm run beta:validate  → Re-run beta validation');

    console.log('\n📖 Documentation: docs/beta_checklist.md');
  }
}

if (require.main === module) {
  const setup = new BetaSetup();
  setup.setup().catch(error => {
    console.error('\n❌ Beta setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = BetaSetup;
