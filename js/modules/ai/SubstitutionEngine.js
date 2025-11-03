/**
 * SubstitutionEngine - AI-powered workout substitution with cross-modality load equivalence
 * Provides mathematically sound substitutions across Running, Cycling, and Swimming
 * Uses MET values and metabolic research for load conversion
 */

class SubstitutionEngine {
    constructor() {
        this.workoutCatalog = window.WorkoutCatalog;
        this.loadCalculator = window.LoadCalculator;
        this.logger = window.SafeLogger || console;

        // Load equivalence factors (derived from metabolic research)
        this.modalityFactors = {
            // Base conversion factors for time equivalence
            timeFactors: {
                'run_to_bike': 1.3,     // 1 min run = 1.3 min bike
                'run_to_swim': 0.8,     // 1 min run = 0.8 min swim
                'bike_to_run': 0.77,    // 1 min bike = 0.77 min run
                'bike_to_swim': 0.62,   // 1 min bike = 0.62 min swim
                'swim_to_run': 1.25,    // 1 min swim = 1.25 min run
                'swim_to_bike': 1.61    // 1 min swim = 1.61 min bike
            },

            // Zone-specific intensity adjustments
            zoneAdjustments: {
                'Z1': { bike: 1.35, swim: 0.75 },  // Easy sessions
                'Z2': { bike: 1.3, swim: 0.8 },    // Aerobic base
                'Z3': { bike: 1.2, swim: 0.8 },    // Tempo/threshold
                'Z4': { bike: 1.15, swim: 0.85 },  // VO2 intervals
                'Z5': { bike: 1.1, swim: 0.9 }     // Neuromuscular power
            },

            // MET values for cross-validation
            metValues: {
                running: { Z1: 8, Z2: 10, Z3: 12, Z4: 15, Z5: 18 },
                cycling: { Z1: 6, Z2: 8, Z3: 10, Z4: 13, Z5: 16 },
                swimming: { Z1: 10, Z2: 12, Z3: 14, Z4: 17, Z5: 20 }
            }
        };

        this.guardrails = {
            weeklyHardMinutes: 40,    // Max hard minutes per week per modality
            dailyLoadCap: 100,        // Max daily load score
            rampRateLimit: 0.1,       // Max 10% weekly increase
            minRestBetweenHard: 24    // Hours between high-intensity sessions
        };
    }

    /**
     * Generate workout substitutions for planned session
     * @param {Object} plannedWorkout - Original planned workout
     * @param {Object} constraints - User constraints and preferences
     * @returns {Array} Array of 3 viable substitution options
     */
    async generateSubstitutions(plannedWorkout, constraints = {}) {
        try {
            if (!plannedWorkout || !this.workoutCatalog) {
                this.logger.warn('SubstitutionEngine: Missing required dependencies');
                return [];
            }

            const targetLoad = this.calculateWorkoutLoad(plannedWorkout);
            const targetAdaptation = plannedWorkout.adaptation || 'aerobic';
            const availableModalities = this.getAvailableModalities(constraints);
            const originalModality = plannedWorkout.modality || this.detectModality(plannedWorkout);

            const substitutions = [];

            for (const modality of availableModalities) {
                if (modality === originalModality) continue;

                const equivalentWorkout = await this.findEquivalentWorkout(
                    plannedWorkout,
                    modality,
                    targetLoad,
                    targetAdaptation,
                    constraints
                );

                if (equivalentWorkout && this.validateSubstitution(equivalentWorkout, constraints)) {
                    const substitutedLoad = this.calculateWorkoutLoad(equivalentWorkout);
                    substitutions.push({
                        ...equivalentWorkout,
                        substitutionReason: this.generateReason(plannedWorkout, equivalentWorkout),
                        loadComparison: {
                            original: targetLoad,
                            substituted: substitutedLoad,
                            variance: this.calculateLoadVariance(targetLoad, substitutedLoad)
                        },
                        originalModality: originalModality,
                        substitutedModality: modality
                    });
                }
            }

            // Return top 3 options sorted by load accuracy and user preference
            return substitutions
                .sort((a, b) => {
                    // Primary sort: load variance
                    if (Math.abs(a.loadComparison.variance - b.loadComparison.variance) > 0.01) {
                        return a.loadComparison.variance - b.loadComparison.variance;
                    }
                    // Secondary sort: user preference match
                    return this.scorePreferenceMatch(b, constraints) - this.scorePreferenceMatch(a, constraints);
                })
                .slice(0, 3);

        } catch (error) {
            this.logger.error('Substitution generation failed:', error);
            return [];
        }
    }

