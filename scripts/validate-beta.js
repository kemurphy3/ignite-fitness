#!/usr/bin/env node

/**
 * Beta Validation Script
 * Automated validation of beta-critical features
 */

const fs = require('fs');
const path = require('path');

class BetaValidator {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: [],
    };
  }

  async validate() {
    console.log('🧪 Running Beta Validation...\n');

    await this.validateEnvironment();
    await this.validateCodeQuality();
    await this.validateFeatures();
    await this.validatePerformance();
    await this.validateSecurity();

    this.generateReport();
    this.exitWithStatus();
  }

  async validateEnvironment() {
    console.log('📦 Validating Environment...');

    this.test(
      'Environment templates exist',
      () => fs.existsSync('env.example') && fs.existsSync('.env.example')
    );

    this.test('Package manifest exists', () => fs.existsSync('package.json'));

    this.test('Demo setup script present', () => fs.existsSync('scripts/setup-demo.js'));

    this.test('Beta checklist available', () => fs.existsSync('docs/beta_checklist.md'));
  }

  async validateCodeQuality() {
    console.log('🔍 Validating Code Quality...');

    this.test('ESLint configuration exists', () => fs.existsSync('.eslintrc.js'));
    this.test('Prettier configuration exists', () => fs.existsSync('.prettierrc.js'));
    this.test('TypeScript configuration exists', () => fs.existsSync('jsconfig.json'));
    this.test('EditorConfig present', () => fs.existsSync('.editorconfig'));
  }

  async validateFeatures() {
    console.log('⚙️ Validating Beta Features...');

    this.test('Soccer-shape workout module present', () =>
      this.fileContains('js/modules/workout', 'soccer_shape')
    );

    this.test('Load guardrails module present', () =>
      fs.existsSync('js/modules/load/LoadGuardrails.js')
    );

    this.test('Week view module present', () => fs.existsSync('js/modules/ui/WeekView.js'));

    this.test('Substitution logic available', () =>
      this.fileContains('js/modules', 'substitution')
    );
  }

  async validatePerformance() {
    console.log('⚡ Validating Performance...');

    this.test(
      'Performance scripts available',
      () => fs.existsSync('scripts/perf-budget.js') && fs.existsSync('lighthouse-ci.json')
    );

    this.test('Demo configuration exists', () => fs.existsSync('data/demo-config.json'));
  }

  async validateSecurity() {
    console.log('🔒 Validating Security...');

    this.test('Security headers configured', () => this.fileContains('env.example', 'CSP_ENABLED'));

    this.test(
      'No obvious secrets committed',
      () =>
        !this.containsDangerousPatterns([
          /SUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!your-)/i,
          /JWT_SECRET\s*=\s*(?!your-)/i,
          /API_KEY\s*=\s*(?!your-)/i,
        ])
    );
  }

  test(name, fn) {
    try {
      const ok = fn();
      if (ok) {
        console.log(`  ✅ ${name}`);
        this.results.passed += 1;
        this.results.tests.push({ name, status: 'passed' });
      } else {
        console.log(`  ❌ ${name}`);
        this.results.failed += 1;
        this.results.tests.push({ name, status: 'failed' });
      }
    } catch (error) {
      console.log(`  ❌ ${name} - ${error.message}`);
      this.results.failed += 1;
      this.results.tests.push({ name, status: 'failed', error: error.message });
    }
  }

  fileContains(targetPath, keyword) {
    try {
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        const files = this.collectFiles(targetPath);
        return files.some(file => this.fileContains(file, keyword));
      }
      const content = fs.readFileSync(targetPath, 'utf8');
      return content.toLowerCase().includes(keyword.toLowerCase());
    } catch (error) {
      return false;
    }
  }

  containsDangerousPatterns(patterns) {
    const files = this.collectFiles('js');
    return files.some(file => {
      try {
        const content = fs.readFileSync(file, 'utf8');
        return patterns.some(pattern => pattern.test(content));
      } catch (error) {
        return false;
      }
    });
  }

  collectFiles(dir, list = []) {
    if (!fs.existsSync(dir)) {
      return list;
    }
    const entries = fs.readdirSync(dir);
    entries.forEach(entry => {
      const full = path.join(dir, entry);
      const stats = fs.statSync(full);
      if (stats.isDirectory()) {
        this.collectFiles(full, list);
      } else if (full.endsWith('.js')) {
        list.push(full);
      }
    });
    return list;
  }

  generateReport() {
    console.log('\n📊 Beta Validation Report');
    console.log('==========================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);

    const total = this.results.passed + this.results.failed;
    const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : '0.0';
    console.log(`📈 Pass Rate: ${passRate}%`);

    const betaReady = this.results.failed === 0 && this.results.passed >= 10;
    console.log(`\n🎯 Beta Ready: ${betaReady ? 'YES' : 'NO'}`);

    const report = {
      passed: betaReady,
      passRate: Number(passRate),
      message: betaReady
        ? `All ${this.results.passed} validation tests passed. Ready for beta testing.`
        : `${this.results.failed} tests failed. Review beta checklist and fix issues.`,
    };

    fs.writeFileSync('beta-results.json', JSON.stringify(report, null, 2));
  }

  exitWithStatus() {
    if (this.results.failed > 0) {
      console.log('\n❌ Beta validation failed. See report above.');
      process.exit(1);
    }
    console.log('\n🎉 Beta validation passed!');
    process.exit(0);
  }
}

if (require.main === module) {
  const validator = new BetaValidator();
  validator.validate().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = BetaValidator;
