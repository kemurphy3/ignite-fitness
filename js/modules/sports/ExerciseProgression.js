/**
 * ExerciseProgression - Exercise progression and adaptation system
 * Manages exercise difficulty progression and individual adaptations
 */
class ExerciseProgression {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.soccerExercises = window.SoccerExercises;
        this.progressionRules = this.initializeProgressionRules();
        this.userProgressions = new Map();
    }

    /**
     * Initialize progression rules for different exercise types
     * @returns {Object} Progression rules
     */
    initializeProgressionRules() {
        return {
            strength: {
                progressionType: 'linear',
                loadIncrease: 0.05, // 5% per week
                volumeIncrease: 0.1, // 10% per week
                deloadFrequency: 4, // Every 4 weeks
                deloadPercentage: 0.8, // 80% of current load
                maxIncrease: 0.2, // Maximum 20% increase
                adaptationTime: 2 // Weeks to adapt to new load
            },
            conditioning: {
                progressionType: 'undulating',
                loadIncrease: 0.1, // 10% per week
                volumeIncrease: 0.15, // 15% per week
                deloadFrequency: 3, // Every 3 weeks
                deloadPercentage: 0.7, // 70% of current load
                maxIncrease: 0.25, // Maximum 25% increase
                adaptationTime: 1 // Week to adapt to new load
            },
            agility: {
                progressionType: 'step',
                loadIncrease: 0.15, // 15% per week
                volumeIncrease: 0.1, // 10% per week
                deloadFrequency: 2, // Every 2 weeks
                deloadPercentage: 0.8, // 80% of current load
                maxIncrease: 0.3, // Maximum 30% increase
                adaptationTime: 1 // Week to adapt to new load
            },
            ball_work: {
                progressionType: 'skill_based',
                loadIncrease: 0.1, // 10% per week
                volumeIncrease: 0.2, // 20% per week
                deloadFrequency: 3, // Every 3 weeks
                deloadPercentage: 0.8, // 80% of current load
                maxIncrease: 0.25, // Maximum 25% increase
                adaptationTime: 2 // Weeks to adapt to new load
            },
            position_specific: {
                progressionType: 'sport_specific',
                loadIncrease: 0.1, // 10% per week
                volumeIncrease: 0.15, // 15% per week
                deloadFrequency: 3, // Every 3 weeks
                deloadPercentage: 0.8, // 80% of current load
                maxIncrease: 0.2, // Maximum 20% increase
                adaptationTime: 2 // Weeks to adapt to new load
            }
        };
    }

    /**
     * Create progression plan for user
     * @param {string} userId - User ID
     * @param {string} sportId - Sport ID
     * @param {string} positionId - Position ID
     * @param {Object} userProfile - User profile
     * @returns {Object} Progression plan
     */
    createProgressionPlan(userId, sportId, positionId, userProfile) {
        const plan = {
            userId,
            sport: sportId,
            position: positionId,
            createdAt: new Date().toISOString(),
            currentPhase: 'base_building',
            phases: this.generateProgressionPhases(userProfile),
            adaptations: this.generateAdaptations(userProfile),
            milestones: this.generateMilestones(sportId, positionId, userProfile),
            tracking: this.initializeTracking()
        };

        this.userProgressions.set(userId, plan);

        this.logger.audit('PROGRESSION_PLAN_CREATED', {
            userId,
            sport: sportId,
            position: positionId
        });

        return plan;
    }

    /**
     * Generate progression phases based on user profile
     * @param {Object} userProfile - User profile
     * @returns {Array} Progression phases
     */
    generateProgressionPhases(userProfile) {
        const experience = userProfile.experience || 'beginner';
        const phases = [];

        if (experience === 'beginner') {
            phases.push(
                {
                    name: 'Foundation',
                    duration: '4-6 weeks',
                    focus: 'technique_mastery',
                    intensity: 'low_moderate',
                    volume: 'low_moderate',
                    exercises: this.getFoundationExercises(userProfile)
                },
                {
                    name: 'Adaptation',
                    duration: '4-6 weeks',
                    focus: 'strength_endurance',
                    intensity: 'moderate',
                    volume: 'moderate',
                    exercises: this.getAdaptationExercises(userProfile)
                },
                {
                    name: 'Progression',
                    duration: '4-6 weeks',
                    focus: 'strength_power',
                    intensity: 'moderate_high',
                    volume: 'moderate',
                    exercises: this.getProgressionExercises(userProfile)
                }
            );
        } else if (experience === 'intermediate') {
            phases.push(
                {
                    name: 'Base Building',
                    duration: '3-4 weeks',
                    focus: 'strength_endurance',
                    intensity: 'moderate',
                    volume: 'moderate_high',
                    exercises: this.getBaseBuildingExercises(userProfile)
                },
                {
                    name: 'Strength Development',
                    duration: '4-6 weeks',
                    focus: 'maximal_strength',
                    intensity: 'high',
                    volume: 'moderate',
                    exercises: this.getStrengthExercises(userProfile)
                },
                {
                    name: 'Power Development',
                    duration: '3-4 weeks',
                    focus: 'explosive_power',
                    intensity: 'very_high',
                    volume: 'moderate',
                    exercises: this.getPowerExercises(userProfile)
                }
            );
        } else { // Advanced
            phases.push(
                {
                    name: 'Preparation',
                    duration: '2-3 weeks',
                    focus: 'movement_preparation',
                    intensity: 'moderate',
                    volume: 'moderate',
                    exercises: this.getPreparationExercises(userProfile)
                },
                {
                    name: 'Overload',
                    duration: '4-6 weeks',
                    focus: 'maximal_adaptation',
                    intensity: 'very_high',
                    volume: 'high',
                    exercises: this.getOverloadExercises(userProfile)
                },
                {
                    name: 'Peak',
                    duration: '2-3 weeks',
                    focus: 'peak_performance',
                    intensity: 'extreme',
                    volume: 'moderate',
                    exercises: this.getPeakExercises(userProfile)
                },
                {
                    name: 'Taper',
                    duration: '1-2 weeks',
                    focus: 'recovery_preparation',
                    intensity: 'moderate',
                    volume: 'low',
                    exercises: this.getTaperExercises(userProfile)
                }
            );
        }

        return phases;
    }

    /**
     * Generate adaptations based on user profile
     * @param {Object} userProfile - User profile
     * @returns {Object} Adaptations
     */
    generateAdaptations(userProfile) {
        const adaptations = {
            age: this.getAgeAdaptations(userProfile.age),
            injuryHistory: this.getInjuryAdaptations(userProfile.injuryHistory),
            goals: this.getGoalAdaptations(userProfile.goals),
            timeConstraints: this.getTimeAdaptations(userProfile.timeConstraints),
            equipment: this.getEquipmentAdaptations(userProfile.availableEquipment)
        };

        return adaptations;
    }

    /**
     * Generate milestones for progression
     * @param {string} sportId - Sport ID
     * @param {string} positionId - Position ID
     * @param {Object} userProfile - User profile
     * @returns {Array} Milestones
     */
    generateMilestones(sportId, positionId, userProfile) {
        const milestones = [];
        const experience = userProfile.experience || 'beginner';

        // Technique milestones
        milestones.push({
            type: 'technique',
            name: 'Master Basic Movements',
            description: 'Demonstrate proper technique in fundamental exercises',
            target: '4-6 weeks',
            criteria: ['proper_form', 'consistent_execution', 'injury_free']
        });

        // Strength milestones
        if (experience !== 'beginner') {
            milestones.push({
                type: 'strength',
                name: 'Strength Development',
                description: 'Achieve target strength levels for position',
                target: '8-12 weeks',
                criteria: ['strength_gains', 'power_development', 'injury_prevention']
            });
        }

        // Sport-specific milestones
        milestones.push({
            type: 'sport_specific',
            name: 'Position Mastery',
            description: 'Demonstrate position-specific skills',
            target: '12-16 weeks',
            criteria: ['skill_development', 'tactical_understanding', 'performance_improvement']
        });

        return milestones;
    }

    /**
     * Initialize tracking for progression
     * @returns {Object} Tracking setup
     */
    initializeTracking() {
        return {
            metrics: [
                'exercise_performance',
                'load_progression',
                'volume_completed',
                'technique_quality',
                'injury_status',
                'recovery_status'
            ],
            frequency: 'weekly',
            assessments: [
                'movement_screen',
                'strength_test',
                'skill_assessment',
                'injury_check'
            ]
        };
    }

    /**
     * Progress user to next phase
     * @param {string} userId - User ID
     * @param {Object} performanceData - Performance data
     * @returns {Object} Progression result
     */
    progressUser(userId, performanceData) {
        const plan = this.userProgressions.get(userId);
        if (!plan) {
            throw new Error(`No progression plan found for user ${userId}`);
        }

        const currentPhaseIndex = plan.phases.findIndex(phase => phase.name === plan.currentPhase);
        if (currentPhaseIndex === -1) {
            throw new Error(`Current phase ${plan.currentPhase} not found`);
        }

        const currentPhase = plan.phases[currentPhaseIndex];
        const canProgress = this.canProgressToNextPhase(currentPhase, performanceData);

        if (canProgress && currentPhaseIndex < plan.phases.length - 1) {
            plan.currentPhase = plan.phases[currentPhaseIndex + 1].name;
            plan.lastProgression = new Date().toISOString();

            this.logger.audit('USER_PROGRESSED', {
                userId,
                fromPhase: currentPhase.name,
                toPhase: plan.currentPhase
            });
        }

        return {
            canProgress,
            currentPhase: plan.currentPhase,
            nextPhase: currentPhaseIndex < plan.phases.length - 1 ?
                plan.phases[currentPhaseIndex + 1].name : null,
            recommendations: this.generateRecommendations(plan, performanceData)
        };
    }

    /**
     * Check if user can progress to next phase
     * @param {Object} currentPhase - Current phase
     * @param {Object} performanceData - Performance data
     * @returns {boolean} Can progress
     */
    canProgressToNextPhase(currentPhase, performanceData) {
        // Check if minimum duration has been met
        const phaseDuration = this.parseDuration(currentPhase.duration);
        const timeInPhase = this.getTimeInPhase(currentPhase);

        if (timeInPhase < phaseDuration.min) {
            return false;
        }

        // Check performance criteria
        const criteria = this.getPhaseCriteria(currentPhase);
        return criteria.every(criterion =>
            this.evaluateCriterion(criterion, performanceData)
        );
    }

    /**
     * Generate recommendations for user
     * @param {Object} plan - Progression plan
     * @param {Object} performanceData - Performance data
     * @returns {Array} Recommendations
     */
    generateRecommendations(plan, performanceData) {
        const recommendations = [];

        // Check for plateaus
        if (this.isPlateaued(performanceData)) {
            recommendations.push({
                type: 'plateau',
                priority: 'high',
                message: 'Performance plateau detected. Consider deload week or exercise variation.',
                action: 'implement_deload'
            });
        }

        // Check for overtraining
        if (this.isOvertrained(performanceData)) {
            recommendations.push({
                type: 'overtraining',
                priority: 'high',
                message: 'Signs of overtraining detected. Reduce training load and increase recovery.',
                action: 'reduce_load'
            });
        }

        // Check for rapid progress
        if (this.isRapidProgress(performanceData)) {
            recommendations.push({
                type: 'rapid_progress',
                priority: 'medium',
                message: 'Excellent progress! Consider increasing training load.',
                action: 'increase_load'
            });
        }

        return recommendations;
    }

    /**
     * Adapt exercise for user
     * @param {string} exerciseId - Exercise ID
     * @param {Object} userProfile - User profile
     * @param {Object} adaptations - Adaptations
     * @returns {Object} Adapted exercise
     */
    adaptExercise(exerciseId, userProfile, adaptations) {
        const exercise = this.soccerExercises.getExercise(exerciseId);
        if (!exercise) {
            throw new Error(`Exercise ${exerciseId} not found`);
        }

        const adaptedExercise = { ...exercise };

        // Apply age adaptations
        if (adaptations.age) {
            adaptedExercise.duration = this.adjustDuration(adaptedExercise.duration, adaptations.age);
            adaptedExercise.intensity = this.adjustIntensity(adaptedExercise.intensity, adaptations.age);
        }

        // Apply injury adaptations
        if (adaptations.injuryHistory && adaptations.injuryHistory.length > 0) {
            adaptedExercise.modifications = this.getInjuryModifications(adaptations.injuryHistory);
            adaptedExercise.alternatives = this.getAlternativeExercises(adaptations.injuryHistory);
        }

        // Apply time constraints
        if (adaptations.timeConstraints) {
            adaptedExercise.duration = this.adjustForTimeConstraints(
                adaptedExercise.duration,
                adaptations.timeConstraints
            );
        }

        // Apply equipment constraints
        if (adaptations.equipment) {
            adaptedExercise.equipment = this.adjustEquipment(adaptedExercise.equipment, adaptations.equipment);
        }

        return adaptedExercise;
    }

    /**
     * Get progression for specific exercise
     * @param {string} exerciseId - Exercise ID
     * @param {string} category - Exercise category
     * @param {Object} userProfile - User profile
     * @returns {Object} Exercise progression
     */
    getExerciseProgression(exerciseId, category, userProfile) {
        const rules = this.progressionRules[category] || this.progressionRules.strength;
        const experience = userProfile.experience || 'beginner';

        return {
            exerciseId,
            category,
            rules,
            currentLevel: this.getCurrentLevel(exerciseId, userProfile),
            nextLevel: this.getNextLevel(exerciseId, userProfile),
            progressionRate: this.getProgressionRate(experience),
            adaptations: this.getExerciseAdaptations(exerciseId, userProfile)
        };
    }

    // Helper methods
    getAgeAdaptations(age) {
        if (age < 18) {
            return { recovery: 'increased', intensity: 'moderate', volume: 'moderate' };
        } else if (age > 35) {
            return { recovery: 'increased', intensity: 'moderate', volume: 'moderate', mobility: 'increased' };
        }
        return { recovery: 'standard', intensity: 'standard', volume: 'standard' };
    }

    getInjuryAdaptations(injuryHistory) {
        if (!injuryHistory || injuryHistory.length === 0) {
            return { modifications: 'none' };
        }

        return {
            modifications: 'increased',
            precautions: injuryHistory,
            alternativeExercises: this.getAlternativeExercises(injuryHistory)
        };
    }

    getGoalAdaptations(goals) {
        const adaptations = {
            focus: 'balanced',
            intensity: 'moderate',
            volume: 'moderate'
        };

        if (goals.includes('strength')) {
            adaptations.focus = 'strength';
            adaptations.intensity = 'high';
        } else if (goals.includes('endurance')) {
            adaptations.focus = 'endurance';
            adaptations.volume = 'high';
        } else if (goals.includes('speed')) {
            adaptations.focus = 'speed';
            adaptations.intensity = 'very_high';
        }

        return adaptations;
    }

    getTimeAdaptations(timeConstraints) {
        if (!timeConstraints) {
            return { sessionLength: 'standard', frequency: 'standard' };
        }

        return {
            sessionLength: timeConstraints.sessionLength || 'standard',
            frequency: timeConstraints.frequency || 'standard',
            modifications: timeConstraints.modifications || 'none'
        };
    }

    getEquipmentAdaptations(availableEquipment) {
        return {
            available: availableEquipment || [],
            limitations: this.getEquipmentLimitations(availableEquipment)
        };
    }

    // Exercise selection methods (would be expanded)
    getFoundationExercises(userProfile) {
        return ['bodyweight_squats', 'wall_passing', 'basic_juggling'];
    }

    getAdaptationExercises(userProfile) {
        return ['goblet_squats', 'cone_dribbling', 'ladder_drills'];
    }

    getProgressionExercises(userProfile) {
        return ['back_squats', 'passing_patterns', 'agility_courses'];
    }

    getBaseBuildingExercises(userProfile) {
        return ['squats', 'deadlifts', 'interval_training'];
    }

    getStrengthExercises(userProfile) {
        return ['heavy_squats', 'heavy_deadlifts', 'plyometrics'];
    }

    getPowerExercises(userProfile) {
        return ['jump_training', 'sprint_training', 'explosive_movements'];
    }

    getPreparationExercises(userProfile) {
        return ['movement_prep', 'activation_drills', 'mobility_work'];
    }

    getOverloadExercises(userProfile) {
        return ['maximal_strength', 'high_intensity_intervals', 'complex_training'];
    }

    getPeakExercises(userProfile) {
        return ['power_training', 'sport_specific_drills', 'competition_prep'];
    }

    getTaperExercises(userProfile) {
        return ['light_training', 'recovery_work', 'mental_preparation'];
    }

    // Additional helper methods would be implemented here
    parseDuration(duration) {
        const match = duration.match(/(\d+)-(\d+)/);
        return {
            min: parseInt(match[1]),
            max: parseInt(match[2])
        };
    }

    getTimeInPhase(phase) {
        // Implementation would track actual time in phase
        return 4; // Placeholder
    }

    getPhaseCriteria(phase) {
        // Implementation would define phase-specific criteria
        return ['technique_mastery', 'injury_free', 'consistent_performance'];
    }

    evaluateCriterion(criterion, performanceData) {
        // Implementation would evaluate specific criteria
        return true; // Placeholder
    }

    isPlateaued(performanceData) {
        // Implementation would detect performance plateaus
        return false; // Placeholder
    }

    isOvertrained(performanceData) {
        // Implementation would detect overtraining
        return false; // Placeholder
    }

    isRapidProgress(performanceData) {
        // Implementation would detect rapid progress
        return false; // Placeholder
    }

    adjustDuration(duration, ageAdaptations) {
        // Implementation would adjust duration based on age
        return duration;
    }

    adjustIntensity(intensity, ageAdaptations) {
        // Implementation would adjust intensity based on age
        return intensity;
    }

    getInjuryModifications(injuryHistory) {
        // Implementation would provide injury-specific modifications
        return [];
    }

    getAlternativeExercises(injuryHistory) {
        // Implementation would provide alternative exercises
        return [];
    }

    adjustForTimeConstraints(duration, timeConstraints) {
        // Implementation would adjust for time constraints
        return duration;
    }

    adjustEquipment(requiredEquipment, availableEquipment) {
        // Implementation would adjust equipment requirements
        return requiredEquipment;
    }

    getCurrentLevel(exerciseId, userProfile) {
        // Implementation would determine current exercise level
        return 'beginner';
    }

    getNextLevel(exerciseId, userProfile) {
        // Implementation would determine next exercise level
        return 'intermediate';
    }

    getProgressionRate(experience) {
        const rates = {
            'beginner': 'slow',
            'intermediate': 'moderate',
            'advanced': 'fast'
        };
        return rates[experience] || 'moderate';
    }

    getExerciseAdaptations(exerciseId, userProfile) {
        // Implementation would provide exercise-specific adaptations
        return {};
    }

    getEquipmentLimitations(availableEquipment) {
        // Implementation would identify equipment limitations
        return [];
    }
}

// Create global instance
window.ExerciseProgression = new ExerciseProgression();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExerciseProgression;
}
