exports.handler = async (_event, _context) => {
  // Only return non-sensitive configuration
  const publicConfig = {
    apiBaseUrl: process.env.NETLIFY_URL || 'https://ignite-fitness.netlify.app',
    environment: process.env.NODE_ENV || 'production',
    stravaClientId: process.env.STRAVA_CLIENT_ID, // This is safe to expose
    features: {
      stravaIntegration: !!process.env.STRAVA_CLIENT_ID,
      aiCoaching: !!process.env.OPENAI_API_KEY,
      analytics: !!process.env.ANALYTICS_KEY,
    },
    version: '1.0.0',
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5 minutes
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(publicConfig),
  };
};
