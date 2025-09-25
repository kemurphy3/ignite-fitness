# Security Documentation

## Environment Variables

The following environment variables must be set in your Netlify dashboard for secure operation:

### Required Variables

1. **DATABASE_URL** - Your Neon PostgreSQL connection string
2. **STRAVA_CLIENT_ID** - Your Strava application client ID
3. **STRAVA_CLIENT_SECRET** - Your Strava application client secret
4. **ADMIN_KEY** - Secret key for admin functions (default: ignitefitness_admin_2024)

### Optional Variables

1. **OPENAI_API_KEY** - Your OpenAI API key for AI features
2. **NODE_ENV** - Set to "production" for production deployments

## Security Features Implemented

### 1. API Key Protection
- All API keys are stored as environment variables
- Client-side code never exposes sensitive credentials
- API calls are routed through secure Netlify functions

### 2. Secure API Proxies
- **ai-proxy.js** - Handles OpenAI API calls securely
- **strava-proxy.js** - Handles Strava API calls securely
- Both proxies validate requests and hide API keys

### 3. User Data Protection
- User-specific tokens (access/refresh) are stored in user profiles
- No sensitive data is exposed in client-side code
- All API calls require proper authentication

### 4. CORS Configuration
- Proper CORS headers are set for all API endpoints
- Preflight requests are handled correctly

## Setting Up Environment Variables

### In Netlify Dashboard:
1. Go to your site's settings
2. Navigate to "Environment variables"
3. Add each variable with its corresponding value

### For Local Development:
Create a `.env` file in your project root:
```
DATABASE_URL=your-neon-connection-string
STRAVA_CLIENT_ID=your-strava-client-id
STRAVA_CLIENT_SECRET=your-strava-client-secret
OPENAI_API_KEY=your-openai-api-key
ADMIN_KEY=your-secure-admin-key
```

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use different keys for development and production**
3. **Regularly rotate API keys**
4. **Monitor API usage for unusual activity**
5. **Use HTTPS in production**

## API Endpoints

### Secure Endpoints
- `/.netlify/functions/ai-proxy` - AI API calls
- `/.netlify/functions/strava-proxy` - Strava API calls
- `/.netlify/functions/sessions-create` - Create workout sessions
- `/.netlify/functions/sessions-list` - List user sessions
- `/.netlify/functions/get-user-data` - Get user data
- `/.netlify/functions/save-user-data` - Save user data
- `/.netlify/functions/admin-get-all-users` - Admin function (requires admin key)

### Authentication
- Admin functions require the `adminKey` parameter
- User data is filtered by `user_id` to prevent cross-user access
- All API calls validate user authentication

## Monitoring

Monitor the following for security issues:
- Unusual API usage patterns
- Failed authentication attempts
- Cross-user data access attempts
- API key exposure in logs

## Incident Response

If you suspect a security breach:
1. Immediately rotate all API keys
2. Check logs for unusual activity
3. Review user data access patterns
4. Update environment variables
5. Deploy updated code if necessary
