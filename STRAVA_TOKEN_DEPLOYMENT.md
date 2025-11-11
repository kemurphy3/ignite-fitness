# Strava Token Management System - Deployment Guide

## Overview

This guide covers the deployment of the comprehensive Strava token management
system with enhanced security, race condition prevention, and automatic refresh
capabilities.

## Prerequisites

- Netlify account with Functions enabled
- Neon PostgreSQL database (or compatible PostgreSQL)
- AWS account for KMS encryption (optional, fallback available)
- Strava API credentials

## 1. Database Setup

### Step 1: Create Database Schema

Run the database schema creation script:

```bash
psql $DATABASE_URL -f database-strava-token-schema.sql
```

### Step 2: Verify Schema

Check that all tables were created:

```sql
\dt strava_tokens
\dt strava_token_audit
\dt api_rate_limits
\dt circuit_breaker_state
\dt encryption_keys
```

## 2. Environment Configuration

### Step 1: Copy Environment Template

```bash
cp env-strava-template.txt .env.local
```

### Step 2: Configure Required Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
STRAVA_CLIENT_ID=YOUR_STRAVA_CLIENT_ID
STRAVA_CLIENT_SECRET=YOUR_STRAVA_CLIENT_SECRET
URL=https://your-site.netlify.app

# Generate fallback encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add the output to FALLBACK_ENCRYPTION_KEY
```

### Step 3: Configure AWS KMS (Optional but Recommended)

1. Create a KMS key in AWS Console
2. Generate data keys for encryption
3. Add the encrypted keys to environment variables

## 3. Netlify Deployment

### Step 1: Deploy Functions

```bash
# Install dependencies
npm install @aws-sdk/client-kms node-fetch

# Deploy to Netlify
netlify deploy --prod
```

### Step 2: Set Environment Variables in Netlify

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add all variables from `.env.local`

### Step 3: Configure Scheduled Functions

Add to `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-scheduled-functions"

[plugins.inputs]
  schedule = "*/5 * * * *"  # Every 5 minutes
  function = "strava-auto-refresh"
```

## 4. Testing

### Step 1: Run Test Suite

```bash
# Install test dependencies
npm install node-fetch

# Update test configuration
# Edit test-strava-token-system.js and set BASE_URL to your Netlify URL

# Run tests
node test-strava-token-system.js
```

### Step 2: Manual Testing

1. **OAuth Exchange Test**:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/strava-oauth-exchange \
  -H "Content-Type: application/json" \
  -d '{"code":"test-code","userId":"test-user"}'
```

2. **Token Status Test**:

```bash
curl https://your-site.netlify.app/.netlify/functions/strava-token-status?userId=test-user
```

3. **Token Refresh Test**:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/strava-refresh-token \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user"}'
```

## 5. Monitoring and Maintenance

### Step 1: Set Up Monitoring

1. **Database Monitoring**:
   - Monitor connection pool usage
   - Track query performance
   - Set up alerts for high error rates

2. **Function Monitoring**:
   - Monitor execution time
   - Track error rates
   - Set up alerts for circuit breaker state

3. **Security Monitoring**:
   - Monitor audit logs
   - Track rate limiting violations
   - Set up alerts for anomalous patterns

### Step 2: Regular Maintenance

1. **Cleanup Jobs**:
   - Audit logs are auto-cleaned after 90 days
   - Rate limits are cleaned every hour
   - Expired locks are cleaned automatically

2. **Key Rotation**:
   - Rotate encryption keys quarterly
   - Update KMS keys as needed
   - Test key rotation process

## 6. Security Considerations

### Encryption

- All tokens are encrypted at rest
- Keys are managed through AWS KMS
- Fallback encryption for development

### Rate Limiting

- Per-user rate limits
- Anomaly detection for bot-like behavior
- Circuit breaker for external API calls

### Audit Logging

- All operations are logged
- IP addresses and user agents tracked
- 90-day retention policy

### Access Control

- API key authentication
- User-specific data isolation
- Admin functions protected

## 7. Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check DATABASE_URL format
   - Verify SSL configuration
   - Check connection pool limits

2. **Encryption Errors**:
   - Verify KMS key configuration
   - Check fallback key format
   - Test key rotation

3. **Rate Limiting Issues**:
   - Check rate limit configuration
   - Monitor anomaly detection
   - Adjust limits as needed

4. **Circuit Breaker Issues**:
   - Check external API status
   - Monitor failure rates
   - Reset circuit breaker if needed

### Debug Commands

```bash
# Check database health
curl https://your-site.netlify.app/.netlify/functions/strava-token-status?userId=test-user

# Check circuit breaker status
# Look for X-Circuit-Breaker-State header in responses

# Check rate limiting
# Look for X-RateLimit-* headers in responses
```

## 8. Performance Optimization

### Database

- Use connection pooling
- Optimize queries with indexes
- Monitor slow queries

### Caching

- Implement Redis for production
- Use in-memory cache for development
- Monitor cache hit rates

### Functions

- Optimize cold start times
- Use appropriate memory allocation
- Monitor execution duration

## 9. Backup and Recovery

### Database Backups

- Enable automated backups
- Test restore procedures
- Store backups securely

### Configuration Backups

- Version control environment variables
- Document configuration changes
- Test configuration updates

## 10. Scaling Considerations

### Horizontal Scaling

- Use read replicas for status checks
- Implement load balancing
- Monitor resource usage

### Vertical Scaling

- Increase function memory as needed
- Optimize database performance
- Monitor connection limits

## Support

For issues or questions:

1. Check the audit logs for error details
2. Review circuit breaker status
3. Monitor rate limiting metrics
4. Check database connection health

## Security Notice

- Never commit encryption keys to version control
- Use environment variables for all secrets
- Regularly rotate encryption keys
- Monitor for security anomalies
- Keep dependencies updated
