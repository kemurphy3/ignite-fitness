// Strava API Configuration
// Copy your tokens from your .env file to here
const STRAVA_TOKENS = {
    accessToken: '91de7cb03d1a763f6972230b955fae8232982f0e',
    refreshToken: 'f6b11117cfa3d8dbcb77c8dfadb1c82d00e8a83e',
    clientId: '168662',        // Add your Strava app's client ID
    clientSecret: '8d502e2d7f16d70bc03f75cafdef3fa0fc541be6' // Add your Strava app's client secret
};

// Export for use in the main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = STRAVA_TOKENS;
}
