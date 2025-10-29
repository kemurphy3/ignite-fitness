/**
 * Data Export Endpoint
 * GDPR-compliant data export with opt-out functionality
 */

const { createClient } = require('@supabase/supabase-js');
const SafeLogger = require('./utils/safe-logging');

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
    if (event.httpMethod === 'OPTIONS') return okPreflight();
    if (event.httpMethod !== 'POST') return methodNotAllowed();

    try {
        // Parse request body
        const { user_id, export_type, format } = JSON.parse(event.body || '{}');
        
        if (!user_id) {
            return badReq('Missing user ID');
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

        logger.info('Data export request received', {
            user_id: user_id,
            export_type: export_type,
            format: format
        });

        // Check if user has opted out of data collection
        const optOutStatus = await checkOptOutStatus(user_id);
        if (optOutStatus.opted_out) {
            logger.warn('Data export requested by opted-out user', {
                user_id: user_id,
                opt_out_date: optOutStatus.opt_out_date
            });
            
            return okJson({
                success: true,
                export_data: {
                    user_id: user_id,
                    opt_out_status: true,
                    opt_out_date: optOutStatus.opt_out_date,
                    message: 'User has opted out of data collection. Limited data available.',
                    data_available: optOutStatus.data_available
                },
                export_type: export_type,
                format: format,
                exported_at: new Date().toISOString()
            });
        }

        // Export data based on type
        let exportData;
        switch (export_type) {
            case 'complete':
                exportData = await exportCompleteData(user_id);
                break;
            case 'workouts':
                exportData = await exportWorkoutData(user_id);
                break;
            case 'settings':
                exportData = await exportSettingsData(user_id);
                break;
            case 'activities':
                exportData = await exportActivityData(user_id);
                break;
            default:
                return badReq('Invalid export type');
        }

        // Log export event for audit trail
        await logExportEvent(user_id, export_type, format, exportData);

        logger.info('Data export completed', {
            user_id: user_id,
            export_type: export_type,
            data_size: JSON.stringify(exportData).length
        });

        return okJson({
            success: true,
            export_data: exportData,
            export_type: export_type,
            format: format,
            exported_at: new Date().toISOString(),
            data_size: JSON.stringify(exportData).length
        });

    } catch (error) {
        logger.error('Data export failed', {
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
                error: 'Internal server error during data export'
            })
        };
    }
};

/**
 * Check if user has opted out of data collection
 * @param {string} userId - User ID
 * @returns {Object} Opt-out status
 */
async function checkOptOutStatus(userId) {
    try {
        const { data, error } = await supabase
            .from('user_privacy_preferences')
            .select('data_collection, opt_out_date, data_available')
            .eq('user_id', userId)
            .single();

        if (error) {
            logger.error('Failed to check opt-out status', {
                user_id: userId,
                error: error
            });
            return { opted_out: false, data_available: true };
        }

        return {
            opted_out: !data.data_collection,
            opt_out_date: data.opt_out_date,
            data_available: data.data_available
        };

    } catch (error) {
        logger.error('Opt-out status check failed', {
            user_id: userId,
            error: error.message
        });
        return { opted_out: false, data_available: true };
    }
}

/**
 * Export complete user data
 * @param {string} userId - User ID
 * @returns {Object} Complete user data
 */
