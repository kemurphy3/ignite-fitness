// POST /integrations/strava/import - Import Activities with Resume Support
const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import utilities
const {
    ImportError,
    fetchWithTimeout,
    mapStravaActivity,
    validateAfterParam,
    generateContinueToken,
    parseContinueToken,
    sanitizeForLog,
    handleStravaRateLimit,
    buildStravaUrl,
    processActivitiesBatch
} = require('./utils/strava-import');

// Import Feature 2's encryption
const { TokenEncryption } = require('./utils/encryption');

exports.handler = async (event) => {
    const sql = neon(process.env.DATABASE_URL);
    const encryption = new TokenEncryption();
    
    const headers = {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }
    
    const runId = crypto.randomUUID();
    const importStartTime = Date.now();
    const MAX_RUNTIME_MS = 9000; // 9s budget (1s buffer for Netlify's 10s limit)
    
    try {
        // Authenticate
        const authHeader = event.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new ImportError('AUTH_REQUIRED', 'Authorization required', 401);
        }
        
        const token = authHeader.substring(7);
        let userId;
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.sub;
        } catch (err) {
            throw new ImportError('AUTH_INVALID', 'Invalid token', 401);
        }
        
        // Parse parameters
        const params = event.queryStringParameters || {};
        const body = event.body ? JSON.parse(event.body) : {};
        
        // Handle continue token for resume
        const continueToken = body.continue_token || params.continue_token;
        let resumeState = null;
        
        if (continueToken) {
            resumeState = parseContinueToken(continueToken);
        }
        
        // Validate after parameter
        let after = resumeState?.after || params.after || null;
        if (after !== null && after !== undefined) {
            if (!validateAfterParam(after)) {
                throw new ImportError('INVALID_PARAM', 'Invalid after parameter - must be unix timestamp', 400);
            }
        }
        
        const perPage = Math.min(Math.max(parseInt(params.per_page) || 30, 1), 100);
        
        // Get user's Strava token
        const tokenResult = await sql`
            SELECT 
                encrypted_access_token,
                encrypted_refresh_token,
                expires_at,
                encryption_key_version
            FROM strava_tokens
            WHERE user_id = ${userId}
        `;
        
        if (!tokenResult.length) {
            throw new ImportError(
                'STRAVA_NOT_CONNECTED',
                'Strava account not connected. Please connect your account first.',
                403,
                { connect_url: '/settings/integrations/strava' }
            );
        }
        
        // Check and refresh token if needed
        const tokenData = tokenResult[0];
        let accessToken;
        
        if (new Date(tokenData.expires_at) <= new Date()) {
            // Call Feature 2's refresh endpoint
            const refreshResponse = await fetchWithTimeout(
                `${process.env.URL}/.netlify/functions/strava-refresh-token`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                },
                10000
            );
            
            if (!refreshResponse.ok) {
                throw new ImportError('TOKEN_REFRESH_FAILED', 'Failed to refresh Strava token', 502);
            }
            
            // Get refreshed token
            const newTokenResult = await sql`
                SELECT encrypted_access_token
                FROM strava_tokens
                WHERE user_id = ${userId}
            `;
            
            accessToken = await encryption.decrypt(newTokenResult[0].encrypted_access_token);
        } else {
            accessToken = await encryption.decrypt(tokenData.encrypted_access_token);
        }
        
        // Get or create sync state
        let syncState = await sql`
            SELECT * FROM integrations_strava
            WHERE user_id = ${userId}
        `;
        
        if (!syncState.length) {
            await sql`
                INSERT INTO integrations_strava (user_id)
                VALUES (${userId})
            `;
            syncState = [{ last_import_after: null }];
        }
        
        // Check if import already in progress
        if (syncState[0].import_in_progress && !continueToken) {
            const inProgressFor = Date.now() - new Date(syncState[0].import_started_at).getTime();
            if (inProgressFor < 60000) { // Less than 1 minute
                throw new ImportError(
                    'IMPORT_IN_PROGRESS',
                    'Import already in progress. Please wait or provide continue_token.',
                    409
                );
            }
        }
        
        // Mark as in progress
        await sql`
            UPDATE integrations_strava
            SET import_in_progress = true,
                import_started_at = NOW()
            WHERE user_id = ${userId}
        `;
        
        // Initialize state
        let page = resumeState?.page || 1;
        let lastActivityId = resumeState?.lastActivityId || null;
        let maxActivityTime = resumeState?.maxActivityTime || after || syncState[0].last_import_after || '0';
        
        if (!after && syncState[0].last_import_after) {
            after = syncState[0].last_import_after;
        }
        
        // Import results
        const results = {
            imported: resumeState?.imported || 0,
            duplicates: resumeState?.duplicates || 0,
            updated: resumeState?.updated || 0,
            failed: resumeState?.failed || 0,
            deleted: 0,
            pages_processed: resumeState?.pages_processed || 0,
            errors: []
        };
        
        let hasMore = true;
        const maxPages = 20;
        const maxActivities = 1000;
        
        // Main import loop with time boxing
        while (hasMore && page <= maxPages && 
               results.imported + results.duplicates < maxActivities) {
            
            // Check time budget
            if (Date.now() - importStartTime > MAX_RUNTIME_MS) {
                // Save progress and return partial
                const newContinueToken = generateContinueToken({
                    page,
                    after,
                    lastActivityId,
                    maxActivityTime,
                    ...results
                });
                
                await sql`
                    UPDATE integrations_strava
                    SET 
                        import_continue_token = ${newContinueToken},
                        last_status = 'partial'
                    WHERE user_id = ${userId}
                `;
                
                return {
                    statusCode: 206, // Partial Content
                    headers,
                    body: JSON.stringify({
                        status: 'partial',
                        message: 'Import in progress. Call again with continue_token to resume.',
                        continue_token: newContinueToken,
                        ...results
                    })
                };
            }
            
            // Build Strava API URL
            const stravaUrl = buildStravaUrl({
                perPage,
                page,
                lastActivityId,
                after
            });
            
            // Fetch with retries
            let stravaResponse;
            let retries = 3;
            let backoffMs = 1000;
            
            while (retries > 0) {
                try {
                    stravaResponse = await fetchWithTimeout(
                        stravaUrl,
                        { headers: { 'Authorization': `Bearer ${accessToken}` } },
                        5000
                    );
                    
                    // Handle rate limiting
                    if (stravaResponse.status === 429) {
                        const rateLimitResponse = await handleStravaRateLimit(stravaResponse, 3 - retries);
                        if (rateLimitResponse === null) {
                            retries--;
                            continue;
                        }
                        stravaResponse = rateLimitResponse;
                    }
                    
                    break;
                    
                } catch (error) {
                    console.error('Strava API error:', error);
                    retries--;
                    if (retries === 0) throw error;
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    backoffMs = Math.min(backoffMs * 2, 30000);
                }
            }
            
            // Handle Strava disconnection
            if (stravaResponse.status === 401) {
                await sql`
                    DELETE FROM strava_tokens WHERE user_id = ${userId};
                    UPDATE integrations_strava 
                    SET last_error = 'Strava access revoked',
                        last_error_code = 'STRAVA_REVOKED',
                        import_in_progress = false
                    WHERE user_id = ${userId}
                `;
                
                throw new ImportError(
                    'STRAVA_REVOKED',
                    'Strava access was revoked. Please reconnect your account.',
                    403
                );
            }
            
            if (!stravaResponse.ok) {
                throw new Error(`Strava API error: ${stravaResponse.status}`);
            }
            
            const activities = await stravaResponse.json();
            
            if (!Array.isArray(activities) || activities.length === 0) {
                hasMore = false;
                break;
            }
            
            // Update cursor for next page
            if (activities.length > 0) {
                lastActivityId = activities[activities.length - 1].id;
            }
            
            // Process activities in transaction
            const pageResults = await sql.begin(async sql => {
                return await processActivitiesBatch(
                    sql, activities, userId, runId, page, after, perPage
                );
            });
            
            // Accumulate results
            results.imported += pageResults.imported;
            results.duplicates += pageResults.duplicates;
            results.updated += pageResults.updated;
            results.failed += pageResults.failed;
            if (pageResults.errors.length > 0) {
                results.errors.push(...pageResults.errors.slice(0, 5)); // Limit errors
            }
            results.pages_processed++;
            
            page++;
            hasMore = activities.length === perPage;
        }
        
        // Clean up orphaned activities
        const deletedCount = await sql`
            SELECT cleanup_orphaned_strava_activities(${userId}) as count
        `;
        results.deleted = deletedCount[0].count;
        
        // Update sync state
        const finalStatus = results.failed > 0 ? 'partial' : 'success';
        
        await sql`
            UPDATE integrations_strava
            SET 
                last_import_after = ${maxActivityTime},
                last_run_at = NOW(),
                last_status = ${finalStatus},
                last_error = ${results.errors.length > 0 ? JSON.stringify(results.errors[0]) : null},
                last_error_code = ${results.errors.length > 0 ? 'PARTIAL_FAILURE' : null},
                total_imported = total_imported + ${results.imported},
                total_duplicates = total_duplicates + ${results.duplicates},
                total_updated = total_updated + ${results.updated},
                total_failed = total_failed + ${results.failed},
                import_in_progress = false,
                import_continue_token = null,
                updated_at = NOW()
            WHERE user_id = ${userId}
        `;
        
        console.log('Strava import complete:', sanitizeForLog({
            user_id: userId,
            imported: results.imported,
            updated: results.updated,
            duplicates: results.duplicates,
            deleted: results.deleted,
            failed: results.failed,
            duration_ms: Date.now() - importStartTime
        }));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'complete',
                imported: results.imported,
                updated: results.updated,
                duplicates: results.duplicates,
                deleted: results.deleted,
                skipped: results.failed,
                pages_processed: results.pages_processed,
                ...(results.errors.length > 0 && { 
                    partial_errors: results.errors 
                })
            })
        };
        
    } catch (error) {
        console.error('Import error:', sanitizeForLog({ error: error.message }));
        
        // Mark as failed
        await sql`
            UPDATE integrations_strava
            SET 
                last_run_at = NOW(),
                last_status = 'failed',
                last_error = ${error.message},
                last_error_code = ${error.code || 'UNKNOWN'},
                import_in_progress = false,
                updated_at = NOW()
            WHERE user_id = ${userId}
        `.catch(console.error);
        
        if (error instanceof ImportError) {
            return error.toResponse(headers);
        }
        
        return {
            statusCode: 503,
            headers,
            body: JSON.stringify({
                error: {
                    code: 'IMPORT_FAILED',
                    message: 'Import failed',
                    details: error.message
                }
            })
        };
    }
};
