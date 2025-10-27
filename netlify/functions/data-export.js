/**
 * Data Export Function
 * Exports user data to CSV and JSON
 */

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { userId, format, tables } = JSON.parse(event.body || '{}');

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'userId is required' })
            };
        }

        const exportData = await exportUserData(userId, format, tables);
        
        return {
            statusCode: 200,
            headers: {
                ...headers,
                'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
                'Content-Disposition': `attachment; filename="ignitefitness-export.${format}"`
            },
            body: format === 'csv' ? exportData.csv : exportData.json
        };
    } catch (error) {
        console.error('Data export error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Export user data
 * @param {string} userId - User ID
 * @param {string} format - Export format
 * @param {Array} tables - Tables to export
 * @returns {Promise<Object>} Export data
 */
async function exportUserData(userId, format = 'json', tables = null) {
    // Mock data structure
    const userData = {
        userId,
        exportedAt: new Date().toISOString(),
        profile: {
            username: 'athlete_user',
            sport: 'soccer',
            position: 'midfielder',
            dateJoined: '2024-01-01'
        },
        readinessLogs: [
            { date: '2024-01-15', score: 8, sleep: 7, stress: 3 },
            { date: '2024-01-14', score: 7, sleep: 8, stress: 4 }
        ],
        sessionLogs: [
            { date: '2024-01-15', workout: 'Upper Body', volume: 5000, duration: 45 },
            { date: '2024-01-14', workout: 'Lower Body', volume: 6000, duration: 50 }
        ],
        progressionEvents: [
            { date: '2024-01-15', exercise: 'Squat', progression: 'Increased load' }
        ],
        injuryFlags: [],
        preferences: {
            theme: 'dark',
            notifications: true
        }
    };

    return {
        json: JSON.stringify(userData, null, 2),
        csv: convertToCSV(userData)
    };
}

/**
 * Convert data to CSV
 * @param {Object} data - Data object
 * @returns {string} CSV string
 */
function convertToCSV(data) {
    const csvLines = [];
    
    // Header
    csvLines.push('Table,Date,Value');
    
    // Readiness logs
    if (data.readinessLogs) {
        data.readinessLogs.forEach(log => {
            csvLines.push(`Readiness,${log.date},${log.score}`);
            csvLines.push(`Readiness Sleep,${log.date},${log.sleep}`);
            csvLines.push(`Readiness Stress,${log.date},${log.stress}`);
        });
    }
    
    // Session logs
    if (data.sessionLogs) {
        data.sessionLogs.forEach(log => {
            csvLines.push(`Session,${log.date},${log.workout}`);
            csvLines.push(`Session Volume,${log.date},${log.volume}`);
            csvLines.push(`Session Duration,${log.date},${log.duration}`);
        });
    }
    
    // Progression events
    if (data.progressionEvents) {
        data.progressionEvents.forEach(event => {
            csvLines.push(`Progression,${event.date},${event.exercise}`);
        });
    }
    
    return csvLines.join('\n');
}

// Export for testing
module.exports = { exportUserData, convertToCSV };