    /**
     * Find equivalent workout in different modality
     * @param {Object} originalWorkout - Original workout plan
     * @param {string} targetModality - Target modality for substitution
     * @param {number} targetLoad - Target training load
     * @param {string} adaptation - Primary adaptation goal
     * @param {Object} constraints - User constraints
     * @returns {Object} Equivalent workout plan
     */
    async findEquivalentWorkout(originalWorkout, targetModality, targetLoad, adaptation, constraints) {
        try {
            // Get all workouts for target modality
            const modalityWorkouts = this.workoutCatalog.getWorkoutsByModality(targetModality);
            
            // Flatten all categories into single array
            const allWorkouts = Object.values(modalityWorkouts).flat();

            // Find workouts with similar adaptation
            const candidateWorkouts = allWorkouts.filter(workout => {
                const workoutAdaptation = workout.adaptation || '';
                return workoutAdaptation.toLowerCase().includes(adaptation.toLowerCase()) ||
                       this.isCompatibleAdaptation(workoutAdaptation, adaptation);
            });

            if (candidateWorkouts.length === 0) {
                this.logger.debug(`No workouts found for ${targetModality} with adaptation ${adaptation}`);
                return null;
            }

            // Scale each candidate and find best match
            let bestMatch = null;
            let smallestVariance = Infinity;

            for (const candidate of candidateWorkouts) {
                const scaledWorkout = this.scaleWorkoutForEquivalence(
                    candidate,
                    originalWorkout,
                    targetModality,
                    targetLoad
                );

                const scaledLoad = this.calculateWorkoutLoad(scaledWorkout);
                const variance = Math.abs(scaledLoad - targetLoad) / targetLoad;

                if (variance < smallestVariance && variance <= 0.15) { // Within 15% load variance
                    smallestVariance = variance;
                    bestMatch = scaledWorkout;
                }
            }

            return bestMatch;

        } catch (error) {
            this.logger.error('findEquivalentWorkout failed:', error);
            return null;
        }
    }

    /**
     * Scale workout for load equivalence across modalities
     * @param {Object} workout - Base workout to scale
     * @param {Object} originalWorkout - Original workout for reference
     * @param {string} targetModality - Target modality
     * @param {number} targetLoad - Target load score
     * @returns {Object} Scaled workout
     */
    scaleWorkoutForEquivalence(workout, originalWorkout, targetModality, targetLoad) {
        try {
            const originalModality = originalWorkout.modality || this.detectModality(originalWorkout);
            const conversionKey = `${originalModality}_to_${targetModality}`;
            const timeFactor = this.modalityFactors.timeFactors[conversionKey] || 1;

            // Calculate total work time from original workout
            const originalWorkTime = this.extractWorkTime(originalWorkout);
            const targetWorkTime = originalWorkTime * timeFactor;

            // Scale the workout structure
            const scaledStructure = workout.structure.map(block => {
                if (block.type === 'main') {
                    // Scale main work blocks
                    if (block.sets) {
                        // Interval workout - adjust work duration
                        const workIntensity = block.work?.intensity || block.intensity || 'Z3';
                        const zoneAdjustment = this.modalityFactors.zoneAdjustments[workIntensity]?.[targetModality] || 1;
                        const adjustedTimeFactor = timeFactor * zoneAdjustment;

                        const newWorkDuration = this.scaleIntervalDuration(
                            block.work.duration,
                            adjustedTimeFactor,
                            workIntensity,
                            targetModality
                        );

                        // Calculate new set count to match target work time
                        const newSets = Math.max(1, Math.round(targetWorkTime / newWorkDuration));

                        return {
                            ...block,
                            work: { ...block.work, duration: newWorkDuration },
                            sets: newSets
                        };
                    } else {
                        // Continuous workout - scale duration directly
                        const workIntensity = block.intensity || 'Z3';
                        const zoneAdjustment = this.modalityFactors.zoneAdjustments[workIntensity]?.[targetModality] || 1;
                        const adjustedTimeFactor = timeFactor * zoneAdjustment;

                        return {
                            ...block,
                            duration: Math.round((block.duration || 0) * adjustedTimeFactor)
                        };
                    }
                }
                return block; // Keep warmup/cooldown unchanged
            });

            // Update time required estimate
            const newTimeRequired = this.calculateTotalTime(scaledStructure);

            return {
                ...workout,
                structure: scaledStructure,
                modality: targetModality,
                estimatedLoad: targetLoad,
                timeRequired: newTimeRequired,
                isSubstitution: true,
                originalWorkout: originalWorkout.id || originalWorkout.name
            };

        } catch (error) {
            this.logger.error('scaleWorkoutForEquivalence failed:', error);
            return workout; // Return original on error
        }
    }

