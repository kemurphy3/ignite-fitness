# Exercises API System - Deployment Guide

## Overview

This guide covers the deployment of the comprehensive session exercises
management API with bulk operations, pagination, and multi-user isolation.

## Prerequisites

- Netlify account with Functions enabled
- Neon PostgreSQL database (or compatible PostgreSQL)
- JWT secret for authentication
- Node.js dependencies

## 1. Database Setup

### Step 1: Create Database Schema

Run the database schema creation script:

```bash
psql $DATABASE_URL -f database-exercises-schema.sql
```

### Step 2: Verify Schema

Check that all tables were created:

```sql
\dt session_exercises
\dt session_exercise_history
\dt exercise_rate_limits
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

### 4.1 Create Exercises (Bulk)

```bash
POST /.netlify/functions/sessions-exercises-create
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "exercises": [
    {
      "name": "Barbell Squat",
      "sets": 5,
      "reps": 5,
      "weight_kg": 102.5,
      "rpe": 8,
      "rest_seconds": 180,
      "tempo": "2-0-2-0",
      "notes": "Felt strong today",
      "muscle_groups": ["quadriceps", "glutes"],
      "equipment_type": "barbell",
      "order_index": 0
    }
  ]
}
```

### 4.2 List Exercises (Paginated)

```bash
GET /.netlify/functions/sessions-exercises-list?limit=20&cursor=eyJvIjoxLCJjIjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaS...
Authorization: Bearer <jwt-token>
```

### 4.3 Update Exercise

```bash
PUT /.netlify/functions/sessions-exercises-update
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "sets": 4,
  "reps": 6,
  "weight_kg": 105,
  "rpe": 9,
  "notes": "Increased weight, felt harder"
}
```

### 4.4 Delete Exercise

```bash
DELETE /.netlify/functions/sessions-exercises-delete
Authorization: Bearer <jwt-token>
```

## 5. Testing

### Step 1: Run Test Suite

```bash
# Install test dependencies
npm install node-fetch

# Update test configuration
# Edit test-exercises-api.js and set BASE_URL to your Netlify URL

# Run tests
node test-exercises-api.js
```

### Step 2: Manual Testing

1. **Create Exercises Test**:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/sessions-exercises-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "exercises": [
      {
        "name": "Bench Press",
        "sets": 3,
        "reps": 10,
        "weight_kg": 80,
        "muscle_groups": ["chest", "triceps"]
      }
    ]
  }'
```

2. **List Exercises Test**:

```bash
curl https://your-site.netlify.app/.netlify/functions/sessions-exercises-list \
  -H "Authorization: Bearer <your-jwt-token>"
```

3. **Update Exercise Test**:

```bash
curl -X PUT https://your-site.netlify.app/.netlify/functions/sessions-exercises-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"sets": 4, "reps": 8}'
```

## 6. Key Features

### Bulk Operations

- **Transaction-wrapped**: All exercises created in single atomic transaction
- **Partial failure handling**: All-or-nothing approach ensures data consistency
- **Idempotency**: Duplicate requests return existing data
- **Rate limiting**: 60 requests per 60 seconds per user

### Pagination

- **Cursor-based**: Stable pagination using composite ordering
- **JSON cursors**: Versioned cursor format for future compatibility
- **Efficient queries**: Composite indexes for 10,000+ exercises
- **Configurable limits**: 1-100 items per page, default 20

### Data Validation

- **Comprehensive validation**: All fields validated with AJV schemas
- **Range checks**: Sets (1-20), reps (1-100), weight (0-500kg), RPE (1-10)
- **String limits**: Name (1-100 chars), notes (≤500 chars)
- **Tempo format**: Validated as "X-X-X-X" pattern
- **Muscle groups**: Validated against enum type

### Security

- **JWT authentication**: Token-based authentication for all endpoints
- **Two-step ownership**: Session ownership verified before exercise access
- **User isolation**: Users can only access their own exercises
- **Input sanitization**: All inputs sanitized and validated
- **Rate limiting**: Sliding window rate limiting prevents abuse

### Order Management

- **Automatic reindexing**: Gaps in order_index are automatically filled
- **Superset grouping**: Exercises can be grouped (e.g., "A", "B")
- **Stable ordering**: Consistent ordering for pagination
- **Gap prevention**: Reindexing ensures no gaps in sequence

## 7. Data Model

### Session Exercises Table

- **Core data**: name, sets, reps, weight_kg, rpe
- **Advanced fields**: tempo, rest_seconds, notes, superset_group
- **Tracking**: equipment_type, muscle_groups, exercise_type
- **Ordering**: order_index for exercise sequence
- **Idempotency**: request_hash for duplicate prevention

### History Tracking

- **Change tracking**: All modifications logged to history table
- **Action types**: create, update, delete, bulk_create
- **Data snapshots**: Old and new data stored as JSONB
- **Audit trail**: Complete history of all changes

### Rate Limiting

- **Sliding window**: 60 requests per 60 seconds per user
- **Per-endpoint**: Different limits for different operations
- **Automatic cleanup**: Old rate limit entries cleaned up
- **Retry headers**: Retry-After header for rate limited requests

## 8. Performance Optimization

### Database Indexes

- **Composite indexes**: Optimized for pagination queries
- **User isolation**: Efficient user-specific queries
- **Order indexing**: Fast ordering and reindexing
- **Superset queries**: Optimized for superset grouping

