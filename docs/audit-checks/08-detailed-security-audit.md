# Security Audit Report - Ignite Fitness

**Audit Date:** September 25, 2025  
**Auditor:** Security Analysis Team  
**Scope:** Entire repository - Netlify Functions + Neon Postgres + PWA  
**Overall Security Score: 45/100** - Critical improvements required

## 🔴 HIGH Priority Findings

### H1. Exposed Secrets in Test Files
**Severity:** HIGH  
**Files Affected:**
- `/test-user-preferences.js:14` - Hardcoded JWT token
- `/test-admin-analytics.js:12` - Admin token in plaintext
- `/test-strava-import.js:8` - Strava access token exposed
- `/test-user-profiles.js` - Multiple credentials

**Current Issue:**
```javascript
// test-user-preferences.js:14 - INSECURE
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...actual.token.here';
const adminToken = 'test-admin-token-123';
```

**Required Fix:**
```javascript
// Use environment variables for all test credentials
const testToken = process.env.TEST_JWT_TOKEN || 'mock-token-for-testing';
const adminToken = process.env.TEST_ADMIN_TOKEN || 'mock-admin-token';

// Add to .env.test (and add to .gitignore)
// TEST_JWT_TOKEN=your-test-token
// TEST_ADMIN_TOKEN=your-admin-token
```

### H2. Unauthenticated Admin Endpoints
**Severity:** CRITICAL  
**Files Affected:**
- `/netlify/functions/admin-get-all-users.js` - No authentication
- `/netlify/functions/test-db-connection.js` - Exposes database structure
- `/netlify/functions/ai-proxy.js` - No auth, unlimited API usage
- `/netlify/functions/strava-proxy.js` - No auth, rate limit bypass

**Fix for admin-get-all-users.js (Line 44):**
```javascript
const { verifyAdminJWT } = require('./utils/admin-auth');

exports.handler = async (event) => {
    // ADD THIS AUTHENTICATION BLOCK
    try {
        const adminId = await verifyAdminJWT(event.headers);
        if (!adminId) {
            return { 
                statusCode: 401, 
                body: JSON.stringify({ error: 'Unauthorized' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }
        
        // Verify admin role in database
        const isAdmin = await sql`
            SELECT role FROM users 
            WHERE id = ${adminId} AND role = 'admin'
        `;
        
        if (!isAdmin.length) {
            return { 
                statusCode: 403, 
                body: JSON.stringify({ error: 'Admin access required' }),
                headers: { 'Content-Type': 'application/json' }
            };
        }
    } catch (error) {
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'Invalid token' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
    
    // Existing code continues...
```

### H3. Client-Side Environment Variable Access
**Severity:** HIGH  
**Files Affected:**
- `/js/app.js:1823` - Attempts to access process.env
- `/config.js` - API configuration exposed
- `/js/core/data-store.js` - Contains API endpoints

**Current Issue:**
```javascript
// js/app.js:1823 - INSECURE (won't work in browser)
const apiKey = process.env.OPENAI_API_KEY; // This exposes intent to use key client-side
```

**Required Fix:**
```javascript
// js/app.js - SECURE - Always proxy through serverless functions
async function callAI(prompt) {
    const response = await fetch('/.netlify/functions/ai-proxy', {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
    });
    return response.json();
}
```

### H4. JWT Secret Exposed in Logs
**Severity:** HIGH  
**Files Affected:**
- `/netlify/functions/utils/auth.js:16`
- Multiple functions logging full error objects

**Current Issue:**
```javascript
// utils/auth.js:16 - INSECURE
console.error('JWT verification failed:', error.message); // May contain secret
```

**Required Fix:**
```javascript
// utils/auth.js - SECURE
console.error('JWT verification failed:', {
    type: error.name,
    timestamp: new Date().toISOString(),
    userId: decoded?.sub || 'unknown',
    // Never log: error.message, token, secret
});
```

### H5. SQL Injection Vulnerabilities
**Severity:** CRITICAL  
**Files Affected:**
- `/netlify/functions/admin-users-top.js:60` - String concatenation
- `/netlify/functions/admin-sessions-series.js` - Dynamic ORDER BY
- `/netlify/functions/admin-sessions-by-type.js` - Dynamic queries

