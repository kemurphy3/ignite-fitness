# User Preferences Settings API - Deployment Guide

## Overview

This guide covers the deployment of the comprehensive user preferences settings system with JWT authentication, atomic upserts, and robust validation.

## Prerequisites

- Netlify account with Functions enabled
- Neon PostgreSQL database (or compatible PostgreSQL)
- JWT secret for authentication
- Node.js dependencies

## 1. Database Setup

### Step 1: Create Database Schema

Run the database schema creation script:

```bash
psql $DATABASE_URL -f database-user-preferences-schema.sql
```

### Step 2: Verify Schema

Check that all tables and functions were created:

```sql
\dt user_preferences
\df get_or_create_user_preferences
\df update_user_preferences
\df is_valid_timezone
\df round_sleep_goal
```

### Step 3: Verify User Table

Ensure the users table has the required external_id column:

```sql
\d users
```

Look for the `external_id` column.

## 2. Environment Configuration

### Step 1: Set Required Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

# Optional
NODE_ENV=production
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
npm install jsonwebtoken moment-timezone
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

### 4.1 Get User Preferences
```bash
GET /.netlify/functions/users-preferences-get
Authorization: Bearer <jwt-token>
```

### 4.2 Update User Preferences
```bash
PATCH /.netlify/functions/users-preferences-patch
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "timezone": "America/Denver",
  "units": "metric",
  "sleep_goal_hours": 7.5,
  "workout_goal_per_week": 4,
  "notifications_enabled": false,
  "theme": "dark"
}
```

## 5. Key Features

### Atomic Operations ⚡
- **Get-or-create**: Automatically creates default preferences if none exist
- **Atomic upserts**: Handles concurrent updates without race conditions
- **Last write wins**: Concurrent updates are handled gracefully

### Validation & Coercion 🔍
- **Timezone validation**: Uses moment-timezone for IANA timezone validation
- **Type coercion**: Automatic conversion of string values to proper types
- **Range validation**: Sleep goal (0-14 hours), workout goal (0-14 per week)
- **Enum validation**: Units, theme, and other enum fields

### Security & Privacy 🔐
- **JWT authentication**: Required for all endpoints
- **User isolation**: Users can only access their own preferences
- **Input sanitization**: Unknown fields are silently ignored
- **Request size limits**: 10KB maximum request body size

### Performance & Reliability 📊
- **Database functions**: Optimized PostgreSQL functions for atomic operations
- **Error handling**: Comprehensive error responses with specific codes
- **CORS support**: Full CORS headers for web applications
- **Logging**: Sanitized logging without PII

## 6. Data Model

### User Preferences Table
- **Core preferences**: timezone, units, sleep_goal_hours, workout_goal_per_week
- **UI preferences**: notifications_enabled, theme
- **Schema versioning**: For future migrations
- **Timestamps**: created_at, updated_at for tracking

### Default Values
- **timezone**: NULL (client falls back to browser detection)
- **units**: 'imperial'
- **sleep_goal_hours**: 8.0
- **workout_goal_per_week**: 3
- **notifications_enabled**: true
- **theme**: 'system'

### Atomic Functions
- **get_or_create_user_preferences**: Gets existing or creates with defaults
- **update_user_preferences**: Atomic upsert with only provided fields
- **is_valid_timezone**: Validates IANA timezone strings
- **round_sleep_goal**: Rounds sleep goal to 0.1 precision

## 7. API Response Format

### Success Response (GET)
```json
{
  "timezone": "America/Denver",
  "units": "imperial",
  "sleep_goal_hours": 8.0,
  "workout_goal_per_week": 3,
  "notifications_enabled": true,
  "theme": "system"
}
```

### Success Response (PATCH)
```
204 No Content
```

### Error Response
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "code": "ERROR_CODE"
}
```

## 8. Error Codes

| Code | Description | Status |
|------|-------------|--------|
| AUTH_REQUIRED | Missing/invalid JWT | 401 |
| USER_NOT_FOUND | Token valid but user not found | 403 |
| INVALID_JSON | Malformed JSON | 400 |
| BODY_TOO_LARGE | Request > 10KB | 400 |
| INVALID_TIMEZONE | Unknown IANA timezone | 400 |
| INVALID_UNITS | Not 'metric' or 'imperial' | 400 |
| INVALID_SLEEP_GOAL | Outside 0-14 range | 400 |
| INVALID_WORKOUT_GOAL | Outside 0-14 range | 400 |
| INVALID_THEME | Not 'system', 'light', or 'dark' | 400 |
| VALIDATION_FAILED | Multiple validation errors | 400 |
| DB_ERROR | Server error | 500 |

## 9. Validation Rules

### Timezone
- **Format**: IANA timezone string (e.g., "America/Denver")
- **Validation**: Uses moment-timezone library
- **NULL allowed**: Client falls back to browser detection

### Units
- **Values**: 'metric' or 'imperial'
- **Case insensitive**: Stored as lowercase
- **Default**: 'imperial'

### Sleep Goal Hours
- **Range**: 0.0 to 14.0
- **Precision**: 0.1 (rounded)
- **Type**: Decimal
- **Default**: 8.0

### Workout Goal Per Week
- **Range**: 0 to 14
- **Type**: Integer
- **Default**: 3

### Notifications Enabled
- **Type**: Boolean
- **Accepts**: true/false, 1/0, "true"/"false"
- **Default**: true

### Theme
- **Values**: 'system', 'light', 'dark'
- **Case insensitive**: Stored as lowercase
- **Default**: 'system'

## 10. Testing

### Step 1: Run Test Suite

```bash
# Install test dependencies
npm install node-fetch moment-timezone

