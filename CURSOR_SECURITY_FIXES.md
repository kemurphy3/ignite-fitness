# Cursor Prompts: Security Vulnerability & Hardening Fixes

## SECURITY FIX 1: Critical Dependency Vulnerabilities

````
CONTEXT: 5 npm security vulnerabilities (3 moderate, 2 critical) must be resolved

STEP 1: Identify exact vulnerabilities
```bash
npm audit --json > audit-report.json
npm audit --audit-level moderate
````

STEP 2: Systematic vulnerability resolution

CRITICAL VULNERABILITIES (Fix First):

1. If webpack-dev-server vulnerable:

```bash
npm install webpack-dev-server@latest
npm test # Verify compatibility
```

2. If @babel/traverse vulnerable:

```bash
npm install @babel/traverse@latest
npm test # Verify compatibility
```

MODERATE VULNERABILITIES:

1. If postcss vulnerable:

```bash
npm install postcss@latest postcss-loader@latest
npm run build # Verify CSS processing works
```

2. If terser vulnerable:

```bash
npm install terser-webpack-plugin@latest
npm run build # Verify minification works
```

STEP 3: Apply automatic fixes

```bash
npm audit fix
npm audit fix --force # Only if automatic fix insufficient
```

STEP 4: Manual review of package-lock.json changes

- Check for major version bumps
- Test critical functionality after updates
- Rollback if compatibility issues found

VALIDATION:

```bash
npm audit # Must show 0 high/critical vulnerabilities
npm run build # Must complete successfully
npm run test # Must pass all tests
```

```

## SECURITY FIX 2: Authentication Hardening

```

CONTEXT: Strengthen authentication and session management security

FILES TO HARDEN:

- js/modules/auth/AuthManager.js
- js/modules/auth/SessionManager.js
- netlify/functions/utils/auth.js

SESSION SECURITY IMPROVEMENTS:

1. Add session token validation:

```javascript
// In SessionManager.js
validateSessionToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token format');
  }

  if (token.length < 32) {
    throw new Error('Token too short');
  }

  // Add expiration check
  const payload = this.decodeToken(token);
  if (payload.exp < Date.now()) {
    throw new Error('Token expired');
  }

  return payload;
}

// Add secure token generation
generateSecureToken() {
  const crypto = require('crypto');
  const payload = {
    userId: this.userId,
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
    iat: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };

  return this.signToken(payload);
}
```

2. Add rate limiting for auth endpoints:

```javascript
// In netlify/functions/utils/auth.js
const rateLimiter = new Map();

function checkRateLimit(
  identifier,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
) {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!rateLimiter.has(identifier)) {
    rateLimiter.set(identifier, []);
  }

  const attempts = rateLimiter
    .get(identifier)
    .filter(timestamp => timestamp > windowStart);

  if (attempts.length >= maxAttempts) {
    throw new Error('Rate limit exceeded');
  }

  attempts.push(now);
  rateLimiter.set(identifier, attempts);
}
```

3. Secure password handling:

```javascript
// Add password strength validation
function validatePasswordStrength(password) {
  const minLength = 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    throw new Error('Password must be at least 8 characters');
  }

  if (!(hasUpper && hasLower && hasNumber && hasSymbol)) {
    throw new Error(
      'Password must contain uppercase, lowercase, number, and symbol'
    );
  }
}
```

APPLY THESE SECURITY MEASURES TO AUTH FLOWS

```

## SECURITY FIX 3: XSS Prevention Hardening

```

CONTEXT: Strengthen XSS protection in HTML sanitization and user inputs

FILES TO HARDEN:

- js/modules/utils/htmlSanitizer.js
- js/modules/ui/components/\* (all UI components)

HTML SANITIZATION IMPROVEMENTS:

1. Enhance htmlSanitizer.js:

```javascript
class HTMLSanitizer {
  constructor() {
    this.allowedTags = [
      'p',
      'br',
      'strong',
      'em',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
    ];
    this.allowedAttributes = {
      a: ['href'],
      img: ['src', 'alt', 'width', 'height'],
    };
  }

  sanitize(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Remove all script tags and event handlers
    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '');

    // Allow only whitelisted tags
    const tagRegex = /<(\/?)([\w-]+)([^>]*)>/g;
    cleaned = cleaned.replace(tagRegex, (match, slash, tag, attrs) => {
      const lowerTag = tag.toLowerCase();

      if (!this.allowedTags.includes(lowerTag)) {
        return '';
      }

      // Sanitize attributes
      const cleanAttrs = this.sanitizeAttributes(lowerTag, attrs);
      return `<${slash}${lowerTag}${cleanAttrs}>`;
    });

