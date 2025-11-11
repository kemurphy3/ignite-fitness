# DevOps & CI/CD Recommendations

## Executive Summary

**Current State: Manual Deployment Only** ❌  
**DevOps Maturity: Level 1/5** (Ad-hoc processes)  
**Recommended Target: Level 3/5** (Automated CI/CD with testing)

## Current State Analysis

### ✅ What's Working

- Simple deployment via Netlify CLI
- Git version control in use
- Environment variables configured in Netlify

### ❌ What's Missing

- No automated testing
- No code quality checks
- No CI/CD pipeline
- No pre-commit hooks
- No dependency scanning
- No performance monitoring
- No error tracking
- No deployment rollback strategy

## Immediate Setup (Day 1)

### 1. Add Essential Scripts to package.json

```json
{
  "name": "ignitefitness",
  "version": "1.0.0",
  "scripts": {
    "dev": "netlify dev",
    "build": "npm run lint && npm run test:unit",
    "deploy": "netlify deploy --prod",
    "deploy:preview": "netlify deploy",

    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "test:integration": "jest --testPathPattern=__tests__/integration --runInBand",
    "test:e2e": "playwright test",
    "test:coverage": "jest --coverage --coverageDirectory=coverage",

    "lint": "eslint . --ext .js,.jsx",
    "lint:fix": "eslint . --ext .js,.jsx --fix",
    "format": "prettier --write '**/*.{js,json,md,css,html}'",
    "format:check": "prettier --check '**/*.{js,json,md,css,html}'",

    "security:audit": "npm audit --audit-level=moderate",
    "security:check": "eslint --plugin security .",
    "security:secrets": "trufflehog filesystem . --json",

    "db:migrate": "node scripts/migrate.js",
    "db:seed": "node scripts/seed.js",
    "db:reset": "node scripts/reset.js",

    "precommit": "npm run lint && npm run format:check && npm run test:unit",
    "prepush": "npm run test"
  },
  "devDependencies": {
    "eslint": "^8.50.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-security": "^1.7.1",
    "prettier": "^3.0.3",
    "jest": "^29.7.0",
    "@playwright/test": "^1.39.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.0.2",
    "dotenv": "^16.3.1",
    "autocannon": "^7.14.0"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.9.5",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "@sentry/node": "^7.77.0"
  }
}
```

### 2. ESLint Configuration (.eslintrc.js)

```javascript
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: ['airbnb-base', 'plugin:security/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'security/detect-object-injection': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'max-len': ['error', { code: 120 }],
  },
  ignorePatterns: ['node_modules/', 'coverage/', '.netlify/', 'dist/'],
};
```

### 3. Prettier Configuration (.prettierrc)

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### 4. Git Hooks with Husky

```bash
# Install and configure Husky
npm install --save-dev husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run precommit"

# Add pre-push hook
npx husky add .husky/pre-push "npm run prepush"
```

### 5. Lint-staged Configuration (.lintstagedrc.json)

```json
{
  "*.js": ["eslint --fix", "prettier --write"],
  "*.{json,md,css,html}": ["prettier --write"],
  "*.sql": ["sqlfluff fix"],
  "package.json": ["npm audit fix"]
}
```

## GitHub Actions CI/CD Pipeline

### Main CI Pipeline (.github/workflows/ci.yml)

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  # Job 1: Linting and Formatting
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check Prettier formatting
        run: npm run format:check

      - name: Security audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

  # Job 2: Unit Tests
  test-unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          flags: unittests

  # Job 3: Integration Tests
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npm run db:migrate
          npm run db:seed
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/testdb

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/testdb
          JWT_SECRET: test-secret-key
          NODE_ENV: test

  # Job 4: Security Scanning
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

  # Job 5: Build and Deploy Preview
  deploy-preview:
    name: Deploy Preview
    needs: [quality, test-unit, test-integration]
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Deploy to Netlify Preview
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: '.'
          production-deploy: false
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-message: 'PR #${{ github.event.pull_request.number }}'
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Production Deployment (.github/workflows/deploy.yml)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: '.'
          production-deploy: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

## Testing Strategy

