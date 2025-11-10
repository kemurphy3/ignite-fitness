/**
 * Readiness Processor Function
 * Backend readiness calculation and adjustment logic
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
            case 'calculate_readiness':
                result = calculateReadiness(data);
                break;

            case 'get_adjustments':
                result = getWorkoutAdjustments(data);
                break;

            case 'check_conflicts':
                result = checkScheduleConflicts(data);
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
        console.error('Readiness processor error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Calculate readiness score with weighted formula
 * @param {Object} checkInData - Check-in data
 * @returns {Object} Readiness score and adjustments
 */
function calculateReadiness(checkInData) {
    const { sleepQuality, stressLevel, sorenessLevel, energyLevel } = checkInData;

    // Weighted formula: 30% sleep, 25% stress (inverted), 25% soreness (inverted), 20% energy
    const sleepWeight = 0.30;
    const stressWeight = 0.25;
    const sorenessWeight = 0.25;
    const energyWeight = 0.20;

    // Invert stress and soreness (lower is better)
    const stressScore = 11 - stressLevel;
    const sorenessScore = 11 - sorenessLevel;

    // Calculate weighted score
    const weightedScore =
        (sleepQuality * sleepWeight) + // 30%
        (stressScore * stressWeight) + // 25%
        (sorenessScore * sorenessWeight) + // 25%
        (energyLevel * energyWeight); // 20%

    const readinessScore = Math.round(weightedScore);

    // Clamp to 1-10
    const clampedScore = Math.max(1, Math.min(10, readinessScore));

    return {
        score: clampedScore,
        breakdown: {
            sleep: sleepQuality * sleepWeight,
            stress: stressScore * stressWeight,
            soreness: sorenessScore * sorenessWeight,
            energy: energyLevel * energyWeight
        }
    };
}

/**
 * Get workout adjustments based on readiness
 * @param {Object} data - Readiness and context data
 * @returns {Object} Workout adjustments
 */
function getWorkoutAdjustments(data) {
    const { readinessScore, rpe, weekNumber, gameDates } = data;

    const adjustments = {
        intensityMultiplier: 1.0,
        volumeMultiplier: 1.0,
        workoutType: 'standard',
        coachMessage: '',
        modifications: []
    };

    // Readiness-based adjustments
    if (readinessScore <= 4) {
        adjustments.workoutType = 'recovery';
        adjustments.intensityMultiplier = 0.5;
        adjustments.volumeMultiplier = 0.6;
        adjustments.coachMessage = 'Recovery session recommended due to low readiness. Focus on mobility and light movement.';
        adjustments.modifications.push('Switch to recovery protocol');
    } else if (readinessScore >= 5 && readinessScore <= 7) {
        adjustments.intensityMultiplier = 0.90;
        adjustments.volumeMultiplier = 1.0;
        adjustments.coachMessage = 'Moderate readiness detected. Reducing intensity by 10% for optimal recovery.';
        adjustments.modifications.push('Reduce intensity by 10%');
    } else {
        adjustments.intensityMultiplier = 1.0;
        adjustments.volumeMultiplier = 1.0;
        adjustments.coachMessage = 'Excellent readiness! Ready for full intensity.';
    }

    // RPE-based adjustments
    if (rpe !== undefined) {
        if (rpe > 8) {
            adjustments.intensityMultiplier *= 0.95;
            adjustments.volumeMultiplier *= 0.95;
            adjustments.modifications.push('Reduce next session by 5% (previous RPE > 8)');
        } else if (rpe < 6) {
            adjustments.intensityMultiplier *= 1.05;
            adjustments.volumeMultiplier *= 1.05;
            adjustments.modifications.push('Increase next session by 5% (previous RPE < 6)');
        }
    }

    // Deload week adjustments
    if (weekNumber && weekNumber % 4 === 0) {
        adjustments.volumeMultiplier *= 0.80;
        adjustments.modifications.push('Deload week - reducing volume by 20%');
        adjustments.coachMessage += ' This is your deload week for active recovery.';
    }

    // Game day scheduling
    if (gameDates && gameDates.length > 0) {
        const gameAdjustments = calculateGameDayAdjustments(gameDates);
        if (gameAdjustments) {
            adjustments.intensityMultiplier *= gameAdjustments.intensityMultiplier;
            adjustments.volumeMultiplier *= gameAdjustments.volumeMultiplier;
            adjustments.modifications.push(gameAdjustments.modification);
        }
    }

    return adjustments;
}

/**
 * Check schedule conflicts
 * @param {Object} data - Schedule conflict data
 * @returns {Object} Conflict resolution
 */
function checkScheduleConflicts(data) {
    const { workoutDate, intensity, bodyPart, gameDates, previousSessions } = data;

    const conflicts = [];

    // Check game day conflicts
    if (gameDates && gameDates.length > 0) {
        gameDates.forEach(gameDate => {
            const daysUntil = Math.ceil((new Date(gameDate) - new Date(workoutDate)) / (1000 * 60 * 60 * 24));

            if (daysUntil === 1) {
                // Game day -1
                if (intensity === 'heavy' || bodyPart === 'legs') {
                    conflicts.push({
                        type: 'game_day_minus_1',
                        severity: 'high',
                        message: 'Game tomorrow - upper body light session only',
                        recommendation: 'RPE ≤ 6, upper body focus'
                    });
                }
            } else if (daysUntil === 2) {
                // Game day -2
                if (bodyPart === 'legs' && intensity === 'heavy') {
                    conflicts.push({
                        type: 'game_day_minus_2',
                        severity: 'moderate',
                        message: 'Game in 2 days - no heavy legs (RPE ≤ 7)',
                        recommendation: 'Moderate leg session or switch to upper body'
                    });
                }
            }
        });
    }

    // Check back-to-back training
    if (previousSessions && previousSessions.length > 0) {
        const lastSession = previousSessions[previousSessions.length - 1];
        const daysSince = Math.ceil((new Date(workoutDate) - new Date(lastSession.date)) / (1000 * 60 * 60 * 24));

        if (daysSince < 2 && lastSession.intensity === 'heavy' && intensity === 'heavy') {
            conflicts.push({
                type: 'back_to_back',
                severity: 'high',
                message: 'Back-to-back heavy sessions detected',
                recommendation: 'Add rest day or switch to active recovery'
            });
        }
    }

    return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        canProceed: conflicts.length === 0 || conflicts.every(c => c.severity === 'low'),
        recommendation: conflicts.length > 0 ? conflicts[0].recommendation : 'Proceed with scheduled workout'
    };
}

/**
 * Calculate game day adjustments
 * @param {Array} gameDates - Game dates
 * @returns {Object|null} Game day adjustments
 */
function calculateGameDayAdjustments(gameDates) {
    const today = new Date();

    for (const gameDate of gameDates) {
        const game = new Date(gameDate);
        const daysUntil = Math.ceil((game - today) / (1000 * 60 * 60 * 24));

        if (daysUntil === 1) {
            return {
                intensityMultiplier: 0.5,
                volumeMultiplier: 0.5,
                modification: 'Game tomorrow - upper body light session (RPE ≤ 6)'
            };
        } else if (daysUntil === 2) {
            return {
                intensityMultiplier: 0.7,
                volumeMultiplier: 0.8,
                modification: 'Game in 2 days - no heavy legs (RPE ≤ 7)'
            };
        }
    }

    return null;
}

module.exports = { calculateReadiness, getWorkoutAdjustments, checkScheduleConflicts };
