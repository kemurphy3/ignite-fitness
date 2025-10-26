/**
 * SeasonalPrograms - Seasonal training program management
 * Handles periodization and seasonal training cycles
 */
class SeasonalPrograms {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.sportDefinitions = window.SportDefinitions;
        this.currentPrograms = new Map();
        this.seasonalTemplates = this.initializeSeasonalTemplates();
    }

    /**
     * Initialize seasonal training templates
     * @returns {Object} Seasonal templates
     */
    initializeSeasonalTemplates() {
        return {
            soccer: {
                'off-season': {
                    name: 'Off-Season Training',
                    duration: '12-16 weeks',
                    phases: [
                        {
                            name: 'Active Recovery',
                            duration: '2-3 weeks',
                            focus: 'recovery_regeneration',
                            intensity: 'low',
                            volume: 'low',
                            activities: ['swimming', 'cycling', 'light_jogging', 'yoga']
                        },
                        {
                            name: 'Base Building',
                            duration: '4-6 weeks',
                            focus: 'aerobic_base_strength',
                            intensity: 'moderate',
                            volume: 'moderate_high',
                            activities: ['endurance_training', 'strength_training', 'mobility_work']
                        },
                        {
                            name: 'Strength Development',
                            duration: '4-6 weeks',
                            focus: 'maximal_strength_power',
                            intensity: 'high',
                            volume: 'moderate',
                            activities: ['heavy_lifting', 'plyometrics', 'power_training']
                        },
                        {
                            name: 'Sport Preparation',
                            duration: '2-3 weeks',
                            focus: 'sport_specific_preparation',
                            intensity: 'moderate_high',
                            volume: 'moderate',
                            activities: ['sport_specific_drills', 'tactical_training', 'match_preparation']
                        }
                    ],
                    weeklyStructure: {
                        monday: { type: 'strength', duration: 60, intensity: 'moderate' },
                        tuesday: { type: 'conditioning', duration: 45, intensity: 'moderate' },
                        wednesday: { type: 'strength', duration: 60, intensity: 'moderate' },
                        thursday: { type: 'conditioning', duration: 45, intensity: 'moderate' },
                        friday: { type: 'strength', duration: 60, intensity: 'moderate' },
                        saturday: { type: 'active_recovery', duration: 30, intensity: 'low' },
                        sunday: { type: 'rest', duration: 0, intensity: 'none' }
                    }
                },
                'pre-season': {
                    name: 'Pre-Season Training',
                    duration: '6-8 weeks',
                    phases: [
                        {
                            name: 'Fitness Foundation',
                            duration: '2-3 weeks',
                            focus: 'base_fitness_tactics',
                            intensity: 'moderate',
                            volume: 'high',
                            activities: ['fitness_training', 'tactical_drills', 'team_building']
                        },
                        {
                            name: 'Match Preparation',
                            duration: '2-3 weeks',
                            focus: 'match_fitness_tactics',
                            intensity: 'high',
                            volume: 'moderate_high',
                            activities: ['match_simulation', 'tactical_preparation', 'set_pieces']
                        },
                        {
                            name: 'Competition Ready',
                            duration: '1-2 weeks',
                            focus: 'peak_performance',
                            intensity: 'moderate',
                            volume: 'moderate',
                            activities: ['taper_training', 'match_preparation', 'mental_preparation']
                        }
                    ],
                    weeklyStructure: {
                        monday: { type: 'tactical', duration: 90, intensity: 'moderate' },
                        tuesday: { type: 'fitness', duration: 60, intensity: 'high' },
                        wednesday: { type: 'tactical', duration: 90, intensity: 'moderate' },
                        thursday: { type: 'fitness', duration: 60, intensity: 'high' },
                        friday: { type: 'tactical', duration: 75, intensity: 'moderate' },
                        saturday: { type: 'match_preparation', duration: 45, intensity: 'moderate' },
                        sunday: { type: 'rest', duration: 0, intensity: 'none' }
                    }
                },
                'in-season': {
                    name: 'In-Season Training',
                    duration: '24-36 weeks',
                    phases: [
                        {
                            name: 'Early Season',
                            duration: '6-8 weeks',
                            focus: 'performance_maintenance',
                            intensity: 'moderate',
                            volume: 'moderate',
                            activities: ['maintenance_training', 'tactical_refinement', 'injury_prevention']
                        },
                        {
                            name: 'Mid Season',
                            duration: '12-16 weeks',
                            focus: 'performance_optimization',
                            intensity: 'variable',
                            volume: 'variable',
                            activities: ['periodized_training', 'tactical_adaptation', 'recovery_management']
                        },
                        {
                            name: 'Late Season',
                            duration: '6-12 weeks',
                            focus: 'peak_performance',
                            intensity: 'moderate',
                            volume: 'moderate',
                            activities: ['taper_training', 'match_preparation', 'mental_preparation']
                        }
                    ],
                    weeklyStructure: {
                        monday: { type: 'recovery', duration: 30, intensity: 'low' },
                        tuesday: { type: 'tactical', duration: 75, intensity: 'moderate' },
                        wednesday: { type: 'fitness', duration: 45, intensity: 'moderate' },
                        thursday: { type: 'tactical', duration: 75, intensity: 'moderate' },
                        friday: { type: 'match_preparation', duration: 30, intensity: 'low' },
                        saturday: { type: 'match', duration: 90, intensity: 'high' },
                        sunday: { type: 'recovery', duration: 30, intensity: 'low' }
                    }
                },
                'post-season': {
                    name: 'Post-Season Recovery',
                    duration: '2-4 weeks',
                    phases: [
                        {
                            name: 'Active Recovery',
                            duration: '1-2 weeks',
                            focus: 'physical_mental_recovery',
                            intensity: 'low',
                            volume: 'low',
                            activities: ['light_activity', 'rehabilitation', 'mental_recovery']
                        },
                        {
                            name: 'Transition',
                            duration: '1-2 weeks',
                            focus: 'transition_preparation',
                            intensity: 'very_low',
                            volume: 'very_low',
                            activities: ['planning', 'assessment', 'goal_setting']
                        }
                    ],
                    weeklyStructure: {
                        monday: { type: 'active_recovery', duration: 20, intensity: 'very_low' },
                        tuesday: { type: 'rest', duration: 0, intensity: 'none' },
                        wednesday: { type: 'active_recovery', duration: 20, intensity: 'very_low' },
                        thursday: { type: 'rest', duration: 0, intensity: 'none' },
                        friday: { type: 'active_recovery', duration: 20, intensity: 'very_low' },
                        saturday: { type: 'rest', duration: 0, intensity: 'none' },
                        sunday: { type: 'rest', duration: 0, intensity: 'none' }
                    }
                }
            },
            basketball: {
                'off-season': {
                    name: 'Off-Season Training',
                    duration: '16-20 weeks',
                    phases: [
                        {
                            name: 'Recovery',
                            duration: '2-3 weeks',
                            focus: 'physical_mental_recovery',
                            intensity: 'low',
                            volume: 'low'
                        },
                        {
                            name: 'Skill Development',
                            duration: '6-8 weeks',
                            focus: 'individual_skills',
                            intensity: 'moderate',
                            volume: 'moderate'
                        },
                        {
                            name: 'Strength Power',
                            duration: '6-8 weeks',
                            focus: 'strength_power_development',
                            intensity: 'high',
                            volume: 'moderate'
                        },
                        {
                            name: 'Pre-Season Prep',
                            duration: '2-3 weeks',
                            focus: 'team_preparation',
                            intensity: 'moderate_high',
                            volume: 'moderate'
                        }
                    ]
                }
                // Additional basketball seasons would be added here
            }
            // Additional sports would be added here
        };
    }

    /**
     * Create seasonal program
     * @param {string} sportId - Sport ID
     * @param {string} seasonId - Season ID
     * @param {Object} userProfile - User profile
     * @param {Object} customizations - Custom program settings
     * @returns {Object} Seasonal program
     */
    createSeasonalProgram(sportId, seasonId, userProfile, customizations = {}) {
        const template = this.seasonalTemplates[sportId]?.[seasonId];
        if (!template) {
            throw new Error(`No template found for ${sportId}/${seasonId}`);
        }

        const program = {
            id: this.generateProgramId(sportId, seasonId),
            sport: sportId,
            season: seasonId,
            name: template.name,
            duration: template.duration,
            userProfile: userProfile,
            customizations: customizations,
            createdAt: new Date().toISOString(),
            phases: this.adaptPhases(template.phases, userProfile, customizations),
            weeklyStructure: this.adaptWeeklyStructure(template.weeklyStructure, userProfile),
            progressTracking: this.initializeProgressTracking(template),
            adaptations: this.generateAdaptations(sportId, seasonId, userProfile)
        };

        // Store program
        this.currentPrograms.set(program.id, program);

        this.logger.audit('SEASONAL_PROGRAM_CREATED', {
            programId: program.id,
            sport: sportId,
            season: seasonId,
            userId: userProfile.userId
        });

        return program;
    }

    /**
     * Adapt phases based on user profile
     * @param {Array} phases - Template phases
     * @param {Object} userProfile - User profile
     * @param {Object} customizations - Customizations
     * @returns {Array} Adapted phases
     */
    adaptPhases(phases, userProfile, customizations) {
        return phases.map(phase => {
            const adaptedPhase = { ...phase };
            
            // Adapt based on experience level
            if (userProfile.experience === 'beginner') {
                adaptedPhase.intensity = this.reduceIntensity(adaptedPhase.intensity);
                adaptedPhase.volume = this.reduceVolume(adaptedPhase.volume);
            } else if (userProfile.experience === 'advanced') {
                adaptedPhase.intensity = this.increaseIntensity(adaptedPhase.intensity);
                adaptedPhase.volume = this.increaseVolume(adaptedPhase.volume);
            }

            // Adapt based on age
            if (userProfile.age > 35) {
                adaptedPhase.intensity = this.reduceIntensity(adaptedPhase.intensity);
                adaptedPhase.recovery = 'increased';
            }

            // Adapt based on injury history
            if (userProfile.injuryHistory && userProfile.injuryHistory.length > 0) {
                adaptedPhase.intensity = this.reduceIntensity(adaptedPhase.intensity);
                adaptedPhase.injuryPrevention = 'increased';
            }

            // Apply customizations
            if (customizations.intensity) {
                adaptedPhase.intensity = customizations.intensity;
            }
            if (customizations.volume) {
                adaptedPhase.volume = customizations.volume;
            }

            return adaptedPhase;
        });
    }

    /**
     * Adapt weekly structure based on user profile
     * @param {Object} weeklyStructure - Template weekly structure
     * @param {Object} userProfile - User profile
     * @returns {Object} Adapted weekly structure
     */
    adaptWeeklyStructure(weeklyStructure, userProfile) {
        const adaptedStructure = { ...weeklyStructure };

        // Adapt based on time constraints
        if (userProfile.timeConstraints) {
            const { sessionLength, frequency } = userProfile.timeConstraints;
            
            if (sessionLength === 'short') {
                Object.keys(adaptedStructure).forEach(day => {
                    if (adaptedStructure[day].duration > 30) {
                        adaptedStructure[day].duration = 30;
                    }
                });
            }
            
            if (frequency === 'low') {
                // Reduce training days
                const trainingDays = Object.keys(adaptedStructure).filter(day => 
                    adaptedStructure[day].type !== 'rest' && adaptedStructure[day].type !== 'recovery'
                );
                
                if (trainingDays.length > 4) {
                    // Remove least important training days
                    trainingDays.slice(4).forEach(day => {
                        adaptedStructure[day] = { type: 'rest', duration: 0, intensity: 'none' };
                    });
                }
            }
        }

        return adaptedStructure;
    }

    /**
     * Initialize progress tracking for program
     * @param {Object} template - Program template
     * @returns {Object} Progress tracking setup
     */
    initializeProgressTracking(template) {
        return {
            metrics: [
                'training_load',
                'intensity_rating',
                'volume_completed',
                'recovery_status',
                'performance_indicators'
            ],
            checkpoints: template.phases.map((phase, index) => ({
                phase: phase.name,
                week: this.calculatePhaseWeek(template.phases, index),
                assessments: ['fitness_test', 'movement_screen', 'injury_check']
            })),
            goals: this.generateSeasonalGoals(template)
        };
    }

    /**
     * Generate adaptations for program
     * @param {string} sportId - Sport ID
     * @param {string} seasonId - Season ID
     * @param {Object} userProfile - User profile
     * @returns {Object} Adaptations
     */
    generateAdaptations(sportId, seasonId, userProfile) {
        const adaptations = {
            loadManagement: this.generateLoadManagement(sportId, seasonId),
            recovery: this.generateRecoveryStrategies(userProfile),
            injuryPrevention: this.generateInjuryPrevention(sportId, userProfile),
            nutrition: this.generateNutritionGuidelines(seasonId),
            monitoring: this.generateMonitoringProtocols(sportId, seasonId)
        };

        return adaptations;
    }

    /**
     * Generate load management strategy
     * @param {string} sportId - Sport ID
     * @param {string} seasonId - Season ID
     * @returns {Object} Load management
     */
    generateLoadManagement(sportId, seasonId) {
        const strategies = {
            soccer: {
                'off-season': {
                    progression: 'linear',
                    deloadFrequency: 'every_4_weeks',
                    maxLoadIncrease: '10%'
                },
                'pre-season': {
                    progression: 'step',
                    deloadFrequency: 'every_3_weeks',
                    maxLoadIncrease: '15%'
                },
                'in-season': {
                    progression: 'undulating',
                    deloadFrequency: 'every_2_weeks',
                    maxLoadIncrease: '5%'
                }
            }
        };

        return strategies[sportId]?.[seasonId] || strategies.soccer['in-season'];
    }

    /**
     * Generate recovery strategies
     * @param {Object} userProfile - User profile
     * @returns {Object} Recovery strategies
     */
    generateRecoveryStrategies(userProfile) {
        const strategies = {
            sleep: {
                target: userProfile.age < 18 ? '9-10 hours' : '7-9 hours',
                quality: 'high',
                consistency: 'important'
            },
            nutrition: {
                hydration: 'adequate',
                protein: 'sufficient',
                timing: 'optimal'
            },
            activeRecovery: {
                activities: ['light_jogging', 'swimming', 'yoga', 'stretching'],
                frequency: 'daily',
                duration: '20-30 minutes'
            },
            passiveRecovery: {
                activities: ['massage', 'ice_baths', 'compression', 'meditation'],
                frequency: 'as_needed',
                duration: 'variable'
            }
        };

        // Adapt based on age
        if (userProfile.age > 35) {
            strategies.sleep.target = '8-9 hours';
            strategies.activeRecovery.frequency = 'daily';
        }

        return strategies;
    }

    /**
     * Generate injury prevention strategies
     * @param {string} sportId - Sport ID
     * @param {Object} userProfile - User profile
     * @returns {Object} Injury prevention
     */
    generateInjuryPrevention(sportId, userProfile) {
        const sport = this.sportDefinitions.getSport(sportId);
        const commonInjuries = sport?.commonInjuries || [];

        const prevention = {
            warmUp: {
                duration: '15-20 minutes',
                components: ['dynamic_stretching', 'movement_preparation', 'activation']
            },
            coolDown: {
                duration: '10-15 minutes',
                components: ['static_stretching', 'foam_rolling', 'breathing']
            },
            movementScreening: {
                frequency: 'monthly',
                tests: ['fms', 'movement_quality', 'asymmetries']
            },
            strengthTraining: {
                focus: 'injury_prevention',
                exercises: ['single_leg', 'core_stability', 'posterior_chain']
            }
        };

        // Add sport-specific prevention
        if (commonInjuries.includes('acl_tears')) {
            prevention.neuromuscularTraining = {
                exercises: ['landing_mechanics', 'cutting_patterns', 'balance_training'],
                frequency: '3x_weekly'
            };
        }

        // Add position-specific prevention
        if (userProfile.position) {
            const position = this.sportDefinitions.getPosition(sportId, userProfile.position);
            if (position?.injuryRisks) {
                position.injuryRisks.forEach(risk => {
                    prevention[risk] = {
                        exercises: [`prevention_for_${risk}`],
                        frequency: 'weekly'
                    };
                });
            }
        }

        return prevention;
    }

    /**
     * Generate nutrition guidelines
     * @param {string} seasonId - Season ID
     * @returns {Object} Nutrition guidelines
     */
    generateNutritionGuidelines(seasonId) {
        const guidelines = {
            'off-season': {
                focus: 'body_composition',
                calories: 'maintenance',
                protein: '1.6-2.2g/kg',
                carbs: 'moderate',
                hydration: 'adequate'
            },
            'pre-season': {
                focus: 'performance_preparation',
                calories: 'maintenance_slight_surplus',
                protein: '1.8-2.4g/kg',
                carbs: 'moderate_high',
                hydration: 'optimal'
            },
            'in-season': {
                focus: 'performance_recovery',
                calories: 'maintenance',
                protein: '1.6-2.2g/kg',
                carbs: 'high',
                hydration: 'optimal'
            },
            'post-season': {
                focus: 'recovery_regeneration',
                calories: 'maintenance',
                protein: '1.4-2.0g/kg',
                carbs: 'moderate',
                hydration: 'adequate'
            }
        };

        return guidelines[seasonId] || guidelines['in-season'];
    }

    /**
     * Generate monitoring protocols
     * @param {string} sportId - Sport ID
     * @param {string} seasonId - Season ID
     * @returns {Object} Monitoring protocols
     */
    generateMonitoringProtocols(sportId, seasonId) {
        return {
            daily: ['sleep_quality', 'mood', 'fatigue', 'soreness'],
            weekly: ['training_load', 'performance_metrics', 'body_weight'],
            monthly: ['fitness_tests', 'movement_screen', 'injury_check'],
            seasonal: ['body_composition', 'performance_assessment', 'goal_review']
        };
    }

    /**
     * Generate seasonal goals
     * @param {Object} template - Program template
     * @returns {Array} Seasonal goals
     */
    generateSeasonalGoals(template) {
        return template.phases.map(phase => ({
            phase: phase.name,
            goals: [
                `Complete ${phase.name} phase successfully`,
                `Maintain injury-free training`,
                `Improve ${phase.focus} capabilities`
            ]
        }));
    }

    // Helper methods
    generateProgramId(sportId, seasonId) {
        return `${sportId}_${seasonId}_${Date.now()}`;
    }

    reduceIntensity(intensity) {
        const intensityMap = {
            'very_high': 'high',
            'high': 'moderate_high',
            'moderate_high': 'moderate',
            'moderate': 'low_moderate',
            'low_moderate': 'low',
            'low': 'very_low'
        };
        return intensityMap[intensity] || intensity;
    }

    increaseIntensity(intensity) {
        const intensityMap = {
            'very_low': 'low',
            'low': 'low_moderate',
            'low_moderate': 'moderate',
            'moderate': 'moderate_high',
            'moderate_high': 'high',
            'high': 'very_high'
        };
        return intensityMap[intensity] || intensity;
    }

    reduceVolume(volume) {
        const volumeMap = {
            'very_high': 'high',
            'high': 'moderate_high',
            'moderate_high': 'moderate',
            'moderate': 'low_moderate',
            'low_moderate': 'low',
            'low': 'very_low'
        };
        return volumeMap[volume] || volume;
    }

    increaseVolume(volume) {
        const volumeMap = {
            'very_low': 'low',
            'low': 'low_moderate',
            'low_moderate': 'moderate',
            'moderate': 'moderate_high',
            'moderate_high': 'high',
            'high': 'very_high'
        };
        return volumeMap[volume] || volume;
    }

    calculatePhaseWeek(phases, phaseIndex) {
        let week = 1;
        for (let i = 0; i < phaseIndex; i++) {
            const duration = phases[i].duration;
            const weeks = parseInt(duration.split('-')[0]);
            week += weeks;
        }
        return week;
    }

    /**
     * Get current program
     * @param {string} programId - Program ID
     * @returns {Object|null} Program
     */
    getProgram(programId) {
        return this.currentPrograms.get(programId) || null;
    }

    /**
     * Update program progress
     * @param {string} programId - Program ID
     * @param {Object} progress - Progress data
     */
    updateProgress(programId, progress) {
        const program = this.getProgram(programId);
        if (program) {
            program.progress = {
                ...program.progress,
                ...progress,
                lastUpdated: new Date().toISOString()
            };
            this.currentPrograms.set(programId, program);
        }
    }

    /**
     * Get all programs for user
     * @param {string} userId - User ID
     * @returns {Array} User programs
     */
    getUserPrograms(userId) {
        return Array.from(this.currentPrograms.values()).filter(
            program => program.userProfile.userId === userId
        );
    }
}

// Create global instance
window.SeasonalPrograms = new SeasonalPrograms();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeasonalPrograms;
}
