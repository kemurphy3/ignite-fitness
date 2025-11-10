// GET /integrations/strava/status - Get Sync Status
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    const { getNeonClient } = require('./utils/connection-pool');
const sql = getNeonClient();

    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    try {
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: {
                        code: 'AUTH_REQUIRED',
                        message: 'Authorization required'
                    }
                })
            };
        }

        const token = authHeader.substring(7);
        let userId;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: {
                        code: 'AUTH_INVALID',
                        message: 'Invalid token'
                    }
                })
            };
        }

        // Get sync status
        const syncState = await sql`
            SELECT 
                last_import_after,
                last_run_at,
                last_status,
                last_error,
                last_error_code,
                total_imported,
                total_duplicates,
                total_updated,
                total_failed,
                import_in_progress,
                import_continue_token,
                import_started_at,
                created_at,
                updated_at
            FROM integrations_strava
            WHERE user_id = ${userId}
        `;

        if (!syncState.length) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    connected: false,
                    last_import_after: null,
                    last_run_at: null,
                    last_status: null,
                    import_in_progress: false,
                    statistics: {
                        total_imported: 0,
                        total_duplicates: 0,
                        total_updated: 0,
                        total_failed: 0
                    }
                })
            };
        }

        const state = syncState[0];

        // Check Strava connection
        const tokenCheck = await sql`
            SELECT expires_at 
            FROM strava_tokens 
            WHERE user_id = ${userId}
        `;

        const connected = tokenCheck.length > 0;
        const tokenValid = connected && new Date(tokenCheck[0].expires_at) > new Date();

        // Get recent imports
        const recentImports = await sql`
            SELECT 
                run_id,
                MIN(started_at) as started_at,
                MAX(completed_at) as completed_at,
                SUM(activities_imported) as total_imported,
                SUM(activities_duplicate) as total_duplicate,
                SUM(activities_updated) as total_updated,
                SUM(activities_failed) as total_failed,
                COUNT(*) as pages_processed,
                BOOL_OR(timed_out) as was_partial
            FROM strava_import_log
            WHERE user_id = ${userId}
            AND started_at > NOW() - INTERVAL '7 days'
            GROUP BY run_id
            ORDER BY started_at DESC
            LIMIT 5
        `;

        // Calculate import progress if in progress
        let importProgress = null;
        if (state.import_in_progress && state.import_started_at) {
            const elapsed = Date.now() - new Date(state.import_started_at).getTime();
            importProgress = {
                started_at: state.import_started_at,
                elapsed_ms: elapsed,
                has_continue_token: !!state.import_continue_token
            };
        }

        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Cache-Control': 'private, max-age=5'
            },
            body: JSON.stringify({
                connected,
                token_valid: tokenValid,
                last_import_after: state.last_import_after,
                last_import_date: state.last_import_after
                    ? new Date(parseInt(state.last_import_after) * 1000).toISOString()
                    : null,
                last_run_at: state.last_run_at,
                last_status: state.last_status,
                last_error: state.last_error,
                last_error_code: state.last_error_code,
                import_in_progress: state.import_in_progress,
                import_progress: importProgress,
                continue_token: state.import_continue_token,
                statistics: {
                    total_imported: state.total_imported,
                    total_duplicates: state.total_duplicates,
                    total_updated: state.total_updated,
                    total_failed: state.total_failed
                },
                recent_imports: recentImports.map(imp => ({
                    run_id: imp.run_id,
                    started_at: imp.started_at,
                    completed_at: imp.completed_at,
                    duration_ms: imp.completed_at
                        ? new Date(imp.completed_at) - new Date(imp.started_at)
                        : null,
                    imported: parseInt(imp.total_imported),
                    duplicates: parseInt(imp.total_duplicate),
                    updated: parseInt(imp.total_updated),
                    failed: parseInt(imp.total_failed),
                    pages: parseInt(imp.pages_processed),
                    was_partial: imp.was_partial
                }))
            })
        };

    } catch (error) {
        console.error('Status error:', error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: {
                    code: 'STATUS_ERROR',
                    message: 'Failed to get status'
                }
            })
        };
    }
};