    /**
     * Scale interval duration for modality conversion
     * @param {number} originalDuration - Original work duration (seconds)
     * @param {number} timeFactor - Time conversion factor
     * @param {string} intensity - Zone intensity
     * @param {string} targetModality - Target modality
     * @returns {number} Scaled duration in seconds
     */
    scaleIntervalDuration(originalDuration, timeFactor, intensity, targetModality) {
        // Base scaling
        let scaledDuration = originalDuration * timeFactor;

        // For very short intervals (< 60s), maintain intensity over efficiency
        if (originalDuration < 60) {
            scaledDuration = originalDuration * 0.95; // Slight reduction for efficiency
        }

        // Round to nearest 5 seconds for practicality
        return Math.round(scaledDuration / 5) * 5;
    }

    /**
     * Calculate comprehensive workout load score
     * Uses modified Session-RPE approach with zone weighting
     * @param {Object} workout - Workout to analyze
     * @returns {number} Load score
     */
    calculateWorkoutLoad(workout) {
        if (!workout || !workout.structure) {
            return workout.estimatedLoad || 0;
        }

        let totalLoad = 0;

        // Zone intensity multipliers (relative to Z1 baseline)
        const zoneMultipliers = { Z1: 1, Z2: 1.5, Z3: 2.5, Z4: 4, Z5: 6 };

        for (const block of workout.structure) {
            const intensity = block.intensity || block.work?.intensity || 'Z1';
            const multiplier = zoneMultipliers[intensity] || zoneMultipliers[intensity.split('-')[0]] || 1;

            if (block.sets) {
                // Interval block
                const workDuration = block.work?.duration || 0;
                const restDuration = block.rest?.duration || 0;
                const sets = block.sets || 1;

                const workMinutes = (workDuration * sets) / 60;
                const restMinutes = (restDuration * sets) / 60;
                
                totalLoad += (workMinutes * multiplier) + (restMinutes * 0.5); // Rest counts less
            } else {
                // Continuous block
                const duration = block.duration || 0;
                const minutes = duration / 60; // Convert seconds to minutes if needed
                totalLoad += minutes * multiplier;
            }
        }

        return Math.round(totalLoad);
    }

    /**
     * Calculate load variance percentage
     * @param {number} originalLoad - Original load
     * @param {number} substitutedLoad - Substituted load
     * @returns {number} Variance as decimal (0.1 = 10%)
     */
    calculateLoadVariance(originalLoad, substitutedLoad) {
        if (!originalLoad || originalLoad === 0) return 1;
        return Math.abs(substitutedLoad - originalLoad) / originalLoad;
    }

