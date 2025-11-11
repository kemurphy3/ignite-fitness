# User Profiles System - Deployment Guide

## Overview

This guide covers the deployment of the comprehensive user profiles management
system with enhanced security, validation, and multi-user isolation.

## Prerequisites

- Netlify account with Functions enabled
- Neon PostgreSQL database (or compatible PostgreSQL)
- JWT secret for authentication
- Node.js dependencies

## 1. Database Setup

### Step 1: Create Database Schema

Run the database schema creation script:

```bash
psql $DATABASE_URL -f database-user-profiles-schema.sql
```

### Step 2: Verify Schema

Check that all tables were created:

```sql
\dt user_profiles
\dt user_profile_history
\dt profile_update_requests
\dt profile_rate_limits
\dt valid_goals
```

## 2. Environment Configuration

### Step 1: Set Required Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters

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
npm install ajv jsonwebtoken
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

### 4.1 Create Profile

```bash
POST /.netlify/functions/users-profile-post
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "age": 28,
  "sex": "male",
  "height": { "value": 6, "unit": "feet", "inches": 0 },
  "weight": { "value": 180, "unit": "lbs" },
  "goals": ["gain_muscle", "increase_strength"],
  "bench_press_max": 135,
  "squat_max": 185,
  "deadlift_max": 225
}
```

### 4.2 Get Profile

```bash
GET /.netlify/functions/users-profile-get
Authorization: Bearer <jwt-token>
```

### 4.3 Update Profile

```bash
PATCH /.netlify/functions/users-profile-patch
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "weight": { "value": 185, "unit": "lbs" },
  "bench_press_max": 145
}
```

### 4.4 Validate Profile

```bash
POST /.netlify/functions/users-profile-validate
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "fields": {
    "age": 30,
    "height": { "value": 5, "unit": "feet", "inches": 10 },
    "weight": { "value": 150, "unit": "lbs" }
  }
}
```

## 5. Testing

### Step 1: Run Test Suite

```bash
# Install test dependencies
npm install node-fetch

# Update test configuration
# Edit test-user-profiles.js and set BASE_URL to your Netlify URL

# Run tests
node test-user-profiles.js
```

### Step 2: Manual Testing

1. **Create Profile Test**:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/users-profile-post \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"age": 25, "sex": "female", "height": 165, "weight": 60}'
```

2. **Get Profile Test**:

```bash
curl https://your-site.netlify.app/.netlify/functions/users-profile-get \
  -H "Authorization: Bearer <your-jwt-token>"
```

3. **Update Profile Test**:

```bash
curl -X PATCH https://your-site.netlify.app/.netlify/functions/users-profile-patch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"age": 26}'
```

## 6. Security Features

### Authentication

- JWT-based authentication for all endpoints
- Row-level security prevents cross-user data access
- Token validation and expiration checking

### Input Validation

- Comprehensive field validation with AJV
- Unit conversion with validation
- Physical consistency checks (BMI, lift ratios)
- Goal conflict detection

### Rate Limiting

- 10 profile updates per hour per user
- Request deduplication via hash tracking
- Anomaly detection for suspicious patterns

### Data Protection

- PII sanitization in logs
- SQL injection prevention
- XSS protection
- Input size limits

## 7. Data Model

### User Profiles Table

- Demographics: age, height, weight, sex
- Unit preferences: metric/imperial
- Goals: JSONB array with validation
- Baseline metrics: lifts, bodyweight, cardio
- Calculated fields: BMI, total lifts, completeness score

### History Tracking

- Field-level change tracking
- Version control with optimistic locking
- Audit trail for all modifications

### Rate Limiting

- Hourly update limits
- Request deduplication
- Anomaly detection

## 8. Unit Conversion

### Supported Units

- **Height**: cm, inches, feet+inches
- **Weight**: kg, lbs
- **Lifts**: kg, lbs (automatic conversion)

### Conversion Examples

```javascript
// Height conversion
{ value: 6, unit: 'feet', inches: 2 } → 187.96 cm

// Weight conversion
{ value: 180, unit: 'lbs' } → 81.65 kg

// Display conversion
187.96 cm → { feet: 6, inches: 2, display: "6'2\"" }
81.65 kg → 180 lbs
```

## 9. Validation Rules

### Demographics

- Age: 13-120 years
- Height: 50-300 cm (20-120 inches)
- Weight: 20-500 kg (44-1100 lbs)
- Sex: male, female, other, prefer_not_to_say

### Baseline Metrics

- Bench Press: 0-500 kg
- Squat: 0-500 kg
- Deadlift: 0-500 kg
- Overhead Press: 0-300 kg
- Pull-ups: 0-100 reps
- Push-ups: 0-500 reps
- Mile Time: 4-30 minutes

### Physical Consistency

- BMI: 15-50 (warning if outside 18.5-30)
- Deadlift ≥ Squat × 0.7
- Bench Press ≤ Weight × 3

## 10. Error Codes

| Code     | Description                               |
| -------- | ----------------------------------------- |
| AUTH_001 | Unauthorized - Invalid or missing JWT     |
| RATE_001 | Rate limit exceeded                       |
| VAL_001  | Validation failed                         |
| VAL_002  | Invalid goals specified                   |
| VAL_003  | Invalid field value                       |
| VAL_004  | No valid fields to update                 |
| PROF_404 | Profile not found                         |
| PROF_409 | Profile already exists / Version conflict |
| DUP_001  | Duplicate request                         |
| SEC_001  | Security validation failed                |
| SYS_001  | Internal server error                     |

## 11. Performance Metrics

### Target Performance

- GET requests: < 200ms (p95)
- PATCH requests: < 500ms (p95)
- POST requests: < 500ms (p95)

### Optimization Features

- Calculated fields cached via GENERATED columns
- Composite indexes for history queries
- ETag headers for client-side caching
- Connection pooling

## 12. Monitoring

### Key Metrics

- Profile creation/update rates
- Validation failure rates
- Rate limiting triggers
- Performance metrics
- Error rates by endpoint

### Logging

- All operations logged with sanitized data
- No PII in application logs
- Request tracking for debugging
- Security event logging

## 13. Troubleshooting

### Common Issues

1. **JWT Authentication Errors**:
   - Check JWT_SECRET is set correctly
   - Verify token format and expiration
   - Ensure proper Authorization header

2. **Validation Errors**:
   - Check field types and ranges
   - Verify unit conversion
   - Review goal conflicts

3. **Rate Limiting**:
   - Check update frequency
   - Review request patterns
   - Adjust limits if needed

4. **Database Errors**:
   - Verify DATABASE_URL format
   - Check table permissions
   - Review constraint violations

### Debug Commands

```bash
# Check profile status
curl -H "Authorization: Bearer <token>" \
  https://your-site.netlify.app/.netlify/functions/users-profile-get

# Validate fields
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fields":{"age":25,"sex":"male"}}' \
  https://your-site.netlify.app/.netlify/functions/users-profile-validate
```

## 14. Maintenance

### Regular Tasks

- Monitor rate limiting metrics
- Review validation error patterns
- Check performance metrics
- Update goal definitions as needed

### Data Cleanup

- Profile history auto-cleanup (90 days)
- Rate limit data cleanup (hourly)
- Request tracking cleanup (daily)

## Support

For issues or questions:

1. Check the error codes and descriptions
2. Review the validation rules
3. Check the test suite for examples
4. Monitor the application logs
5. Verify environment configuration

## Security Notice

- Never commit JWT secrets to version control
- Use environment variables for all secrets
- Regularly rotate JWT secrets
- Monitor for security anomalies
- Keep dependencies updated
- Review access logs regularly