**Current Issue:**
```javascript
// admin-users-top.js:60 - VULNERABLE
const query = `
    SELECT * FROM users 
    WHERE role = '${role}'  -- SQL INJECTION!
    ORDER BY ${orderBy}     -- SQL INJECTION!
`;
```

**Required Fix:**
```javascript
// SECURE - Always use parameterized queries
const allowedOrderBy = ['created_at', 'updated_at', 'id'];
const safeOrderBy = allowedOrderBy.includes(orderBy) ? orderBy : 'id';

const result = await sql`
    SELECT * FROM users 
    WHERE role = ${role}
    ORDER BY ${sql.identifier([safeOrderBy])} DESC
`;

// For dynamic column names, use identifier
const column = sql.identifier(['user_id']);
await sql`SELECT ${column} FROM sessions`;
```

### H6. Strava Token Logging
**Severity:** HIGH  
**Files Affected:**
- `/netlify/functions/strava-refresh-token.js:143-144`
- `/netlify/functions/strava-oauth-exchange.js`
- `/netlify/functions/integrations-strava-import.js`

**Current Issue:**
```javascript
// strava-refresh-token.js:143 - INSECURE
console.log('Token response:', tokenResponse); // Logs access_token!
```

**Required Fix:**
```javascript
// SECURE - Never log sensitive tokens
console.log('Token refresh successful:', {
    athlete_id: tokenResponse.athlete?.id,
    expires_at: tokenResponse.expires_at,
    scope: tokenResponse.scope,
    // NEVER log: access_token, refresh_token
});

// Create safe logging helper
function logStravaEvent(event, data) {
    const safe = { ...data };
    delete safe.access_token;
    delete safe.refresh_token;
    delete safe.client_secret;
    console.log(`Strava ${event}:`, safe);
}
```

## 🟡 MEDIUM Priority Findings

### M1. Inconsistent Error Handling
**Severity:** MEDIUM  
**Pattern Found:** All functions have different error formats

**Create `/netlify/functions/utils/error-handler.js`:**
```javascript
const { logSafe } = require('./logger');

class APIError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
    }
}

function handleError(error, context = {}) {
    const requestId = context.requestId || crypto.randomUUID();
    
    // Log full error internally (with PII redaction)
    logSafe('error', 'Function error', {
        requestId,
        functionName: context.functionName,
        error: {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
    });
    
    // Return sanitized error to client
    if (error.isOperational) {
        return {
            statusCode: error.statusCode || 500,
            headers: { 
                'Content-Type': 'application/json',
                'X-Request-ID': requestId
            },
            body: JSON.stringify({
                error: {
                    code: error.code,
                    message: error.message,
                    requestId
                }
            })
        };
    }
    
    // Generic error for unexpected issues
    return {
        statusCode: 500,
        headers: { 
            'Content-Type': 'application/json',
            'X-Request-ID': requestId
        },
        body: JSON.stringify({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                requestId
            }
        })
    };
}

// Usage in functions
exports.handler = async (event, context) => {
    try {
        // Function logic...
    } catch (error) {
        return handleError(error, { 
            functionName: context.functionName,
            requestId: event.headers['x-request-id']
        });
    }
};

module.exports = { APIError, handleError };
```

### M2. Missing Rate Limiting
**Severity:** MEDIUM  
**Affected:** Most endpoints lack rate limiting