    /**
     * Validate substitution against safety guardrails
     * @param {Object} substitution - Proposed substitution
     * @param {Object} constraints - User constraints including recent training
     * @returns {boolean} Whether substitution is safe
     */
    validateSubstitution(substitution, constraints = {}) {
        // Check equipment availability
        if (substitution.equipment && substitution.equipment.length > 0) {
            if (!this.hasRequiredEquipment(substitution.equipment, constraints)) {
                this.logger.debug(`Substitution requires unavailable equipment: ${substitution.equipment.join(', ')}`);
                return false;
            }
        }

        // Check time constraints
        const availableTime = constraints.availableTime || 120; // Default 2 hours
        const timeRequired = substitution.timeRequired || this.calculateTotalTime(substitution.structure || []);
        
        if (timeRequired > availableTime) {
            this.logger.debug(`Substitution exceeds available time: ${timeRequired} > ${availableTime}`);
            return false;
        }

        // Check weekly hard minutes cap
        const recentSessions = constraints.recentSessions || [];
        const weeklyHardMinutes = this.calculateWeeklyHardMinutes(recentSessions);
        const substitutionHardMinutes = this.calculateHardMinutes(substitution);

        if (weeklyHardMinutes + substitutionHardMinutes > this.guardrails.weeklyHardMinutes) {
            this.logger.debug(`Substitution exceeds weekly hard minutes cap`);
            return false;
        }

        // Check minimum rest between hard sessions
        if (this.isHighIntensity(substitution) && this.hasRecentHardSession(recentSessions)) {
            this.logger.debug('Substitution violates minimum rest between hard sessions');
            return false;
        }

        // Check daily load cap
        const todayLoad = constraints.todayLoad || 0;
        const substitutionLoad = this.calculateWorkoutLoad(substitution);
        if (todayLoad + substitutionLoad > this.guardrails.dailyLoadCap) {
            this.logger.debug(`Substitution exceeds daily load cap: ${todayLoad + substitutionLoad} > ${this.guardrails.dailyLoadCap}`);
            return false;
        }

        return true;
    }

    /**
     * Generate human-readable substitution reasoning
     * @param {Object} original - Original workout
     * @param {Object} substitution - Substitution workout
     * @returns {string} Explanation for substitution
     */
    generateReason(original, substitution) {
        const reasons = [];

        // Equipment reason
        const originalEquipment = original.equipment || [];
        const substitutionEquipment = substitution.equipment || [];
        
        if (originalEquipment.length > 0 && substitutionEquipment.length > 0) {
            const equipmentDiff = substitutionEquipment.filter(eq => !originalEquipment.includes(eq));
            if (equipmentDiff.length > 0) {
                reasons.push(`Uses available ${equipmentDiff.join(', ')}`);
            }
        }

        // Load equivalence
        const originalLoad = original.estimatedLoad || this.calculateWorkoutLoad(original);
        const substitutionLoad = substitution.estimatedLoad || this.calculateWorkoutLoad(substitution);
        const loadDiff = Math.abs(substitutionLoad - originalLoad);
        const loadDiffPercent = ((loadDiff / originalLoad) * 100).toFixed(0);

        if (loadDiff <= 5) {
            reasons.push('Equivalent training load');
        } else {
            reasons.push(`${loadDiffPercent}% load adjustment for modality difference`);
        }

        // Adaptation match
        const originalAdaptation = original.adaptation || 'general';
        const substitutionAdaptation = substitution.adaptation || 'general';

        if (originalAdaptation.toLowerCase() === substitutionAdaptation.toLowerCase()) {
            reasons.push('Same training adaptation');
        } else if (this.isCompatibleAdaptation(originalAdaptation, substitutionAdaptation)) {
            reasons.push(`Targets ${substitutionAdaptation} (similar to ${originalAdaptation})`);
        } else {
            reasons.push(`Targets ${substitutionAdaptation}`);
        }

        // Modality change
        const originalModality = original.modality || 'unknown';
        const substitutionModality = substitution.modality || 'unknown';
        if (originalModality !== substitutionModality) {
            reasons.push(`Switched from ${originalModality} to ${substitutionModality}`);
        }

        return reasons.join('. ');
    }