    return cleaned;
  }

  sanitizeAttributes(tag, attrs) {
    if (!attrs || !this.allowedAttributes[tag]) {
      return '';
    }

    const allowedForTag = this.allowedAttributes[tag];
    const attrRegex = /(\w+)=["']([^"']*)["']/g;
    let match;
    const cleanAttrs = [];

    while ((match = attrRegex.exec(attrs)) !== null) {
      const [, attrName, attrValue] = match;

      if (allowedForTag.includes(attrName.toLowerCase())) {
        // Additional validation for specific attributes
        if (attrName === 'href' && this.isValidURL(attrValue)) {
          cleanAttrs.push(`${attrName}="${attrValue}"`);
        } else if (attrName !== 'href') {
          cleanAttrs.push(`${attrName}="${attrValue}"`);
        }
      }
    }

    return cleanAttrs.length ? ' ' + cleanAttrs.join(' ') : '';
  }

  isValidURL(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
}
```

2. Input validation for UI components:

```javascript
// Add to all form input handlers
function sanitizeUserInput(input) {
  if (typeof input !== 'string') {
    return String(input);
  }

  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['"]/g, '') // Remove quotes
    .trim()
    .slice(0, 1000); // Limit length
}

// Use in component render methods:
render() {
  const safeContent = this.htmlSanitizer.sanitize(this.content);
  return `<div>${safeContent}</div>`;
}
```

APPLY SANITIZATION TO ALL USER-GENERATED CONTENT

```

## SECURITY FIX 4: Database Security Hardening

```

CONTEXT: Secure database connections and prevent SQL injection

FILES TO HARDEN:

- netlify/functions/utils/database.js
- netlify/functions/utils/safe-query.js
- All database query functions

SQL INJECTION PREVENTION:

1. Parameterized query enforcement:

```javascript
// In safe-query.js - enhance existing implementation
class SafeQuery {
  static validate(query, params = []) {
    // Detect potential SQL injection patterns
    const dangerousPatterns = [
      /;\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER)/i,
      /UNION\s+SELECT/i,
      /'.*OR.*'.*=.*'/i,
      /--/,
      /\/\*.*\*\//,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error('Potentially unsafe query detected');
      }
    }

    // Ensure all dynamic values use parameters
    const dynamicValuePattern = /\$\d+/g;
    const expectedParams = (query.match(dynamicValuePattern) || []).length;

    if (params.length !== expectedParams) {
      throw new Error(
        `Parameter count mismatch: expected ${expectedParams}, got ${params.length}`
      );
    }
  }

  static async execute(pool, query, params = []) {
    this.validate(query, params);

    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      // Log error without exposing sensitive details
      console.error('Database query failed:', {
        error: error.message,
        queryHash: this.hashQuery(query),
      });
      throw new Error('Database operation failed');
    }
  }

  static hashQuery(query) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query).digest('hex').slice(0, 8);
  }
}
```

2. Connection pool security:

```javascript
// In connection-pool.js
class SecureConnectionPool {
  constructor(config) {
    this.config = {
      ...config,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: true }
          : false,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 20, // Limit connections
      min: 2,
    };

    // Validate connection string
    if (!this.isValidConnectionString(config.connectionString)) {
      throw new Error('Invalid database connection string');
    }
  }

  isValidConnectionString(connStr) {
    try {
      const url = new URL(connStr);
      return ['postgresql:', 'postgres:'].includes(url.protocol);
    } catch {
      return false;
    }
  }
}
```

3. Data validation before database operations:

```javascript
// Add input validation layer
function validateDatabaseInput(data, schema) {
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null)) {
      throw new Error(`Required field missing: ${field}`);
    }

    if (value !== undefined && rules.type && typeof value !== rules.type) {
      throw new Error(`Invalid type for ${field}: expected ${rules.type}`);
    }

    if (
      rules.maxLength &&
      typeof value === 'string' &&
      value.length > rules.maxLength
    ) {
      throw new Error(`Field ${field} exceeds maximum length`);
    }
  }
}
```

APPLY THESE PATTERNS TO ALL DATABASE OPERATIONS

```

## SECURITY FIX 5: Content Security Policy Implementation

