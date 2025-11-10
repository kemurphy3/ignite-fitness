/**
 * StravaDataProcessor - Strava activity data processing and training stress calculation
 * Handles Strava activity import, TSS calculation, and recovery impact estimation
 */
class StravaDataProcessor {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.authManager = window.AuthManager;
        this.storageManager = window.StorageManager;

        this.tssFormulas = this.initializeTSSFormulas();
        this.recoveryEstimates = this.initializeRecoveryEstimates();
        this.adjustmentRules = this.initializeAdjustmentRules();
        this.importedActivities = new Set(); // Idempotency guard

        // MVP: Initialize deduplication guard for file uploads
        this.uploadedActivities = new Set(); // Separate from existing idempotency guard
    }

    /**
     * Initialize TSS calculation formulas
     * @returns {Object} TSS formulas by activity type
     */
    initializeTSSFormulas() {
        return {
            'Run': {
                formula: 'rTSS',
                description: 'Running Training Stress Score based on pace and duration',
                calculate: (activity) => this.calculateRunningTSS(activity)
            },
            'Ride': {
                formula: 'hrTSS',
                description: 'Cycling Training Stress Score based on heart rate',
                calculate: (activity) => this.calculateCyclingTSS(activity)
            },
            'Swim': {
                formula: 'heuristic',
                description: 'Swimming training load (heuristic)',
                calculate: (activity) => this.calculateSwimmingLoad(activity)
            },
            'WeightTraining': {
                formula: 'heuristic',
                description: 'Weight training load (heuristic)',
                calculate: (activity) => this.calculateWeightTrainingLoad(activity)
            }
        };
    }

    /**
     * Initialize recovery time estimates
     * @returns {Object} Recovery estimates by activity type
     */
    initializeRecoveryEstimates() {
        return {
            'Run': {
                baseHours: 24,
                intensityMultiplier: 1.5,
                distanceMultiplier: 0.1
            },
            'Ride': {
                baseHours: 18,
                intensityMultiplier: 1.3,
                distanceMultiplier: 0.08
            },
            'Swim': {
                baseHours: 12,
                intensityMultiplier: 1.2,
                distanceMultiplier: 0.05
            },
            'WeightTraining': {
                baseHours: 48,
                intensityMultiplier: 2.0,
                distanceMultiplier: 0
            }
        };
    }

    /**
     * Initialize workout adjustment rules
     * @returns {Object} Adjustment rules for different activity types
     */
    initializeAdjustmentRules() {
        return {
            longRun: {
                condition: (activity) => activity.type === 'Run' && activity.distance > 10000,
                adjustment: {
                    legVolume: 0.8,
                    message: 'Great run yesterday! Reducing leg volume to aid recovery.'
                }
            },
            highIntensity: {
                condition: (activity) => {
                    const userAge = this.getUserAge();
                    const maxHR = 220 - userAge;
                    return activity.avg_heart_rate > maxHR * 0.85;
                },
                adjustment: {
                    overallIntensity: 0.9,
                    message: 'High intensity session detected. Taking it easier today.'
                }
            },
            longRide: {
                condition: (activity) => activity.type === 'Ride' && activity.distance > 50000,
                adjustment: {
                    legVolume: 0.7,
                    message: 'Long ride completed! Reducing leg work to support recovery.'
                }
            },
            intenseSwim: {
                condition: (activity) => activity.type === 'Swim' && activity.avg_heart_rate > 150,
                adjustment: {
                    upperBodyVolume: 0.8,
                    message: 'Intense swim session! Reducing upper body volume today.'
                }
            }
        };
    }

    /**
     * Process Strava activity data
     * @param {Object} activity - Raw Strava activity data
     * @returns {Object} Processed activity data
     */
    processActivity(activity) {
        try {
            // Validate input data
            if (!activity || typeof activity !== 'object') {
                return { success: false, error: 'Invalid activity data' };
            }

            // Sanitize activity data
            const sanitizedActivity = this.sanitizeActivityData(activity);

            // Check for idempotency
            const activityKey = `${sanitizedActivity.source}_${sanitizedActivity.external_id}`;
            if (this.importedActivities.has(activityKey)) {
                this.logger.debug('Activity already processed, skipping:', activityKey);
                return { success: false, error: 'Activity already processed' };
            }

            const processedActivity = {
                // Basic metrics
                duration: activity.moving_time || activity.elapsed_time,
                distance: activity.distance,
                calories: activity.calories,
                avgHeartRate: activity.average_heartrate,
                maxHeartRate: activity.max_heartrate,
                elevation: activity.total_elevation_gain,
                pace: this.calculatePace(activity),
                power: activity.avg_watts || activity.weighted_avg_watts,

                // Training stress calculation
                trainingStress: this.calculateTrainingStress(activity),
                sourceLoad: this.calculateSourceLoad(activity),

                // Recovery impact estimation
                recoveryDebt: this.estimateRecoveryTime(activity),
                perceivedExertion: this.estimatePerceivedExertion(activity),

                // Next workout adjustment
                workoutAdjustment: this.suggestAdjustment(activity),

                // Metadata
                processedAt: new Date().toISOString(),
                source: 'strava',
                externalId: activity.id.toString()
            };

            // Mark as processed for idempotency
            this.importedActivities.add(activityKey);

            this.logger.audit('STRAVA_ACTIVITY_PROCESSED', {
                activityId: activity.id,
                type: activity.type,
                duration: processedActivity.duration,
                trainingStress: processedActivity.trainingStress
            });

            return { success: true, activity: processedActivity };
        } catch (error) {
            this.logger.error('Failed to process Strava activity', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate training stress score for activity
     * @param {Object} activity - Activity data
     * @returns {number} Training stress score
     */
    calculateTrainingStress(activity) {
        const activityType = activity.type;
        const formula = this.tssFormulas[activityType];

        if (!formula) {
            // Default heuristic calculation
            return this.calculateHeuristicLoad(activity);
        }

        return formula.calculate(activity);
    }

    /**
     * Calculate running TSS (rTSS)
     * @param {Object} activity - Running activity data
     * @returns {number} Running TSS
     */
    calculateRunningTSS(activity) {
        const duration = activity.moving_time / 3600; // Convert to hours
        const distance = activity.distance / 1000; // Convert to km
        const pace = distance / duration; // km/h

        // Simplified rTSS calculation based on pace and duration
        // This is a heuristic approximation - real rTSS requires power data
        const baseLoad = duration * 10; // Base load per hour
        const paceMultiplier = Math.pow(pace / 10, 1.5); // Pace intensity factor

        return Math.round(baseLoad * paceMultiplier);
    }

    /**
     * Calculate cycling TSS (hrTSS)
     * @param {Object} activity - Cycling activity data
     * @returns {number} Cycling TSS
     */
    calculateCyclingTSS(activity) {
        if (!activity.average_heartrate || !activity.max_heartrate) {
            return this.calculateHeuristicLoad(activity);
        }

        const duration = activity.moving_time / 3600; // Convert to hours
        const avgHR = activity.average_heartrate;
        const maxHR = activity.max_heartrate;
        const hrRatio = avgHR / maxHR;

        // hrTSS calculation based on heart rate reserve
        const intensityFactor = Math.pow(hrRatio, 2.5);
        const baseLoad = duration * 100; // Base TSS per hour

        return Math.round(baseLoad * intensityFactor);
    }

    /**
     * Calculate swimming training load (heuristic)
     * @param {Object} activity - Swimming activity data
     * @returns {number} Swimming training load
     */
    calculateSwimmingLoad(activity) {
        const duration = activity.moving_time / 3600; // Convert to hours
        const distance = activity.distance / 1000; // Convert to km

        // Swimming load based on duration and distance
        const baseLoad = duration * 15; // Base load per hour
        const distanceFactor = distance * 5; // Distance factor

        return Math.round(baseLoad + distanceFactor);
    }

    /**
     * Calculate weight training load (heuristic)
     * @param {Object} activity - Weight training activity data
     * @returns {number} Weight training load
     */
    calculateWeightTrainingLoad(activity) {
        const duration = activity.moving_time / 3600; // Convert to hours

        // Weight training load based on duration
        // This would ideally use volume load (sets × reps × weight)
        const baseLoad = duration * 20; // Base load per hour

        return Math.round(baseLoad);
    }

    /**
     * Calculate heuristic training load for unknown activity types
     * @param {Object} activity - Activity data
     * @returns {number} Heuristic training load
     */
    calculateHeuristicLoad(activity) {
        const duration = activity.moving_time / 3600; // Convert to hours
        const distance = activity.distance / 1000; // Convert to km

        // Simple heuristic based on duration and distance
        const baseLoad = duration * 12; // Base load per hour
        const distanceFactor = distance * 2; // Distance factor

        return Math.round(baseLoad + distanceFactor);
    }

    /**
     * Calculate source load (rTSS/hrTSS or heuristic)
     * @param {Object} activity - Activity data
     * @returns {number} Source load value
     */
    calculateSourceLoad(activity) {
        const activityType = activity.type;
        const formula = this.tssFormulas[activityType];

        if (formula && formula.formula !== 'heuristic') {
            return this.calculateTrainingStress(activity);
        }

        // For heuristic activities, use a scaled version
        return Math.round(this.calculateTrainingStress(activity) * 0.8);
    }

    /**
     * Estimate recovery time for activity
     * @param {Object} activity - Activity data
     * @returns {number} Recovery time in hours
     */
    estimateRecoveryTime(activity) {
        const activityType = activity.type;
        const recovery = this.recoveryEstimates[activityType] || this.recoveryEstimates.Run;

        const {baseHours} = recovery;
        const duration = activity.moving_time / 3600; // Convert to hours
        const distance = activity.distance / 1000; // Convert to km

        // Calculate intensity factor based on heart rate
        let intensityFactor = 1.0;
        if (activity.average_heartrate && activity.max_heartrate) {
            const hrRatio = activity.average_heartrate / activity.max_heartrate;
            intensityFactor = 1 + (hrRatio - 0.7) * recovery.intensityMultiplier;
        }

        // Calculate distance factor
        const distanceFactor = distance * recovery.distanceMultiplier;

        const totalRecovery = baseHours + (duration * recovery.intensityMultiplier) + distanceFactor;

        return Math.round(totalRecovery * 10) / 10; // Round to 1 decimal place
    }

    /**
     * Estimate perceived exertion based on activity data
     * @param {Object} activity - Activity data
     * @returns {number} Perceived exertion (1-10)
     */
    estimatePerceivedExertion(activity) {
        if (activity.average_heartrate && activity.max_heartrate) {
            const hrRatio = activity.average_heartrate / activity.max_heartrate;
            return Math.round(hrRatio * 10);
        }

        // Fallback based on duration and distance
        const duration = activity.moving_time / 3600; // Convert to hours
        const distance = activity.distance / 1000; // Convert to km

        if (duration > 2) {return 9;} // Long duration = high exertion
        if (distance > 20) {return 8;} // Long distance = high exertion
        if (duration > 1) {return 7;} // Medium duration = medium exertion
        if (distance > 10) {return 6;} // Medium distance = medium exertion

        return 5; // Default moderate exertion
    }

    /**
     * Suggest workout adjustment based on activity
     * @param {Object} activity - Activity data
     * @returns {Object} Workout adjustment recommendation
     */
    suggestAdjustment(activity) {
        for (const [ruleName, rule] of Object.entries(this.adjustmentRules)) {
            if (rule.condition(activity)) {
                return {
                    rule: ruleName,
                    adjustment: rule.adjustment,
                    message: rule.adjustment.message
                };
            }
        }

        return {
            rule: 'none',
            adjustment: { overallIntensity: 1.0 },
            message: 'No adjustment needed based on recent activities.'
        };
    }

    /**
     * Calculate pace for running activities
     * @param {Object} activity - Activity data
     * @returns {number} Pace in min/km
     */
    calculatePace(activity) {
        if (activity.type !== 'Run' || !activity.distance || !activity.moving_time) {
            return null;
        }

        const distanceKm = activity.distance / 1000;
        const durationMinutes = activity.moving_time / 60;

        return Math.round((durationMinutes / distanceKm) * 10) / 10; // Round to 1 decimal place
    }

    /**
     * Get user age for heart rate calculations
     * @returns {number} User age
     */
    getUserAge() {
        // This would typically come from user profile
        return 30; // Default age
    }

    /**
     * Sanitize activity data to prevent security issues
     * @param {Object} activity - Raw activity data
     * @returns {Object} Sanitized activity data
     */
    sanitizeActivityData(activity) {
        const sanitized = {};

        // Only allow specific fields and sanitize them
        const allowedFields = [
            'id', 'type', 'moving_time', 'elapsed_time', 'distance', 'calories',
            'average_heartrate', 'max_heartrate', 'total_elevation_gain',
            'start_date', 'avg_watts', 'weighted_avg_watts', 'source'
        ];

        for (const field of allowedFields) {
            if (activity.hasOwnProperty(field)) {
                const value = activity[field];

                // Sanitize string values
                if (typeof value === 'string') {
                    sanitized[field] = value.replace(/[<>\"'&]/g, '');
                } else if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
                    sanitized[field] = value;
                } else if (typeof value === 'boolean') {
                    sanitized[field] = value;
                } else if (value === null || value === undefined) {
                    sanitized[field] = value;
                }
            }
        }

        // Ensure required fields have defaults
        sanitized.source = sanitized.source || 'strava';
        sanitized.external_id = sanitized.id ? sanitized.id.toString() : '';

        return sanitized;
    }

    /**
     * Import Strava activities
     * @param {Array} activities - Array of Strava activities
     * @returns {Object} Import result
     */
    async importActivities(activities) {
        try {
            const processedActivities = [];
            const errors = [];

            for (const activity of activities) {
                const result = this.processActivity(activity);

                if (result.success) {
                    processedActivities.push(result.activity);

                    // Save to database
                    await this.saveActivity(result.activity);
                } else {
                    errors.push({ activityId: activity.id, error: result.error });
                }
            }

            this.logger.audit('STRAVA_ACTIVITIES_IMPORTED', {
                total: activities.length,
                processed: processedActivities.length,
                errors: errors.length
            });

            return {
                success: true,
                processed: processedActivities.length,
                errors: errors.length,
                activities: processedActivities,
                errorDetails: errors
            };
        } catch (error) {
            this.logger.error('Failed to import Strava activities', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save processed activity to database
     * @param {Object} activity - Processed activity data
     */
    async saveActivity(activity) {
        try {
            const activityData = {
                user_id: this.authManager?.getCurrentUsername() || 'anonymous',
                source: activity.source,
                external_id: activity.externalId,
                activity_type: activity.type || 'Unknown',
                start_time: activity.start_time,
                duration_seconds: activity.duration,
                distance_meters: activity.distance,
                calories: activity.calories,
                avg_heart_rate: activity.avgHeartRate,
                max_heart_rate: activity.maxHeartRate,
                training_stress_score: activity.trainingStress,
                recovery_debt_hours: activity.recoveryDebt,
                perceived_exertion: activity.perceivedExertion,
                source_load: activity.sourceLoad,
                raw_data: activity.rawData || {}
            };

            // Save to localStorage for now (would typically be database)
            const activities = this.storageManager?.get('external_activities', []);
            activities.push(activityData);
            this.storageManager?.set('external_activities', activities);

            this.logger.debug('Activity saved:', activityData);
        } catch (error) {
            this.logger.error('Failed to save activity', error);
        }
    }

    /**
     * Get recent activities for load calculation
     * @param {number} days - Number of days to look back
     * @returns {Array} Recent activities
     */
    getRecentActivities(days = 7) {
        try {
            const activities = this.storageManager?.get('external_activities', []);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            return activities.filter(activity => {
                const activityDate = new Date(activity.start_time);
                return activityDate >= cutoffDate;
            });
        } catch (error) {
            this.logger.error('Failed to get recent activities', error);
            return [];
        }
    }

    /**
     * Get activity summary for dashboard
     * @returns {Object} Activity summary
     */
    getActivitySummary() {
        try {
            const activities = this.getRecentActivities(30);

            const summary = {
                totalActivities: activities.length,
                totalDuration: activities.reduce((sum, activity) => sum + (activity.duration_seconds || 0), 0),
                totalDistance: activities.reduce((sum, activity) => sum + (activity.distance_meters || 0), 0),
                totalCalories: activities.reduce((sum, activity) => sum + (activity.calories || 0), 0),
                averageTSS: activities.length > 0
                    ? activities.reduce((sum, activity) => sum + (activity.training_stress_score || 0), 0) / activities.length
                    : 0,
                totalRecoveryDebt: activities.reduce((sum, activity) => sum + (activity.recovery_debt_hours || 0), 0),
                activityTypes: this.getActivityTypeBreakdown(activities)
            };

            return summary;
        } catch (error) {
            this.logger.error('Failed to get activity summary', error);
            return {};
        }
    }

    /**
     * Get breakdown of activity types
     * @param {Array} activities - Activities array
     * @returns {Object} Activity type breakdown
     */
    getActivityTypeBreakdown(activities) {
        const breakdown = {};

        activities.forEach(activity => {
            const type = activity.activity_type;
            if (!breakdown[type]) {
                breakdown[type] = { count: 0, totalDuration: 0, totalTSS: 0 };
            }
            breakdown[type].count++;
            breakdown[type].totalDuration += activity.duration_seconds || 0;
            breakdown[type].totalTSS += activity.training_stress_score || 0;
        });

        return breakdown;
    }
    /**
     * MVP: Handle file upload for Strava JSON export
     * @param {File} file - Uploaded file
     * @returns {Promise<Object>} Processing results
     */
    async handleFileUpload(file) {
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            if (!file.name.endsWith('.json')) {
                throw new Error('File must be a JSON file');
            }

            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);

            // Handle different Strava export formats
            let activities = [];
            if (Array.isArray(data)) {
                activities = data;
            } else if (data.activities && Array.isArray(data.activities)) {
                activities = data.activities;
            } else {
                throw new Error('Invalid Strava export format');
            }

            return await this.processActivitiesFromFile(activities);
        } catch (error) {
            this.logger.error('Failed to handle file upload', error);
            throw error;
        }
    }

    /**
     * MVP: Process activities from file upload with deduplication
     * @param {Array} activities - Array of Strava activity objects
     * @returns {Promise<Object>} Processing results
     */
    async processActivitiesFromFile(activities) {
        try {
            this.logger.debug('Processing Strava activities from file', { count: activities.length });

            const processedActivities = [];
            const duplicates = [];
            const errors = [];

            for (const activity of activities) {
                try {
                    // Check for duplicates using MVP deduplication
                    const dedupeKey = this.getDedupeKey(activity);
                    if (this.uploadedActivities.has(dedupeKey)) {
                        duplicates.push(activity);
                        continue;
                    }

                    // Process activity using existing method
                    const processed = this.processActivity(activity);
                    if (processed) {
                        // Add simple training load for MVP
                        processed.simpleTrainingLoad = this.calculateSimpleTrainingLoad(processed);

                        processedActivities.push(processed);
                        this.uploadedActivities.add(dedupeKey);
                    }
                } catch (error) {
                    this.logger.error('Failed to process activity', { activity, error });
                    errors.push({ activity, error: error.message });
                }
            }

            // Save to storage using MVP storage
            if (processedActivities.length > 0) {
                await this.saveExternalActivities(processedActivities);
            }

            const result = {
                processed: processedActivities.length,
                duplicates: duplicates.length,
                errors: errors.length,
                activities: processedActivities
            };

            this.logger.info('Strava file processing complete', result);
            return result;

        } catch (error) {
            this.logger.error('Failed to process Strava activities from file', error);
            throw error;
        }
    }

    /**
     * MVP: Get deduplication key for activity
     * @param {Object} activity - Strava activity
     * @returns {string} Deduplication key
     */
    getDedupeKey(activity) {
        const type = this.mapActivityType(activity.type);
        const startTime = this.parseStartTime(activity.start_date_local);
        const duration = this.parseDuration(activity.moving_time || activity.elapsed_time);

        return `${type}_${startTime}_${duration}`;
    }

    /**
     * MVP: Map Strava activity type to internal type
     * @param {string} stravaType - Strava activity type
     * @returns {string} Internal activity type
     */
    mapActivityType(stravaType) {
        const typeMap = {
            'Run': 'run',
            'TrailRun': 'run',
            'Treadmill': 'run',
            'Ride': 'cycle',
            'VirtualRide': 'cycle',
            'IndoorRide': 'cycle',
            'Swim': 'swim',
            'WeightTraining': 'strength',
            'Workout': 'strength',
            'Yoga': 'recovery',
            'Stretching': 'recovery',
            'Walk': 'recovery'
        };

        return typeMap[stravaType] || 'other';
    }

    /**
     * MVP: Parse duration from Strava format
     * @param {number} seconds - Duration in seconds
     * @returns {number} Duration in minutes
     */
    parseDuration(seconds) {
        if (!seconds || seconds <= 0) {return null;}
        return Math.round(seconds / 60);
    }

    /**
     * MVP: Parse start time from Strava format
     * @param {string} dateString - ISO date string
     * @returns {string} ISO date string
     */
    parseStartTime(dateString) {
        if (!dateString) {return null;}

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {return null;}
            return date.toISOString();
        } catch (error) {
            this.logger.warn('Invalid date format', { dateString, error });
            return null;
        }
    }

    /**
     * MVP: Calculate simple training load score (0-100)
     * @param {Object} activity - Processed activity
     * @returns {number} Simple training load score
     */
    calculateSimpleTrainingLoad(activity) {
        const { type, duration, distance, avgHeartRate } = activity;

        let baseLoad = 0;

        // Base load by activity type
        const typeMultipliers = {
            'run': 1.0,
            'cycle': 0.8,
            'swim': 0.9,
            'strength': 1.2,
            'recovery': 0.3,
            'other': 0.5
        };

        baseLoad = typeMultipliers[type] || 0.5;

        // Duration factor (logarithmic)
        const durationFactor = Math.log10(Math.max(duration, 1)) / 2; // 0-1 range

        // Distance factor for cardio activities
        let distanceFactor = 0;
        if (['run', 'cycle', 'swim'].includes(type) && distance) {
            distanceFactor = Math.min(distance / 10000, 1); // 0-1 range, max at 10km
        }

        // Heart rate factor (if available)
        let hrFactor = 0;
        if (avgHeartRate && avgHeartRate > 0) {
            // Assume max HR of 200 for calculation
            const hrPercent = Math.min(avgHeartRate / 200, 1);
            hrFactor = hrPercent * 0.5; // 0-0.5 range
        }

        // Combine factors
        const totalLoad = baseLoad * (durationFactor + distanceFactor + hrFactor) * 20;

        // Clamp to 0-100 range
        return Math.max(0, Math.min(100, Math.round(totalLoad)));
    }

    /**
     * MVP: Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * MVP: Save external activities to storage
     * @param {Array} activities - Processed activities
     * @returns {Promise<void>}
     */
    async saveExternalActivities(activities) {
        try {
            const userId = this.authManager?.getCurrentUsername() || 'anonymous';

            // Get existing external activities
            const existing = this.storageManager.getStorage('ignitefitness_external_activities', {});
            const userActivities = existing[userId] || [];

            // Add new activities
            userActivities.push(...activities);

            // Keep only last 100 activities
            if (userActivities.length > 100) {
                userActivities.splice(0, userActivities.length - 100);
            }

            // Save back to storage
            existing[userId] = userActivities;
            this.storageManager.setStorage('ignitefitness_external_activities', existing);

            // Update last import time
            await this.updateLastImportTime();

            this.logger.debug('Saved external activities', { count: activities.length });
        } catch (error) {
            this.logger.error('Failed to save external activities', error);
            throw error;
        }
    }

    /**
     * MVP: Update last import time
     * @returns {Promise<void>}
     */
    async updateLastImportTime() {
        try {
            const userId = this.authManager?.getCurrentUsername() || 'anonymous';
            const importTimes = this.storageManager.getStorage('ignitefitness_strava_import_times', {});

            importTimes[userId] = new Date().toISOString();
            this.storageManager.setStorage('ignitefitness_strava_import_times', importTimes);
        } catch (error) {
            this.logger.error('Failed to update import time', error);
        }
    }

    /**
     * MVP: Get last import time
     * @returns {string|null} Last import time or null
     */
    getLastImportTime() {
        try {
            const userId = this.authManager?.getCurrentUsername() || 'anonymous';
            const importTimes = this.storageManager.getStorage('ignitefitness_strava_import_times', {});

            return importTimes[userId] || null;
        } catch (error) {
            this.logger.error('Failed to get import time', error);
            return null;
        }
    }

    /**
     * MVP: Get external activities for user
     * @param {string} userId - User ID
     * @returns {Array} External activities
     */
    getExternalActivities(userId = null) {
        try {
            const targetUserId = userId || this.authManager?.getCurrentUsername() || 'anonymous';
            const allActivities = this.storageManager.getStorage('ignitefitness_external_activities', {});

            return allActivities[targetUserId] || [];
        } catch (error) {
            this.logger.error('Failed to get external activities', error);
            return [];
        }
    }

    /**
     * MVP: Remove external activity
     * @param {string} activityId - Activity ID to remove
     * @returns {Promise<boolean>} Success status
     */
    async removeExternalActivity(activityId) {
        try {
            const userId = this.authManager?.getCurrentUsername() || 'anonymous';
            const allActivities = this.storageManager.getStorage('ignitefitness_external_activities', {});
            const userActivities = allActivities[userId] || [];

            const index = userActivities.findIndex(a => a.id === activityId);
            if (index === -1) {
                this.logger.warn('Activity not found for removal', { activityId });
                return false;
            }

            userActivities.splice(index, 1);
            allActivities[userId] = userActivities;
            this.storageManager.setStorage('ignitefitness_external_activities', allActivities);

            this.logger.info('Removed external activity', { activityId });
            return true;
        } catch (error) {
            this.logger.error('Failed to remove external activity', error);
            return false;
        }
    }

    /**
     * MVP: Get activities affecting readiness (last 7 days)
     * @param {string} userId - User ID
     * @returns {Array} Recent activities
     */
    getRecentActivities(userId = null) {
        try {
            const activities = this.getExternalActivities(userId);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            return activities.filter(activity => {
                const activityDate = new Date(activity.startTime);
                return activityDate >= sevenDaysAgo;
            });
        } catch (error) {
            this.logger.error('Failed to get recent activities', error);
            return [];
        }
    }

    /**
     * MVP: Calculate weekly load from external activities
     * @param {string} userId - User ID
     * @returns {number} Weekly load score
     */
    calculateWeeklyLoad(userId = null) {
        try {
            const recentActivities = this.getRecentActivities(userId);

            return recentActivities.reduce((total, activity) => {
                return total + (activity.simpleTrainingLoad || 0);
            }, 0);
        } catch (error) {
            this.logger.error('Failed to calculate weekly load', error);
            return 0;
        }
    }
}

// Create global instance
window.StravaProcessor = new StravaDataProcessor();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StravaDataProcessor;
}