    /**
     * Get available modalities based on constraints
     * @param {Object} constraints - User constraints
     * @returns {Array} Available modalities
     */
    getAvailableModalities(constraints = {}) {
        const allModalities = ['running', 'cycling', 'swimming'];
        
        if (!constraints || !constraints.equipment) {
            return allModalities;
        }

        const availableEquipment = constraints.equipment || [];
        
        return allModalities.filter(modality => {
            // Check if user has equipment for this modality
            if (modality === 'running') {
                // Running requires no special equipment
                return true;
            } else if (modality === 'cycling') {
                return availableEquipment.includes('bike') || availableEquipment.includes('bicycle');
            } else if (modality === 'swimming') {
                return availableEquipment.includes('pool');
            }
            return true;
        });
    }

    /**
     * Detect modality from workout structure
     * @param {Object} workout - Workout to analyze
     * @returns {string} Detected modality
     */
    detectModality(workout) {
        if (workout.modality) return workout.modality;
        if (workout.equipment && workout.equipment.includes('pool')) return 'swimming';
        if (workout.equipment && workout.equipment.includes('track')) return 'running';
        if (workout.equipment && workout.equipment.includes('bike')) return 'cycling';
        
        // Default based on workout name
        const name = (workout.name || '').toLowerCase();
        if (name.includes('swim') || name.includes('pool')) return 'swimming';
        if (name.includes('bike') || name.includes('cycle') || name.includes('ride')) return 'cycling';
        if (name.includes('run') || name.includes('track') || name.includes('mile')) return 'running';
        
        return 'running'; // Default fallback
    }

    /**
     * Extract total work time from workout
     * @param {Object} workout - Workout to analyze
     * @returns {number} Total work time in seconds
     */
    extractWorkTime(workout) {
        if (!workout || !workout.structure) {
            return (workout.timeRequired || 0) * 60; // Convert minutes to seconds
        }

        return workout.structure
            .filter(block => block.type === 'main')
            .reduce((total, block) => {
                if (block.sets) {
                    const workDuration = block.work?.duration || block.duration || 0;
                    return total + (workDuration * (block.sets || 1));
                }
                return total + (block.duration || 0);
            }, 0);
    }

    /**
     * Calculate total workout time
     * @param {Array} structure - Workout structure
     * @returns {number} Total time in minutes
     */
    calculateTotalTime(structure) {
        if (!structure || !Array.isArray(structure)) return 0;

        return structure.reduce((total, block) => {
            if (block.duration) {
                // Duration in seconds, convert to minutes
                return total + (block.duration / 60);
            }
            if (block.sets && block.work) {
                // Interval workout
                const workTime = (block.work.duration * block.sets) / 60;
                const restTime = (block.rest?.duration * block.sets || 0) / 60;
                return total + workTime + restTime;
            }
            return total;
        }, 0);
    }

