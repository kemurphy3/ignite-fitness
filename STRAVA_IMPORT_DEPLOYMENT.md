# Strava Activity Import System - Deployment Guide

## Overview

This guide covers the deployment of the comprehensive Strava activity import system with resume support, timezone handling, and robust error management.

## Prerequisites

- Netlify account with Functions enabled
- Neon PostgreSQL database (or compatible PostgreSQL)
- JWT secret for authentication
- Strava OAuth credentials (from Feature 2)
- Node.js dependencies

## 1. Database Setup

### Step 1: Create Database Schema

Run the database schema creation script:

```bash
psql $DATABASE_URL -f database-strava-import-schema.sql
```

### Step 2: Verify Schema

Check that all tables were created:

```sql
\dt integrations_strava
\dt strava_activity_cache
\dt strava_import_log
```

### Step 3: Verify Session Table Extensions

Check that the sessions table has been extended:

```sql
\d sessions
```

Look for the new columns:
- `source`, `source_id`, `external_url`
- `utc_date`, `timezone`, `timezone_offset`
- `elapsed_duration`, `payload`

## 2. Environment Configuration

### Step 1: Set Required Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

# Strava OAuth (from Feature 2)
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret

# AWS KMS (from Feature 2)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
KMS_KEY_ID=your-kms-key-id

# Optional
ALLOWED_ORIGINS=https://yourapp.com,https://www.yourapp.com
```

### Step 2: Generate JWT Secret

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 3. Netlify Deployment

### Step 1: Install Dependencies

```bash
npm install ajv jsonwebtoken @aws-sdk/client-kms
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

### 4.1 Import Activities
```bash
POST /.netlify/functions/integrations-strava-import
Authorization: Bearer <jwt-token>
Content-Type: application/json

# Query Parameters (optional)
?after=1704067200&per_page=50

# Body (for resume)
{
  "continue_token": "eyJwYWdlIjozLCJhZnRlciI6IjE3MDQwNjcyMDAi..."
}
```

### 4.2 Get Import Status
```bash
GET /.netlify/functions/integrations-strava-status
Authorization: Bearer <jwt-token>
```

## 5. Key Features

### Resume Support
- **Time-boxed execution**: 9-second budget with resume tokens
- **Continue tokens**: Base64-encoded state for resuming imports
- **Progress tracking**: Detailed statistics and error reporting
- **Automatic cleanup**: Orphaned activities removed after import

### Timezone Handling
- **Dual storage**: Both local and UTC timestamps
- **Timezone offset**: Minutes from UTC for accurate display
- **Local time display**: Uses `start_date_local` from Strava
- **UTC sorting**: Uses `start_date` for consistent ordering

### Data Mapping
- **Complete field mapping**: All Strava data preserved in payload
- **Sport type mapping**: Comprehensive mapping to internal types
- **Pace calculation**: Automatic pace per km/mile calculation
- **Rich metadata**: Heart rate, power, achievements, etc.

### Error Handling
- **Network timeouts**: 5-second timeout with AbortController
- **Rate limiting**: Exponential backoff with proper header parsing
- **Token refresh**: Automatic token refresh when expired
- **Disconnection handling**: Clean up tokens on 401 responses

## 6. Testing

### Step 1: Run Test Suite

```bash
# Install test dependencies
npm install node-fetch

# Update test configuration
# Edit test-strava-import.js and set BASE_URL to your Netlify URL

# Run tests
node test-strava-import.js
```

### Step 2: Manual Testing

1. **Connect Strava Account** (via Feature 2):
```bash
# First, connect Strava account using the OAuth flow
curl -X POST https://your-site.netlify.app/.netlify/functions/strava-oauth
```

2. **Import Activities**:
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/integrations-strava-import \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

3. **Check Import Status**:
```bash
curl https://your-site.netlify.app/.netlify/functions/integrations-strava-status \
  -H "Authorization: Bearer <your-jwt-token>"
```

4. **Resume Import** (if partial):
```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/integrations-strava-import \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"continue_token": "eyJwYWdlIjozLCJhZnRlciI6IjE3MDQwNjcyMDAi..."}'
```

## 7. Data Model

### Integration State Table
- **Sync tracking**: Last import time, status, errors
- **Resume support**: Continue tokens and progress state
- **Statistics**: Total imported, duplicates, updates, failures
- **User isolation**: Each user has separate sync state

### Activity Cache Table
- **Orphan detection**: Track all activities seen on Strava
- **Version tracking**: Detect updates via version changes
- **Cleanup**: Remove activities no longer on Strava

### Import Log Table
- **Detailed logging**: Page-by-page import details
- **Error tracking**: Failed activities with error details
- **Performance metrics**: Duration and timeout tracking
- **Audit trail**: Complete history of import operations

### Session Extensions
- **Source tracking**: `source` and `source_id` for deduplication
- **External links**: `external_url` for Strava activity links
- **Timezone data**: `utc_date`, `timezone`, `timezone_offset`
- **Rich payload**: Complete Strava data in JSONB format

## 8. Import Process

### 1. Authentication & Token Management
- Verify JWT token and extract user ID
- Check Strava token expiry
- Refresh token if needed using Feature 2's refresh endpoint
- Handle token decryption using AWS KMS

### 2. Resume State Management
- Check for existing import in progress
- Parse continue token if provided
- Initialize or resume import state
- Mark import as in progress

