/**
 * DailyCheckIn - Handles daily readiness assessment and workout adjustments
 * Manages sleep, stress, energy, and soreness tracking with smart adjustments
 */
class DailyCheckIn {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.authManager = window.AuthManager;
        this.workoutTracker = window.WorkoutTracker;
        this.storageManager = window.StorageManager;
        
        this.checkInData = {
            sleepHours: 8,
            sleepQuality: 5,
            stressLevel: 5,
            energyLevel: 5,
            sorenessLevel: 5
        };
        
        this.descriptions = this.initializeDescriptions();
        this.adjustmentRules = this.initializeAdjustmentRules();
    }

    /**
     * Initialize slider descriptions
     * @returns {Object} Descriptions for each metric
     */
    initializeDescriptions() {
        return {
            sleep: {
                hours: {
                    min: 4,
                    max: 12,
                    step: 0.5,
                    label: 'Sleep Hours'
                },
                quality: {
                    min: 1,
                    max: 10,
                    descriptions: {
                        1: '😴 Terrible sleep, tossing and turning',
                        2: '😴 Poor sleep, frequent wake-ups',
                        3: '😴 Restless sleep, not refreshing',
                        4: '😴 Below average sleep quality',
                        5: '😐 Average sleep, okay rest',
                        6: '😐 Decent sleep, somewhat refreshing',
                        7: '😴 Good sleep, well rested',
                        8: '😴 Very good sleep, very refreshed',
                        9: '😴 Excellent sleep, completely refreshed',
                        10: '😴 Perfect sleep, incredibly refreshed'
                    }
                }
            },
            stress: {
                min: 1,
                max: 10,
                descriptions: {
                    1: '😌 Completely relaxed, no worries',
                    2: '😌 Very relaxed, minimal stress',
                    3: '😌 Mostly relaxed, slight concerns',
                    4: '😐 Some stress, manageable',
                    5: '😟 Moderate stress, affecting focus',
                    6: '😟 Noticeable stress, harder to focus',
                    7: '😟 High stress, significantly affecting mood',
                    8: '😟 Very high stress, difficult to concentrate',
                    9: '🤯 Extreme stress, overwhelming feelings',
                    10: '🤯 Overwhelming stress, can\'t function'
                }
            },
            energy: {
                min: 1,
                max: 10,
                descriptions: {
                    1: '😴 Exhausted, can barely move',
                    2: '😴 Very tired, minimal energy',
                    3: '😴 Tired, low energy levels',
                    4: '😐 Below average energy',
                    5: '😐 Average energy, feeling okay',
                    6: '😐 Good energy, feeling decent',
                    7: '⚡ High energy, feeling good',
                    8: '⚡ Very high energy, feeling great',
                    9: '⚡ Excellent energy, feeling fantastic',
                    10: '⚡ Incredible energy, could run a marathon'
                }
            },
            soreness: {
                min: 1,
                max: 10,
                descriptions: {
                    1: '💪 Feel amazing, no soreness',
                    2: '💪 Very good, minimal soreness',
                    3: '💪 Good, slight soreness',
                    4: '😐 Some soreness, noticeable',
                    5: '😐 Moderate soreness, aware of it',
                    6: '😐 Noticeable soreness, affecting movement',
                    7: '😵 High soreness, difficult to move',
                    8: '😵 Very high soreness, limited movement',
                    9: '😵 Extreme soreness, barely can move',
                    10: '😵 Extreme soreness, can\'t move normally'
                }
            }
        };
    }

    /**
     * Initialize workout adjustment rules
     * @returns {Object} Adjustment rules and logic
     */
    initializeAdjustmentRules() {
        return {
            intensityReduction: {
                sleepHours: { threshold: 6, reduction: 0.2 },
                stressLevel: { threshold: 7, reduction: 0.2 },
                energyLevel: { threshold: 4, reduction: 0.2 }
            },
            recoveryWorkout: {
                sorenessLevel: { threshold: 7 }
            },
            coachMessages: {
                intensityReduced: 'Based on your readiness, let\'s take it easier today',
                recoverySuggested: 'High soreness detected - focusing on mobility and recovery',
                excellentReadiness: 'You\'re feeling great! Let\'s push for a strong workout',
                goodReadiness: 'Good readiness today - standard workout intensity',
                moderateReadiness: 'Moderate readiness - we\'ll adjust the workout accordingly'
            }
        };
    }

    /**
     * Check if user has completed today's check-in
     * @returns {boolean} Has completed check-in
     */
    hasCompletedTodayCheckIn() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const lastCheckIn = localStorage.getItem('ignitefitness_last_checkin');
            return lastCheckIn === today;
        } catch (error) {
            this.logger.error('Failed to check today\'s check-in status', error);
            return false;
        }
    }

    /**
     * Start daily check-in process
     * @returns {Object} Start result
     */
    startDailyCheckIn() {
        try {
            if (this.hasCompletedTodayCheckIn()) {
                return { 
                    success: false, 
                    error: 'Check-in already completed today',
                    alreadyCompleted: true 
                };
            }

            this.logger.audit('DAILY_CHECKIN_STARTED', { 
                userId: this.authManager?.getCurrentUsername() 
            });
            this.eventBus?.emit('checkin:started');
            
            return { success: true, data: this.checkInData };
        } catch (error) {
            this.logger.error('Failed to start daily check-in', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Update check-in data
     * @param {string} metric - Metric to update
     * @param {number} value - New value
     * @returns {Object} Update result
     */
    updateCheckInData(metric, value) {
        try {
            if (!this.checkInData.hasOwnProperty(metric)) {
                return { success: false, error: 'Invalid metric' };
            }

            this.checkInData[metric] = value;
            
            this.logger.debug('Check-in data updated', { metric, value });
            this.eventBus?.emit('checkin:dataUpdated', { metric, value, data: this.checkInData });
            
            return { success: true, data: this.checkInData };
        } catch (error) {
            this.logger.error('Failed to update check-in data', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate readiness score
     * @param {Object} data - Check-in data
     * @returns {number} Readiness score (1-10)
     */
    calculateReadinessScore(data = this.checkInData) {
        try {
            const { sleepHours, sleepQuality, stressLevel, energyLevel, sorenessLevel } = data;
            
            // Calculate weighted score
            const sleepScore = Math.min(10, (sleepHours / 8) * 5 + (sleepQuality / 10) * 5);
            const stressScore = 11 - stressLevel; // Invert stress (lower is better)
            const energyScore = energyLevel;
            const sorenessScore = 11 - sorenessLevel; // Invert soreness (lower is better)
            
            const readinessScore = Math.round(
                (sleepScore + stressScore + energyScore + sorenessScore) / 4
            );
            
            return Math.max(1, Math.min(10, readinessScore));
        } catch (error) {
            this.logger.error('Failed to calculate readiness score', error);
            return 5; // Default moderate score
        }
    }

    /**
     * Get workout adjustments based on readiness
     * @param {Object} data - Check-in data
     * @returns {Object} Workout adjustments
     */
    getWorkoutAdjustments(data = this.checkInData) {
        try {
            const adjustments = {
                intensityMultiplier: 1.0,
                workoutType: 'standard',
                coachMessage: '',
                recoverySuggested: false,
                intensityReduced: false
            };

            const { sleepHours, stressLevel, energyLevel, sorenessLevel } = data;
            const readinessScore = this.calculateReadinessScore(data);

            // Check for intensity reduction triggers
            if (sleepHours < 6 || stressLevel > 7 || energyLevel < 4) {
                adjustments.intensityMultiplier *= 0.8;
                adjustments.intensityReduced = true;
                adjustments.coachMessage = this.adjustmentRules.coachMessages.intensityReduced;
            }

            // Check for recovery workout suggestion
            if (sorenessLevel > 7) {
                adjustments.workoutType = 'recovery';
                adjustments.recoverySuggested = true;
                adjustments.coachMessage = this.adjustmentRules.coachMessages.recoverySuggested;
            }

            // Set coach message based on readiness score
            if (!adjustments.coachMessage) {
                if (readinessScore >= 8) {
                    adjustments.coachMessage = this.adjustmentRules.coachMessages.excellentReadiness;
                } else if (readinessScore >= 6) {
                    adjustments.coachMessage = this.adjustmentRules.coachMessages.goodReadiness;
                } else {
                    adjustments.coachMessage = this.adjustmentRules.coachMessages.moderateReadiness;
                }
            }

            this.logger.debug('Workout adjustments calculated', { 
                readinessScore, 
                adjustments 
            });

            return adjustments;
        } catch (error) {
            this.logger.error('Failed to calculate workout adjustments', error);
            return {
                intensityMultiplier: 1.0,
                workoutType: 'standard',
                coachMessage: 'Ready for your workout!',
                recoverySuggested: false,
                intensityReduced: false
            };
        }
    }

    /**
     * Complete daily check-in
     * @returns {Object} Completion result
     */
    completeDailyCheckIn() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const readinessScore = this.calculateReadinessScore();
            const adjustments = this.getWorkoutAdjustments();

            const checkInRecord = {
                date: today,
                sleepHours: this.checkInData.sleepHours,
                sleepQuality: this.checkInData.sleepQuality,
                stressLevel: this.checkInData.stressLevel,
                energyLevel: this.checkInData.energyLevel,
                sorenessLevel: this.checkInData.sorenessLevel,
                readinessScore: readinessScore,
                adjustments: adjustments,
                completedAt: new Date().toISOString()
            };

            // Save to localStorage
            localStorage.setItem('ignitefitness_last_checkin', today);
            localStorage.setItem('ignitefitness_checkin_data', JSON.stringify(checkInRecord));

            // Save to IndexedDB for offline storage
            if (this.storageManager) {
                this.storageManager.addToSyncQueue('daily_checkin', checkInRecord);
            }

            this.logger.audit('DAILY_CHECKIN_COMPLETED', { 
                userId: this.authManager?.getCurrentUsername(),
                readinessScore,
                adjustments: adjustments.workoutType
            });
            this.eventBus?.emit('checkin:completed', checkInRecord);

            return { 
                success: true, 
                checkInRecord,
                adjustments,
                message: 'Daily check-in completed successfully!' 
            };
        } catch (error) {
            this.logger.error('Failed to complete daily check-in', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get today's check-in data
     * @returns {Object|null} Today's check-in data
     */
    getTodayCheckIn() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const stored = localStorage.getItem('ignitefitness_checkin_data');
            
            if (stored) {
                const data = JSON.parse(stored);
                if (data.date === today) {
                    return data;
                }
            }
            
            return null;
        } catch (error) {
            this.logger.error('Failed to get today\'s check-in', error);
            return null;
        }
    }

    /**
     * Get readiness trend over time
     * @param {number} days - Number of days to look back
     * @returns {Array} Readiness trend data
     */
    getReadinessTrend(days = 7) {
        try {
            // This would typically fetch from server/IndexedDB
            // For now, return mock data
            const trend = [];
            const today = new Date();
            
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                
                trend.push({
                    date: date.toISOString().split('T')[0],
                    readinessScore: Math.floor(Math.random() * 4) + 6, // 6-10 range
                    sleepHours: 7 + Math.random() * 2, // 7-9 range
                    energyLevel: Math.floor(Math.random() * 3) + 6, // 6-8 range
                    stressLevel: Math.floor(Math.random() * 3) + 3 // 3-5 range
                });
            }
            
            return trend;
        } catch (error) {
            this.logger.error('Failed to get readiness trend', error);
            return [];
        }
    }

    /**
     * Get slider description for metric and value
     * @param {string} metric - Metric name
     * @param {number} value - Current value
     * @returns {string} Description
     */
    getSliderDescription(metric, value) {
        try {
            const descriptions = this.descriptions[metric];
            if (!descriptions) return '';

            if (metric === 'sleep' && descriptions.quality) {
                return descriptions.quality.descriptions[Math.round(value)] || '';
            } else if (descriptions.descriptions) {
                return descriptions.descriptions[Math.round(value)] || '';
            }
            
            return '';
        } catch (error) {
            this.logger.error('Failed to get slider description', error);
            return '';
        }
    }

    /**
     * Get slider configuration for metric
     * @param {string} metric - Metric name
     * @returns {Object} Slider configuration
     */
    getSliderConfig(metric) {
        try {
            const descriptions = this.descriptions[metric];
            if (!descriptions) return null;

            if (metric === 'sleep') {
                return {
                    hours: descriptions.hours,
                    quality: descriptions.quality
                };
            } else {
                return {
                    min: descriptions.min,
                    max: descriptions.max,
                    descriptions: descriptions.descriptions
                };
            }
        } catch (error) {
            this.logger.error('Failed to get slider config', error);
            return null;
        }
    }

    /**
     * Skip daily check-in
     * @returns {Object} Skip result
     */
    skipDailyCheckIn() {
        try {
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('ignitefitness_last_checkin', today);
            
            this.logger.audit('DAILY_CHECKIN_SKIPPED', { 
                userId: this.authManager?.getCurrentUsername() 
            });
            this.eventBus?.emit('checkin:skipped');
            
            return { success: true, message: 'Check-in skipped for today' };
        } catch (error) {
            this.logger.error('Failed to skip daily check-in', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Reset check-in data
     * @returns {Object} Reset result
     */
    resetCheckInData() {
        try {
            this.checkInData = {
                sleepHours: 8,
                sleepQuality: 5,
                stressLevel: 5,
                energyLevel: 5,
                sorenessLevel: 5
            };
            
            this.logger.debug('Check-in data reset');
            this.eventBus?.emit('checkin:dataReset');
            
            return { success: true, data: this.checkInData };
        } catch (error) {
            this.logger.error('Failed to reset check-in data', error);
            return { success: false, error: error.message };
        }
    }
}

// Create global instance
window.DailyCheckIn = new DailyCheckIn();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DailyCheckIn;
}