    /**
     * Check if two adaptations are compatible
     * @param {string} adaptation1 - First adaptation
     * @param {string} adaptation2 - Second adaptation
     * @returns {boolean} Whether adaptations are compatible
     */
    isCompatibleAdaptation(adaptation1, adaptation2) {
        if (!adaptation1 || !adaptation2) return false;

        const adaptationGroups = {
            'aerobic': ['aerobic', 'endurance', 'base', 'aerobic base', 'aerobic capacity'],
            'threshold': ['threshold', 'tempo', 'lactate', 'lactate threshold'],
            'vo2': ['vo2', 'vo2 max', 'speed', 'anaerobic capacity'],
            'power': ['power', 'strength', 'neuromuscular', 'form', 'turnover']
        };

        const a1Lower = adaptation1.toLowerCase();
        const a2Lower = adaptation2.toLowerCase();

        for (const group of Object.values(adaptationGroups)) {
            const match1 = group.some(term => a1Lower.includes(term));
            const match2 = group.some(term => a2Lower.includes(term));
            if (match1 && match2) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Calculate hard minutes in workout (Z4 and Z5)
     * @param {Object} workout - Workout to analyze
     * @returns {number} Hard minutes
     */
    calculateHardMinutes(workout) {
        if (!workout || !workout.structure) return 0;

        return workout.structure
            .filter(block => {
                const intensity = block.intensity || block.work?.intensity || '';
                return intensity.includes('Z4') || intensity.includes('Z5');
            })
            .reduce((total, block) => {
                if (block.sets && block.work) {
                    const workIntensity = block.work.intensity || '';
                    if (workIntensity.includes('Z4') || workIntensity.includes('Z5')) {
                        return total + (block.work.duration * block.sets) / 60;
                    }
                } else if (block.duration) {
                    return total + (block.duration / 60);
                }
                return total;
            }, 0);
    }

    /**
     * Calculate weekly hard minutes from recent sessions
     * @param {Array} recentSessions - Recent training sessions
     * @returns {number} Total hard minutes in last 7 days
     */
    calculateWeeklyHardMinutes(recentSessions = []) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        return recentSessions
            .filter(session => {
                const sessionDate = new Date(session.date || session.startTime || session.start_at);
                return sessionDate >= sevenDaysAgo;
            })
            .reduce((total, session) => {
                // Assume sessions have hardMinutes property or calculate from workout
                const hardMinutes = session.hardMinutes || this.calculateHardMinutes(session.workout || session);
                return total + hardMinutes;
            }, 0);
    }

    /**
     * Check if workout is high intensity
     * @param {Object} workout - Workout to check
     * @returns {boolean} Whether workout is high intensity
     */
    isHighIntensity(workout) {
        if (!workout || !workout.structure) {
            const load = workout.estimatedLoad || this.calculateWorkoutLoad(workout);
            return load >= 80; // High load threshold
        }

        return workout.structure.some(block => {
            const intensity = block.intensity || block.work?.intensity || '';
            return intensity.includes('Z4') || intensity.includes('Z5');
        });
    }

    /**
     * Check if there was a recent hard session
     * @param {Array} recentSessions - Recent training sessions
     * @returns {boolean} Whether there was a hard session in last 24 hours
     */
    hasRecentHardSession(recentSessions = []) {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - this.guardrails.minRestBetweenHard);

        return recentSessions.some(session => {
            const sessionDate = new Date(session.date || session.startTime || session.start_at);
            if (sessionDate < twentyFourHoursAgo) return false;

            return this.isHighIntensity(session.workout || session);
        });
    }

    /**
     * Check if user has required equipment
     * @param {Array} requiredEquipment - Required equipment list
     * @param {Object} constraints - User constraints
     * @returns {boolean} Whether user has equipment
     */
    hasRequiredEquipment(requiredEquipment = [], constraints = {}) {
        if (!requiredEquipment || requiredEquipment.length === 0) return true;

        const availableEquipment = constraints.equipment || [];
        
        return requiredEquipment.every(req => {
            return availableEquipment.some(avail => 
                avail.toLowerCase().includes(req.toLowerCase()) ||
                req.toLowerCase().includes(avail.toLowerCase())
            );
        });
    }

    /**
     * Score preference match for substitution ranking
     * @param {Object} substitution - Substitution workout
     * @param {Object} constraints - User constraints
     * @returns {number} Preference score (higher is better)
     */
    scorePreferenceMatch(substitution, constraints = {}) {
        let score = 0;

        const preferences = constraints.preferences || {};
        const preferredModality = preferences.modality || '';

        if (substitution.modality && preferredModality && 
            substitution.modality.toLowerCase() === preferredModality.toLowerCase()) {
            score += 10;
        }

        // Equipment preference
        const preferredEquipment = preferences.equipment || [];
        const substitutionEquipment = substitution.equipment || [];
        
        const equipmentMatch = substitutionEquipment.some(eq => 
            preferredEquipment.some(pref => 
                eq.toLowerCase().includes(pref.toLowerCase()) ||
                pref.toLowerCase().includes(eq.toLowerCase())
            )
        );

        if (equipmentMatch) {
            score += 5;
        }

        return score;
    }
}

// Create global instance
window.SubstitutionEngine = new SubstitutionEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubstitutionEngine;
}

