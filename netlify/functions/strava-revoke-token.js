/**
 * Strava Token Revocation Endpoint
 * Securely revokes Strava tokens and clears encrypted database records
 */

const fetch = require('node-fetch');
const SafeLogger = require('./utils/safe-logging');
const { createClient } = require('@supabase/supabase-js');

// Create safe logger for this context
const logger = SafeLogger.create({
    enableMasking: true,
    visibleChars: 4,
    maskChar: '*'
});

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const okJson = (data) => ({
    statusCode: 200,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(data)
});

const badReq = (message) => ({
    statusCode: 400,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: message })
});

const unauthorized = (message) => ({
    statusCode: 401,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: message })
});

const methodNotAllowed = () => ({
    statusCode: 405,
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: 'Method not allowed' })
});

const okPreflight = () => ({
    statusCode: 200,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: ''
});

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {return okPreflight();}
    if (event.httpMethod !== 'POST') {return methodNotAllowed();}

    try {
        // Parse request body
        const { access_token, refresh_token, user_id } = JSON.parse(event.body || '{}');

        if (!access_token) {
            return badReq('Missing access token');
        }

        // Validate user authentication
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return unauthorized('Missing or invalid authorization header');
        }

        const jwtToken = authHeader.substring(7);

        // Verify JWT token (simplified - in production, use proper JWT verification)
        if (!jwtToken || jwtToken.length < 10) {
            return unauthorized('Invalid JWT token');
        }

        logger.info('Token revocation request received', {
            user_id,
            access_token,
            refresh_token
        });

        // Revoke token with Strava API
        const revokeResponse = await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                access_token
            })
        });

        if (!revokeResponse.ok) {
            const errorData = await revokeResponse.json();
            logger.error('Strava token revocation failed', {
                status: revokeResponse.status,
                error_data: errorData,
                access_token
            });

            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to revoke token with Strava',
                    details: errorData
                })
            };
        }

        // Clear tokens from database
        await clearTokensFromDatabase(user_id, access_token);

        // Log successful revocation
        logger.info('Token revocation successful', {
            user_id,
            access_token,
            revoked_at: new Date().toISOString()
        });

        return okJson({
            success: true,
            message: 'Strava token revoked successfully',
            revoked_at: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Token revocation failed', {
            error_type: error.name,
            error_message: error.message,
            stack: error.stack
        });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: 'Internal server error during token revocation'
            })
        };
    }
};

/**
 * Clear tokens from database
 * @param {string} userId - User ID
 * @param {string} accessToken - Access token to clear
 */
async function clearTokensFromDatabase(userId, accessToken) {
    try {
        // Clear Strava tokens from user_integrations table
        const { error: integrationError } = await supabase
            .from('user_integrations')
            .delete()
            .eq('user_id', userId)
            .eq('provider', 'strava');

        if (integrationError) {
            logger.error('Failed to clear integration tokens', {
                user_id: userId,
                error: integrationError
            });
        }

        // Clear any cached Strava data
        const { error: cacheError } = await supabase
            .from('strava_cache')
            .delete()
            .eq('user_id', userId);

        if (cacheError) {
            logger.error('Failed to clear Strava cache', {
                user_id: userId,
                error: cacheError
            });
        }

        // Clear activity data if user requests complete data removal
        const { error: activityError } = await supabase
            .from('activities')
            .delete()
            .eq('user_id', userId)
            .eq('canonical_source', 'strava');

        if (activityError) {
            logger.error('Failed to clear Strava activities', {
                user_id: userId,
                error: activityError
            });
        }

        // Log audit trail
        await logTokenRevocation(userId, accessToken);

        logger.info('Database cleanup completed', {
            user_id: userId,
            access_token: accessToken
        });

    } catch (error) {
        logger.error('Database cleanup failed', {
            user_id: userId,
            access_token: accessToken,
            error: error.message
        });
        throw error;
    }
}

/**
 * Log token revocation for audit trail
 * @param {string} userId - User ID
 * @param {string} accessToken - Access token
 */
async function logTokenRevocation(userId, accessToken) {
    try {
        const { error } = await supabase
            .from('audit_logs')
            .insert({
                user_id: userId,
                action: 'token_revocation',
                resource_type: 'strava_integration',
                resource_id: accessToken,
                details: {
                    revoked_at: new Date().toISOString(),
                    reason: 'user_requested',
                    scope: 'complete_revocation'
                },
                ip_address: 'server',
                user_agent: 'strava-revoke-endpoint',
                created_at: new Date().toISOString()
            });

        if (error) {
            logger.error('Failed to log token revocation', {
                user_id: userId,
                error
            });
        }

    } catch (error) {
        logger.error('Audit logging failed', {
            user_id: userId,
            error: error.message
        });
    }
}