# Update test configuration
# Edit test-user-preferences.js and set BASE_URL to your Netlify URL

# Run tests
node test-user-preferences.js
```

### Step 2: Manual Testing

1. **Create Test User**:
```sql
-- Create a test user with external_id
INSERT INTO users (external_id, email, created_at) 
VALUES ('test-user-123', 'test@example.com', NOW());
```

2. **Generate Test Token**:
```bash
# Use the test script to generate a proper JWT token
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'test-user-123' },
  'your-jwt-secret',
  { expiresIn: '24h' }
);
console.log('Test Token:', token);
"
```

3. **Test Get Preferences**:
```bash
curl https://your-site.netlify.app/.netlify/functions/users-preferences-get \
  -H "Authorization: Bearer <test-token>"
```

4. **Test Update Preferences**:
```bash
curl -X PATCH https://your-site.netlify.app/.netlify/functions/users-preferences-patch \
  -H "Authorization: Bearer <test-token>" \
  -H "Content-Type: application/json" \
  -d '{"timezone": "America/New_York", "units": "metric"}'
```

## 11. Performance Considerations

### Database Optimization
- **Indexed lookups**: user_id index for fast queries
- **Atomic functions**: PostgreSQL functions for atomic operations
- **Connection pooling**: Efficient database connections

### Caching Strategy
- **Client-side caching**: Store preferences in localStorage
- **Server-side caching**: Consider Redis for high-traffic scenarios
- **Cache invalidation**: Update cache on PATCH requests

### Rate Limiting
- **Per-user limits**: 10 requests per minute per user
- **Request size limits**: 10KB maximum request body
- **Timeout protection**: 30-second function timeout

## 12. Security Considerations

### Authentication
- **JWT validation**: Proper token verification
- **User resolution**: External ID to internal ID mapping
- **Token expiration**: 24-hour token lifetime

### Data Privacy
- **User isolation**: Users can only access their own preferences
- **No PII logging**: Sanitized error messages
- **Input sanitization**: Unknown fields are ignored

### Input Validation
- **Type validation**: Proper type checking and coercion
- **Range validation**: Bounds checking for numeric fields
- **Format validation**: IANA timezone validation

## 13. Troubleshooting

### Common Issues

1. **Authentication Failures**:
   - Check JWT secret configuration
   - Verify token format and expiration
   - Ensure user exists in database

2. **Validation Errors**:
   - Check timezone format (must be IANA)
   - Verify enum values (units, theme)
   - Check numeric ranges (sleep goal, workout goal)

3. **Database Errors**:
   - Verify database connection
   - Check function permissions
   - Review error logs

4. **Concurrent Update Issues**:
   - Atomic upserts handle concurrent updates
   - Last write wins strategy
   - No race conditions

### Debug Commands

```bash
# Check user preferences
psql $DATABASE_URL -c "SELECT * FROM user_preferences WHERE user_id = 'your-user-id';"

# Check user table
psql $DATABASE_URL -c "SELECT id, external_id FROM users WHERE external_id = 'your-external-id';"

# Test timezone validation
psql $DATABASE_URL -c "SELECT is_valid_timezone('America/Denver');"

# Test sleep goal rounding
psql $DATABASE_URL -c "SELECT round_sleep_goal(7.55);"
```

## 14. Maintenance

### Regular Tasks
- **Monitor error rates**: Check for validation failures
- **Review logs**: Look for authentication issues
- **Update dependencies**: Keep moment-timezone current
- **Test timezone validation**: Ensure IANA timezone support

### Data Cleanup
- **Orphaned preferences**: Clean up preferences for deleted users
- **Old preferences**: Consider archiving old preference history
- **Schema migrations**: Plan for future schema changes

### Updates
- **Schema changes**: Use versioning for migrations
- **API versioning**: Maintain backward compatibility
- **Dependency updates**: Keep packages current
- **Security patches**: Apply promptly

## 15. Future Enhancements

### Phase 2 Features
- **Unit conversion**: Server-side unit conversion in API responses
- **Audit trail**: Track preference changes over time
- **Advanced notifications**: Granular notification preferences
- **Timezone display**: Server-side timezone formatting

### Phase 3 Features
- **Preference categories**: Group related preferences
- **Bulk operations**: Update multiple preferences at once
- **Preference templates**: Default preference sets
- **Admin management**: Admin interface for user preferences

## Support

For issues or questions:
1. Check the error codes and descriptions
2. Review the validation rules
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
- Ensure proper user isolation
- Validate all input data
