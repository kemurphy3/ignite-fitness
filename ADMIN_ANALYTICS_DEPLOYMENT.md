# Admin Analytics System - Deployment Guide

## Overview

This guide covers the deployment of the comprehensive admin analytics system
with role-based access control, privacy protection, timezone handling, and
robust error management.

## Prerequisites

- Netlify account with Functions enabled
- Neon PostgreSQL database (or compatible PostgreSQL)
- JWT secret for authentication
- Admin user accounts configured
- Node.js dependencies

## 1. Database Setup

### Step 1: Create Database Schema

Run the database schema creation script:

```bash
psql $DATABASE_URL -f database-admin-analytics-schema.sql
```

### Step 2: Verify Schema

Check that all tables were created:

```sql
\dt admin_audit_log
\dt mv_refresh_log
\dt admin_rate_limits
\dm mv_sessions_daily
```

### Step 3: Verify User Table Extension

Check that the users table has been extended:

```sql
\d users
```

Look for the new `role` column with CHECK constraint.

### Step 4: Create Admin Users

```sql
-- Create admin user (replace with actual user ID)
UPDATE users
SET role = 'admin'
WHERE id = 'your-admin-user-id';

-- Verify admin user
SELECT id, role FROM users WHERE role = 'admin';
```

## 2. Environment Configuration

### Step 1: Set Required Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

# Optional
HASH_SALT=your-hash-salt-for-user-aliases
NODE_ENV=production
APP_VERSION=1.0.0
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

### Step 2: Generate JWT Secret

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Step 3: Generate Hash Salt

```bash
# Generate a hash salt for user aliases
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Netlify Deployment

### Step 1: Install Dependencies

```bash
npm install jsonwebtoken
```

### Step 2: Deploy Functions

```bash
# Deploy to Netlify
netlify deploy --prod
```

### Step 3: Set Environment Variables in Netlify

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add all required variables

## 4. API Endpoints

### 4.1 Admin Overview

```bash
GET /.netlify/functions/admin-overview
Authorization: Bearer <admin-jwt-token>
```

### 4.2 Sessions Series

```bash
GET /.netlify/functions/admin-sessions-series?from=2024-01-01&to=2024-01-31&bucket=day&timezone=UTC
Authorization: Bearer <admin-jwt-token>
```

### 4.3 Sessions By Type

```bash
GET /.netlify/functions/admin-sessions-by-type?from=2024-01-01&to=2024-01-31
Authorization: Bearer <admin-jwt-token>
```

### 4.4 Top Users

```bash
GET /.netlify/functions/admin-users-top?metric=sessions&limit=50&cursor=eyJ2IjoxNDUsImlkIjoidXNyX2ExYjJjMyJ9
Authorization: Bearer <admin-jwt-token>
```

### 4.5 Admin Health

```bash
GET /.netlify/functions/admin-health
Authorization: Bearer <admin-jwt-token>
```

## 5. Key Features

### Role-Based Access Control (RBAC) 🔐

- **JWT validation** with issuer/audience checks
- **Admin role enforcement** on all endpoints
- **Database role verification** for additional security
- **Proper error responses** for unauthorized access

### Privacy Protection 🛡️

- **5-user minimum threshold** for all aggregates
- **User ID hashing** with salt for anonymity
- **Privacy metadata** included in responses
- **No PII exposure** in any response

### Timezone Handling 🌍

- **DST transitions** handled correctly
- **AT TIME ZONE conversion** for accurate local time
- **Bucket boundaries** align with local midnight
- **2-year date range limit** enforced

### Performance & Reliability ⚡

- **Query timeouts** set to 5 seconds
- **Keyset pagination** for stable results
- **Materialized views** for performance
- **Connection pooling** for efficiency

### Data Freshness 📊

- **Materialized view staleness** tracked
- **Health endpoint** shows view freshness
- **Data version** included in responses
- **Refresh strategy** documented

## 6. Security Implementation

### Authentication & Authorization 🔐

- **JWT tokens** with proper validation
- **Issuer/audience checks** for security
- **Admin role enforcement** in database
- **Token generation** for testing

### Privacy Protection 🛡️

- **User ID hashing** with salt
- **Privacy thresholds** applied consistently
- **No PII in logs** or responses
- **Audit logging** for compliance

### Input Validation & Sanitization 🛡️

- **Date range validation** with limits
- **Timezone validation** using Intl API
- **Parameter validation** for all inputs
- **Error boundary protection** with try-catch

## 7. Testing

### Step 1: Run Test Suite

```bash
# Install test dependencies
npm install node-fetch

# Update test configuration
# Edit test-admin-analytics.js and set BASE_URL to your Netlify URL

# Run tests
node test-admin-analytics.js
```

### Step 2: Manual Testing

1. **Create Admin User**:

```bash
# First, create an admin user in the database
UPDATE users SET role = 'admin' WHERE id = 'your-user-id';
```

2. **Generate Admin Token**:

```bash
# Use the test script to generate a proper admin token
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'your-admin-user-id', role: 'admin' },
  'your-jwt-secret',
  { issuer: 'ignite-fitness', audience: 'api', expiresIn: '24h' }
);
console.log('Admin Token:', token);
"
```

3. **Test Admin Overview**:

```bash
curl https://your-site.netlify.app/.netlify/functions/admin-overview \
  -H "Authorization: Bearer <admin-token>"
```

4. **Test Sessions Series**:

```bash
curl "https://your-site.netlify.app/.netlify/functions/admin-sessions-series?from=2024-01-01&to=2024-01-31&bucket=day&timezone=UTC" \
  -H "Authorization: Bearer <admin-token>"
```

5. **Test Sessions By Type**:

```bash
curl https://your-site.netlify.app/.netlify/functions/admin-sessions-by-type \
  -H "Authorization: Bearer <admin-token>"
