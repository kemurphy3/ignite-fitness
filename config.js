// Strava API Configuration
// These credentials are now loaded from environment variables for security
const STRAVA_TOKENS = {
    clientId: process.env.STRAVA_CLIENT_ID || '168662',        // Fallback for development
    clientSecret: process.env.STRAVA_CLIENT_SECRET || '8d502e2d7f16d70bc03f75cafdef3fa0fc541be6' // Fallback for development
    // Note: accessToken and refreshToken are user-specific and stored in user profiles
};

// Additional API configurations
const API_CONFIG = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || null
    },
    admin: {
        key: process.env.ADMIN_KEY || 'ignitefitness_admin_2024'
    }
};

// Export for use in the main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STRAVA_TOKENS, API_CONFIG };
}
