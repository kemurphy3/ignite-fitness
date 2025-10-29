# Ignite Fitness - Deployment Guide

## Overview

This guide provides comprehensive instructions for securely deploying the Ignite Fitness application with proper security, compliance, and monitoring configurations.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Netlify account
- Supabase account
- Strava API credentials
- Domain name (optional)

### 2. Environment Setup

```bash
# Clone the repository
git clone https://github.com/your-username/ignite-fitness.git
cd ignite-fitness

# Copy environment template
cp env.example .env

# Install dependencies
npm install
```

### 3. Configure Environment Variables

Edit `.env` file with your actual values:

```bash
# Required: Database
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Required: Security
JWT_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Required: Strava API
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret

# Required: Application
NODE_ENV=production
APP_URL=https://your-app.netlify.app
```

## 🔒 Security Configuration

### 1. Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate CSRF secret
openssl rand -base64 32

# Generate session secret
openssl rand -base64 32
```

### 2. Enable Security Features

```bash
# Security features
ENABLE_RATE_LIMITING=true
ENABLE_CSRF_PROTECTION=true
ENABLE_AUDIT_LOGGING=true
SAFE_LOGGING=true

# Security headers
CSP_ENABLED=true
HSTS_ENABLED=true
X_FRAME_OPTIONS=DENY
X_CONTENT_TYPE_OPTIONS=nosniff
```

### 3. Configure Rate Limiting

```bash
# OAuth rate limiting
OAUTH_RATE_LIMIT_ENABLED=true
OAUTH_RATE_LIMIT_WINDOW=900
OAUTH_RATE_LIMIT_MAX=5

# API rate limiting
API_RATE_LIMIT_ENABLED=true
API_RATE_LIMIT_WINDOW=900
API_RATE_LIMIT_MAX=1000
```

## 🗄️ Database Setup

### 1. Supabase Configuration

1. Create a new Supabase project
2. Get your project URL and anon key
3. Configure database schema (see `database/schema.sql`)
4. Set up Row Level Security (RLS) policies

### 2. Database Schema

```sql
-- User profiles table
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User privacy preferences
CREATE TABLE user_privacy_preferences (
    user_id UUID PRIMARY KEY,
    data_collection BOOLEAN DEFAULT true,
    analytics BOOLEAN DEFAULT true,
    marketing BOOLEAN DEFAULT false,
    data_retention INTEGER DEFAULT 365,
    consent_version VARCHAR(10) DEFAULT '1.0',
    opt_out_date TIMESTAMP,
    data_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Consent history
CREATE TABLE consent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Row Level Security

```sql
-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);
```

## 🌐 Netlify Deployment

### 1. Netlify Configuration

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.strava.com https://*.supabase.co;"
```

### 2. Environment Variables in Netlify

1. Go to Site settings > Environment variables
2. Add all variables from your `.env` file
3. Ensure `NODE_ENV=production`
4. Set `APP_URL` to your Netlify URL

### 3. Deploy to Netlify

```bash
# Build the project
npm run build

# Deploy to Netlify
netlify deploy --prod
```

## 🔐 Security Checklist

### Pre-Deployment

- [ ] All secrets generated with high entropy
- [ ] Environment variables configured
- [ ] Security features enabled
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Audit logging enabled
- [ ] Safe logging enabled
- [ ] Security headers configured
- [ ] Database RLS policies set
- [ ] CORS configured correctly

### Post-Deployment

- [ ] HTTPS enabled
- [ ] Security headers working
- [ ] Rate limiting functional
- [ ] CSRF protection working
- [ ] Audit logging functional
- [ ] Error tracking configured
- [ ] Monitoring enabled
- [ ] Backup configured
- [ ] Health checks working
- [ ] Security scan passed

## 📊 Monitoring & Alerting

### 1. Error Tracking

```bash
# Sentry configuration
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production
```

### 2. Performance Monitoring

```bash
# New Relic configuration
NEW_RELIC_LICENSE_KEY=your-license-key
NEW_RELIC_APP_NAME=ignite-fitness
```

### 3. Health Checks

```bash
# Health check configuration
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_INTERVAL=300
```

## 🔄 CI/CD Pipeline

### 1. GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Build project
      run: npm run build
      
    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v2.0
      with:
        publish-dir: './dist'
        production-branch: main
        github-token: ${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### 2. Security Scanning

```yaml
- name: Security scan
  run: |
    npm audit
    npm run security-scan
```

## 🛡️ Security Best Practices

### 1. Secret Management

- Use different secrets for each environment
- Rotate secrets regularly
- Never commit secrets to version control
- Use secret management services in production

### 2. Access Control

- Implement proper authentication
- Use JWT tokens with short expiration
- Enable CSRF protection
- Implement rate limiting

### 3. Data Protection

- Encrypt sensitive data
- Use safe logging
- Implement audit trails
- Enable data export/deletion

### 4. Network Security

- Use HTTPS everywhere
- Configure security headers
- Enable CORS properly
- Use secure cookies

## 📋 Compliance

### 1. GDPR Compliance

```bash
# GDPR features
GDPR_COMPLIANCE=true
DATA_EXPORT_ENABLED=true
DATA_DELETION_ENABLED=true
CONSENT_REQUIRED=true
```

### 2. Data Retention

```bash
# Data retention settings
DEFAULT_DATA_RETENTION=365
MAX_DATA_RETENTION=730
MIN_DATA_RETENTION=30
```

### 3. Audit Logging

```bash
# Audit configuration
AUDIT_LOG_RETENTION=365
ENABLE_AUDIT_LOGGING=true
```

## 🔧 Troubleshooting

### Common Issues

1. **JWT Secret Too Weak**
   ```bash
   # Generate stronger secret
   openssl rand -base64 32
   ```

2. **CORS Errors**
   ```bash
   # Check APP_URL configuration
   APP_URL=https://your-app.netlify.app
   ```

3. **Database Connection Issues**
   ```bash
   # Verify Supabase credentials
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Rate Limiting Issues**
   ```bash
   # Adjust rate limits
   OAUTH_RATE_LIMIT_MAX=10
   API_RATE_LIMIT_MAX=2000
   ```

5. **Security Header Issues**
   ```bash
   # Check CSP configuration
   CSP_ENABLED=true
   CSP_REPORT_URI=/csp-report
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=true
LOG_LEVEL=debug
ENABLE_DEBUG_LOGGING=true
```

## 📞 Support

### Getting Help

- Check the documentation
- Review security best practices
- Test in development first
- Use production-grade secrets in production

### Security Issues

- Report security vulnerabilities privately
- Follow responsible disclosure
- Use secure communication channels

### Performance Issues

- Enable performance monitoring
- Check rate limiting settings
- Optimize database queries
- Use caching strategies

## 🎯 Next Steps

### Post-Deployment

1. **Security Audit**
   - Run security scans
   - Test all security features
   - Verify compliance requirements

2. **Performance Testing**
   - Load test the application
   - Monitor performance metrics
   - Optimize bottlenecks

3. **Monitoring Setup**
   - Configure alerting
   - Set up dashboards
   - Monitor key metrics

4. **Backup Strategy**
   - Configure database backups
   - Test restore procedures
   - Document recovery processes

5. **Documentation**
   - Update deployment docs
   - Document security procedures
   - Create runbooks

---

**Last Updated**: December 2024  
**Deployment Version**: 1.0  
**Next Review**: March 2025