### Query Optimization

- **Stable ordering**: Consistent results for pagination
- **Limit optimization**: Efficient LIMIT + 1 for has_more detection
- **Cursor decoding**: Fast cursor parsing and validation
- **Transaction efficiency**: Minimal transaction overhead

### Caching

- **Client-side**: ETag headers for conditional requests
- **Response caching**: Short-term caching for list operations
- **Connection pooling**: Efficient database connections

## 9. Error Handling

### Error Codes

| Code      | Description               |
| --------- | ------------------------- |
| AUTH_001  | Authorization required    |
| AUTH_002  | Invalid token             |
| AUTHZ_001 | Access denied             |
| VAL_001   | Invalid path format       |
| VAL_002   | Exercises array required  |
| VAL_003   | Too many exercises        |
| VAL_004   | Validation failed         |
| VAL_005   | Invalid cursor            |
| VAL_006   | No valid fields to update |
| SESS_001  | Session not found         |
| EX_001    | Exercise not found        |
| RATE_001  | Rate limit exceeded       |
| SYS_001   | Transaction failed        |
| SYS_002   | Internal server error     |

### Error Response Format

```json
{
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

## 10. Rate Limiting

### Limits

- **Create**: 60 requests per 60 seconds
- **List**: 60 requests per 60 seconds
- **Update**: 60 requests per 60 seconds
- **Delete**: 60 requests per 60 seconds

### Implementation

- **Sliding window**: More accurate than fixed windows
- **Per-user**: Individual limits for each user
- **Per-endpoint**: Different limits for different operations
- **Automatic cleanup**: Old entries removed automatically

### Response Headers

- **Retry-After**: Seconds to wait before retrying
- **X-RateLimit-Limit**: Maximum requests allowed
- **X-RateLimit-Remaining**: Requests remaining in window
- **X-RateLimit-Reset**: When the window resets

## 11. Pagination

### Cursor Format

```json
{
  "o": 19, // order_index
  "c": "2024-01-15T10:30:00.000Z", // created_at
  "i": "987fcdeb-51a2-43f1-b890-123456789abc", // id
  "v": 1 // version
}
```

### Usage

1. **First page**: No cursor parameter
2. **Next page**: Use `next_cursor` from previous response
3. **Stable ordering**: Consistent results even with concurrent modifications
4. **Version support**: Cursor format versioned for future changes

### Query Parameters

- **limit**: Number of items per page (1-100, default 20)
- **cursor**: Base64-encoded cursor for pagination

## 12. Superset Grouping

### Features

- **Group identification**: Use `superset_group` field (e.g., "A", "B")
- **Ordering**: Exercises within groups maintain order
- **Querying**: Filter by superset group
- **Validation**: Group names limited to 10 characters

### Example

```json
{
  "exercises": [
    {
      "name": "Bench Press",
      "sets": 4,
      "reps": 8,
      "superset_group": "A",
      "order_index": 0
    },
    {
      "name": "Bent Row",
      "sets": 4,
      "reps": 8,
      "superset_group": "A",
      "order_index": 1
    }
  ]
}
```

## 13. Monitoring

### Key Metrics

- **Request rates**: Per endpoint and per user
- **Response times**: P95 and P99 latencies
- **Error rates**: By error code and endpoint
- **Rate limiting**: Number of rate limited requests

### Logging

- **Structured logs**: JSON format for easy parsing
- **User anonymization**: User IDs hashed in logs
- **Request tracking**: Unique request IDs for tracing
- **Error details**: Comprehensive error information

### Health Checks

- **Database connectivity**: Connection pool health
- **Function performance**: Response time monitoring
- **Rate limit status**: Current rate limit state
- **Error rates**: Error rate thresholds

## 14. Troubleshooting

### Common Issues

1. **Rate Limiting**:
   - Check request frequency
   - Implement exponential backoff
   - Monitor rate limit headers

2. **Validation Errors**:
   - Check field types and ranges
   - Verify required fields
   - Review muscle group enums

3. **Authentication Errors**:
   - Verify JWT token format
   - Check token expiration
   - Ensure proper Authorization header

4. **Pagination Issues**:
   - Validate cursor format
   - Check cursor version
   - Verify limit parameters

### Debug Commands

```bash
# Check exercise count
curl -H "Authorization: Bearer <token>" \
  https://your-site.netlify.app/.netlify/functions/sessions-<sessionId>-exercises

# Test rate limiting
for i in {1..65}; do
  curl -H "Authorization: Bearer <token>" \
    https://your-site.netlify.app/.netlify/functions/sessions-<sessionId>-exercises
done

# Validate exercise data
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"exercises":[{"name":"Test","sets":3,"reps":10}]}' \
  https://your-site.netlify.app/.netlify/functions/sessions-<sessionId>-exercises
```

## 15. Maintenance

### Regular Tasks

- **Monitor rate limiting**: Check for abuse patterns
- **Review error rates**: Identify common issues
- **Check performance**: Monitor response times
- **Clean up data**: Remove old rate limit entries

### Data Cleanup

- **Rate limits**: Automatic cleanup after 2 minutes
- **History**: Consider archiving old history data
- **Exercises**: Clean up orphaned exercises

### Updates

- **Schema changes**: Use migrations for database updates
- **API versioning**: Maintain backward compatibility
- **Dependency updates**: Keep packages current
- **Security patches**: Apply security updates promptly

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
