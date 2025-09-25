// Strava API Configuration
// These credentials are loaded from environment variables for security
const STRAVA_TOKENS = {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET
    // Note: accessToken and refreshToken are user-specific and stored in user profiles
};

// Additional API configurations
const API_CONFIG = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    admin: {
        key: process.env.ADMIN_KEY
    }
};

// Export for use in the main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STRAVA_TOKENS, API_CONFIG };
}