**Implement `/netlify/functions/utils/simple-rate-limiter.js`:**
```javascript
const rateLimitStore = new Map();

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000; // 1 minute
        this.maxRequests = options.maxRequests || 100;
        this.keyPrefix = options.keyPrefix || '';
    }
    
    async checkLimit(identifier) {
        const key = `${this.keyPrefix}:${identifier}`;
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        // Get or create request log
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, []);
        }
        
        const requests = rateLimitStore.get(key);
        
        // Remove old requests outside window
        const validRequests = requests.filter(time => time > windowStart);
        
        // Check if limit exceeded
        if (validRequests.length >= this.maxRequests) {
            const oldestRequest = validRequests[0];
            const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000);
            
            return {
                allowed: false,
                limit: this.maxRequests,
                remaining: 0,
                retryAfter,
                resetAt: new Date(oldestRequest + this.windowMs).toISOString()
            };
        }
        
        // Add current request
        validRequests.push(now);
        rateLimitStore.set(key, validRequests);
        
        // Cleanup old entries periodically
        if (Math.random() < 0.01) { // 1% chance
            this.cleanup();
        }
        
        return {
            allowed: true,
            limit: this.maxRequests,
            remaining: this.maxRequests - validRequests.length,
            resetAt: new Date(now + this.windowMs).toISOString()
        };
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, requests] of rateLimitStore.entries()) {
            const validRequests = requests.filter(time => time > now - this.windowMs);
            if (validRequests.length === 0) {
                rateLimitStore.delete(key);
            } else {
                rateLimitStore.set(key, validRequests);
            }
        }
    }
}

// Endpoint-specific limiters
const limiters = {
    'ai-proxy': new RateLimiter({ maxRequests: 10, windowMs: 60000 }),
    'sessions-create': new RateLimiter({ maxRequests: 30, windowMs: 60000 }),
    'default': new RateLimiter({ maxRequests: 100, windowMs: 60000 })
};

async function enforceRateLimit(userId, endpoint) {
    const limiter = limiters[endpoint] || limiters.default;
    const result = await limiter.checkLimit(userId);
    
    if (!result.allowed) {
        return {
            statusCode: 429,
            headers: {
                'X-RateLimit-Limit': result.limit,
                'X-RateLimit-Remaining': result.remaining,
                'X-RateLimit-Reset': result.resetAt,
                'Retry-After': result.retryAfter
            },
            body: JSON.stringify({
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests',
                    retryAfter: result.retryAfter
                }
            })
        };
    }
    
    return null; // No rate limit hit
}

module.exports = { enforceRateLimit, RateLimiter };
```

### M3. PII in Logs
**Severity:** MEDIUM  
**Files:** All functions potentially log sensitive data

**Create `/netlify/functions/utils/logger.js`:**
```javascript
const SENSITIVE_PATTERNS = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b\d{10,12}\b/g, // Phone numbers
];

const SENSITIVE_KEYS = [
    'password', 'token', 'access_token', 'refresh_token',
    'api_key', 'secret', 'email', 'phone', 'ssn',
    'credit_card', 'bank_account', 'authorization',
    'x-api-key', 'cookie', 'session'
];

function redactString(str) {
    let redacted = str;
    for (const pattern of SENSITIVE_PATTERNS) {
        redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
}

function redactObject(obj, depth = 0) {
    if (depth > 10) return '[MAX_DEPTH]';
    if (!obj || typeof obj !== 'object') {
        return typeof obj === 'string' ? redactString(obj) : obj;
    }
    
    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains sensitive terms
        const isSensitive = SENSITIVE_KEYS.some(term => 
            lowerKey.includes(term)
        );
        
        if (isSensitive) {
            result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
            result[key] = redactObject(value, depth + 1);
        } else if (typeof value === 'string') {
            result[key] = redactString(value);
        } else {
            result[key] = value;
        }
    }
    
    return result;
}

function logSafe(level, message, data = {}) {
    const safeData = redactObject(data);
    const timestamp = new Date().toISOString();
    
    const logEntry = {
        timestamp,
        level,
        message,
        ...safeData
    };
    
    console[level](JSON.stringify(logEntry));
}

module.exports = { logSafe, redactObject, redactString };
```

### M4. Missing Transaction Boundaries
**Severity:** MEDIUM  
**Files:** 
- `/netlify/functions/exercises-bulk-create.js`
- `/netlify/functions/users-profile-post.js`
- `/netlify/functions/sessions-create.js`

**Required Fix:**
```javascript
// Use proper transaction handling
const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function executeInTransaction(operations) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const results = [];
        for (const operation of operations) {
            const result = await operation(client);
            results.push(result);
        }
        
        await client.query('COMMIT');
        return results;
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Transaction rolled back:', error.message);
        throw error;
        
    } finally {
        client.release();
    }
}

// Usage example
const results = await executeInTransaction([
    (client) => client.query('INSERT INTO sessions ...'),
    (client) => client.query('INSERT INTO exercises ...'),
    (client) => client.query('UPDATE user_stats ...')
]);
```

