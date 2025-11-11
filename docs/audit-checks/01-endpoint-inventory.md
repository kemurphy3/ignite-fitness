# Endpoint Inventory - Ignite Fitness

## Complete Function Inventory

| Endpoint                     | Method         | Auth Type | Purpose                    | Status                |
| ---------------------------- | -------------- | --------- | -------------------------- | --------------------- |
| `admin-get-all-users`        | GET            | None (⚠️) | Retrieve all users from DB | 🔴 CRITICAL - No Auth |
| `admin-health`               | GET            | JWT Admin | System health check        | ✅ OK                 |
| `admin-overview`             | GET            | JWT Admin | Analytics overview         | ✅ OK                 |
| `admin-sessions-by-type`     | GET            | JWT Admin | Sessions breakdown by type | ✅ OK                 |
| `admin-sessions-series`      | GET            | JWT Admin | Time series session data   | ✅ OK                 |
| `admin-users-top`            | GET            | JWT Admin | Top users by activity      | ✅ OK                 |
| `ai-proxy`                   | POST           | None (⚠️) | Proxy AI requests          | 🔴 CRITICAL - No Auth |
| `api-key-manager`            | POST           | Admin Key | Manage API keys            | ✅ OK                 |
| `exercises-bulk-create`      | POST           | API Key   | Bulk create exercises      | ✅ OK                 |
| `get-user-data`              | GET            | None (⚠️) | Legacy user data retrieval | 🔴 CRITICAL - No Auth |
| `integrations-strava-import` | POST           | JWT       | Import Strava activities   | ✅ OK                 |
| `integrations-strava-status` | GET            | JWT       | Check import status        | ✅ OK                 |
| `save-user-data`             | POST           | None (⚠️) | Legacy user data save      | 🔴 CRITICAL - No Auth |
| `sessions-create`            | POST           | API Key   | Create workout session     | ✅ OK                 |
| `sessions-exercises-create`  | POST           | JWT       | Add exercise to session    | ✅ OK                 |
| `sessions-exercises-delete`  | DELETE         | JWT       | Remove exercise            | ✅ OK                 |
| `sessions-exercises-list`    | GET            | JWT       | List session exercises     | ✅ OK                 |
| `sessions-exercises-update`  | PUT            | JWT       | Update exercise            | ✅ OK                 |
| `sessions-list`              | GET            | API Key   | List user sessions         | ✅ OK                 |
| `strava-auto-refresh`        | Scheduled      | None      | Auto-refresh tokens        | ✅ OK (Scheduled)     |
| `strava-oauth`               | POST           | None      | OAuth initiation           | ✅ OK (Public)        |
| `strava-oauth-exchange`      | POST           | None      | OAuth token exchange       | ✅ OK (Public)        |
| `strava-proxy`               | ALL            | None (⚠️) | Proxy Strava API           | 🔴 CRITICAL - No Auth |
| `strava-refresh-token`       | POST           | None      | Refresh Strava token       | ⚠️ Should have auth   |
| `strava-token-status`        | GET            | None      | Check token status         | ⚠️ Should have auth   |
| `test-db-connection`         | GET            | None      | DB connectivity test       | 🔴 CRITICAL - Remove  |
| `user-profile`               | GET/POST/PATCH | API Key   | User profile CRUD          | ✅ OK                 |
| `users-preferences-get`      | GET            | JWT       | Get user preferences       | ✅ OK                 |
| `users-preferences-patch`    | PATCH          | JWT       | Update preferences         | ✅ OK                 |
| `users-profile-get`          | GET            | JWT       | Get user profile           | ✅ OK                 |
| `users-profile-patch`        | PATCH          | JWT       | Update profile             | ✅ OK                 |
| `users-profile-post`         | POST           | JWT       | Create profile             | ✅ OK                 |
| `users-profile-validate`     | POST           | JWT       | Validate profile data      | ✅ OK                 |

## Authentication Summary

### Current Authentication Methods

1. **JWT Bearer Token** - Used for user-authenticated endpoints
2. **API Key (X-API-Key header)** - Used for service endpoints
3. **Admin Key** - Special key for admin operations
4. **None** - Public or missing authentication

### Authentication Distribution

- ✅ Properly Authenticated: 23 endpoints (70%)
- 🔴 Critical Security Issues: 6 endpoints (18%)
- ⚠️ Should Review: 2 endpoints (6%)
- ✅ Intentionally Public: 2 endpoints (6%)

## Utility Modules

Located in `/netlify/functions/utils/`:

| Module                | Purpose                     | Usage             |
| --------------------- | --------------------------- | ----------------- |
| `admin-auth.js`       | Admin role verification     | Admin endpoints   |
| `audit.js`            | Audit logging               | Admin operations  |
| `auth.js`             | JWT verification            | User endpoints    |
| `circuit-breaker.js`  | External API protection     | Strava, AI calls  |
| `database.js`         | DB connection utilities     | All DB operations |
| `distributed-lock.js` | Race condition prevention   | Token refresh     |
| `encryption.js`       | Token encryption/decryption | Strava tokens     |
| `rate-limiter.js`     | Request rate limiting       | API protection    |
| `security.js`         | Security utilities          | Various           |
| `strava-import.js`    | Strava import logic         | Import endpoint   |
| `units.js`            | Unit conversions            | Data processing   |
| `user-preferences.js` | Preference utilities        | User preferences  |

## Recommendations

### Immediate Actions Required

1. Add authentication to `admin-get-all-users.js`
2. Add authentication to `ai-proxy.js`
3. Add authentication to `strava-proxy.js`
4. Remove or protect `test-db-connection.js`
5. Remove or protect `get-user-data.js` and `save-user-data.js` (legacy)

### Authentication Standardization

Consider implementing a unified authentication middleware that:

- Checks API keys first (for service-to-service calls)
- Falls back to JWT (for user sessions)
- Validates admin roles where required
- Returns consistent error responses
