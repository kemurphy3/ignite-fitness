/**
 * SoccerExercises - Soccer-specific exercise library
 * Comprehensive collection of soccer training exercises organized by category
 */
class SoccerExercises {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.exercises = this.initializeSoccerExercises();
    }

    /**
     * Render exercise list with virtual scrolling
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Rendering options
     */
    renderExerciseList(container, options = {}) {
        const {
            category = null,
            position = null,
            difficulty = null,
            equipment = null,
            searchTerm = '',
            onSelect = null
        } = options;
        
        // Filter exercises
        let filteredExercises = this.getAllExercises();
        
        if (category) {
            filteredExercises = filteredExercises.filter(ex => ex.category === category);
        }
        
        if (position) {
            filteredExercises = filteredExercises.filter(ex => 
                ex.positions && ex.positions.includes(position)
            );
        }
        
        if (difficulty) {
            filteredExercises = filteredExercises.filter(ex => ex.difficulty === difficulty);
        }
        
        if (equipment) {
            filteredExercises = filteredExercises.filter(ex => 
                ex.equipment && ex.equipment.includes(equipment)
            );
        }
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredExercises = filteredExercises.filter(ex => 
                ex.name.toLowerCase().includes(term) ||
                ex.description.toLowerCase().includes(term) ||
                (ex.instructions && ex.instructions.some(inst => 
                    inst.toLowerCase().includes(term)
                ))
            );
        }
        
        this.logger.debug(`Rendering ${filteredExercises.length} exercises with virtual scrolling`);
        
        // Create virtual list
        const virtualList = new VirtualList({
            container,
            items: filteredExercises,
            itemHeight: 80,
            overscan: 5,
            renderItem: (exercise, index) => this.renderExerciseItem(exercise, index, onSelect)
        });
        
        // Store reference for cleanup
        container._virtualList = virtualList;
        
        return virtualList;
    }
    
    /**
     * Render individual exercise item
     * @param {Object} exercise - Exercise data
     * @param {number} index - Item index
     * @param {Function} onSelect - Selection callback
     * @returns {HTMLElement} Exercise item element
     */
    renderExerciseItem(exercise, index, onSelect) {
        const item = document.createElement('div');
        item.className = 'exercise-item';
        item.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--color-border);
            cursor: pointer;
            transition: background-color 0.2s ease;
        `;
        
        // Exercise icon
        const icon = document.createElement('div');
        icon.className = 'exercise-icon';
        icon.style.cssText = `
            width: 48px;
            height: 48px;
            background: var(--color-primary-light);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-size: 20px;
        `;
        icon.textContent = this.getExerciseIcon(exercise.category);
        
        // Exercise content
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1;
            min-width: 0;
        `;
        
        // Exercise name
        const name = document.createElement('div');
        name.className = 'exercise-name';
        name.style.cssText = `
            font-weight: 600;
            font-size: 16px;
            color: var(--color-text);
            margin-bottom: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        `;
        name.textContent = exercise.name;
        
        // Exercise details
        const details = document.createElement('div');
        details.className = 'exercise-details';
        details.style.cssText = `
            font-size: 14px;
            color: var(--color-text-secondary);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        `;
        
        // Difficulty badge
        const difficulty = document.createElement('span');
        difficulty.className = 'difficulty-badge';
        difficulty.style.cssText = `
            background: ${this.getDifficultyColor(exercise.difficulty)};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        `;
        difficulty.textContent = exercise.difficulty;
        
        // Duration
        const duration = document.createElement('span');
        duration.textContent = exercise.duration || 'N/A';
        
        // Equipment
        const equipment = document.createElement('span');
        equipment.textContent = exercise.equipment ? exercise.equipment.join(', ') : 'No equipment';
        
        details.appendChild(difficulty);
        details.appendChild(duration);
        details.appendChild(equipment);
        
        content.appendChild(name);
        content.appendChild(details);
        
        // Add to item
        item.appendChild(icon);
        item.appendChild(content);
        
        // Add click handler
        item.addEventListener('click', () => {
            if (onSelect) {
                onSelect(exercise);
            }
        });
        
        // Add hover effects
        item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = 'var(--color-surface-hover)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = '';
        });
        
        return item;
    }
    
    /**
     * Get exercise icon based on category
     * @param {string} category - Exercise category
     * @returns {string} Icon character
     */
    getExerciseIcon(category) {
        const icons = {
            agility: '🏃',
            strength: '💪',
            endurance: '❤️',
            speed: '⚡',
            coordination: '🎯',
            flexibility: '🤸',
            balance: '⚖️',
            power: '💥',
            technical: '⚽',
            tactical: '🧠'
        };
        
        return icons[category] || '🏃';
    }
    
    /**
     * Get difficulty color
     * @param {string} difficulty - Difficulty level
     * @returns {string} Color value
     */
    getDifficultyColor(difficulty) {
        const colors = {
            beginner: '#10b981',
            intermediate: '#f59e0b',
            advanced: '#ef4444',
            expert: '#8b5cf6'
        };
        
        return colors[difficulty] || '#6b7280';
    }
    
    /**
     * Get all exercises as flat array
     * @returns {Array} All exercises
     */
    getAllExercises() {
        const allExercises = [];
        
        Object.values(this.exercises).forEach(categoryExercises => {
            allExercises.push(...categoryExercises);
        });
        
        return allExercises;
    }
    initializeSoccerExercises() {
        return {
            agility: [
                {
                    id: 'cone_weaving',
                    name: 'Cone Weaving',
                    description: 'Quick feet through cones with sharp direction changes',
                    category: 'agility',
                    positions: ['midfielder', 'forward', 'defender'],
                    equipment: ['cones'],
                    difficulty: 'beginner',
                    duration: '30-60 seconds',
                    sets: 3,
                    reps: 'continuous',
                    rest: '60 seconds',
                    instructions: [
                        'Set up 5-7 cones in a straight line, 2 yards apart',
                        'Weave through cones using quick, sharp cuts',
                        'Keep knees slightly bent and stay on balls of feet',
                        'Maintain low center of gravity',
                        'Focus on quick direction changes'
                    ],
                    progressions: [
                        'Increase cone spacing',
                        'Add ball to exercise',
                        'Increase speed',
                        'Add defender pressure'
                    ],
                    injuryPrevention: ['ankle_stability', 'change_of_direction', 'proper_warm_up'],
                    videoUrl: '/videos/cone_weaving.mp4',
                    variations: [
                        'lateral_weaving',
                        'backward_weaving',
                        'one_foot_weaving'
                    ]
                },
                {
                    id: 'ladder_drills',
                    name: 'Agility Ladder Drills',
                    description: 'Footwork patterns through agility ladder',
                    category: 'agility',
                    positions: ['all'],
                    equipment: ['agility_ladder'],
                    difficulty: 'beginner',
                    duration: '30-45 seconds',
                    sets: 3,
                    reps: 'continuous',
                    rest: '60 seconds',
                    instructions: [
                        'Place agility ladder on flat surface',
                        'Perform various footwork patterns',
                        'Stay on balls of feet',
                        'Keep arms pumping',
                        'Maintain rhythm and tempo'
                    ],
                    progressions: [
                        'basic_run',
                        'in_out',
                        'lateral_shuffle',
                        'icky_shuffle',
                        'carioca'
                    ],
                    injuryPrevention: ['ankle_stability', 'coordination', 'proper_warm_up'],
                    videoUrl: '/videos/ladder_drills.mp4',
                    variations: [
                        'single_leg_hops',
                        'lateral_movements',
                        'backward_patterns'
                    ]
                },
                {
                    id: 'reaction_drills',
                    name: 'Reaction Training',
                    description: 'Quick reaction to visual or auditory cues',
                    category: 'agility',
                    positions: ['goalkeeper', 'defender', 'midfielder'],
                    equipment: ['cones', 'reaction_balls'],
                    difficulty: 'intermediate',
                    duration: '20-30 seconds',
                    sets: 4,
                    reps: 'continuous',
                    rest: '90 seconds',
                    instructions: [
                        'Start in athletic position',
                        'React to coach\'s visual or auditory cue',
                        'Move quickly in indicated direction',
                        'Return to starting position',
                        'Stay ready for next cue'
                    ],
                    progressions: [
                        'increase_cue_speed',
                        'add_multiple_cues',
                        'add_ball_handling',
                        'add_defender_pressure'
                    ],
                    injuryPrevention: ['proper_warm_up', 'gradual_progression'],
                    videoUrl: '/videos/reaction_drills.mp4',
                    variations: [
                        'visual_cues',
                        'auditory_cues',
                        'tactile_cues'
                    ]
                }
            ],
            ball_work: [
                {
                    id: 'juggling_progressions',
                    name: 'Juggling Progressions',
                    description: 'Ball control development through juggling',
                    category: 'ball_work',
                    positions: ['all'],
                    equipment: ['soccer_ball'],
                    difficulty: 'beginner',
                    duration: '5-10 minutes',
                    sets: 3,
                    reps: 'continuous',
                    rest: '60 seconds',
                    instructions: [
                        'Start with ball in hands',
                        'Drop ball and juggle with feet',
                        'Keep ball close to body',
                        'Use both feet equally',
                        'Focus on control, not height'
                    ],
                    progressions: [
                        'beginner_10_touches',
                        'intermediate_50_touches',
                        'advanced_100_touches',
                        'expert_200_touches'
                    ],
                    injuryPrevention: ['proper_warm_up', 'gradual_progression'],
                    videoUrl: '/videos/juggling.mp4',
                    variations: [
                        'feet_only',
                        'thighs_feet',
                        'head_feet',
                        'alternating_surfaces'
                    ]
                },
                {
                    id: 'wall_passing',
                    name: 'Wall Passing',
                    description: 'Passing accuracy and first touch development',
                    category: 'ball_work',
                    positions: ['all'],
                    equipment: ['soccer_ball', 'wall'],
                    difficulty: 'beginner',
                    duration: '10-15 minutes',
                    sets: 3,
                    reps: 'continuous',
                    rest: '60 seconds',
                    instructions: [
                        'Stand 5-10 yards from wall',
                        'Pass ball against wall',
                        'Control return with first touch',
                        'Use both feet',
                        'Focus on accuracy and control'
                    ],
                    progressions: [
                        'increase_distance',
                        'add_movement',
                        'one_touch_passing',
                        'add_pressure'
                    ],
                    injuryPrevention: ['proper_warm_up', 'gradual_progression'],
                    videoUrl: '/videos/wall_passing.mp4',
                    variations: [
                        'one_touch',
                        'two_touch',
                        'moving_passing',
                        'angled_passing'
                    ]
                },
                {
                    id: 'cone_dribbling',
                    name: 'Cone Dribbling',
                    description: 'Ball control and dribbling technique',
                    category: 'ball_work',
                    positions: ['all'],
                    equipment: ['soccer_ball', 'cones'],
                    difficulty: 'beginner',
                    duration: '5-10 minutes',
                    sets: 3,
                    reps: 'continuous',
                    rest: '60 seconds',
                    instructions: [
                        'Set up cones in various patterns',
                        'Dribble through cones using different techniques',
                        'Keep ball close to feet',
                        'Use both feet',
                        'Maintain control and speed'
                    ],
                    progressions: [
                        'basic_dribbling',
                        'speed_dribbling',
                        'skill_moves',
                        'pressure_dribbling'
                    ],
                    injuryPrevention: ['proper_warm_up', 'gradual_progression'],
                    videoUrl: '/videos/cone_dribbling.mp4',
                    variations: [
                        'inside_foot',
                        'outside_foot',
                        'sole_rolls',
                        'step_overs'
                    ]
                }
            ],
            position_specific: {
                goalkeeper: [
                    {
                        id: 'diving_progressions',
                        name: 'Diving Progressions',
                        description: 'Safe diving technique development',
                        category: 'position_specific',
                        positions: ['goalkeeper'],
                        equipment: ['goals', 'mats', 'balls'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 3,
                        reps: '8-12',
                        rest: '90 seconds',
                        instructions: [
                            'Start with kneeling dives',
                            'Progress to standing dives',
                            'Focus on proper landing technique',
                            'Use arms to break fall',
                            'Keep eyes on ball'
                        ],
                        progressions: [
                            'kneeling_dives',
                            'standing_dives',
                            'full_extension_dives',
                            'reaction_dives'
                        ],
                        injuryPrevention: ['shoulder_stability', 'core_strength', 'proper_landing'],
                        videoUrl: '/videos/goalkeeper_diving.mp4',
                        variations: [
                            'low_dives',
                            'high_dives',
                            'lateral_dives',
                            'reaction_dives'
                        ]
                    },
                    {
                        id: 'distribution_training',
                        name: 'Distribution Training',
                        description: 'Throwing and kicking accuracy',
                        category: 'position_specific',
                        positions: ['goalkeeper'],
                        equipment: ['soccer_ball', 'targets'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 3,
                        reps: '10-15',
                        rest: '60 seconds',
                        instructions: [
                            'Practice various distribution techniques',
                            'Focus on accuracy over distance',
                            'Use proper technique',
                            'Target specific areas',
                            'Maintain consistency'
                        ],
                        progressions: [
                            'short_distribution',
                            'medium_distribution',
                            'long_distribution',
                            'pressure_distribution'
                        ],
                        injuryPrevention: ['proper_technique', 'gradual_progression'],
                        videoUrl: '/videos/goalkeeper_distribution.mp4',
                        variations: [
                            'roll_distribution',
                            'throw_distribution',
                            'kick_distribution',
                            'punt_distribution'
                        ]
                    }
                ],
                defender: [
                    {
                        id: 'aerial_training',
                        name: 'Aerial Training',
                        description: 'Jumping and heading technique',
                        category: 'position_specific',
                        positions: ['defender', 'midfielder'],
                        equipment: ['soccer_ball', 'cones'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 3,
                        reps: '8-12',
                        rest: '90 seconds',
                        instructions: [
                            'Practice jumping technique',
                            'Focus on timing and positioning',
                            'Use proper heading technique',
                            'Keep eyes on ball',
                            'Land safely'
                        ],
                        progressions: [
                            'standing_headers',
                            'jumping_headers',
                            'defensive_headers',
                            'attacking_headers'
                        ],
                        injuryPrevention: ['neck_strength', 'proper_technique', 'gradual_progression'],
                        videoUrl: '/videos/aerial_training.mp4',
                        variations: [
                            'defensive_headers',
                            'attacking_headers',
                            'clearing_headers',
                            'directed_headers'
                        ]
                    },
                    {
                        id: 'tackling_drills',
                        name: 'Tackling Drills',
                        description: 'Safe tackling technique and timing',
                        category: 'position_specific',
                        positions: ['defender', 'midfielder'],
                        equipment: ['soccer_ball', 'cones'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 3,
                        reps: '8-12',
                        rest: '90 seconds',
                        instructions: [
                            'Practice proper tackling technique',
                            'Focus on timing and positioning',
                            'Stay on feet when possible',
                            'Use proper body position',
                            'Follow through safely'
                        ],
                        progressions: [
                            'standing_tackles',
                            'sliding_tackles',
                            'pressure_tackles',
                            'game_situation_tackles'
                        ],
                        injuryPrevention: ['proper_technique', 'gradual_progression', 'warm_up'],
                        videoUrl: '/videos/tackling_drills.mp4',
                        variations: [
                            'block_tackles',
                            'slide_tackles',
                            'interceptions',
                            'recovery_tackles'
                        ]
                    }
                ],
                midfielder: [
                    {
                        id: 'passing_patterns',
                        name: 'Passing Patterns',
                        description: 'Passing accuracy and vision development',
                        category: 'position_specific',
                        positions: ['midfielder', 'all'],
                        equipment: ['soccer_ball', 'cones'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 3,
                        reps: 'continuous',
                        rest: '60 seconds',
                        instructions: [
                            'Set up passing patterns with teammates',
                            'Focus on accuracy and timing',
                            'Use both feet',
                            'Maintain good body position',
                            'Communicate with teammates'
                        ],
                        progressions: [
                            'short_passing',
                            'medium_passing',
                            'long_passing',
                            'pressure_passing'
                        ],
                        injuryPrevention: ['proper_technique', 'gradual_progression'],
                        videoUrl: '/videos/passing_patterns.mp4',
                        variations: [
                            'one_touch_passing',
                            'two_touch_passing',
                            'moving_passing',
                            'pressure_passing'
                        ]
                    },
                    {
                        id: 'endurance_running',
                        name: 'Endurance Running',
                        description: 'Aerobic capacity and work rate development',
                        category: 'position_specific',
                        positions: ['midfielder', 'all'],
                        equipment: ['track_or_field'],
                        difficulty: 'intermediate',
                        duration: '20-30 minutes',
                        sets: 1,
                        reps: 'continuous',
                        rest: 'none',
                        instructions: [
                            'Maintain steady pace',
                            'Focus on breathing rhythm',
                            'Keep good running form',
                            'Stay relaxed',
                            'Finish strong'
                        ],
                        progressions: [
                            'easy_pace',
                            'moderate_pace',
                            'tempo_pace',
                            'threshold_pace'
                        ],
                        injuryPrevention: ['proper_warm_up', 'gradual_progression', 'good_form'],
                        videoUrl: '/videos/endurance_running.mp4',
                        variations: [
                            'steady_state',
                            'tempo_runs',
                            'fartlek',
                            'interval_training'
                        ]
                    }
                ],
                forward: [
                    {
                        id: 'finishing_drills',
                        name: 'Finishing Drills',
                        description: 'Shooting and goal scoring technique',
                        category: 'position_specific',
                        positions: ['forward', 'midfielder'],
                        equipment: ['soccer_ball', 'goals'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 3,
                        reps: '10-15',
                        rest: '60 seconds',
                        instructions: [
                            'Practice various shooting techniques',
                            'Focus on accuracy and power',
                            'Use both feet',
                            'Maintain good body position',
                            'Follow through properly'
                        ],
                        progressions: [
                            'static_shooting',
                            'moving_shooting',
                            'pressure_shooting',
                            'game_situation_shooting'
                        ],
                        injuryPrevention: ['proper_technique', 'gradual_progression'],
                        videoUrl: '/videos/finishing_drills.mp4',
                        variations: [
                            'inside_foot',
                            'laces',
                            'chip_shots',
                            'volleys'
                        ]
                    },
                    {
                        id: 'sprint_training',
                        name: 'Sprint Training',
                        description: 'Speed and acceleration development',
                        category: 'position_specific',
                        positions: ['forward', 'all'],
                        equipment: ['cones', 'track'],
                        difficulty: 'intermediate',
                        duration: '15-20 minutes',
                        sets: 4,
                        reps: '4-6',
                        rest: '2-3 minutes',
                        instructions: [
                            'Focus on proper sprint technique',
                            'Maintain good body position',
                            'Drive knees up',
                            'Pump arms efficiently',
                            'Finish each sprint strong'
                        ],
                        progressions: [
                            'short_sprints',
                            'medium_sprints',
                            'long_sprints',
                            'sport_specific_sprints'
                        ],
                        injuryPrevention: ['proper_warm_up', 'gradual_progression', 'good_form'],
                        videoUrl: '/videos/sprint_training.mp4',
                        variations: [
                            'acceleration_sprints',
                            'max_speed_sprints',
                            'speed_endurance',
                            'sport_specific_sprints'
                        ]
                    }
                ]
            },
            strength: [
                {
                    id: 'squats',
                    name: 'Squats',
                    description: 'Lower body strength and power development',
                    category: 'strength',
                    positions: ['all'],
                    equipment: ['barbell', 'weights'],
                    difficulty: 'intermediate',
                    duration: '20-30 minutes',
                    sets: 3,
                    reps: '8-12',
                    rest: '2-3 minutes',
                    instructions: [
                        'Stand with feet shoulder-width apart',
                        'Lower body by bending knees and hips',
                        'Keep chest up and core engaged',
                        'Descend until thighs parallel to floor',
                        'Drive through heels to return to start'
                    ],
                    progressions: [
                        'bodyweight_squats',
                        'goblet_squats',
                        'back_squats',
                        'front_squats'
                    ],
                    injuryPrevention: ['proper_form', 'gradual_progression', 'warm_up'],
                    videoUrl: '/videos/squats.mp4',
                    variations: [
                        'back_squats',
                        'front_squats',
                        'goblet_squats',
                        'single_leg_squats'
                    ]
                },
                {
                    id: 'deadlifts',
                    name: 'Deadlifts',
                    description: 'Posterior chain strength development',
                    category: 'strength',
                    positions: ['all'],
                    equipment: ['barbell', 'weights'],
                    difficulty: 'intermediate',
                    duration: '20-30 minutes',
                    sets: 3,
                    reps: '5-8',
                    rest: '3-4 minutes',
                    instructions: [
                        'Stand with feet hip-width apart',
                        'Hinge at hips to lower bar',
                        'Keep back straight and core engaged',
                        'Drive through heels to lift bar',
                        'Stand tall at top'
                    ],
                    progressions: [
                        'romanian_deadlifts',
                        'conventional_deadlifts',
                        'sumo_deadlifts',
                        'single_leg_deadlifts'
                    ],
                    injuryPrevention: ['proper_form', 'gradual_progression', 'warm_up'],
                    videoUrl: '/videos/deadlifts.mp4',
                    variations: [
                        'conventional_deadlifts',
                        'sumo_deadlifts',
                        'romanian_deadlifts',
                        'single_leg_deadlifts'
                    ]
                }
            ],
            conditioning: [
                {
                    id: 'interval_training',
                    name: 'Interval Training',
                    description: 'High-intensity aerobic and anaerobic conditioning',
                    category: 'conditioning',
                    positions: ['all'],
                    equipment: ['track_or_field'],
                    difficulty: 'advanced',
                    duration: '20-30 minutes',
                    sets: 'variable',
                    reps: 'variable',
                    rest: 'variable',
                    instructions: [
                        'Warm up thoroughly',
                        'Perform high-intensity intervals',
                        'Recover between intervals',
                        'Maintain good form',
                        'Cool down properly'
                    ],
                    progressions: [
                        'short_intervals',
                        'medium_intervals',
                        'long_intervals',
                        'mixed_intervals'
                    ],
                    injuryPrevention: ['proper_warm_up', 'gradual_progression', 'good_form'],
                    videoUrl: '/videos/interval_training.mp4',
                    variations: [
                        'sprint_intervals',
                        'tempo_intervals',
                        'fartlek',
                        'threshold_intervals'
                    ]
                }
            ]
        };
    }

    /**
     * Get exercises by category
     * @param {string} category - Exercise category
     * @returns {Array} Exercises in category
     */
    getExercisesByCategory(category) {
        if (category === 'position_specific') {
            // Flatten position-specific exercises
            const positionExercises = [];
            Object.values(this.exercises.position_specific).forEach(positionGroup => {
                positionExercises.push(...positionGroup);
            });
            return positionExercises;
        }
        return this.exercises[category] || [];
    }

    /**
     * Get exercises for specific position
     * @param {string} position - Player position
     * @returns {Array} Position-specific exercises
     */
    getExercisesForPosition(position) {
        const exercises = [];
        
        // Get general exercises
        Object.keys(this.exercises).forEach(category => {
            if (category !== 'position_specific') {
                this.exercises[category].forEach(exercise => {
                    if (exercise.positions.includes(position) || exercise.positions.includes('all')) {
                        exercises.push(exercise);
                    }
                });
            }
        });

        // Get position-specific exercises
        if (this.exercises.position_specific[position]) {
            exercises.push(...this.exercises.position_specific[position]);
        }

        return exercises;
    }

    /**
     * Get exercise by ID
     * @param {string} exerciseId - Exercise ID
     * @returns {Object|null} Exercise
     */
    getExercise(exerciseId) {
        for (const category in this.exercises) {
            if (category === 'position_specific') {
                for (const position in this.exercises[category]) {
                    const exercise = this.exercises[category][position].find(ex => ex.id === exerciseId);
                    if (exercise) return exercise;
                }
            } else {
                const exercise = this.exercises[category].find(ex => ex.id === exerciseId);
                if (exercise) return exercise;
            }
        }
        return null;
    }

    /**
     * Get exercises by difficulty
     * @param {string} difficulty - Difficulty level
     * @returns {Array} Exercises at difficulty level
     */
    getExercisesByDifficulty(difficulty) {
        const exercises = [];
        
        Object.keys(this.exercises).forEach(category => {
            if (category === 'position_specific') {
                Object.values(this.exercises[category]).forEach(positionGroup => {
                    positionGroup.forEach(exercise => {
                        if (exercise.difficulty === difficulty) {
                            exercises.push(exercise);
                        }
                    });
                });
            } else {
                this.exercises[category].forEach(exercise => {
                    if (exercise.difficulty === difficulty) {
                        exercises.push(exercise);
                    }
                });
            }
        });

        return exercises;
    }

    /**
     * Get exercises by equipment
     * @param {Array} availableEquipment - Available equipment
     * @returns {Array} Exercises that can be performed
     */
    getExercisesByEquipment(availableEquipment) {
        const exercises = [];
        
        Object.keys(this.exercises).forEach(category => {
            if (category === 'position_specific') {
                Object.values(this.exercises[category]).forEach(positionGroup => {
                    positionGroup.forEach(exercise => {
                        if (this.canPerformExercise(exercise, availableEquipment)) {
                            exercises.push(exercise);
                        }
                    });
                });
            } else {
                this.exercises[category].forEach(exercise => {
                    if (this.canPerformExercise(exercise, availableEquipment)) {
                        exercises.push(exercise);
                    }
                });
            }
        });

        return exercises;
    }

    /**
     * Check if exercise can be performed with available equipment
     * @param {Object} exercise - Exercise
     * @param {Array} availableEquipment - Available equipment
     * @returns {boolean} Can perform exercise
     */
    canPerformExercise(exercise, availableEquipment) {
        return exercise.equipment.every(equipment => 
            availableEquipment.includes(equipment) || equipment === 'none'
        );
    }

    /**
     * Get exercise progressions
     * @param {string} exerciseId - Exercise ID
     * @returns {Array} Exercise progressions
     */
    getExerciseProgressions(exerciseId) {
        const exercise = this.getExercise(exerciseId);
        return exercise ? exercise.progressions : [];
    }

    /**
     * Get exercise variations
     * @param {string} exerciseId - Exercise ID
     * @returns {Array} Exercise variations
     */
    getExerciseVariations(exerciseId) {
        const exercise = this.getExercise(exerciseId);
        return exercise ? exercise.variations : [];
    }

    /**
     * Get injury prevention exercises
     * @param {string} injuryType - Type of injury
     * @returns {Array} Prevention exercises
     */
    getInjuryPreventionExercises(injuryType) {
        const exercises = [];
        
        Object.keys(this.exercises).forEach(category => {
            if (category === 'position_specific') {
                Object.values(this.exercises[category]).forEach(positionGroup => {
                    positionGroup.forEach(exercise => {
                        if (exercise.injuryPrevention.includes(injuryType)) {
                            exercises.push(exercise);
                        }
                    });
                });
            } else {
                this.exercises[category].forEach(exercise => {
                    if (exercise.injuryPrevention.includes(injuryType)) {
                        exercises.push(exercise);
                    }
                });
            }
        });

        return exercises;
    }

    /**
     * Search exercises
     * @param {string} query - Search query
     * @returns {Array} Matching exercises
     */
    searchExercises(query) {
        const exercises = [];
        const searchTerm = query.toLowerCase();
        
        Object.keys(this.exercises).forEach(category => {
            if (category === 'position_specific') {
                Object.values(this.exercises[category]).forEach(positionGroup => {
                    positionGroup.forEach(exercise => {
                        if (this.matchesSearch(exercise, searchTerm)) {
                            exercises.push(exercise);
                        }
                    });
                });
            } else {
                this.exercises[category].forEach(exercise => {
                    if (this.matchesSearch(exercise, searchTerm)) {
                        exercises.push(exercise);
                    }
                });
            }
        });

        return exercises;
    }

    /**
     * Check if exercise matches search query
     * @param {Object} exercise - Exercise
     * @param {string} searchTerm - Search term
     * @returns {boolean} Matches search
     */
    matchesSearch(exercise, searchTerm) {
        return exercise.name.toLowerCase().includes(searchTerm) ||
               exercise.description.toLowerCase().includes(searchTerm) ||
               exercise.category.toLowerCase().includes(searchTerm) ||
               exercise.instructions.some(instruction => 
                   instruction.toLowerCase().includes(searchTerm)
               );
    }

    /**
     * Get all exercise categories
     * @returns {Array} Exercise categories
     */
    getCategories() {
        return Object.keys(this.exercises);
    }

    /**
     * Get exercise statistics
     * @returns {Object} Exercise statistics
     */
    getStatistics() {
        const stats = {
            totalExercises: 0,
            byCategory: {},
            byDifficulty: {},
            byPosition: {}
        };

        Object.keys(this.exercises).forEach(category => {
            if (category === 'position_specific') {
                Object.entries(this.exercises[category]).forEach(([position, exercises]) => {
                    stats.byPosition[position] = exercises.length;
                    stats.totalExercises += exercises.length;
                });
            } else {
                stats.byCategory[category] = this.exercises[category].length;
                stats.totalExercises += this.exercises[category].length;
            }
        });

        return stats;
    }
}

// Create global instance
window.SoccerExercises = new SoccerExercises();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoccerExercises;
}
