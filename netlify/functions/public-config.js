/**
 * Public Configuration Endpoint
 *
 * Returns only safe, public configuration that can be exposed to the client.
 * NEVER includes API keys, secrets, or sensitive environment variables.
 */

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Only return safe, public configuration
        const stravaClientId = process.env.STRAVA_CLIENT_ID;

        if (!stravaClientId || String(stravaClientId).trim() === '' || String(stravaClientId).toLowerCase() === 'undefined') {
            throw new Error('Strava client ID not configured');
        }

        const publicConfig = {
            // App configuration
            app: {
                name: 'Ignite Fitness',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            },

            // API endpoints (public URLs only)
            api: {
                baseUrl: process.env.NETLIFY_URL || 'http://localhost:8888',
                endpoints: {
                    strava: {
                        oauth: '/.netlify/functions/strava-oauth',
                        status: '/.netlify/functions/integrations-strava-status',
                        import: '/.netlify/functions/integrations-strava-import'
                    },
                    ai: {
                        proxy: '/.netlify/functions/ai-proxy'
                    },
                    sessions: {
                        list: '/.netlify/functions/sessions-list',
                        create: '/.netlify/functions/sessions-create',
                        update: '/.netlify/functions/sessions-update',
                        delete: '/.netlify/functions/sessions-delete'
                    },
                    exercises: {
                        list: '/.netlify/functions/sessions-exercises-list',
                        create: '/.netlify/functions/sessions-exercises-create',
                        update: '/.netlify/functions/sessions-exercises-update',
                        delete: '/.netlify/functions/sessions-exercises-delete'
                    },
                    user: {
                        data: '/.netlify/functions/get-user-data',
                        preferences: '/.netlify/functions/users-preferences-get',
                        updatePreferences: '/.netlify/functions/users-preferences-patch'
                    }
                }
            },

            // Feature flags (public only)
            features: {
                stravaIntegration: true,
                aiWorkoutGeneration: true,
                offlineMode: true,
                pwa: true
            },

            // Public integration settings
            integrations: {
                strava: {
                    clientId: stravaClientId,
                    redirectUri: process.env.STRAVA_PUBLIC_REDIRECT_URI || `${process.env.NETLIFY_URL || 'http://localhost:8888'}/strava-callback.html`,
                    scope: 'read,activity:read_all,profile:read_all'
                }
            },

            // UI configuration
            ui: {
                theme: 'default',
                language: 'en',
                timezone: 'UTC'
            },

            // Cache configuration
            cache: {
                defaultTtl: 300000, // 5 minutes
                maxSize: 1000
            }
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(publicConfig)
        };

    } catch (error) {
        console.error('Error in public-config:', error);

        if (error.message === 'Strava client ID not configured') {
            return {
                statusCode: 503,
                headers,
                body: JSON.stringify({
                    error: 'Strava integration requires configuration. Contact your administrator.'
                })
            };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: 'Failed to load public configuration'
            })
        };
    }
};