### 3. Strava API Interaction
- Build paginated API URLs with proper parameters
- Handle rate limiting with exponential backoff
- Process activities in batches with time boxing
- Track cursor for stable pagination

### 4. Data Processing
- Map Strava activities to session format
- Apply sport type mapping via SQL function
- Handle timezone parsing and conversion
- Calculate pace, speed, and other metrics

### 5. Database Operations
- UPSERT activities with duplicate detection
- Track in activity cache for orphan detection
- Log detailed import statistics
- Update sync state and statistics

### 6. Cleanup & Completion
- Remove orphaned activities
- Update final sync state
- Return results or continue token
- Handle errors and timeouts gracefully

## 9. Error Handling

### Error Codes
| Code | Description | Status |
|------|-------------|--------|
| AUTH_REQUIRED | Authorization required | 401 |
| AUTH_INVALID | Invalid token | 401 |
| STRAVA_NOT_CONNECTED | Strava account not connected | 403 |
| STRAVA_REVOKED | Strava access revoked | 403 |
| IMPORT_IN_PROGRESS | Import already in progress | 409 |
| INVALID_PARAM | Invalid parameter | 400 |
| INVALID_CONTINUE_TOKEN | Invalid continue token | 400 |
| TOKEN_REFRESH_FAILED | Token refresh failed | 502 |
| IMPORT_FAILED | Import failed | 503 |

### Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

## 10. Performance Considerations

### Time Boxing
- **9-second budget**: Leaves 1 second buffer for Netlify's 10s limit
- **Resume support**: Continue tokens for large imports
- **Progress tracking**: Detailed statistics for monitoring

### Rate Limiting
- **Exponential backoff**: Proper handling of Strava rate limits
- **Header parsing**: Correct interpretation of Retry-After headers
- **Usage tracking**: Monitor rate limit usage

### Database Optimization
- **Composite indexes**: Efficient queries for pagination
- **UPSERT operations**: Atomic duplicate handling
- **Connection pooling**: Efficient database connections

### Memory Management
- **Batch processing**: Process activities in batches
- **Error limiting**: Limit error details to prevent memory issues
- **State cleanup**: Clean up resume tokens after completion

## 11. Monitoring

### Key Metrics
- **Import success rate**: Percentage of successful imports
- **Resume frequency**: How often imports need to be resumed
- **Error rates**: By error code and endpoint
- **Performance**: Import duration and page processing time

### Logging
- **Structured logs**: JSON format for easy parsing
- **User anonymization**: User IDs hashed in logs
- **Request tracking**: Unique run IDs for tracing
- **Error details**: Comprehensive error information

### Health Checks
- **Database connectivity**: Connection pool health
- **Function performance**: Response time monitoring
- **Token validity**: Strava token status
- **Import progress**: Active import monitoring

## 12. Troubleshooting

### Common Issues

1. **Import Timeout**:
   - Check time budget and resume with continue token
   - Monitor function execution time
   - Consider reducing per_page parameter

2. **Rate Limiting**:
   - Check Strava rate limit headers
   - Implement proper backoff strategy
   - Monitor rate limit usage

3. **Token Issues**:
   - Verify Strava OAuth setup
   - Check token refresh functionality
   - Monitor token expiry times

4. **Data Mapping**:
   - Check sport type mapping function
   - Verify timezone parsing
   - Review payload structure

### Debug Commands

```bash
# Check import status
curl -H "Authorization: Bearer <token>" \
  https://your-site.netlify.app/.netlify/functions/integrations-strava-status

# Test with specific parameters
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"continue_token": "test-token"}' \
  https://your-site.netlify.app/.netlify/functions/integrations-strava-import

# Check database state
psql $DATABASE_URL -c "SELECT * FROM integrations_strava WHERE user_id = 'your-user-id';"
```

## 13. Maintenance

### Regular Tasks
- **Monitor import logs**: Check for errors and performance issues
- **Clean up old data**: Remove old import logs and cache entries
- **Update sport mappings**: Add new Strava sport types
- **Review error rates**: Identify common issues

### Data Cleanup
- **Import logs**: Consider archiving old logs
- **Activity cache**: Clean up old cache entries
- **Resume tokens**: Clean up expired tokens

### Updates
- **Schema changes**: Use migrations for database updates
- **API versioning**: Maintain backward compatibility
- **Dependency updates**: Keep packages current
- **Security patches**: Apply security updates promptly

## 14. Security Considerations

### Token Security
- **Encryption**: All tokens encrypted with AWS KMS
- **Key rotation**: Regular key rotation for security
- **Access control**: Proper IAM permissions for KMS

### Data Privacy
- **User isolation**: Users can only access their own data
- **PII protection**: No sensitive data in logs
- **Audit trails**: Complete audit trail for compliance

### API Security
- **JWT validation**: Proper token validation
- **Rate limiting**: Prevent abuse and DoS attacks
- **Input validation**: Validate all input parameters

## Support

For issues or questions:
1. Check the error codes and descriptions
2. Review the import logs for details
3. Verify environment configuration
4. Check the test suite for examples
5. Monitor the application logs

## Security Notice

- Never commit JWT secrets to version control
- Use environment variables for all secrets
- Regularly rotate JWT secrets
- Monitor for security anomalies
- Keep dependencies updated
- Review access logs regularly
