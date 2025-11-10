/**
 * CorrectiveExercises - Corrective exercise protocol management
 * Provides targeted exercises to address movement dysfunction
 */
class CorrectiveExercises {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.exerciseLibrary = this.initializeExerciseLibrary();
        this.activeProtocols = new Map();
    }

    /**
     * Initialize corrective exercise library
     * @returns {Object} Exercise library
     */
    initializeExerciseLibrary() {
        return {
            glute_activation: {
                name: 'Glute Activation',
                description: 'Activates gluteal muscles for proper hip mechanics',
                purpose: 'address_knee_valgus',
                difficulty: 'beginner',
                equipment: ['resistance_band'],
                instructions: [
                    'Place resistance band around legs above knees',
                    'Stand with feet hip-width apart',
                    'Push knees out against band',
                    'Hold for 2 seconds',
                    'Release and repeat'
                ],
                sets: 3,
                reps: '15-20',
                progression: ['standing', 'side_lying', 'standing_with_hip_extension']
            },
            hip_strengthening: {
                name: 'Hip Strengthening',
                description: 'Strengthens hip abductors and external rotators',
                purpose: 'address_knee_valgus_hip_stability',
                difficulty: 'beginner',
                equipment: ['resistance_band'],
                instructions: [
                    'Place band around legs above knees',
                    'Lie on side with knees bent',
                    'Keep feet together, raise top knee',
                    'Hold for 2 seconds',
                    'Lower slowly and repeat'
                ],
                sets: 3,
                reps: '15-20',
                progression: ['side_lying', 'standing', 'with_band']
            },
            VMO_strengthening: {
                name: 'VMO Strengthening',
                description: 'Strengthens vastus medialis oblique',
                purpose: 'address_knee_valgus_patella_stability',
                difficulty: 'intermediate',
                equipment: ['resistance_band'],
                instructions: [
                    'Sit with knee extended',
                    'Place band around knee',
                    'Press knee outward against band',
                    'Simultaneously tighten quadriceps',
                    'Hold for 2 seconds'
                ],
                sets: 3,
                reps: '15-20',
                progression: ['seated', 'standing', 'during_squat']
            },
            lateral_band_walks: {
                name: 'Lateral Band Walks',
                description: 'Strengthens hip abductors and external rotators',
                purpose: 'address_knee_valgus_hip_stability',
                difficulty: 'beginner',
                equipment: ['resistance_band'],
                instructions: [
                    'Place band around legs above knees',
                    'Stand with feet hip-width apart',
                    'Maintain slight squat position',
                    'Step laterally maintaining band tension',
                    'Bring trailing leg to meet leading leg'
                ],
                sets: 2,
                reps: '10-12 each direction',
                progression: ['slow', 'with_squat', 'single_leg']
            },
            ankle_mobility: {
                name: 'Ankle Mobility Work',
                description: 'Improves ankle dorsiflexion range of motion',
                purpose: 'address_heel_lift_ankle_impingement',
                difficulty: 'beginner',
                equipment: ['wall'],
                instructions: [
                    'Stand facing wall',
                    'Place foot forward, knee bent',
                    'Keep heel on ground',
                    'Drive knee forward over toes',
                    'Hold for 30 seconds'
                ],
                sets: 3,
                reps: 'per_side',
                progression: ['partial', 'full_range', 'weighted']
            },
            calf_stretching: {
                name: 'Calf Stretching',
                description: 'Improves calf flexibility and ankle dorsiflexion',
                purpose: 'address_heel_lift_calf_tightness',
                difficulty: 'beginner',
                equipment: ['wall'],
                instructions: [
                    'Stand facing wall',
                    'Place one foot back',
                    'Keep back leg straight',
                    'Bend front knee',
                    'Feel stretch in back calf'
                ],
                sets: 3,
                reps: '30-45 seconds each',
                progression: ['straight_leg', 'bent_knee', 'weighted']
            },
            dorsiflexion_work: {
                name: 'Dorsiflexion Work',
                description: 'Active dorsiflexion mobility',
                purpose: 'address_heel_lift_limited_dorsiflexion',
                difficulty: 'beginner',
                equipment: ['resistance_band'],
                instructions: [
                    'Sit with leg extended',
                    'Place band around top of foot',
                    'Pull toes toward shin',
                    'Hold for 2 seconds',
                    'Release slowly'
                ],
                sets: 3,
                reps: '20',
                progression: ['passive', 'active', 'resisted']
            },
            thoracic_extension: {
                name: 'Thoracic Extension',
                description: 'Improves upper back extension mobility',
                purpose: 'address_forward_lean_poor_posture',
                difficulty: 'beginner',
                equipment: ['foam_roller'],
                instructions: [
                    'Place foam roller under upper back',
                    'Support head with hands',
                    'Extend over roller',
                    'Hold for 30 seconds',
                    'Return slowly'
                ],
                sets: 3,
                reps: '10-15',
                progression: ['foam_roller', 'over_bench', 'weighted']
            },
            hip_flexor_stretching: {
                name: 'Hip Flexor Stretching',
                description: 'Improves hip flexor flexibility',
                purpose: 'address_forward_lean_limited_hip_extension',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Kneel on one knee',
                    'Other foot forward',
                    'Shift weight forward',
                    'Feel stretch in front hip',
                    'Hold for 30-60 seconds'
                ],
                sets: 3,
                reps: 'per_side',
                progression: ['basic', 'with_reach', 'weighted']
            },
            core_stability: {
                name: 'Core Stability',
                description: 'Improves core stability and strength',
                purpose: 'address_forward_lean_core_weakness',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Assume plank position',
                    'Engage core muscles',
                    'Maintain neutral spine',
                    'Hold for 30-60 seconds',
                    'Rest and repeat'
                ],
                sets: 3,
                reps: '30-60 seconds',
                progression: ['knees', 'full_plank', 'weighted', 'single_arm']
            },
            arch_strengthening: {
                name: 'Arch Strengthening',
                description: 'Strengthens foot arch muscles',
                purpose: 'address_foot_flattening_fallen_arches',
                difficulty: 'beginner',
                equipment: ['towel'],
                instructions: [
                    'Sit with foot on towel',
                    'Use toes to scrunch towel',
                    'Pull towel toward you',
                    'Release slowly',
                    'Repeat'
                ],
                sets: 3,
                reps: '20',
                progression: ['towel', 'marbles', 'resisted']
            },
            short_foot_exercise: {
                name: 'Short Foot Exercise',
                description: 'Strengthens intrinsic foot muscles',
                purpose: 'address_foot_flattening_arch_support',
                difficulty: 'intermediate',
                equipment: ['none'],
                instructions: [
                    'Sit with foot on ground',
                    'Shorten foot by pulling arch up',
                    'Do not curl toes',
                    'Hold for 5 seconds',
                    'Release slowly'
                ],
                sets: 3,
                reps: '15-20',
                progression: ['seated', 'standing', 'single_leg']
            },
            calf_strengthening: {
                name: 'Calf Strengthening',
                description: 'Strengthens calf muscles',
                purpose: 'address_foot_flattening_calf_support',
                difficulty: 'beginner',
                equipment: ['none'],
                instructions: [
                    'Stand on edge of step',
                    'Rise up on toes',
                    'Lower slowly',
                    'Repeat',
                    'Maintain control'
                ],
                sets: 3,
                reps: '15-20',
                progression: ['bodyweight', 'weighted', 'single_leg']
            },
            thoracic_mobility: {
                name: 'Thoracic Mobility',
                description: 'Improves upper back rotation and extension',
                purpose: 'address_trunk_lateral_lean_rotational_mobility',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Cat-cow position',
                    'Rotate through thoracic spine',
                    'Reach arm up and back',
                    'Return to center',
                    'Repeat other side'
                ],
                sets: 3,
                reps: '10 each side',
                progression: ['basic', 'weighted', 'dynamic']
            },
            single_leg_stability: {
                name: 'Single Leg Stability',
                description: 'Improves single leg balance and control',
                purpose: 'address_trunk_lateral_lean_asymmetric_stability',
                difficulty: 'intermediate',
                equipment: ['none'],
                instructions: [
                    'Stand on one leg',
                    'Maintain balance',
                    'Reach opposite arm forward',
                    'Hold for 30 seconds',
                    'Return to start'
                ],
                sets: 2,
                reps: '30 seconds each',
                progression: ['eyes_open', 'eyes_closed', 'on_unstable_surface']
            },
            single_leg_RDL: {
                name: 'Single Leg Romanian Deadlift',
                description: 'Single leg stability and posterior chain strength',
                purpose: 'address_knee_valgus_single_leg_stability',
                difficulty: 'advanced',
                equipment: ['dumbbell'],
                instructions: [
                    'Stand on one leg',
                    'Hinge at hip',
                    'Lower torso and lift opposite leg',
                    'Keep knee slightly bent',
                    'Return to start'
                ],
                sets: 3,
                reps: '8-12',
                progression: ['bodyweight', 'weighted', 'unstable']
            },
            step_up_variations: {
                name: 'Step Up Variations',
                description: 'Unilateral strength and stability',
                purpose: 'address_knee_valgus_single_leg_strength',
                difficulty: 'intermediate',
                equipment: ['box'],
                instructions: [
                    'Place foot on box',
                    'Drive through heel to stand',
                    'Control descent',
                    'Repeat',
                    'Maintain knee alignment'
                ],
                sets: 3,
                reps: '10-12 each',
                progression: ['bodyweight', 'weighted', 'lateral']
            },
            hip_abduction_strengthening: {
                name: 'Hip Abduction Strengthening',
                description: 'Strengthens hip abductors',
                purpose: 'address_hip_drop_hip_stability',
                difficulty: 'beginner',
                equipment: ['resistance_band'],
                instructions: [
                    'Place band around legs above knees',
                    'Stand on one leg',
                    'Lift opposite leg to side',
                    'Maintain alignment',
                    'Return slowly'
                ],
                sets: 3,
                reps: '15-20',
                progression: ['supported', 'unsupported', 'weighted']
            },
            lateral_plank: {
                name: 'Lateral Plank',
                description: 'Side plank for lateral core stability',
                purpose: 'address_hip_drop_lateral_stability',
                difficulty: 'intermediate',
                equipment: ['mat'],
                instructions: [
                    'Lie on side',
                    'Prop up on elbow',
                    'Lift hips to straight line',
                    'Hold for 30-60 seconds',
                    'Lower slowly'
                ],
                sets: 3,
                reps: '30-60 seconds',
                progression: ['knees', 'straight', 'with_lift']
            },
            hamstring_stretch: {
                name: 'Hamstring Stretch',
                description: 'Improves hamstring flexibility',
                purpose: 'address_limited_hamstring_flexibility',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Lie supine with one leg extended',
                    'Lift opposite leg straight up',
                    'Feel stretch in hamstring',
                    'Hold for 30-60 seconds',
                    'Switch legs'
                ],
                sets: 3,
                reps: '30-60 seconds',
                progression: ['assisted', 'active', 'PNF']
            },
            dead_bug: {
                name: 'Dead Bug',
                description: 'Core stability and coordination',
                purpose: 'address_core_instability_cross_patterning',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Lie supine with knees and hips at 90°',
                    'Extend opposite arm and leg',
                    'Maintain neutral spine',
                    'Return to start',
                    'Alternate sides'
                ],
                sets: 3,
                reps: '10 each side',
                progression: ['basic', 'with_band', 'weighted']
            },
            bird_dog: {
                name: 'Bird Dog',
                description: 'Quadruped core stability',
                purpose: 'address_core_instability_rotational_stability',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Assume quadruped position',
                    'Extend opposite arm and leg',
                    'Maintain neutral spine',
                    'Hold for 5-10 seconds',
                    'Return to start'
                ],
                sets: 3,
                reps: '10 each side',
                progression: ['static', 'dynamic', 'weighted']
            },
            plank_variations: {
                name: 'Plank Variations',
                description: 'Core stability training',
                purpose: 'address_core_instability_stability_strength',
                difficulty: 'beginner',
                equipment: ['mat'],
                instructions: [
                    'Assume plank position',
                    'Engage core muscles',
                    'Maintain neutral spine',
                    'Hold for 30-60 seconds',
                    'Rest and repeat'
                ],
                sets: 3,
                reps: '30-60 seconds',
                progression: ['knees', 'straight', 'side', 'weighted']
            }
        };
    }

    /**
     * Create corrective exercise protocol
     * @param {Object} screeningResult - Screening result with issues
     * @returns {Object} Corrective exercise protocol
     */
    createProtocol(screeningResult) {
        const issues = this.identifyIssues(screeningResult);
        const exercises = this.selectExercises(issues);

        const protocol = {
            id: this.generateId(),
            userId: screeningResult.userProfile?.userId,
            createdAt: new Date().toISOString(),
            issues,
            exercises,
            schedule: this.generateSchedule(exercises),
            duration: '4-6 weeks',
            progressions: this.generateProgressions(exercises)
        };

        this.activeProtocols.set(protocol.id, protocol);

        this.logger.audit('CORRECTIVE_PROTOCOL_CREATED', {
            protocolId: protocol.id,
            issues,
            exerciseCount: exercises.length
        });

        return protocol;
    }

    /**
     * Identify issues from screening result
     * @param {Object} screeningResult - Screening result
     * @returns {Array} Identified issues
     */
    identifyIssues(screeningResult) {
        const issues = [];

        if (screeningResult.score <= 1) {
            issues.push('significant_movement_dysfunction');
        }

        if (screeningResult.observations) {
            Object.values(screeningResult.observations).forEach(obs => {
                if (obs.compensation === 'major' || obs.compensation === 'minor') {
                    issues.push(obs.compensation);
                    issues.push(`${obs.compensation}_compensation`);
                }

                if (obs.muscleImbalance) {
                    issues.push(obs.muscleImbalance);
                }
            });
        }

        return [...new Set(issues)];
    }

    /**
     * Select exercises based on issues
     * @param {Array} issues - Identified issues
     * @returns {Array} Selected exercises
     */
    selectExercises(issues) {
        const selectedExercises = [];

        issues.forEach(issue => {
            Object.values(this.exerciseLibrary).forEach(exercise => {
                if (exercise.purpose.includes(issue) ||
                    exercise.name.toLowerCase().includes(issue.toLowerCase())) {
                    if (!selectedExercises.find(ex => ex.name === exercise.name)) {
                        selectedExercises.push(exercise);
                    }
                }
            });
        });

        return selectedExercises;
    }

    /**
     * Generate training schedule for protocol
     * @param {Array} exercises - Selected exercises
     * @returns {Object} Training schedule
     */
    generateSchedule(exercises) {
        return {
            frequency: 'Daily',
            duration: '15-20 minutes',
            timing: 'Morning or warm-up',
            sessionStructure: {
                mobility: exercises.filter(ex => ex.name.toLowerCase().includes('stretch') ||
                                                 ex.name.toLowerCase().includes('mobility')),
                activation: exercises.filter(ex => ex.name.toLowerCase().includes('activation')),
                strength: exercises.filter(ex => ex.name.toLowerCase().includes('strength') ||
                                               ex.name.toLowerCase().includes('strengthening')),
                stability: exercises.filter(ex => ex.name.toLowerCase().includes('stability'))
            }
        };
    }

    /**
     * Generate exercise progressions
     * @param {Array} exercises - Selected exercises
     * @returns {Object} Progressions
     */
    generateProgressions(exercises) {
        const progressions = {};

        exercises.forEach(exercise => {
            progressions[exercise.name] = {
                week1_2: exercise.progression[0] || exercise.instructions,
                week3_4: exercise.progression[1] || exercise.instructions,
                week5_6: exercise.progression[2] || exercise.instructions,
                criteria: 'Progressive overload and improved movement quality'
            };
        });

        return progressions;
    }

    /**
     * Get protocol by ID
     * @param {string} protocolId - Protocol ID
     * @returns {Object|null} Protocol
     */
    getProtocol(protocolId) {
        return this.activeProtocols.get(protocolId) || null;
    }

    /**
     * Get protocols for user
     * @param {string} userId - User ID
     * @returns {Array} User protocols
     */
    getUserProtocols(userId) {
        return Array.from(this.activeProtocols.values()).filter(
            protocol => protocol.userId === userId
        );
    }

    /**
     * Get exercise by name
     * @param {string} exerciseName - Exercise name
     * @returns {Object|null} Exercise
     */
    getExercise(exerciseName) {
        return this.exerciseLibrary[exerciseName.toLowerCase().replace(/\s+/g, '_')] || null;
    }

    /**
     * Get all corrective exercises
     * @returns {Array} All exercises
     */
    getAllExercises() {
        return Object.values(this.exerciseLibrary);
    }

    /**
     * Search exercises
     * @param {string} query - Search query
     * @returns {Array} Matching exercises
     */
    searchExercises(query) {
        const searchTerm = query.toLowerCase();
        return Object.values(this.exerciseLibrary).filter(exercise =>
            exercise.name.toLowerCase().includes(searchTerm) ||
            exercise.description.toLowerCase().includes(searchTerm) ||
            exercise.purpose.includes(searchTerm)
        );
    }

    /**
     * Get exercise modifications for specific issues
     * @param {string|Array} issues - Movement issues to address (can be string or array)
     * @returns {Object} Exercise modifications
     */
    getModifications(issues) {
        // Ensure issues is an array - handle both string and array inputs
        const issuesArray = Array.isArray(issues) ? issues : (issues ? [issues] : []);

        if (issuesArray.length === 0) {
            return {
                warmUp: [],
                mainExercises: [],
                coolDown: [],
                substitute: [],
                frequency: 'Daily',
                duration: '15-20 minutes'
            };
        }

        const modifications = {
            warmUp: [],
            mainExercises: [],
            coolDown: [],
            substitute: [],
            frequency: 'Daily',
            duration: '15-20 minutes'
        };

        issuesArray.forEach(issue => {
            const exercises = this.selectExercises([issue]);
            exercises.forEach(exercise => {
                if (exercise.name.toLowerCase().includes('stretch') ||
                    exercise.name.toLowerCase().includes('mobility')) {
                    modifications.warmUp.push(exercise);
                } else if (exercise.name.toLowerCase().includes('strength') ||
                           exercise.name.toLowerCase().includes('stability')) {
                    modifications.mainExercises.push(exercise);
                } else {
                    modifications.coolDown.push(exercise);
                }

                // Add exercise to substitute list if it's a corrective exercise
                if (exercise.purpose && exercise.purpose.includes(issue)) {
                    modifications.substitute.push(exercise);
                }
            });
        });

        return modifications;
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `protocol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Create global instance
window.CorrectiveExercises = new CorrectiveExercises();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CorrectiveExercises;
}
