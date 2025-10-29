/**
 * AI Data Validation and Conservative Fallbacks
 * Ensures AI systems handle invalid data gracefully with conservative recommendations
 */

class AIDataValidator {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.conservativeDefaults = this.getConservativeDefaults();
    }

    /**
     * Get conservative default values for AI calculations
     * @returns {Object} Conservative default values
     */
    getConservativeDefaults() {
        return {
            // Readiness and Energy (1-10 scale)
            readiness: 6, // Slightly below average for safety
            energyLevel: 6,
            stressLevel: 5, // Moderate stress
            
            // Training Load Metrics
            atl7: 50, // Moderate acute training load
            ctl28: 100, // Moderate chronic training load
            monotony: 1.2, // Low monotony (good)
            strain: 60, // Moderate strain
            
            // Performance Metrics
            averageRPE: 6.5, // Moderate intensity
            progressionRate: 0.05, // Conservative 5% progression
            consistencyScore: 0.7, // Good consistency
            
            // Training Frequency and Volume
            trainingFrequency: 3, // 3x per week
            workoutStreak: 0, // No streak assumption
            missedWorkouts: 0,
            
            // Goals and Preferences
            primaryGoal: 'general_fitness',
            sport: 'general_fitness',
            seasonPhase: 'offseason',
            
            // Trends (conservative assumptions)
            energyTrend: 'stable',
            stressTrend: 'stable',
            
            // Safety Thresholds
            maxIntensity: 8, // Never exceed RPE 8
            minRestDays: 1, // At least 1 rest day per week
            maxVolumeIncrease: 0.1, // Max 10% volume increase
            minDataPoints: 3 // Minimum data points for trends
        };
    }

    /**
     * Validate and sanitize user context data
     * @param {Object} context - User context to validate
     * @returns {Object} Validated context with conservative fallbacks
     */
    validateContext(context) {
        if (!context || typeof context !== 'object') {
            this.logger.warn('Invalid context provided, using conservative defaults');
            return this.getConservativeDefaults();
        }

        const validated = { ...context };

        // Validate readiness score (1-10)
        validated.readinessScore = this.validateReadinessScore(context.readinessScore);
        validated.readiness = validated.readinessScore; // Alias for compatibility

        // Validate energy and stress levels (1-10)
        validated.energyLevel = this.validateEnergyLevel(context.energyLevel);
        validated.stressLevel = this.validateStressLevel(context.stressLevel);

        // Validate training load metrics
        validated.atl7 = this.validateTrainingLoad(context.atl7, 'atl7');
        validated.ctl28 = this.validateTrainingLoad(context.ctl28, 'ctl28');
        validated.monotony = this.validateMonotony(context.monotony);
        validated.strain = this.validateStrain(context.strain);

        // Validate performance metrics
        validated.averageRPE = this.validateRPE(context.averageRPE);
        validated.progressionRate = this.validateProgressionRate(context.progressionRate);
        validated.consistencyScore = this.validateConsistencyScore(context.consistencyScore);

        // Validate training frequency and volume
        validated.trainingFrequency = this.validateTrainingFrequency(context.trainingFrequency);
        validated.workoutStreak = this.validateWorkoutStreak(context.workoutStreak);
        validated.missedWorkouts = this.validateMissedWorkouts(context.missedWorkouts);

        // Validate goals and preferences
        validated.primaryGoal = this.validateGoal(context.primaryGoal);
        validated.sport = this.validateSport(context.sport);
        validated.seasonPhase = this.validateSeasonPhase(context.seasonPhase);

        // Validate trends
        validated.energyTrend = this.validateTrend(context.energyTrend);
        validated.stressTrend = this.validateTrend(context.stressTrend);

        // Validate arrays and objects
        validated.trainingHistory = this.validateTrainingHistory(context.trainingHistory);
        validated.recentWorkouts = this.validateRecentWorkouts(context.recentWorkouts);
        validated.progressionData = this.validateProgressionData(context.progressionData);

        this.logger.debug('Context validated with conservative fallbacks', {
            originalReadiness: context.readinessScore,
            validatedReadiness: validated.readinessScore,
            originalRPE: context.averageRPE,
            validatedRPE: validated.averageRPE
        });

        return validated;
    }

    /**
     * Validate readiness score (1-10 scale)
     * @param {number} score - Readiness score
     * @returns {number} Validated readiness score
     */
    validateReadinessScore(score) {
        if (typeof score !== 'number' || isNaN(score) || score <= 0) {
            return this.conservativeDefaults.readiness;
        }
        
        // Cap at reasonable maximum for safety
        return Math.min(Math.max(score, 1), 10);
    }

    /**
     * Validate energy level (1-10 scale)
     * @param {number} level - Energy level
     * @returns {number} Validated energy level
     */
    validateEnergyLevel(level) {
        if (typeof level !== 'number' || isNaN(level) || level <= 0) {
            return this.conservativeDefaults.energyLevel;
        }
        
        return Math.min(Math.max(level, 1), 10);
    }

    /**
     * Validate stress level (1-10 scale)
     * @param {number} level - Stress level
     * @returns {number} Validated stress level
     */
    validateStressLevel(level) {
        if (typeof level !== 'number' || isNaN(level) || level <= 0) {
            return this.conservativeDefaults.stressLevel;
        }
        
        return Math.min(Math.max(level, 1), 10);
    }

    /**
     * Validate training load metrics
     * @param {number} load - Training load value
     * @param {string} type - Type of load (atl7, ctl28, etc.)
     * @returns {number} Validated training load
     */
    validateTrainingLoad(load, type) {
        if (typeof load !== 'number' || isNaN(load) || load < 0) {
            return this.conservativeDefaults[type] || 0;
        }
        
        // Cap at reasonable maximum to prevent extreme values
        const maxLoad = type === 'atl7' ? 200 : 400;
        return Math.min(load, maxLoad);
    }

    /**
     * Validate monotony (should be >= 1.0)
     * @param {number} monotony - Monotony value
     * @returns {number} Validated monotony
     */
    validateMonotony(monotony) {
        if (typeof monotony !== 'number' || isNaN(monotony) || monotony < 1.0) {
            return this.conservativeDefaults.monotony;
        }
        
        // Cap at reasonable maximum
        return Math.min(monotony, 5.0);
    }

    /**
     * Validate strain (should be >= 0)
     * @param {number} strain - Strain value
     * @returns {number} Validated strain
     */
    validateStrain(strain) {
        if (typeof strain !== 'number' || isNaN(strain) || strain < 0) {
            return this.conservativeDefaults.strain;
        }
        
        // Cap at reasonable maximum
        return Math.min(strain, 1000);
    }

    /**
     * Validate RPE (1-10 scale)
     * @param {number} rpe - RPE value
     * @returns {number} Validated RPE
     */
    validateRPE(rpe) {
        if (typeof rpe !== 'number' || isNaN(rpe) || rpe <= 0) {
            return this.conservativeDefaults.averageRPE;
        }
        
        // Cap at conservative maximum for safety
        return Math.min(Math.max(rpe, 1), this.conservativeDefaults.maxIntensity);
    }

    /**
     * Validate progression rate (0-1 scale)
     * @param {number} rate - Progression rate
     * @returns {number} Validated progression rate
     */
    validateProgressionRate(rate) {
        if (typeof rate !== 'number' || isNaN(rate) || rate < 0) {
            return this.conservativeDefaults.progressionRate;
        }
        
        // Cap at conservative maximum
        return Math.min(rate, this.conservativeDefaults.maxVolumeIncrease);
    }

    /**
     * Validate consistency score (0-1 scale)
     * @param {number} score - Consistency score
     * @returns {number} Validated consistency score
     */
    validateConsistencyScore(score) {
        if (typeof score !== 'number' || isNaN(score) || score < 0) {
            return this.conservativeDefaults.consistencyScore;
        }
        
        return Math.min(Math.max(score, 0), 1);
    }

    /**
     * Validate training frequency (1-7 days per week)
     * @param {number} frequency - Training frequency
     * @returns {number} Validated training frequency
     */
    validateTrainingFrequency(frequency) {
        if (typeof frequency !== 'number' || isNaN(frequency) || frequency <= 0) {
            return this.conservativeDefaults.trainingFrequency;
        }
        
        return Math.min(Math.max(frequency, 1), 7);
    }

    /**
     * Validate workout streak (>= 0)
     * @param {number} streak - Workout streak
     * @returns {number} Validated workout streak
     */
    validateWorkoutStreak(streak) {
        if (typeof streak !== 'number' || isNaN(streak) || streak < 0) {
            return this.conservativeDefaults.workoutStreak;
        }
        
        return streak;
    }

    /**
     * Validate missed workouts (>= 0)
     * @param {number} missed - Missed workouts count
     * @returns {number} Validated missed workouts count
     */
    validateMissedWorkouts(missed) {
        if (typeof missed !== 'number' || isNaN(missed) || missed < 0) {
            return this.conservativeDefaults.missedWorkouts;
        }
        
        return missed;
    }

    /**
     * Validate goal
     * @param {string} goal - Primary goal
     * @returns {string} Validated goal
     */
    validateGoal(goal) {
        const validGoals = [
            'general_fitness', 'strength', 'endurance', 'muscle_gain', 
            'weight_loss', 'sport_specific', 'injury_prevention'
        ];
        
        if (typeof goal !== 'string' || !validGoals.includes(goal)) {
            return this.conservativeDefaults.primaryGoal;
        }
        
        return goal;
    }

    /**
     * Validate sport
     * @param {string} sport - Sport type
     * @returns {string} Validated sport
     */
    validateSport(sport) {
        const validSports = [
            'general_fitness', 'soccer', 'basketball', 'running', 
            'cycling', 'swimming', 'tennis', 'martial_arts'
        ];
        
        if (typeof sport !== 'string' || !validSports.includes(sport)) {
            return this.conservativeDefaults.sport;
        }
        
        return sport;
    }

    /**
     * Validate season phase
     * @param {string} phase - Season phase
     * @returns {string} Validated season phase
     */
    validateSeasonPhase(phase) {
        const validPhases = ['offseason', 'preseason', 'inseason', 'playoffs'];
        
        if (typeof phase !== 'string' || !validPhases.includes(phase)) {
            return this.conservativeDefaults.seasonPhase;
        }
        
        return phase;
    }

    /**
     * Validate trend
     * @param {string} trend - Trend value
     * @returns {string} Validated trend
     */
    validateTrend(trend) {
        const validTrends = ['increasing', 'decreasing', 'stable', 'volatile'];
        
        if (typeof trend !== 'string' || !validTrends.includes(trend)) {
            return this.conservativeDefaults.energyTrend;
        }
        
        return trend;
    }

    /**
     * Validate training history array
     * @param {Array} history - Training history
     * @returns {Array} Validated training history
     */
    validateTrainingHistory(history) {
        if (!Array.isArray(history)) {
            return [];
        }
        
        // Filter out invalid entries
        return history.filter(entry => 
            entry && 
            typeof entry === 'object' && 
            entry.date && 
            entry.type
        );
    }

    /**
     * Validate recent workouts array
     * @param {Array} workouts - Recent workouts
     * @returns {Array} Validated recent workouts
     */
    validateRecentWorkouts(workouts) {
        if (!Array.isArray(workouts)) {
            return [];
        }
        
        // Filter out invalid entries
        return workouts.filter(workout => 
            workout && 
            typeof workout === 'object' && 
            workout.date && 
            workout.duration > 0
        );
    }

    /**
     * Validate progression data object
     * @param {Object} data - Progression data
     * @returns {Object} Validated progression data
     */
    validateProgressionData(data) {
        if (!data || typeof data !== 'object') {
            return {};
        }
        
        const validated = {};
        
        // Validate each progression metric
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'number' && !isNaN(value) && value >= 0) {
                validated[key] = value;
            }
        }
        
        return validated;
    }

    /**
     * Apply conservative intensity scaling based on data confidence
     * @param {number} baseIntensity - Base intensity (1-10)
     * @param {number} dataConfidence - Data confidence (0-1)
     * @returns {number} Scaled intensity
     */
    applyConservativeScaling(baseIntensity, dataConfidence = 0.5) {
        const validatedIntensity = this.validateRPE(baseIntensity);
        const validatedConfidence = Math.min(Math.max(dataConfidence, 0), 1);
        
        // Scale down intensity when data confidence is low
        const confidenceFactor = 0.5 + (validatedConfidence * 0.5); // 0.5 to 1.0
        const scaledIntensity = validatedIntensity * confidenceFactor;
        
        // Ensure we don't exceed conservative maximum
        return Math.min(scaledIntensity, this.conservativeDefaults.maxIntensity);
    }

    /**
     * Generate conservative workout recommendations
     * @param {Object} context - User context
     * @returns {Object} Conservative workout recommendations
     */
    generateConservativeRecommendations(context) {
        const validatedContext = this.validateContext(context);
        
        // Determine conservative intensity based on readiness
        let intensity = 'moderate';
        if (validatedContext.readinessScore <= 4) {
            intensity = 'light';
        } else if (validatedContext.readinessScore >= 8) {
            intensity = 'moderate-high';
        }
        
        // Determine conservative volume based on recent load
        let volume = 'moderate';
        if (validatedContext.atl7 > 150) {
            volume = 'low';
        } else if (validatedContext.atl7 < 30) {
            volume = 'moderate-high';
        }
        
        return {
            intensity,
            volume,
            duration: 45, // Conservative 45 minutes
            focus: 'general',
            notes: 'Conservative workout based on current readiness and training load.',
            safetyFlags: this.generateSafetyFlags(validatedContext)
        };
    }

    /**
     * Generate safety flags for the workout
     * @param {Object} context - Validated context
     * @returns {Array} Safety flags
     */
    generateSafetyFlags(context) {
        const flags = [];
        
        if (context.readinessScore <= 4) {
            flags.push('Low readiness - consider light workout or rest');
        }
        
        if (context.atl7 > 150) {
            flags.push('High training load - reduce volume');
        }
        
        if (context.stressLevel >= 8) {
            flags.push('High stress - prioritize recovery');
        }
        
        if (context.missedWorkouts >= 3) {
            flags.push('Multiple missed workouts - ease back gradually');
        }
        
        return flags;
    }
}

// Create global instance
window.AIDataValidator = new AIDataValidator();