### Unit Test Example (**tests**/unit/auth.test.js)

```javascript
const {
  verifyJWT,
  generateTestToken,
} = require('../../netlify/functions/utils/auth');

describe('Auth Utils', () => {
  describe('verifyJWT', () => {
    it('should verify valid token', async () => {
      const userId = 'test-user-123';
      const token = generateTestToken(userId);
      const headers = { authorization: `Bearer ${token}` };

      const result = await verifyJWT(headers);
      expect(result).toBe(userId);
    });

    it('should return null for invalid token', async () => {
      const headers = { authorization: 'Bearer invalid-token' };
      const result = await verifyJWT(headers);
      expect(result).toBeNull();
    });

    it('should return null for missing token', async () => {
      const result = await verifyJWT({});
      expect(result).toBeNull();
    });
  });
});
```

### Integration Test Example (**tests**/integration/sessions.test.js)

```javascript
const { handler } = require('../../netlify/functions/sessions-create');

describe('Sessions API', () => {
  beforeAll(async () => {
    // Setup test database
    await setupTestDB();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestDB();
  });

  describe('POST /sessions-create', () => {
    it('should create a new session', async () => {
      const event = {
        httpMethod: 'POST',
        headers: { 'x-api-key': 'test-key' },
        body: JSON.stringify({
          type: 'workout',
          duration_minutes: 60,
          notes: 'Test workout',
        }),
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('id');
      expect(body.data.type).toBe('workout');
    });

    it('should handle duplicate sessions', async () => {
      // Test deduplication logic
    });

    it('should validate required fields', async () => {
      // Test validation
    });
  });
});
```

## Environment Management

### .env.example

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Authentication
JWT_SECRET=your-jwt-secret-here-min-32-chars
ADMIN_KEY=your-admin-api-key

# Strava Integration
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret

# AI Services
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
NEW_RELIC_LICENSE_KEY=xxx

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_STRAVA_SYNC=true

# Environment
NODE_ENV=development
APP_VERSION=1.0.0
```

### Environment Validation (scripts/validate-env.js)

```javascript
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STRAVA_CLIENT_ID',
  'STRAVA_CLIENT_SECRET',
];

const optional = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'SENTRY_DSN'];

function validateEnv() {
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
    process.exit(1);
  }

  optional.forEach(key => {
    if (!process.env[key]) {
      console.warn(`Optional environment variable not set: ${key}`);
    }
  });

  console.log('✅ Environment validation passed');
}

validateEnv();
```

## Monitoring & Observability

### 1. Error Tracking with Sentry

```javascript
// netlify/functions/utils/monitoring.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});

function captureError(error, context = {}) {
  console.error('Error:', error);

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
      tags: {
        function: context.functionName,
        environment: process.env.NODE_ENV,
      },
    });
  }
}

module.exports = { captureError, Sentry };
```

### 2. Performance Monitoring

```javascript
// Add to all functions
const { performance } = require('perf_hooks');