```

6. **Test Top Users**:

```bash
curl "https://your-site.netlify.app/.netlify/functions/admin-users-top?metric=sessions&limit=10" \
  -H "Authorization: Bearer <admin-token>"
```

7. **Test Admin Health**:

```bash
curl https://your-site.netlify.app/.netlify/functions/admin-health \
  -H "Authorization: Bearer <admin-token>"
```

## 8. Data Model

### Admin Audit Log Table

- **Request tracking** with unique request IDs
- **Admin identification** for accountability
- **Query parameters** stored as JSONB
- **Response metrics** for performance monitoring

### Materialized Views

- **Daily session aggregates** with privacy thresholds
- **Refresh tracking** for data freshness
- **Performance optimization** for complex queries
- **Concurrent refresh** support

### Rate Limiting Table

- **Per-admin limits** with sliding windows
- **Attempt tracking** for monitoring
- **Window-based** rate limiting
- **Automatic cleanup** of old entries

### User Role Extension

- **Role column** added to users table
- **Admin role** enforcement
- **Index optimization** for admin queries
- **Constraint validation** for role values

## 9. API Response Format

### Success Response

```json
{
  "status": "success",
  "data": {
    // Endpoint-specific data
  },
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "generated_at": "2024-01-15T10:00:00Z",
    "response_time_ms": 145,
    "privacy_threshold": 5,
    "data_version": "mv_20240115_10"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token",
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

## 10. Error Codes

| Code           | Description                   | Status |
| -------------- | ----------------------------- | ------ |
| MISSING_TOKEN  | Authorization header required | 401    |
| UNAUTHORIZED   | Invalid or expired token      | 401    |
| FORBIDDEN      | Admin access required         | 403    |
| MISSING_PARAMS | Required parameters missing   | 400    |
| INVALID_PARAM  | Invalid parameter value       | 400    |
| INVALID_METRIC | Invalid metric type           | 400    |
| INVALID_CURSOR | Invalid cursor format         | 400    |
| QUERY_TIMEOUT  | Query exceeded timeout        | 500    |
| INTERNAL_ERROR | Internal server error         | 500    |

## 11. Performance Considerations

### Query Optimization

- **Materialized views** for complex aggregations
- **Composite indexes** for admin queries
- **Query timeouts** to prevent function timeouts
- **Connection pooling** for efficiency

### Caching Strategy

- **Response caching** with appropriate headers
- **Materialized view caching** for performance
- **Data freshness** tracking
- **Cache invalidation** strategies

### Rate Limiting

- **Per-admin limits** to prevent abuse
- **Sliding window** rate limiting
- **Automatic cleanup** of old entries
- **Monitoring** of rate limit usage

## 12. Monitoring

### Key Metrics

- **Response times** for all endpoints
- **Error rates** by error code
- **Rate limit usage** per admin
- **Data freshness** of materialized views

### Logging

- **Structured logs** with request IDs
- **Admin audit trail** for compliance
- **Error logging** with context
- **Performance metrics** tracking

### Health Checks

- **Database connectivity** monitoring
- **Materialized view freshness** checks
- **Function performance** monitoring
- **Integration status** tracking

## 13. Troubleshooting

### Common Issues

1. **Authentication Failures**:
   - Check JWT secret configuration
   - Verify issuer/audience settings
   - Ensure admin role is set in database

2. **Query Timeouts**:
   - Check database performance
   - Review query complexity
   - Consider materialized view refresh

3. **Privacy Threshold Issues**:
   - Verify 5-user minimum threshold
   - Check data aggregation logic
   - Review privacy metadata

4. **Timezone Problems**:
   - Validate timezone strings
   - Check DST transition handling
   - Verify date range calculations

### Debug Commands

```bash
# Check admin users
psql $DATABASE_URL -c "SELECT id, role FROM users WHERE role = 'admin';"

# Check materialized view freshness
psql $DATABASE_URL -c "SELECT * FROM mv_refresh_log;"

# Check audit logs
psql $DATABASE_URL -c "SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 10;"

# Check rate limits
psql $DATABASE_URL -c "SELECT * FROM admin_rate_limits ORDER BY window_start DESC LIMIT 10;"
```

## 14. Maintenance

### Regular Tasks

- **Monitor audit logs** for security issues
- **Refresh materialized views** as needed
- **Clean up old rate limit entries**
- **Review error rates** and performance

### Data Cleanup

- **Audit logs**: Consider archiving old logs
- **Rate limits**: Clean up old entries
- **Materialized views**: Refresh regularly

### Updates

- **Schema changes**: Use migrations
- **API versioning**: Maintain backward compatibility
- **Dependency updates**: Keep packages current
- **Security patches**: Apply promptly

## 15. Security Considerations

### Token Security

- **JWT secrets** must be strong and rotated
- **Issuer/audience** validation for security
- **Token expiration** for time-limited access
- **Role verification** in database

### Data Privacy

- **User ID hashing** with salt
- **Privacy thresholds** enforced consistently
- **No PII** in logs or responses
- **Audit trails** for compliance

### API Security

- **Admin-only access** enforced
- **Rate limiting** to prevent abuse
- **Input validation** for all parameters
- **Error handling** without information leakage

## Support

For issues or questions:

1. Check the error codes and descriptions
2. Review the audit logs for details
3. Verify environment configuration
4. Check the test suite for examples
5. Monitor the application logs

## Security Notice

- Never commit JWT secrets to version control
- Use environment variables for all secrets
- Regularly rotate JWT secrets and hash salts
- Monitor for security anomalies
- Keep dependencies updated
- Review access logs regularly
- Ensure admin users are properly configured
- Monitor for unauthorized access attempts
