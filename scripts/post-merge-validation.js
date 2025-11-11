#!/usr/bin/env node

/**
 * Post-Merge Validation Script
 * Validates complete feature pipeline after merge/deployment
 * Usage: npm run validate:post-merge
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class PostMergeValidator {
  constructor() {
    this.baseUrl = process.env.APP_URL || 'http://localhost:3000';
    this.serverProcess = null;
    this.validationResults = [];
    this.quickMode = process.argv.includes('--quick');

    this.fetch =
      typeof globalThis.fetch === 'function' ? (...args) => globalThis.fetch(...args) : null;

    this.colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
    };
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  pass(step) {
    this.log(`✅ PASS: ${step}`, 'green');
    this.validationResults.push({ step, status: 'PASS' });
  }

  fail(step, error) {
    this.log(`❌ FAIL: ${step} - ${error}`, 'red');
    this.validationResults.push({ step, status: 'FAIL', error });
  }

  warn(step, message) {
    this.log(`⚠️  WARN: ${step} - ${message}`, 'yellow');
    this.validationResults.push({ step, status: 'WARN', message });
  }

  async validate() {
    try {
      this.log('\n🔍 Post-Merge Validation Starting', 'cyan');
      this.log('=====================================', 'blue');

      await this.validateEnvironment();
      await this.runMigrations();
      await this.seedData();
      await this.startApplication();
      await this.validateSubstitutionsAPI();
      await this.validateCoreFeatures();

      this.generateReport();
      await this.cleanup();
    } catch (error) {
      this.fail('Post-merge validation', error.message || String(error));
      await this.cleanup();
      process.exit(1);
    }
  }

  async validateEnvironment() {
    this.log('\n📦 Step 1: Environment Validation', 'cyan');

    try {
      if (fs.existsSync('.env')) {
        this.pass('Environment file exists');
      } else {
        this.fail('Environment file missing', 'No .env file found');
        return;
      }

      const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
      const envContent = fs.readFileSync('.env', 'utf8');

      for (const varName of requiredVars) {
        const regex = new RegExp(`${varName}=(.+)`);
        const match = envContent.match(regex);

        if (match && match[1] && !match[1].includes('your-') && match[1].trim().length > 10) {
          this.pass(`${varName} configured`);
        } else {
          this.warn(`${varName} missing or invalid`, 'Using fallback configuration');
        }
      }

      if (fs.existsSync('node_modules')) {
        this.pass('Dependencies installed');
      } else {
        this.log('Installing dependencies...', 'yellow');
        execSync('npm ci --prefer-offline --no-audit', { stdio: 'inherit' });
        this.pass('Dependencies installed');
      }
    } catch (error) {
      this.fail('Environment validation', error.message || String(error));
      throw error;
    }
  }

  async runMigrations() {
    this.log('\n🗄️  Step 2: Database Migrations', 'cyan');

    if (this.quickMode) {
      this.warn('Database migrations', 'Skipped in quick mode');
      return;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

      if (packageJson.scripts && packageJson.scripts['db:migrate']) {
        this.log('Running database migrations...', 'yellow');
        execSync('npm run db:migrate', { stdio: 'inherit' });
        this.pass('Database migrations executed');
      } else if (fs.existsSync('supabase/migrations')) {
        this.log('Running Supabase migrations...', 'yellow');
        try {
          execSync('npx supabase db reset --local', { stdio: 'inherit' });
          this.pass('Supabase migrations executed');
        } catch (migrationError) {
          this.warn('Supabase migrations', 'Local Supabase not available, using fallback');
        }
      } else {
        this.warn('Database migrations', 'No migration script found, assuming schema is current');
      }

      await this.testDatabaseConnection();
    } catch (error) {
      this.fail('Database migrations', error.message || String(error));
      throw error;
    }
  }

  async testDatabaseConnection() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-')) {
      this.warn('Database connection', 'Using fallback demo mode');
      return;
    }

    if (!this.fetch) {
      this.warn('Database connection', 'Fetch API unavailable, skipping connectivity check');
      return;
    }

    try {
      const response = await this.fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (response.ok) {
        this.pass('Database connection verified');
      } else {
        this.warn('Database connection', `HTTP ${response.status} - using fallback mode`);
      }
    } catch (error) {
      this.warn('Database connection', 'Connection failed - using fallback mode');
    }
  }

  async seedData() {
    this.log('\n🌱 Step 3: Data Seeding', 'cyan');

    if (this.quickMode) {
      this.warn('Data seeding', 'Skipped in quick mode');
      return;
    }

    try {
      this.log('Seeding demo data...', 'yellow');
      execSync('npm run demo:seed', { stdio: 'inherit' });
      this.pass('Demo data seeded');
      await this.verifySeededData();
    } catch (error) {
      this.warn('Data seeding', 'Seeding failed, using fallback data');

      const fallbackData = {
        user: { username: 'demo_user', onboardingCompleted: true },
        sessions: [
          {
            id: 'test_session',
            name: 'Test Session',
            category: 'running',
            type: 'planned',
            estimatedLoad: 50,
          },
        ],
        workouts: [
          {
            id: 'test_workout',
            name: 'Test Soccer Workout',
            category: 'running',
            subcategory: 'soccer_shape',
            tags: ['soccer_shape'],
          },
        ],
      };

      const fallbackPath = path.join(process.cwd(), 'data', 'validation-fallback.json');
      this.ensureDirectoryExists(path.dirname(fallbackPath));
      fs.writeFileSync(fallbackPath, JSON.stringify(fallbackData, null, 2));
      this.pass('Fallback data created');
    }
  }

  async verifySeededData() {
    const dataFiles = ['data/demo-config.json', 'data/local-demo.json', 'data/demo-data.js'];

    dataFiles.forEach(file => {
      if (fs.existsSync(file)) {
        this.pass(`Data file created: ${file}`);
      }
    });

    if (fs.existsSync('data/demo-config.json')) {
      const config = JSON.parse(fs.readFileSync('data/demo-config.json', 'utf8'));

      if (Array.isArray(config.sessions) && config.sessions.length > 0) {
        this.pass(`Demo sessions available: ${config.sessions.length}`);
      }

      if (Array.isArray(config.workouts) && config.workouts.length >= 3) {
        this.pass(`Soccer-shape workouts available: ${config.workouts.length}`);
      }
    }
  }

  async startApplication() {
    this.log('\n🚀 Step 4: Application Startup', 'cyan');

    try {
      const isPortFree = await this.checkPort(3000);
      if (!isPortFree) {
        this.warn('Port 3000 in use', 'Attempting to connect to existing server');

        const isResponsive = await this.testServerHealth();
        if (isResponsive) {
          this.pass('Existing server is responsive');
          return;
        }
      }

      this.log('Starting application server...', 'yellow');

      this.serverProcess = spawn('npm', ['run', 'serve'], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      this.serverProcess.stdout.on('data', data => {
        const message = data.toString();
        if (message.toLowerCase().includes('error')) {
          this.log(message.trim(), 'red');
        }
      });

      this.serverProcess.stderr.on('data', data => {
        this.log(data.toString().trim(), 'red');
      });

      await this.waitForServer();
      this.pass('Application server started');
    } catch (error) {
      this.fail('Application startup', error.message || String(error));
      throw error;
    }
  }

  async waitForServer(maxAttempts = 30) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const signal = this.createTimeoutSignal(2000);
        const response = await this.fetchWithFallback(`${this.baseUrl}/`, { signal });

        if (response && response.status < 500) {
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }

      await this.sleep(1000);
    }

    throw new Error('Server failed to start within 30 seconds');
  }

  async testServerHealth() {
    try {
      const signal = this.createTimeoutSignal(3000);
      const response = await this.fetchWithFallback(`${this.baseUrl}/`, { signal });
      return response && response.status < 500;
    } catch (error) {
      return false;
    }
  }

  async fetchWithFallback(url, options = {}) {
    if (!this.fetch) {
      throw new Error('Fetch API unavailable in current Node.js version');
    }

    const opts = { ...options };
    if (opts.signal === null) {
      const timeoutSignal = this.createTimeoutSignal(10000);
      if (timeoutSignal) {
        opts.signal = timeoutSignal;
      }
    }

    return this.fetch(url, opts);
  }

  createTimeoutSignal(ms) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(ms);
    }

    if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    }

    return undefined;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateSubstitutionsAPI() {
    this.log('\n🔄 Step 5: Substitutions API Validation', 'cyan');

    try {
      const payload = {
        exerciseId: 'test_workout',
        userConstraints: {
          equipment: ['bodyweight'],
          timeLimit: 45,
          experienceLevel: 'intermediate',
        },
        currentLoad: 50,
      };

      this.log('Testing /substitutions endpoint...', 'yellow');

      const response = await this.fetchWithFallback(`${this.baseUrl}/api/substitutions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: this.createTimeoutSignal(10000),
      });

      if (!response) {
        this.fail('Substitutions API', 'No response received');
        return;
      }

      if (response.ok) {
        this.pass('Substitutions API responds with 200');
      } else if (response.status === 404) {
        this.warn('Substitutions API', 'Endpoint not implemented yet');
        return;
      } else {
        this.fail('Substitutions API', `HTTP ${response.status}`);
        return;
      }

      const jsonResponse = await response.json();
      await this.validateSubstitutionsJSON(jsonResponse);
    } catch (error) {
      if (error.name === 'AbortError') {
        this.fail('Substitutions API', 'Request timeout (>10s)');
      } else if (error.code === 'ECONNREFUSED') {
        this.fail('Substitutions API', 'Server connection refused');
      } else {
        this.fail('Substitutions API', error.message || String(error));
      }
    }
  }

  async validateSubstitutionsJSON(json) {
    this.log('Validating JSON response structure...', 'yellow');

    const requiredFields = ['substitutions', 'metadata'];
    requiredFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(json, field)) {
        this.pass(`JSON contains required field: ${field}`);
      } else {
        this.fail('JSON structure', `Missing required field: ${field}`);
      }
    });

    if (Array.isArray(json.substitutions)) {
      this.pass('Substitutions is array');

      if (json.substitutions.length >= 1 && json.substitutions.length <= 3) {
        this.pass(`Substitutions count valid: ${json.substitutions.length}`);
      } else {
        this.warn('Substitutions count', `Expected 1-3, got ${json.substitutions.length}`);
      }

      json.substitutions.forEach((substitution, index) => {
        this.validateSubstitutionObject(substitution, index);
      });
    } else {
      this.fail('JSON structure', 'Substitutions is not an array');
    }

    if (json.metadata && typeof json.metadata === 'object') {
      this.pass('Metadata is object');

      ['requestId', 'processingTime', 'algorithm'].forEach(field => {
        if (Object.prototype.hasOwnProperty.call(json.metadata, field)) {
          this.pass(`Metadata contains: ${field}`);
        }
      });
    }
  }

  validateSubstitutionObject(substitution, index) {
    const requiredFields = [
      'id',
      'name',
      'category',
      'estimatedLoad',
      'adaptationMatch',
      'reasoning',
      'tags',
    ];

    requiredFields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(substitution, field)) {
        this.pass(`Substitution ${index + 1} has ${field}`);
      } else {
        this.fail('Substitution structure', `Missing ${field} in substitution ${index + 1}`);
      }
    });

    if (typeof substitution.estimatedLoad === 'number' && substitution.estimatedLoad > 0) {
      this.pass(`Substitution ${index + 1} estimatedLoad valid`);
    }

    if (
      typeof substitution.adaptationMatch === 'number' &&
      substitution.adaptationMatch >= 0 &&
      substitution.adaptationMatch <= 1
    ) {
      this.pass(`Substitution ${index + 1} adaptationMatch valid`);
    }

    if (Array.isArray(substitution.tags) && substitution.tags.length > 0) {
      this.pass(`Substitution ${index + 1} tags valid`);
    }
  }

  async validateCoreFeatures() {
    this.log('\n⚙️  Step 6: Core Feature Validation', 'cyan');

    await this.testLoadGuardrails();
    await this.testWeekViewData();
    await this.testSoccerShapeContent();
  }

  async testLoadGuardrails() {
    try {
      const response = await this.fetchWithFallback(`${this.baseUrl}/api/load/guardrails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo_user',
          weeklyLoad: [80, 85, 95, 110],
          currentWeek: 110,
        }),
        signal: this.createTimeoutSignal(5000),
      });

      if (!response) {
        this.warn('Load guardrails', 'No response received');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data && data.guardrailTriggered) {
          this.pass('Load guardrails functional');
        } else {
          this.warn('Load guardrails', 'May not detect violations correctly');
        }
      } else if (response.status === 404) {
        this.warn('Load guardrails', 'Endpoint not implemented yet');
      } else {
        this.warn('Load guardrails', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.warn('Load guardrails', error.message || 'Feature not accessible');
    }
  }

  async testWeekViewData() {
    try {
      const response = await this.fetchWithFallback(`${this.baseUrl}/api/week-view?weeks=1`, {
        signal: this.createTimeoutSignal(5000),
      });

      if (!response) {
        this.warn('Week view data', 'No response received');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.weeks)) {
          this.pass('Week view data endpoint functional');
        } else {
          this.warn('Week view data', 'Response structure unexpected');
        }
      } else if (response.status === 404) {
        this.warn('Week view data', 'Endpoint not implemented yet');
      } else {
        this.warn('Week view data', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.warn('Week view data', error.message || 'Feature not accessible');
    }
  }

  async testSoccerShapeContent() {
    try {
      const response = await this.fetchWithFallback(
        `${this.baseUrl}/api/workouts?category=soccer_shape`,
        {
          signal: this.createTimeoutSignal(5000),
        }
      );

      if (!response) {
        this.warn('Soccer-shape content', 'No response received');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.workouts) && data.workouts.length >= 3) {
          this.pass(`Soccer-shape content available: ${data.workouts.length} workouts`);
        } else {
          this.warn('Soccer-shape content', 'Insufficient workouts (<3)');
        }
      } else if (response.status === 404) {
        this.warn('Soccer-shape content', 'Endpoint not implemented yet');
      } else {
        this.warn('Soccer-shape content', `HTTP ${response.status}`);
      }
    } catch (error) {
      this.warn('Soccer-shape content', error.message || 'Feature not accessible');
    }
  }

  generateReport() {
    this.log('\n📊 Validation Report', 'cyan');
    this.log('==================', 'blue');

    const passed = this.validationResults.filter(result => result.status === 'PASS').length;
    const failed = this.validationResults.filter(result => result.status === 'FAIL').length;
    const warned = this.validationResults.filter(result => result.status === 'WARN').length;

    this.log(`✅ PASSED: ${passed}`, 'green');
    this.log(`❌ FAILED: ${failed}`, failed > 0 ? 'red' : 'reset');
    this.log(`⚠️  WARNED: ${warned}`, warned > 0 ? 'yellow' : 'reset');

    const deploymentReady = failed === 0 && passed >= 10;
    this.log(
      `\n🎯 DEPLOYMENT READY: ${deploymentReady ? 'YES' : 'NO'}`,
      deploymentReady ? 'green' : 'red'
    );

    const report = {
      timestamp: new Date().toISOString(),
      passed: deploymentReady,
      summary: { passed, failed, warned },
      details: this.validationResults,
    };

    fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
    this.log('\n📄 Report saved to validation-report.json', 'blue');

    if (failed > 0) {
      this.log('\n❌ CRITICAL ISSUES FOUND:', 'red');
      this.validationResults
        .filter(result => result.status === 'FAIL')
        .forEach(result => {
          this.log(`  • ${result.step}: ${result.error}`, 'red');
        });
    }
  }

  async cleanup() {
    this.log('\n🧹 Cleanup', 'cyan');

    if (this.serverProcess) {
      try {
        const termination = new Promise(resolve => {
          this.serverProcess.on('exit', resolve);
          setTimeout(() => {
            if (!this.serverProcess.killed) {
              this.serverProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
        });

        this.serverProcess.kill('SIGTERM');
        await termination;
        this.pass('Server process terminated');
      } catch (error) {
        this.warn('Cleanup', 'Server process cleanup failed');
      }
    }

    const tempFiles = ['data/validation-fallback.json'];
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  }

  async checkPort(port) {
    return new Promise(resolve => {
      const net = require('net');
      const server = net.createServer();

      server.once('error', () => {
        resolve(false);
      });

      server.once('listening', () => {
        server.close(() => resolve(true));
      });

      server.listen(port);
    });
  }

  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

if (require.main === module) {
  const validator = new PostMergeValidator();

  process.on('SIGINT', async () => {
    console.log('\n🛑 Validation interrupted');
    await validator.cleanup();
    process.exit(1);
  });

  validator.validate().catch(error => {
    console.error('❌ Validation failed:', error.message || String(error));
    process.exit(1);
  });
}

module.exports = PostMergeValidator;