function withPerformanceTracking(handler) {
  return async (event, context) => {
    const start = performance.now();

    try {
      const result = await handler(event, context);

      const duration = performance.now() - start;
      console.log('Performance:', {
        function: context.functionName,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: result.statusCode,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error('Performance (error):', {
        function: context.functionName,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message,
      });
      throw error;
    }
  };
}
```

### 3. Health Checks

```yaml
# netlify.toml additions
[[headers]]
  for = "/.netlify/functions/health"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"

[[redirects]]
  from = "/health"
  to = "/.netlify/functions/health"
  status = 200
```

## Database Migration Strategy

### Migration Script (scripts/migrate.js)

```javascript
const { neon } = require('@neondatabase/serverless');
const fs = require('fs').promises;
const path = require('path');

async function migrate() {
  const sql = neon(process.env.DATABASE_URL);

  // Track migrations
  await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Get migration files
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = await fs.readdir(migrationsDir);
  const migrations = files.filter(f => f.endsWith('.sql')).sort();

  // Execute pending migrations
  for (const file of migrations) {
    const existing = await sql`
      SELECT id FROM migrations WHERE filename = ${file}
    `;

    if (existing.length === 0) {
      console.log(`Running migration: ${file}`);
      const content = await fs.readFile(path.join(migrationsDir, file), 'utf8');

      await sql.begin(async sql => {
        await sql.unsafe(content);
        await sql`INSERT INTO migrations (filename) VALUES (${file})`;
      });

      console.log(`✅ Migration completed: ${file}`);
    }
  }

  console.log('All migrations completed');
}

migrate().catch(console.error);
```

## Deployment Rollback Strategy

### Automatic Rollback on Errors

```yaml
# In deploy.yml
- name: Health Check
  id: health
  run: |
    sleep 30  # Wait for deployment
    response=$(curl -f https://your-app.netlify.app/health || echo "failed")
    if [[ "$response" == "failed" ]]; then
      echo "Health check failed"
      exit 1
    fi

- name: Rollback on Failure
  if: failure() && steps.health.outcome == 'failure'
  uses: actions/github-script@v6
  with:
    script: |
      await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo: context.repo.repo,
        workflow_id: 'rollback.yml',
        ref: 'main',
        inputs: {
          deployment_id: '${{ steps.deploy.outputs.deployment_id }}'
        }
      });
```

## Performance Testing

### Load Testing Script (scripts/load-test.js)

```javascript
const autocannon = require('autocannon');

const instance = autocannon(
  {
    url: 'https://your-app.netlify.app/.netlify/functions/sessions-list',
    connections: 100,
    pipelining: 1,
    duration: 30,
    headers: {
      'X-API-Key': process.env.TEST_API_KEY,
    },
  },
  (err, result) => {
    if (err) {
      console.error('Load test failed:', err);
      process.exit(1);
    }

    console.log('Load Test Results:');
    console.log('Avg Latency:', result.latency.mean, 'ms');
    console.log('Requests/sec:', result.requests.mean);
    console.log('Errors:', result.errors);
    console.log('Timeouts:', result.timeouts);

    // Fail if performance degrades
    if (result.latency.mean > 500) {
      console.error('❌ Latency threshold exceeded');
      process.exit(1);
    }

    if (result.errors > 0) {
      console.error('❌ Errors occurred during load test');
      process.exit(1);
    }

    console.log('✅ Load test passed');
  }
);

instance.on('response', (client, statusCode, resBytes, responseTime) => {
  if (statusCode >= 400) {
    console.error(`Error ${statusCode} - Response time: ${responseTime}ms`);
  }
});
```

## Recommended Timeline

### Week 1 - Foundation

- ✅ Set up ESLint and Prettier
- ✅ Configure Husky pre-commit hooks
- ✅ Create basic unit tests
- ✅ Set up GitHub Actions CI

### Week 2 - Testing

- 📝 Write comprehensive unit tests
- 📝 Add integration tests
- 📝 Set up code coverage reporting
- 📝 Add load testing

### Week 3 - Monitoring

- 📊 Integrate Sentry for error tracking
- 📊 Add performance monitoring
- 📊 Set up alerts
- 📊 Create dashboards

### Month 2 - Advanced

- 🚀 Implement blue-green deployments
- 🚀 Add feature flags
- 🚀 Set up A/B testing
- 🚀 Implement canary releases

## DevOps Maturity Assessment

| Area                   | Current    | Target  | Actions Required    |
| ---------------------- | ---------- | ------- | ------------------- |
| Version Control        | ✅ Level 3 | Level 3 | Maintain            |
| CI/CD                  | ❌ Level 1 | Level 3 | Implement pipelines |
| Testing                | ❌ Level 1 | Level 3 | Add automated tests |
| Monitoring             | ❌ Level 1 | Level 3 | Add observability   |
| Security               | ⚠️ Level 2 | Level 3 | Add scanning        |
| Documentation          | ⚠️ Level 2 | Level 3 | Improve docs        |
| Infrastructure as Code | ❌ Level 1 | Level 3 | Add Terraform       |

## Conclusion

Implementing these DevOps practices will significantly improve code quality,
reduce bugs, and enable confident deployments. The estimated effort is 1-2 weeks
for basic CI/CD setup, with ongoing improvements over the following months.
Priority should be given to automated testing and security scanning before
production deployment.
