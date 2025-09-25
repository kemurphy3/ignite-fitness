// PATCH /users/profile - Partial Update User Profile
const { getServerlessDB } = require('./utils/database');
const { verifyJWT } = require('./utils/auth');
const { sanitizeForLog, generateRequestHash, validateInput, sanitizeInput } = require('./utils/security');
const convertUnits = require('./utils/units');
const Ajv = require('ajv');
const crypto = require('crypto');

// Import the same schema for field validation
const createProfileSchema = {
    type: 'object',
    properties: {
        age: { type: 'integer', minimum: 13, maximum: 120 },
        height: {
            oneOf: [
                { type: 'number', minimum: 50, maximum: 300 }, // cm
                {
                    type: 'object',
                    properties: {
                        value: { type: 'number' },
                        unit: { enum: ['cm', 'inches', 'feet'] },
                        inches: { type: 'number', minimum: 0, maximum: 11 }
                    },
                    required: ['value', 'unit']
                }
            ]
        },
        weight: {
            oneOf: [
                { type: 'number', minimum: 20, maximum: 500 }, // kg
                {
                    type: 'object',
                    properties: {
                        value: { type: 'number' },
                        unit: { enum: ['kg', 'lbs'] }
                    },
                    required: ['value', 'unit']
                }
            ]
        },
        sex: { enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
        preferred_units: { enum: ['metric', 'imperial'] },
        goals: { 
            type: 'array',
            items: { type: 'string' },
            maxItems: 10
        },
        goal_priorities: {
            type: 'object',
            additionalProperties: { type: 'integer', minimum: 1, maximum: 10 }
        },
        bench_press_max: { type: 'number', minimum: 0, maximum: 500 },
        squat_max: { type: 'number', minimum: 0, maximum: 500 },
        deadlift_max: { type: 'number', minimum: 0, maximum: 500 },
        overhead_press_max: { type: 'number', minimum: 0, maximum: 300 },
        pull_ups_max: { type: 'integer', minimum: 0, maximum: 100 },
        push_ups_max: { type: 'integer', minimum: 0, maximum: 500 },
        mile_time_seconds: { type: 'integer', minimum: 240, maximum: 1800 }
    },
    required: ['age', 'sex'],
    additionalProperties: false
};

exports.handler = async (event) => {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'PATCH, OPTIONS'
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'PATCH') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed', code: 'METHOD_001' })
        };
    }

    const sql = getServerlessDB();
    const ajv = new Ajv();
    
    try {
        // Authenticate user
        const userId = await verifyJWT(event.headers);
        if (!userId) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Unauthorized', code: 'AUTH_001' })
            };
        }
        
        // Check rate limit
        const canUpdate = await sql`SELECT check_profile_rate_limit(${userId}) as allowed`;
        if (!canUpdate[0].allowed) {
            return {
                statusCode: 429,
                headers: { 
                    'Content-Type': 'application/json',
                    'Retry-After': '3600'
                },
                body: JSON.stringify({ 
                    error: 'Rate limit exceeded',
                    code: 'RATE_001'
                })
            };
        }
        
        // Generate request ID for tracking
        const requestId = crypto.randomUUID();
        const requestHash = generateRequestHash(
            event.body, 
            userId, 
            Date.now()
        );
        
        // Check for duplicate request
        try {
            await sql`
                INSERT INTO profile_update_requests (
                    user_id, request_hash, ip_address, user_agent, endpoint
                ) VALUES (
                    ${userId}, ${requestHash}, 
                    ${event.headers['x-forwarded-for'] || event.headers['x-real-ip']},
                    ${event.headers['user-agent']},
                    'PATCH /users/profile'
                )
            `;
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                return {
                    statusCode: 409,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        error: 'Duplicate request', 
                        code: 'DUP_001' 
                    })
                };
            }
            throw error;
        }
        
        const updates = JSON.parse(event.body);
        const { version: expectedVersion, ...fieldUpdates } = updates;
        
        // Validate input for security
        const inputValidation = validateInput(fieldUpdates);
        if (!inputValidation.valid) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid input',
                    code: 'SEC_001',
                    reason: inputValidation.reason
                })
            };
        }
        
        // Sanitize input
        const sanitizedUpdates = sanitizeInput(fieldUpdates);
        
        // Convert units if necessary
        if (sanitizedUpdates.height) {
            sanitizedUpdates.height_cm = typeof sanitizedUpdates.height === 'object' 
                ? convertUnits.toCm(sanitizedUpdates.height)
                : sanitizedUpdates.height;
            delete sanitizedUpdates.height;
        }
        
        if (sanitizedUpdates.weight) {
            sanitizedUpdates.weight_kg = typeof sanitizedUpdates.weight === 'object'
                ? convertUnits.toKg(sanitizedUpdates.weight)
                : sanitizedUpdates.weight;
            delete sanitizedUpdates.weight;
        }
        
        // Build dynamic update query
        const updateFields = [];
        const updateValues = {};
        
        for (const [key, value] of Object.entries(sanitizedUpdates)) {
            // Validate each field individually
            if (createProfileSchema.properties[key]) {
                const fieldSchema = { 
                    type: 'object', 
                    properties: { [key]: createProfileSchema.properties[key] } 
                };
                const validateField = ajv.compile(fieldSchema);
                
                if (!validateField({ [key]: value })) {
                    return {
                        statusCode: 400,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            error: `Invalid value for ${key}`,
                            code: 'VAL_003',
                            details: validateField.errors
                        })
                    };
                }
            }
            
            updateFields.push(`${key} = \${${key}}`);
            updateValues[key] = value;
        }
        
        if (updateFields.length === 0) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'No valid fields to update',
                    code: 'VAL_004'
                })
            };
        }
        
        // Add metadata fields
        updateFields.push('last_modified_by = ${userId}');
        updateValues.userId = userId;
        
        // Set request context for trigger
        await sql`SELECT set_config('app.request_id', ${requestId}, false)`;
        
        // Perform optimistic locking update
        let query = `
            UPDATE user_profiles 
            SET ${updateFields.join(', ')}
            WHERE user_id = \${whereUserId}
        `;
        
        if (expectedVersion) {
            query += ' AND version = ${expectedVersion}';
            updateValues.expectedVersion = expectedVersion;
        }
        
        query += ' RETURNING *';
        
        updateValues.whereUserId = userId;
        
        // Execute dynamic update
        const result = await sql.unsafe(query, updateValues);
        
        if (result.length === 0) {
            if (expectedVersion) {
                // Check if profile exists with different version
                const current = await sql`
                    SELECT version FROM user_profiles WHERE user_id = ${userId}
                `;
                
                if (current.length > 0) {
                    return {
                        statusCode: 409,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            error: 'Version conflict',
                            code: 'PROF_409',
                            current_version: current[0].version,
                            expected_version: expectedVersion
                        })
                    };
                }
            }
            
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Profile not found',
                    code: 'PROF_404'
                })
            };
        }
        
        // Log sanitized action (no PII)
        console.log('Profile updated:', {
            userId: sanitizeForLog(userId),
            requestId,
            updatedFields: Object.keys(sanitizedUpdates),
            newVersion: result[0].version,
            completeness: result[0].completeness_score
        });
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                version: result[0].version,
                completeness_score: result[0].completeness_score,
                updated_fields: Object.keys(sanitizedUpdates)
            })
        };
        
    } catch (error) {
        console.error('Profile update error:', sanitizeForLog(error.message));
        
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Internal server error',
                code: 'SYS_001'
            })
        };
    }
};