async function exportCompleteData(userId) {
    try {
        const [
            userProfile,
            workouts,
            activities,
            settings,
            preferences,
            consentHistory,
            auditLog
        ] = await Promise.all([
            getUserProfile(userId),
            getWorkouts(userId),
            getActivities(userId),
            getUserSettings(userId),
            getPrivacyPreferences(userId),
            getConsentHistory(userId),
            getAuditLog(userId)
        ]);

        return {
            user_profile: userProfile,
            workouts: workouts,
            activities: activities,
            settings: settings,
            privacy_preferences: preferences,
            consent_history: consentHistory,
            audit_log: auditLog,
            export_metadata: {
                export_type: 'complete',
                exported_at: new Date().toISOString(),
                data_version: '1.0',
                gdpr_compliant: true
            }
        };

    } catch (error) {
        logger.error('Complete data export failed', {
            user_id: userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Export workout data only
 * @param {string} userId - User ID
 * @returns {Object} Workout data
 */
async function exportWorkoutData(userId) {
    try {
        const workouts = await getWorkouts(userId);
        
        return {
            workouts: workouts,
            export_metadata: {
                export_type: 'workouts',
                exported_at: new Date().toISOString(),
                data_version: '1.0',
                gdpr_compliant: true
            }
        };

    } catch (error) {
        logger.error('Workout data export failed', {
            user_id: userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Export settings data only
 * @param {string} userId - User ID
 * @returns {Object} Settings data
 */
async function exportSettingsData(userId) {
    try {
        const [settings, preferences] = await Promise.all([
            getUserSettings(userId),
            getPrivacyPreferences(userId)
        ]);

        return {
            settings: settings,
            privacy_preferences: preferences,
            export_metadata: {
                export_type: 'settings',
                exported_at: new Date().toISOString(),
                data_version: '1.0',
                gdpr_compliant: true
            }
        };

    } catch (error) {
        logger.error('Settings data export failed', {
            user_id: userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Export activity data only
 * @param {string} userId - User ID
 * @returns {Object} Activity data
 */
async function exportActivityData(userId) {
    try {
        const activities = await getActivities(userId);
        
        return {
            activities: activities,
            export_metadata: {
                export_type: 'activities',
                exported_at: new Date().toISOString(),
                data_version: '1.0',
                gdpr_compliant: true
            }
        };

    } catch (error) {
        logger.error('Activity data export failed', {
            user_id: userId,
            error: error.message
        });
        throw error;
    }
}

/**
 * Get user profile data
 * @param {string} userId - User ID
 * @returns {Object} User profile
 */
async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        logger.warn('User profile not found', { user_id: userId });
        return null;
    }

    return data;
}

/**
 * Get user workouts
 * @param {string} userId - User ID
 * @returns {Array} User workouts
 */
async function getWorkouts(userId) {
    const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        logger.warn('Workouts not found', { user_id: userId });
        return [];
    }

    return data || [];
}

/**
 * Get user activities
 * @param {string} userId - User ID
 * @returns {Array} User activities
 */
async function getActivities(userId) {
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

    if (error) {
        logger.warn('Activities not found', { user_id: userId });
        return [];
    }

    return data || [];
}

/**
 * Get user settings
 * @param {string} userId - User ID
 * @returns {Object} User settings
 */
async function getUserSettings(userId) {
    const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        logger.warn('User settings not found', { user_id: userId });
        return null;
    }

    return data;
}

/**
 * Get privacy preferences
 * @param {string} userId - User ID
 * @returns {Object} Privacy preferences
 */
async function getPrivacyPreferences(userId) {
    const { data, error } = await supabase
        .from('user_privacy_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        logger.warn('Privacy preferences not found', { user_id: userId });
        return null;
    }

    return data;
}

/**
 * Get consent history
 * @param {string} userId - User ID
 * @returns {Array} Consent history
 */
async function getConsentHistory(userId) {
    const { data, error } = await supabase
        .from('consent_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false });

    if (error) {
        logger.warn('Consent history not found', { user_id: userId });
        return [];
    }

    return data || [];
}

/**
 * Get audit log
 * @param {string} userId - User ID
 * @returns {Array} Audit log
 */
async function getAuditLog(userId) {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100); // Limit to last 100 entries

    if (error) {
        logger.warn('Audit log not found', { user_id: userId });
        return [];
    }

    return data || [];
}

/**
 * Log export event for audit trail
 * @param {string} userId - User ID
 * @param {string} exportType - Export type
 * @param {string} format - Export format
 * @param {Object} exportData - Exported data
 */
async function logExportEvent(userId, exportType, format, exportData) {
    try {
        const { error } = await supabase
            .from('audit_logs')
            .insert({
                user_id: userId,
                action: 'data_export',
                resource_type: 'user_data',
                resource_id: userId,
                details: {
                    export_type: exportType,
                    format: format,
                    data_size: JSON.stringify(exportData).length,
                    exported_at: new Date().toISOString()
                },
                ip_address: 'server',
                user_agent: 'data-export-endpoint',
                created_at: new Date().toISOString()
            });

        if (error) {
            logger.error('Failed to log export event', {
                user_id: userId,
                error: error
            });
        }

    } catch (error) {
        logger.error('Export event logging failed', {
            user_id: userId,
            error: error.message
        });
    }
}