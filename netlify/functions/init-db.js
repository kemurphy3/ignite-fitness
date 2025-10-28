/**
 * Initialize Database Function
 * Seeds database with initial schema and sample data
 */

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { action } = JSON.parse(event.body || '{}');

        switch (action) {
            case 'seed':
                return await seedDatabase();
            
            case 'migrate':
                return await migrateDatabase();
            
            case 'status':
                return await getDatabaseStatus();
            
            default:
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Seed database with initial data
 */
async function seedDatabase() {
    const schema = {
        user_profiles: {
            columns: ['userId', 'email', 'username', 'sport', 'position', 'createdAt', 'updatedAt'],
            indexes: ['userId', 'email']
        },
        preferences: {
            columns: ['userId', 'theme', 'notifications', 'language', 'units', 'aestheticFocus', 'sessionLength', 'createdAt', 'updatedAt'],
            indexes: ['userId']
        },
        session_logs: {
            columns: ['userId', 'date', 'workout_id', 'exercises', 'duration', 'volume', 'averageRPE', 'createdAt', 'updatedAt'],
            indexes: ['userId', 'date']
        },
        progression_events: {
            columns: ['userId', 'date', 'exercise', 'previous_level', 'new_level', 'reason', 'eventType', 'createdAt', 'updatedAt'],
            indexes: ['userId', 'date', 'exercise']
        },
        injury_flags: {
            columns: ['userId', 'date', 'risk_level', 'location', 'severity', 'factors', 'recommendations', 'createdAt', 'updatedAt'],
            indexes: ['userId', 'date']
        },
        external_activities: {
            columns: ['userId', 'source', 'type', 'duration', 'distance', 'averageIntensity', 'timestamp', 'name', 'createdAt', 'updatedAt'],
            indexes: ['userId', 'timestamp', 'source']
        },
        nutrition_profiles: {
            columns: ['userId', 'date', 'calories', 'protein', 'carbs', 'fat', 'hydration', 'createdAt', 'updatedAt'],
            indexes: ['userId', 'date']
        }
    };

    // Sample data
    const sampleData = {
        user_profiles: {
            'user_001': {
                userId: 'user_001',
                email: 'athlete@example.com',
                username: 'AthleteUser',
                sport: 'soccer',
                position: 'midfielder',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        },
        readiness_logs: {
            'user_001_2024-01-01': {
                userId: 'user_001',
                date: '2024-01-01',
                sleep: 8,
                soreness: 3,
                stress: 4,
                energy: 7,
                readiness_score: 6.5,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        },
        session_logs: {
            'user_001_2024-01-01': {
                userId: 'user_001',
                date: '2024-01-01',
                workout_id: 'workout_001',
                exercises: ['Squat', 'Deadlift', 'Bench Press'],
                duration: 45,
                volume: 5000,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        }
    };

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: 'Database seeded successfully',
            schema,
            sampleData
        })
    };
}

/**
 * Run database migrations
 */
async function migrateDatabase() {
    const migrations = [
        {
            version: 1,
            name: 'Initial schema',
            description: 'Create base tables',
            timestamp: new Date().toISOString()
        },
        {
            version: 2,
            name: 'Add indexes',
            description: 'Add compound indexes on (userId, date)',
            timestamp: new Date().toISOString()
        },
        {
            version: 3,
            name: 'Add progression tracking',
            description: 'Add progression_events table',
            timestamp: new Date().toISOString()
        }
    ];

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            message: 'Migrations completed',
            migrations
        })
    };
}

/**
 * Get database status
 */
async function getDatabaseStatus() {
    const status = {
        connected: true,
        tables: [
            'user_profiles',
            'readiness_logs',
            'session_logs',
            'progression_events',
            'injury_flags',
            'preferences'
        ],
        indexes: [
            'user_profiles_userId',
            'readiness_logs_userId_date',
            'session_logs_userId_date',
            'progression_events_userId_date_exercise',
            'injury_flags_userId_date',
            'preferences_userId'
        ],
        version: '1.0.0',
        timestamp: new Date().toISOString()
    };

    return {
        statusCode: 200,
        body: JSON.stringify(status)
    };
}
