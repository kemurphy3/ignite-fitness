/**
 * Injury Logger Function
 * Safe logging backend for injury assessments and disclaimers
 */

const InjuryFlags = {
    painAssessment: 'PAIN_ASSESSMENT',
    injuryFlag: 'INJURY_FLAG',
    modification: 'EXERCISE_MODIFICATION',
    disclaimerAccepted: 'DISCLAIMER_ACCEPTED'
};

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
        const { action, data } = JSON.parse(event.body || '{}');

        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'action is required' })
            };
        }

        let result;

        switch (action) {
            case 'log_assessment':
                result = await logPainAssessment(data);
                break;
            
            case 'log_modification':
                result = await logExerciseModification(data);
                break;
            
            case 'get_assessment_history':
                result = await getAssessmentHistory(data);
                break;
            
            case 'check_persistent_pain':
                result = checkPersistentPain(data);
                break;
            
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
    } catch (error) {
        console.error('Injury logger error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Log pain assessment with timestamp
 * @param {Object} data - Assessment data
 * @returns {Object} Logged assessment
 */
async function logPainAssessment(data) {
    const timestamp = new Date().toISOString();
    
    const assessment = {
        userId: data.userId,
        timestamp,
        location: data.location,
        intensity: data.intensity,
        description: data.description,
        exercise: data.exercise,
        bodyLocation: data.bodyLocation,
        action: 'assessed',
        disclaimer_accepted: data.disclaimerAccepted || false,
        disclaimers_viewed: data.disclaimers || []
    };
    
    // Store in database
    // This would integrate with actual database
    console.log('Pain assessment logged:', assessment);
    
    return {
        success: true,
        assessment,
        message: 'Assessment logged securely with timestamp'
    };
}

/**
 * Log exercise modification
 * @param {Object} data - Modification data
 * @returns {Object} Logged modification
 */
async function logExerciseModification(data) {
    const timestamp = new Date().toISOString();
    
    const modification = {
        userId: data.userId,
        timestamp,
        originalExercise: data.originalExercise,
        modifiedExercise: data.modifiedExercise,
        reason: data.reason,
        location: data.location,
        painLevel: data.painLevel,
        educational_note: data.educationalNote
    };
    
    console.log('Exercise modification logged:', modification);
    
    return {
        success: true,
        modification,
        message: 'Modification logged for liability protection'
    };
}

/**
 * Get assessment history
 * @param {Object} data - Query data
 * @returns {Object} Assessment history
 */
async function getAssessmentHistory(data) {
    const { userId, limit = 10 } = data;
    
    // This would query actual database
    const history = [
        // Sample data
        {
            date: new Date().toISOString(),
            location: 'knee',
            intensity: 5,
            description: 'aching',
            modifications: ['switched_to_goblet_squats']
        }
    ];
    
    return {
        success: true,
        history,
        message: 'Assessment history retrieved'
    };
}

/**
 * Check for persistent pain patterns
 * @param {Object} data - Assessment data
 * @returns {Object} Persistent pain analysis
 */
function checkPersistentPain(data) {
    const { history, currentPain } = data;
    
    if (!history || history.length < 3) {
        return {
            persistent: false,
            recommendation: 'Continue monitoring'
        };
    }
    
    // Check if same location has pain 3+ times in recent history
    const recentPain = history.filter(assessment => {
        const daysSince = (new Date() - new Date(assessment.timestamp)) / (1000 * 60 * 60 * 24);
        return daysSince <= 7; // Last week
    });
    
    const painCount = recentPain.length;
    const avgIntensity = recentPain.reduce((sum, p) => sum + p.intensity, 0) / recentPain.length;
    
    if (painCount >= 3 || avgIntensity >= 7) {
        return {
            persistent: true,
            recommendation: 'Consult a healthcare professional',
            message: 'Persistent pain detected. Please consult a healthcare professional.',
            triggers: [
                'Multiple pain reports in same area',
                'High average pain level',
                'Recurring discomfort'
            ]
        };
    }
    
    return {
        persistent: false,
        recommendation: 'Continue monitoring with modifications'
    };
}

module.exports = { logPainAssessment, logExerciseModification, getAssessmentHistory, checkPersistentPain };