### M5. JWT Claims Not Properly Validated
**Severity:** MEDIUM  
**File:** `/netlify/functions/utils/auth.js`

**Current Issue:**
```javascript
// Minimal validation
const decoded = jwt.verify(token, process.env.JWT_SECRET);
return decoded.sub;
```

**Required Fix:**
```javascript
async function verifyJWT(headers) {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    
    try {
        // Verify with complete options
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'],
            maxAge: '24h',
            clockTolerance: 30 // 30 seconds
        });
        
        // Validate required claims
        if (!decoded.sub || typeof decoded.sub !== 'string') {
            throw new Error('Invalid subject claim');
        }
        
        if (!decoded.iat || typeof decoded.iat !== 'number') {
            throw new Error('Invalid issued at claim');
        }
        
        if (!decoded.exp || typeof decoded.exp !== 'number') {
            throw new Error('Invalid expiration claim');
        }
        
        // Check token age
        const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
        if (tokenAge > 86400) { // 24 hours
            throw new Error('Token too old');
        }
        
        // Verify user still exists and is active
        const user = await sql`
            SELECT id, status 
            FROM users 
            WHERE id = ${decoded.sub} 
            AND status = 'active'
        `;
        
        if (!user.length) {
            throw new Error('User not found or inactive');
        }
        
        return decoded.sub;
        
    } catch (error) {
        logSafe('warn', 'JWT verification failed', {
            reason: error.message,
            timestamp: new Date().toISOString()
        });
        return null;
    }
}
```

### M6. Missing Ownership Checks
**Severity:** MEDIUM  
**Files:** All data modification endpoints

**Add ownership verification:**
```javascript
async function verifyOwnership(userId, resourceType, resourceId) {
    const ownership = {
        'session': async () => {
            const result = await sql`
                SELECT user_id FROM sessions 
                WHERE id = ${resourceId} AND user_id = ${userId}
            `;
            return result.length > 0;
        },
        'exercise': async () => {
            const result = await sql`
                SELECT s.user_id 
                FROM exercises e
                JOIN sessions s ON e.session_id = s.id
                WHERE e.id = ${resourceId} AND s.user_id = ${userId}
            `;
            return result.length > 0;
        },
        'profile': async () => {
            const result = await sql`
                SELECT user_id FROM user_profiles 
                WHERE id = ${resourceId} AND user_id = ${userId}
            `;
            return result.length > 0;
        }
    };
    
    const checker = ownership[resourceType];
    if (!checker) {
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
    
    return await checker();
}

// Usage in endpoints
const isOwner = await verifyOwnership(userId, 'session', sessionId);
if (!isOwner) {
    return { 
        statusCode: 403, 
        body: JSON.stringify({ error: 'Access denied' }) 
    };
}
```

## 🟢 LOW Priority Findings

### L1. Missing Security Headers
**Severity:** LOW  
**Fix:** Add to all function responses:

```javascript
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

// Add to all responses
return {
    statusCode: 200,
    headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
};
```

### L2. Weak Password Hashing (SHA-256)
**Severity:** LOW (but should be fixed)  
**Current:** Using SHA-256 for passwords  
**Fix:** Upgrade to bcrypt:

```javascript
const bcrypt = require('bcrypt');

// Hashing
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

// Verification
const isValid = await bcrypt.compare(plainPassword, hashedPassword);

// Migration strategy
async function migratePassword(userId, plainPassword) {
    const user = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
    
    // Check if old SHA-256
    const sha256Hash = crypto.createHash('sha256').update(plainPassword).digest('hex');
    if (user[0].password_hash === sha256Hash) {
        // Migrate to bcrypt
        const bcryptHash = await bcrypt.hash(plainPassword, 12);
        await sql`UPDATE users SET password_hash = ${bcryptHash}, hash_type = 'bcrypt' WHERE id = ${userId}`;
        return true;
    }
    
    return false;
}
```

### L3. No Request Signing
**Severity:** LOW  
**Recommendation:** Add HMAC signatures for critical operations:

```javascript
function generateRequestSignature(payload, secret = process.env.SIGNING_SECRET) {
    const timestamp = Date.now();
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');
    
    return {
        signature,
        timestamp,
        header: `t=${timestamp},v1=${signature}`
    };
}

function verifyRequestSignature(header, payload, secret = process.env.SIGNING_SECRET) {
    const parts = header.split(',');
    const timestamp = parts[0]?.replace('t=', '');
    const signature = parts[1]?.replace('v1=', '');
    
    if (!timestamp || !signature) return false;
    
    // Check timestamp (5 minute window)
    const age = Date.now() - parseInt(timestamp);
    if (age > 300000) return false;
    
    // Verify signature
    const message = `${timestamp}.${JSON.stringify(payload)}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
    );
}
```

## Security Implementation Checklist

| Task | Priority | Status | Files to Update |
|------|----------|--------|-----------------|
| Remove hardcoded secrets | 🔴 HIGH | ❌ | All test files |
| Add auth to admin endpoints | 🔴 HIGH | ❌ | admin-get-all-users.js, ai-proxy.js |
| Fix SQL injection | 🔴 HIGH | ❌ | admin-users-top.js, admin-sessions-series.js |
| Stop logging tokens | 🔴 HIGH | ❌ | strava-*.js files |
| Remove test-db-connection | 🔴 HIGH | ❌ | test-db-connection.js |
| Implement error handler | 🟡 MEDIUM | ❌ | Create utils/error-handler.js |
| Add rate limiting | 🟡 MEDIUM | ❌ | All endpoints |
| Create PII redaction | 🟡 MEDIUM | ❌ | Create utils/logger.js |
| Add transaction boundaries | 🟡 MEDIUM | ❌ | Bulk operations |
| Validate JWT claims | 🟡 MEDIUM | ❌ | utils/auth.js |
| Add ownership checks | 🟡 MEDIUM | ❌ | All data endpoints |
| Add security headers | 🟢 LOW | ❌ | All functions |
| Upgrade password hashing | 🟢 LOW | ❌ | Auth functions |
| Implement request signing | 🟢 LOW | ❌ | Critical operations |

## Recommended Security Tools

### 1. Add to package.json:
```json
{
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:scan": "trivy fs .",
    "security:secrets": "trufflehog filesystem . --no-verification",
    "security:deps": "snyk test"
  },
  "devDependencies": {
    "bcrypt": "^5.1.1",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.10.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

### 2. Pre-commit Hook (.husky/pre-commit):
```bash
#!/bin/sh
# Check for secrets
npm run security:secrets
if [ $? -ne 0 ]; then
    echo "❌ Potential secrets detected. Please remove them."
    exit 1
fi

# Run security audit
npm run security:audit
```

### 3. GitHub Actions Security Scan:
```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          
      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
```

## Migration Path to Secure State

### Phase 1: Critical (Day 1)
1. Remove all hardcoded secrets (1 hour)
2. Add authentication to admin endpoints (2 hours)
3. Fix SQL injection vulnerabilities (2 hours)
4. Stop logging sensitive tokens (1 hour)
5. Remove test-db-connection.js (15 minutes)

### Phase 2: Important (Days 2-3)
1. Implement centralized error handling (2 hours)
2. Add rate limiting to all endpoints (3 hours)
3. Create PII redaction utilities (2 hours)
4. Add transaction boundaries (2 hours)
5. Enhance JWT validation (1 hour)

### Phase 3: Enhancement (Week 2)
1. Add security headers (1 hour)
2. Upgrade password hashing to bcrypt (2 hours)
3. Implement request signing (2 hours)
4. Add comprehensive audit logging (3 hours)
5. Set up security monitoring (2 hours)

## Summary

The application has fundamental security issues that must be addressed before production deployment. The most critical issues are exposed secrets, unauthenticated endpoints, and SQL injection vulnerabilities. With 2-3 days of focused security work, the application can reach a minimum acceptable security level for production use.

**Current Security Score: 45/100**  
**Target After Fixes: 85/100**  
**Time to Secure: 2-3 days**  
**Recommended: Complete Phase 1 & 2 before any production deployment**