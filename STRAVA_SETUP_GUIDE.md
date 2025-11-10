# Strava Integration Setup Guide

## Overview
This guide explains how to connect your Ignite Fitness app to real Strava accounts using OAuth 2.0.

## Prerequisites
- A Strava account
- A Strava app registered at https://www.strava.com/settings/api
- A deployed version of Ignite Fitness (can be localhost for testing)

## Step 1: Create a Strava App

1. **Go to Strava Settings**
   - Visit https://www.strava.com/settings/api
   - Log in with your Strava account

2. **Create a New App**
   - Click "Create App" or "Manage App"
   - Fill in the details:
     - **Name**: Ignite Fitness (or your choice)
     - **Category**: Training
     - **Website**: Your app URL (e.g., `https://ignitefitness.netlify.app`)
     - **Authorization Callback Domain**: Your domain (e.g., `ignitefitness.netlify.app`)
     - **Description**: Fitness tracking and training load management

3. **Get Your Credentials**
   - **Client ID**: You'll see this immediately
   - **Client Secret**: Click "Show" to reveal it (save this securely!)

## Step 2: Configure Your App

### Option A: Local Testing (Development)

1. **Set the Client ID in localStorage**
   ```javascript
   // Open browser console on your app
   localStorage.setItem('strava_client_id', 'YOUR_CLIENT_ID_HERE');
   ```

2. **Update callback.html**
   - Open `callback.html`
   - Find the line with `const stravaClientId = '168662';`
   - Replace with your actual Client ID

### Option B: Production (Deployed)

1. **Add Environment Variables**
   - In your deployment platform (Netlify, Vercel, etc.)
   - Add environment variable:
     ```
     STRAVA_CLIENT_ID=YOUR_STRAVA_CLIENT_ID
     STRAVA_CLIENT_SECRET=YOUR_STRAVA_CLIENT_SECRET
     ```

2. **Update netlify.toml or environment config**
   ```toml
   [build.environment]
     STRAVA_CLIENT_ID = "YOUR_STRAVA_CLIENT_ID"
     STRAVA_CLIENT_SECRET = "YOUR_STRAVA_CLIENT_SECRET"
   ```

## Step 3: Backend Setup (Required for Token Exchange)

### Netlify Functions

1. **Create the OAuth function** (`netlify/functions/strava-oauth.js`)

```javascript
exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { code, state } = JSON.parse(event.body);

    // Verify state parameter (security check)
    // This should match what was stored in localStorage

    // Exchange code for tokens
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();

    if (data.errors) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.errors[0].message })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        athlete: data.athlete
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

2. **Deploy the function**

## Step 4: Test the Integration

### Local Testing

1. **Start your local server**
   ```bash
   python -m http.server 8000
   ```

2. **Set up ngrok (to get HTTPS for OAuth)**
   ```bash
   ngrok http 8000
   ```
   - Update your Strava app's "Authorization Callback Domain" to use the ngrok URL

3. **Test the connection**
   - Open your app in a browser
   - Go to Settings → Strava Integration
   - Click "Connect to Strava"
   - Authorize the app
   - You should be redirected back with tokens

### Production Testing

1. **Deploy your app**
2. **Update Strava app settings** with your production URL
3. **Test the full flow**

## Step 5: Using the Strava API

### Current Implementation

The app automatically:
- **Connects** to Strava via OAuth
- **Syncs activities** from the last 30 days
- **Calculates TSS** (Training Stress Score) for each activity
- **Estimates recovery** time needed
- **Suggests workout adjustments** based on external activities

### API Features Used

- `GET /athlete/activities` - Fetch user activities
- Scopes used: `read`, `activity:read`

### Adding More Features

You can extend the integration to include:
- Real-time activity updates
- Segment analysis
- Performance metrics
- Training zones

## Troubleshooting

### "Redirect URI mismatch"
- Ensure the callback URL in your Strava app matches exactly
- Format should be: `https://yourdomain.com/callback.html`

### "Access token expired"
- Tokens expire after 6 hours
- Implement automatic refresh using the refresh token
- Or re-authorize when expired

### "Client ID not configured"
- Make sure you've set the Client ID
- Check localStorage: `localStorage.getItem('strava_client_id')`

### CORS Errors
- Ensure your Netlify function has proper CORS headers
- Check that the function is deployed and accessible

## Security Considerations

1. **Never expose your Client Secret** in client-side code
2. **Always use HTTPS** in production
3. **Validate the state parameter** to prevent CSRF attacks
4. **Store tokens securely** (consider encrypting in localStorage)
5. **Implement token refresh** to avoid frequent re-authorization

## Resources

- [Strava OAuth Documentation](https://developers.strava.com/docs/authentication/)
- [Strava API Documentation](https://developers.strava.com/docs/reference/)
- [Strava API Explorer](https://www.strava.com/settings/api)
- [OAuth 2.0 Flow Diagram](https://developers.strava.com/docs/getting-started/#account)

## Next Steps

1. Implement token refresh mechanism
2. Add more Strava API endpoints
3. Store activity data in a database
4. Set up automatic syncing
5. Add activity visualization
6. Implement training load dashboards
