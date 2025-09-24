// Strava API Configuration
// These are your Strava app's credentials (same for all users)
const STRAVA_TOKENS = {
    clientId: '168662',        // Your Strava app's client ID
    clientSecret: '8d502e2d7f16d70bc03f75cafdef3fa0fc541be6' // Your Strava app's client secret
    // Note: accessToken and refreshToken are now user-specific and stored in user profiles
};

// Export for use in the main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = STRAVA_TOKENS;
}
