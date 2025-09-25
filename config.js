// Strava API Configuration
// These credentials are loaded from environment variables for security
const STRAVA_TOKENS = {
    clientId: process.env.STRAVA_CLIENT_ID || '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET || ''
    // Note: accessToken and refreshToken are user-specific and stored in user profiles
};

// Additional API configurations
const API_CONFIG = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || ''
    },
    admin: {
        key: process.env.ADMIN_KEY || ''
    },
    database: {
        url: process.env.DATABASE_URL || ''
    }
};

// Check for missing environment variables and warn
function checkEnvironmentVariables() {
    const missingVars = [];
    
    if (!STRAVA_TOKENS.clientId) missingVars.push('STRAVA_CLIENT_ID');
    if (!STRAVA_TOKENS.clientSecret) missingVars.push('STRAVA_CLIENT_SECRET');
    if (!API_CONFIG.openai.apiKey) missingVars.push('OPENAI_API_KEY');
    if (!API_CONFIG.database.url) missingVars.push('DATABASE_URL');
    if (!API_CONFIG.admin.key) missingVars.push('ADMIN_KEY');
    
    if (missingVars.length > 0) {
        console.warn('⚠️ Missing environment variables:', missingVars.join(', '));
        console.warn('Please set these variables in your .env.local file or environment');
        console.warn('See env-template.txt for reference');
    } else {
        console.log('✅ All environment variables are set');
    }
}

// Check environment variables on load
if (typeof window === 'undefined') {
    // Only check in Node.js environment (not in browser)
    checkEnvironmentVariables();
}

// Export for use in the main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STRAVA_TOKENS, API_CONFIG };
}