```

CONTEXT: Add Content Security Policy headers for XSS protection

FILES TO MODIFY:

- netlify.toml (or \_headers file)
- index.html

CSP HEADER CONFIGURATION:

1. Add to netlify.toml:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' *.netlify.app *.supabase.co; frame-src 'none'; object-src 'none'; base-uri 'self'"
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

2. Add meta tags to index.html:

```html
<!-- Security Meta Tags -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com;"
/>
<meta http-equiv="X-Content-Type-Options" content="nosniff" />
<meta http-equiv="X-Frame-Options" content="DENY" />
<meta http-equiv="X-XSS-Protection" content="1; mode=block" />
```

3. Implement CSP violation reporting:

```javascript
// Add to main.js
window.addEventListener('securitypolicyviolation', event => {
  console.warn('CSP Violation:', {
    blockedURI: event.blockedURI,
    violatedDirective: event.violatedDirective,
    originalPolicy: event.originalPolicy,
  });

  // Report to monitoring service if available
  if (window.analytics) {
    window.analytics.track('csp_violation', {
      directive: event.violatedDirective,
      uri: event.blockedURI,
    });
  }
});
```

GRADUAL CSP IMPLEMENTATION:

- Start with report-only mode
- Monitor violations
- Tighten policy gradually

```

## SECURITY FIX 6: Environment Variable Security

```

CONTEXT: Secure handling of environment variables and secrets

FILES TO REVIEW:

- netlify/functions/\* (all function files)
- js/app.js (client-side config)

SECRET MANAGEMENT IMPROVEMENTS:

1. Environment variable validation:

```javascript
// Add to netlify/functions/_base.js
function validateEnvironment() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }
}

// Call at function startup
validateEnvironment();
```

2. Client-side config sanitization:

```javascript
// In public-config.js function
exports.handler = async (event, context) => {
  const safeConfig = {
    apiUrl: process.env.NETLIFY_URL || 'http://localhost:8888',
    environment: process.env.NODE_ENV || 'development',
    features: {
      strava: !!process.env.STRAVA_CLIENT_ID,
      analytics: !!process.env.ANALYTICS_ID,
    },
    // NEVER expose: JWT_SECRET, DATABASE_URL, API_KEYS
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
    body: JSON.stringify(safeConfig),
  };
};
```

3. Secret rotation preparation:

```javascript
// Add secret versioning support
function getSecret(name, version = 'current') {
  const versionedKey = version === 'current' ? name : `${name}_${version}`;
  return process.env[versionedKey];
}

// Use in auth functions
const currentSecret = getSecret('JWT_SECRET');
const previousSecret = getSecret('JWT_SECRET', 'previous'); // For rotation period
```

AUDIT ALL FILES FOR EXPOSED SECRETS

```

## FINAL SECURITY VALIDATION

```

CONTEXT: Comprehensive security validation script

FILE: validate-security.js

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class SecurityValidator {
  constructor() {
    this.issues = [];
  }

  checkForHardcodedSecrets() {
    const secretPatterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i,
      /\b[A-Za-z0-9]{32,}\b/, // Long alphanumeric strings
    ];

    this.scanFiles('js/', secretPatterns, 'Potential hardcoded secret');
    this.scanFiles(
      'netlify/functions/',
      secretPatterns,
      'Potential hardcoded secret'
    );
  }

  checkForXSSVulnerabilities() {
    const xssPatterns = [
      /innerHTML\s*=\s*[^'"]/, // Unescaped innerHTML
      /document\.write\s*\(/, // document.write usage
      /eval\s*\(/, // eval usage
      /Function\s*\(/, // Function constructor
    ];

    this.scanFiles('js/', xssPatterns, 'Potential XSS vulnerability');
  }

  checkForSQLInjection() {
    const sqlPatterns = [
      /query\s*\(\s*['"`][^'"`]*\$\{/, // String interpolation in queries
      /query\s*\(\s*['"`][^'"`]*\+/, // String concatenation in queries
    ];

    this.scanFiles(
      'netlify/functions/',
      sqlPatterns,
      'Potential SQL injection'
    );
  }

  scanFiles(dir, patterns, issueType) {
    const files = this.getAllFiles(dir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        patterns.forEach(pattern => {
          if (pattern.test(line)) {
            this.issues.push({
              type: issueType,
              file: file,
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      });
    }
  }

  getAllFiles(dir) {
    const files = [];

    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (
          stat.isDirectory() &&
          !item.startsWith('.') &&
          item !== 'node_modules'
        ) {
          traverse(fullPath);
        } else if (stat.isFile() && item.endsWith('.js')) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  validate() {
    console.log('🔒 Security Validation Starting...\n');

    this.checkForHardcodedSecrets();
    this.checkForXSSVulnerabilities();
    this.checkForSQLInjection();

    if (this.issues.length === 0) {
      console.log('✅ No security issues detected');
      return true;
    } else {
      console.log(
        `❌ Found ${this.issues.length} potential security issues:\n`
      );

      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.type}`);
        console.log(`   File: ${issue.file}:${issue.line}`);
        console.log(`   Code: ${issue.content}`);
        console.log('');
      });

      return false;
    }
  }
}

const validator = new SecurityValidator();
const isSecure = validator.validate();

process.exit(isSecure ? 0 : 1);
```

RUN: node validate-security.js

```

```
