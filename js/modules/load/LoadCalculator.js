/**
 * LoadCalculator - Training load management and recovery tracking
 * Handles load calculation, recovery debt, and workout intensity adjustments
 */
class LoadCalculator {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.authManager = window.AuthManager;
        this.storageManager = window.StorageManager;
        this.stravaProcessor = window.StravaProcessor;
        
        this.loadThresholds = this.initializeLoadThresholds();
        this.recoveryFactors = this.initializeRecoveryFactors();
        this.intensityGuidelines = this.initializeIntensityGuidelines();
    }

    /**
     * Initialize load thresholds for different training levels
     * @returns {Object} Load thresholds
     */
    initializeLoadThresholds() {
        return {
            beginner: {
                weeklyLoad: 100,
                dailyLoad: 20,
                recoveryTime: 48
            },
            intermediate: {
                weeklyLoad: 200,
                dailyLoad: 40,
                recoveryTime: 36
            },
            advanced: {
                weeklyLoad: 300,
                dailyLoad: 60,
                recoveryTime: 24
            },
            elite: {
                weeklyLoad: 400,
                dailyLoad: 80,
                recoveryTime: 18
            }
        };
    }

    /**
     * Initialize recovery factors
     * @returns {Object} Recovery factors
     */
    initializeRecoveryFactors() {
        return {
            sleep: 0.3, // Sleep quality impact
            nutrition: 0.2, // Nutrition impact
            stress: 0.2, // Stress impact
            age: 0.1, // Age impact
            experience: 0.2 // Training experience impact
        };
    }

    /**
     * Initialize intensity guidelines
     * @returns {Object} Intensity guidelines
     */
    initializeIntensityGuidelines() {
        return {
            low: { threshold: 0.6, description: 'Easy recovery session' },
            moderate: { threshold: 0.8, description: 'Moderate training session' },
            high: { threshold: 0.9, description: 'High intensity session' },
            max: { threshold: 1.0, description: 'Maximum intensity session' }
        };
    }

    /**
     * Calculate weekly training load
     * @param {Array} sessions - Training sessions for the week
     * @returns {Object} Weekly load analysis
     */
    calculateWeeklyLoad(sessions) {
        try {
            let totalLoad = 0;
            let volumeLoad = 0;
            let intensityLoad = 0;
            const dailyLoads = {};

            sessions.forEach(session => {
                const sessionLoad = this.calculateSessionLoad(session);
                totalLoad += sessionLoad.total;
                volumeLoad += sessionLoad.volume;
                intensityLoad += sessionLoad.intensity;

                // Track daily loads
                const date = session.date || new Date().toISOString().split('T')[0];
                if (!dailyLoads[date]) {
                    dailyLoads[date] = { total: 0, volume: 0, intensity: 0 };
                }
                dailyLoads[date].total += sessionLoad.total;
                dailyLoads[date].volume += sessionLoad.volume;
                dailyLoads[date].intensity += sessionLoad.intensity;
            });

            const averageDailyLoad = totalLoad / 7;
            const peakDailyLoad = Math.max(...Object.values(dailyLoads).map(d => d.total));
            const loadVariation = this.calculateLoadVariation(dailyLoads);

            return {
                totalLoad,
                volumeLoad,
                intensityLoad,
                averageDailyLoad,
                peakDailyLoad,
                loadVariation,
                dailyLoads,
                recommendation: this.getLoadRecommendation(totalLoad),
                nextDayIntensity: this.suggestNextDayIntensity(totalLoad, averageDailyLoad)
            };
        } catch (error) {
            this.logger.error('Failed to calculate weekly load', error);
            return { error: error.message };
        }
    }

    /**
     * Calculate load for a single training session
     * @param {Object} session - Training session data
     * @returns {Object} Session load breakdown
     */
    calculateSessionLoad(session) {
        let volumeLoad = 0;
        let intensityLoad = 0;

        // Check if this is a soccer-shape session
        const isSoccerShape = session.category === 'soccer_shape' || 
                             session.tags?.includes('soccer_shape') ||
                             session.subcategory === 'soccer_shape';

        if (session.exercises) {
            session.exercises.forEach(exercise => {
                // Volume load: sets × reps × weight
                const exerciseVolume = exercise.sets * exercise.reps * exercise.weight;
                volumeLoad += exerciseVolume;

                // Intensity factor (RPE/10)
                const intensityFactor = exercise.rpe / 10;
                intensityLoad += exerciseVolume * intensityFactor;

                // Soccer-shape specific adjustments
                if (isSoccerShape) {
                    // High-intensity intervals: RPE × minutes × 1.3 multiplier
                    if (exercise.intensity === 'Z4' || exercise.intensity === 'Z5') {
                        intensityLoad *= 1.3;
                    }

                    // Change of direction work: Base load × 1.2 neuromotor factor
                    if (exercise.tags?.includes('change_of_direction') || 
                        exercise.tags?.includes('COD') ||
                        exercise.tags?.includes('agility')) {
                        intensityLoad *= 1.2;
                    }
                }
            });
        }

        // Add external activity load if present
        if (session.externalActivities) {
            session.externalActivities.forEach(activity => {
                const activityLoad = activity.training_stress_score || 0;
                volumeLoad += activityLoad;
                intensityLoad += activityLoad;
            });
        }

        // Soccer-shape specific load calculation for structured workouts
        if (isSoccerShape && session.structure) {
            const soccerLoad = this.calculateSoccerShapeLoad(session);
            if (soccerLoad > 0) {
                intensityLoad = Math.max(intensityLoad, soccerLoad);
            }
        }

        const totalLoad = Math.max(0, volumeLoad + intensityLoad);

        // Prevent division by zero in ratio calculations
        const safeTotalLoad = totalLoad > 0 ? totalLoad : 1;
        
        return {
            total: totalLoad,
            volume: Math.max(0, volumeLoad),
            intensity: Math.max(0, intensityLoad),
            volumeRatio: totalLoad > 0 ? Math.max(0, Math.min(1, volumeLoad / safeTotalLoad)) : 0,
            intensityRatio: totalLoad > 0 ? Math.max(0, Math.min(1, intensityLoad / safeTotalLoad)) : 0
        };
    }

    /**
     * Calculate load variation across days
     * @param {Object} dailyLoads - Daily load data
     * @returns {number} Load variation coefficient
     */
    calculateLoadVariation(dailyLoads) {
        const loads = Object.values(dailyLoads).map(d => d.total);
        const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
        const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
        const standardDeviation = Math.sqrt(variance);
        
        return mean > 0 ? standardDeviation / mean : 0;
    }

    /**
     * Get load recommendation based on total load
     * @param {number} totalLoad - Total weekly load
     * @returns {Object} Load recommendation
     */
    getLoadRecommendation(totalLoad) {
        const userLevel = this.getUserTrainingLevel();
        const thresholds = this.loadThresholds[userLevel];

        if (totalLoad < thresholds.weeklyLoad * 0.7) {
            return {
                status: 'low',
                message: 'Load is low - consider increasing training volume',
                suggestion: 'Add 1-2 additional sessions or increase intensity'
            };
        } else if (totalLoad > thresholds.weeklyLoad * 1.3) {
            return {
                status: 'high',
                message: 'Load is high - risk of overtraining',
                suggestion: 'Reduce training volume or intensity for recovery'
            };
        } else {
            return {
                status: 'optimal',
                message: 'Load is within optimal range',
                suggestion: 'Maintain current training load'
            };
        }
    }

    /**
     * Suggest next day intensity based on current load
     * @param {number} totalLoad - Total weekly load
     * @param {number} averageDailyLoad - Average daily load
     * @returns {Object} Intensity suggestion
     */
    suggestNextDayIntensity(totalLoad, averageDailyLoad) {
        const userLevel = this.getUserTrainingLevel();
        const thresholds = this.loadThresholds[userLevel];
        
        // Bounds checking: ensure thresholds are positive and totalLoad/averageDailyLoad are non-negative
        const safeWeeklyLoad = Math.max(1, thresholds.weeklyLoad);
        const safeDailyLoad = Math.max(1, thresholds.dailyLoad);
        const safeTotalLoad = Math.max(0, totalLoad);
        const safeAverageDailyLoad = Math.max(0, averageDailyLoad);
        
        // Cap ratios to prevent extreme values
        const loadRatio = Math.min(Math.max(0.1, safeTotalLoad / safeWeeklyLoad), 10.0);
        const dailyRatio = Math.min(Math.max(0.1, safeAverageDailyLoad / safeDailyLoad), 10.0);

        if (loadRatio > 1.2 || dailyRatio > 1.5) {
            return {
                intensity: 0.6,
                type: 'recovery',
                message: 'High load detected - focus on recovery',
                exercises: ['light cardio', 'stretching', 'mobility work']
            };
        } else if (loadRatio < 0.8) {
            return {
                intensity: 0.9,
                type: 'high',
                message: 'Low load - good time for high intensity',
                exercises: ['heavy compound movements', 'high-intensity intervals']
            };
        } else {
            return {
                intensity: 0.8,
                type: 'moderate',
                message: 'Optimal load - moderate intensity recommended',
                exercises: ['balanced training', 'skill work', 'strength training']
            };
        }
    }

    /**
     * Calculate recovery debt from all activities
     * @param {Array} activities - Recent activities
     * @returns {Object} Recovery debt analysis
     */
    calculateRecoveryDebt(activities) {
        try {
            let totalRecoveryDebt = 0;
            const recoveryByType = {};
            const recoveryTimeline = [];

            activities.forEach(activity => {
                const debt = activity.recovery_debt_hours || 0;
                totalRecoveryDebt += debt;

                // Track by activity type
                const type = activity.activity_type;
                if (!recoveryByType[type]) {
                    recoveryByType[type] = 0;
                }
                recoveryByType[type] += debt;

                // Add to recovery timeline
                recoveryTimeline.push({
                    date: activity.start_time,
                    type: type,
                    debt: debt,
                    remaining: debt
                });
            });

            // Calculate recovery status
            const recoveryStatus = this.assessRecoveryStatus(totalRecoveryDebt);
            const recommendedActions = this.getRecoveryRecommendations(totalRecoveryDebt, recoveryByType);

            return {
                totalDebt: totalRecoveryDebt,
                byType: recoveryByType,
                timeline: recoveryTimeline,
                status: recoveryStatus,
                recommendations: recommendedActions
            };
        } catch (error) {
            this.logger.error('Failed to calculate recovery debt', error);
            return { error: error.message };
        }
    }

    /**
     * Assess recovery status based on total debt
     * @param {number} totalDebt - Total recovery debt in hours
     * @returns {Object} Recovery status
     */
    assessRecoveryStatus(totalDebt) {
        if (totalDebt < 12) {
            return {
                level: 'excellent',
                message: 'Excellent recovery status',
                color: 'green',
                readiness: 0.9
            };
        } else if (totalDebt < 24) {
            return {
                level: 'good',
                message: 'Good recovery status',
                color: 'yellow',
                readiness: 0.7
            };
        } else if (totalDebt < 48) {
            return {
                level: 'moderate',
                message: 'Moderate recovery debt',
                color: 'orange',
                readiness: 0.5
            };
        } else {
            return {
                level: 'poor',
                message: 'High recovery debt - rest needed',
                color: 'red',
                readiness: 0.3
            };
        }
    }

    /**
     * Get recovery recommendations
     * @param {number} totalDebt - Total recovery debt
     * @param {Object} recoveryByType - Recovery debt by activity type
     * @returns {Array} Recovery recommendations
     */
    getRecoveryRecommendations(totalDebt, recoveryByType) {
        const recommendations = [];

        if (totalDebt > 24) {
            recommendations.push({
                priority: 'high',
                action: 'Take a rest day',
                description: 'High recovery debt - focus on complete rest'
            });
        }

        if (recoveryByType['Run'] > 12) {
            recommendations.push({
                priority: 'medium',
                action: 'Reduce leg training',
                description: 'High running load - reduce leg volume'
            });
        }

        if (recoveryByType['Ride'] > 12) {
            recommendations.push({
                priority: 'medium',
                action: 'Focus on upper body',
                description: 'High cycling load - focus on upper body training'
            });
        }

        if (totalDebt < 12) {
            recommendations.push({
                priority: 'low',
                action: 'Maintain current training',
                description: 'Good recovery status - continue training'
            });
        }

        return recommendations;
    }

    /**
     * Calculate comprehensive load analysis
     * @param {Array} sessions - Training sessions
     * @param {Array} activities - External activities
     * @returns {Object} Comprehensive load analysis
     */
    calculateComprehensiveLoad(sessions, activities) {
        try {
            // Calculate internal training load
            const weeklyLoad = this.calculateWeeklyLoad(sessions);
            
            // Calculate external activity load
            const externalLoad = this.calculateExternalLoad(activities);
            
            // Calculate recovery debt
            const recoveryDebt = this.calculateRecoveryDebt(activities);
            
            // Combine loads with bounds checking
            const safeWeeklyLoad = Math.max(0, weeklyLoad?.totalLoad || 0);
            const safeExternalLoad = Math.max(0, externalLoad?.totalLoad || 0);
            const totalLoad = safeWeeklyLoad + safeExternalLoad;
            
            const combinedRecommendation = this.getCombinedRecommendation(
                { ...weeklyLoad, totalLoad: safeWeeklyLoad },
                { ...externalLoad, totalLoad: safeExternalLoad },
                recoveryDebt
            );
            
            return {
                internal: weeklyLoad,
                external: externalLoad,
                recovery: recoveryDebt,
                combined: {
                    totalLoad,
                    recommendation: combinedRecommendation,
                    riskAssessment: this.assessOvertrainingRisk(totalLoad, recoveryDebt.totalDebt)
                }
            };
        } catch (error) {
            this.logger.error('Failed to calculate comprehensive load', error);
            return { error: error.message };
        }
    }

    /**
     * Calculate external activity load
     * @param {Array} activities - External activities
     * @returns {Object} External load analysis
     */
    calculateExternalLoad(activities) {
        let totalLoad = 0;
        const loadByType = {};
        const dailyLoads = {};

        activities.forEach(activity => {
            const load = activity.training_stress_score || 0;
            totalLoad += load;

            // Track by type
            const type = activity.activity_type;
            if (!loadByType[type]) {
                loadByType[type] = 0;
            }
            loadByType[type] += load;

            // Track by day
            const date = activity.start_time.split('T')[0];
            if (!dailyLoads[date]) {
                dailyLoads[date] = 0;
            }
            dailyLoads[date] += load;
        });

            // Ensure non-negative total load and safe division
            const safeTotalLoad = Math.max(0, totalLoad);
            
            return {
                totalLoad: safeTotalLoad,
                loadByType,
                dailyLoads,
                averageDailyLoad: Math.max(0, safeTotalLoad / 7)
            };
    }

    /**
     * Get combined recommendation
     * @param {Object} weeklyLoad - Weekly load data
     * @param {Object} externalLoad - External load data
     * @param {Object} recoveryDebt - Recovery debt data
     * @returns {Object} Combined recommendation
     */
    getCombinedRecommendation(weeklyLoad, externalLoad, recoveryDebt) {
        const totalLoad = weeklyLoad.totalLoad + externalLoad.totalLoad;
        const recoveryStatus = recoveryDebt.status;

        if (recoveryStatus.level === 'poor') {
            return {
                priority: 'high',
                action: 'Reduce training load',
                message: 'High recovery debt - reduce training intensity and volume',
                adjustments: {
                    intensity: 0.6,
                    volume: 0.7,
                    focus: 'recovery'
                }
            };
        } else if (totalLoad > 400) {
            return {
                priority: 'medium',
                action: 'Monitor load carefully',
                message: 'High combined load - monitor for overtraining signs',
                adjustments: {
                    intensity: 0.8,
                    volume: 0.9,
                    focus: 'maintenance'
                }
            };
        } else {
            return {
                priority: 'low',
                action: 'Maintain current training',
                message: 'Load is within optimal range',
                adjustments: {
                    intensity: 1.0,
                    volume: 1.0,
                    focus: 'progression'
                }
            };
        }
    }

    /**
     * Assess overtraining risk
     * @param {number} totalLoad - Total training load
     * @param {number} recoveryDebt - Recovery debt in hours
     * @returns {Object} Overtraining risk assessment
     */
    assessOvertrainingRisk(totalLoad, recoveryDebt) {
        let riskScore = 0;
        const factors = [];

        // Load factor
        if (totalLoad > 400) {
            riskScore += 3;
            factors.push('High training load');
        } else if (totalLoad > 300) {
            riskScore += 2;
            factors.push('Moderate-high training load');
        }

        // Recovery debt factor
        if (recoveryDebt > 48) {
            riskScore += 3;
            factors.push('High recovery debt');
        } else if (recoveryDebt > 24) {
            riskScore += 2;
            factors.push('Moderate recovery debt');
        }

        // Determine risk level
        let riskLevel = 'low';
        if (riskScore >= 5) {
            riskLevel = 'high';
        } else if (riskScore >= 3) {
            riskLevel = 'medium';
        }

        return {
            score: riskScore,
            level: riskLevel,
            factors: factors,
            recommendation: this.getRiskRecommendation(riskLevel)
        };
    }

    /**
     * Get risk-based recommendation
     * @param {string} riskLevel - Risk level
     * @returns {Object} Risk recommendation
     */
    getRiskRecommendation(riskLevel) {
        const recommendations = {
            low: {
                action: 'Continue training',
                message: 'Low overtraining risk - maintain current training'
            },
            medium: {
                action: 'Monitor closely',
                message: 'Medium overtraining risk - monitor recovery and adjust if needed'
            },
            high: {
                action: 'Reduce training',
                message: 'High overtraining risk - reduce training load immediately'
            }
        };

        return recommendations[riskLevel] || recommendations.low;
    }

    /**
     * Get user training level
     * @returns {string} Training level
     */
    getUserTrainingLevel() {
        // This would typically come from user profile
        return 'intermediate'; // Default level
    }

    /**
     * Get load management dashboard data
     * @returns {Object} Dashboard data
     */
    getLoadDashboard() {
        try {
            const sessions = this.getRecentSessions(7);
            const activities = this.stravaProcessor?.getRecentActivities(7) || [];
            
            const comprehensiveLoad = this.calculateComprehensiveLoad(sessions, activities);
            
            return {
                load: comprehensiveLoad,
                summary: {
                    totalLoad: comprehensiveLoad.combined.totalLoad,
                    recoveryStatus: comprehensiveLoad.recovery.status,
                    riskLevel: comprehensiveLoad.combined.riskAssessment.level,
                    recommendation: comprehensiveLoad.combined.recommendation
                }
            };
        } catch (error) {
            this.logger.error('Failed to get load dashboard', error);
            return { error: error.message };
        }
    }

    /**
     * Get current load status for workout planning
     * @returns {Object} Current load status with workout recommendations
     */
    getCurrentLoadStatus() {
        try {
            const sessions = this.getRecentSessions(7);
            const activities = this.stravaProcessor?.getRecentActivities(7) || [];
            
            // Calculate current week's load
            const weeklyLoad = this.calculateWeeklyLoad(sessions);
            const externalLoad = this.calculateExternalLoad(activities);
            const totalCurrentLoad = weeklyLoad.totalLoad + externalLoad.totalLoad;
            
            // Calculate 7-day average for comparison
            const sevenDayAverage = this.calculateSevenDayAverage(sessions, activities);
            
            // Detect load spikes
            const loadSpike = this.detectLoadSpike(totalCurrentLoad, sevenDayAverage);
            
            // Generate workout intensity recommendations
            const workoutRecommendations = this.generateWorkoutIntensityRecommendations(
                totalCurrentLoad, 
                sevenDayAverage, 
                loadSpike
            );
            
            return {
                currentLoad: totalCurrentLoad,
                sevenDayAverage: sevenDayAverage,
                loadSpike: loadSpike,
                recommendations: workoutRecommendations,
                weeklyBreakdown: weeklyLoad,
                externalBreakdown: externalLoad
            };
        } catch (error) {
            this.logger.error('Failed to get current load status', error);
            return { 
                currentLoad: 0, 
                sevenDayAverage: 0, 
                loadSpike: false, 
                recommendations: { intensity: 1.0, volume: 1.0, message: 'Unable to calculate load' }
            };
        }
    }

    /**
     * Calculate 7-day average load
     * @param {Array} sessions - Training sessions
     * @param {Array} activities - External activities
     * @returns {number} 7-day average load
     */
    calculateSevenDayAverage(sessions, activities) {
        try {
            // Get last 7 days of data
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            // Filter sessions from last 7 days
            const recentSessions = sessions.filter(session => {
                const sessionDate = new Date(session.date || session.start_at);
                return sessionDate >= sevenDaysAgo;
            });
            
            // Filter activities from last 7 days
            const recentActivities = activities.filter(activity => {
                const activityDate = new Date(activity.start_time);
                return activityDate >= sevenDaysAgo;
            });
            
            // Calculate total load for the period
            const sessionLoad = this.calculateWeeklyLoad(recentSessions).totalLoad;
            const activityLoad = this.calculateExternalLoad(recentActivities).totalLoad;
            
            // Ensure non-negative values
            const safeSessionLoad = Math.max(0, sessionLoad || 0);
            const safeActivityLoad = Math.max(0, activityLoad || 0);
            
            return Math.max(0, safeSessionLoad + safeActivityLoad);
        } catch (error) {
            this.logger.error('Failed to calculate 7-day average', error);
            // Return conservative default instead of 0 to prevent division issues downstream
            return 1;
        }
    }

    /**
     * Detect load spikes
     * @param {number} currentLoad - Current load
     * @param {number} sevenDayAverage - 7-day average load
     * @returns {Object} Load spike detection
     */
    detectLoadSpike(currentLoad, sevenDayAverage) {
        // Bounds checking: ensure non-negative values
        const safeCurrentLoad = Math.max(0, currentLoad || 0);
        const safeSevenDayAverage = Math.max(0, sevenDayAverage || 0);
        
        if (safeSevenDayAverage === 0) {
            return { isSpike: false, ratio: 1.0, severity: 'none' };
        }
        
        // Cap ratio to prevent extreme values that could cause issues
        const ratio = Math.min(Math.max(0.1, safeCurrentLoad / safeSevenDayAverage), 10.0);
        
        let severity = 'none';
        if (ratio > 1.5) {
            severity = 'high';
        } else if (ratio > 1.3) {
            severity = 'medium';
        } else if (ratio > 1.1) {
            severity = 'low';
        }
        
        return {
            isSpike: ratio > 1.1,
            ratio: ratio,
            severity: severity,
            message: this.getLoadSpikeMessage(ratio, severity)
        };
    }

    /**
     * Get load spike message
     * @param {number} ratio - Load ratio
     * @param {string} severity - Spike severity
     * @returns {string} Load spike message
     */
    getLoadSpikeMessage(ratio, severity) {
        const messages = {
            high: `High load spike detected (${(ratio * 100).toFixed(0)}% of average) - recovery day recommended`,
            medium: `Moderate load spike detected (${(ratio * 100).toFixed(0)}% of average) - consider reducing intensity`,
            low: `Slight load increase (${(ratio * 100).toFixed(0)}% of average) - monitor recovery`,
            none: 'Load within normal range'
        };
        
        return messages[severity] || messages.none;
    }

    /**
     * Generate workout intensity recommendations based on load
     * @param {number} currentLoad - Current load
     * @param {number} sevenDayAverage - 7-day average load
     * @param {Object} loadSpike - Load spike detection
     * @returns {Object} Workout intensity recommendations
     */
    generateWorkoutIntensityRecommendations(currentLoad, sevenDayAverage, loadSpike) {
        const userLevel = this.getUserTrainingLevel();
        const thresholds = this.loadThresholds[userLevel];
        
        // Bounds checking: ensure all values are non-negative
        const safeCurrentLoad = Math.max(0, currentLoad || 0);
        const safeSevenDayAverage = Math.max(0, sevenDayAverage || 0);
        
        // Calculate load ratio with bounds checking
        // Use safe default of 1.0 if average is 0, and cap ratio to prevent extreme values
        const rawRatio = safeSevenDayAverage > 0 ? safeCurrentLoad / safeSevenDayAverage : 1.0;
        const loadRatio = Math.min(Math.max(0.1, rawRatio), 10.0);
        
        // Base recommendations
        let intensity = 1.0;
        let volume = 1.0;
        let message = 'Normal training load';
        let recoveryRecommended = false;
        
        // High weekly load (>7 day average) reduces volume by 20%
        if (loadRatio > 1.0) {
            volume = 0.8; // 20% reduction
            message = 'Reduced volume due to high training load';
            
            // More aggressive reduction for higher loads
            if (loadRatio > 1.3) {
                volume = 0.6; // 40% reduction
                intensity = 0.8; // 20% intensity reduction
                message = 'Significantly reduced volume and intensity due to high training load';
            }
        }
        
        // Load spike detection triggers recovery day recommendation
        if (loadSpike.isSpike) {
            if (loadSpike.severity === 'high') {
                recoveryRecommended = true;
                intensity = 0.5;
                volume = 0.3;
                message = 'Recovery day recommended due to load spike';
            } else if (loadSpike.severity === 'medium') {
                intensity = 0.7;
                volume = 0.6;
                message = 'Reduced intensity due to load spike';
            }
        }
        
        // Additional adjustments based on absolute load
        // Ensure thresholds.weeklyLoad is positive before comparison
        const safeThreshold = Math.max(1, thresholds.weeklyLoad);
        if (safeCurrentLoad > safeThreshold * 1.2) {
            intensity *= 0.8;
            volume *= 0.7;
            message = 'High absolute load - reduced intensity and volume';
        }
        
        // Log if bounds checking was triggered (for monitoring)
        if (currentLoad !== safeCurrentLoad || sevenDayAverage !== safeSevenDayAverage) {
            this.logger.debug('LOAD_BOUNDS_CHECK', {
                originalCurrentLoad: currentLoad,
                originalAverage: sevenDayAverage,
                safeCurrentLoad: safeCurrentLoad,
                safeAverage: safeSevenDayAverage,
                loadRatio: loadRatio
            });
        }
        
        return {
            intensity: Math.max(0.3, Math.min(1.0, intensity)),
            volume: Math.max(0.3, Math.min(1.0, volume)),
            message: message,
            recoveryRecommended: recoveryRecommended,
            loadRatio: loadRatio,
            adjustments: {
                intensityReduction: Math.round((1 - intensity) * 100),
                volumeReduction: Math.round((1 - volume) * 100)
            }
        };
    }

    /**
     * Calculate soccer-shape specific load for structured workouts
     * @param {Object} session - Soccer-shape session with structure
     * @returns {number} Soccer-shape load score
     */
    calculateSoccerShapeLoad(session) {
        if (!session.structure || !Array.isArray(session.structure)) {
            return 0;
        }

        let totalLoad = 0;
        const zoneMultipliers = {
            Z1: 1.0,
            Z2: 2.0,
            Z3: 4.0,
            Z4: 7.0,
            Z5: 10.0
        };

        session.structure.forEach(block => {
            if (block.block_type === 'main' && block.intensity) {
                const intensity = block.intensity;
                const zone = intensity.includes('Z') ? intensity.split('-')[0] : 'Z3';
                const multiplier = zoneMultipliers[zone] || 4.0;

                // Calculate work duration
                let workMinutes = 0;
                if (block.sets && block.work_duration) {
                    workMinutes = (block.sets * block.work_duration) / 60;
                } else if (block.duration) {
                    workMinutes = block.duration;
                }

                // Base load calculation
                let blockLoad = workMinutes * multiplier;

                // High-intensity intervals: RPE × minutes × 1.3 multiplier
                if (zone === 'Z4' || zone === 'Z5') {
                    blockLoad *= 1.3;
                }

                // Change of direction work: Base load × 1.2 neuromotor factor
                if (block.description?.toLowerCase().includes('shuttle') ||
                    block.description?.toLowerCase().includes('agility') ||
                    block.description?.toLowerCase().includes('change of direction') ||
                    block.description?.toLowerCase().includes('COD')) {
                    blockLoad *= 1.2;
                }

                totalLoad += blockLoad;
            }
        });

        // Recovery intervals excluded from load calculation (already handled by excluding Z1 rest blocks)
        return Math.round(totalLoad * 10) / 10;
    }

    /**
     * Get recent training sessions
     * @param {number} days - Number of days to look back
     * @returns {Array} Recent sessions
     */
    getRecentSessions(days = 7) {
        try {
            const sessions = this.storageManager?.get('training_sessions', []);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            return sessions.filter(session => {
                const sessionDate = new Date(session.date);
                return sessionDate >= cutoffDate;
            });
        } catch (error) {
            this.logger.error('Failed to get recent sessions', error);
            return [];
        }
    }
}

// Create global instance
window.LoadCalculator = new LoadCalculator();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadCalculator;
}
