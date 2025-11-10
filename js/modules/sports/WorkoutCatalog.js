/**
 * WorkoutCatalog - Comprehensive multi-sport workout catalog
 * Provides structured workout templates for Running, Cycling, and Swimming
 * Uses universal Z1-Z5 zone system for intensity targeting
 */

class WorkoutCatalog {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.workouts = this.initializeWorkouts();
    }

    /**
     * Initialize comprehensive workout catalog
     * Minimum 50 workouts across all modalities
     * @returns {Object} Complete workout catalog
     */
    initializeWorkouts() {
        return {
            running: {
                track: this.getRunningTrackWorkouts(),
                tempo: this.getRunningTempoWorkouts(),
                hills: this.getRunningHillWorkouts(),
                soccer: this.getSoccerShapeWorkouts()
            },
            cycling: {
                endurance: this.getCyclingEnduranceWorkouts(),
                tempo: this.getCyclingTempoWorkouts(),
                vo2: this.getCyclingVO2Workouts(),
                cadence: this.getCyclingCadenceWorkouts()
            },
            swimming: {
                aerobic: this.getSwimmingAerobicWorkouts(),
                threshold: this.getSwimmingThresholdWorkouts(),
                vo2: this.getSwimmingVO2Workouts()
            }
        };
    }

    /**
     * Get running track workouts
     * @returns {Array} Track workout templates
     */
    getRunningTrackWorkouts() {
        return [
            {
                id: 'track_200m_repeats',
                name: '12x200m Track Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1', description: 'Easy jog warmup' },
                    { type: 'drills', duration: 5, intensity: 'Z1', description: 'Dynamic warmup drills' },
                    {
                        type: 'main',
                        sets: 12,
                        work: { duration: 60, intensity: 'Z4', distance: 200, unit: 'm' },
                        rest: { duration: 90, intensity: 'Z1', description: 'Walk/jog recovery' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1', description: 'Easy jog cooldown' }
                ],
                adaptation: 'VO2 max, speed',
                estimatedLoad: 85,
                equipment: ['track'],
                timeRequired: 45
            },
            {
                id: 'track_300m_repeats',
                name: '10x300m Track Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { duration: 75, intensity: 'Z4', distance: 300, unit: 'm' },
                        rest: { duration: 120, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, anaerobic capacity',
                estimatedLoad: 88,
                equipment: ['track'],
                timeRequired: 50
            },
            {
                id: 'track_400m_repeats',
                name: '8x400m Track Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 8,
                        work: { duration: 90, intensity: 'Z4', distance: 400, unit: 'm' },
                        rest: { duration: 180, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, lactate tolerance',
                estimatedLoad: 85,
                equipment: ['track'],
                timeRequired: 55
            },
            {
                id: 'track_800m_repeats',
                name: '6x800m Track Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 6,
                        work: { duration: 180, intensity: 'Z4', distance: 800, unit: 'm' },
                        rest: { duration: 240, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, aerobic power',
                estimatedLoad: 82,
                equipment: ['track'],
                timeRequired: 60
            },
            {
                id: 'track_mile_repeats',
                name: '5x1 Mile Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 5,
                        work: { duration: 360, intensity: 'Z4', distance: 1609, unit: 'm' },
                        rest: { duration: 480, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic power, threshold',
                estimatedLoad: 90,
                equipment: ['track'],
                timeRequired: 75
            },
            {
                id: 'track_200_400_600_pyramid',
                name: '200-400-600m Pyramid',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Pyramid: 200m-400m-600m-400m-200m',
                        sets: 5,
                        work: [
                            { distance: 200, intensity: 'Z4', duration: 60 },
                            { distance: 400, intensity: 'Z4', duration: 90 },
                            { distance: 600, intensity: 'Z4', duration: 120 },
                            { distance: 400, intensity: 'Z4', duration: 90 },
                            { distance: 200, intensity: 'Z4', duration: 60 }
                        ],
                        rest: { duration: 90, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, varied pace',
                estimatedLoad: 85,
                equipment: ['track'],
                timeRequired: 50
            },
            {
                id: 'track_100m_sprints',
                name: '16x100m Sprint Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 10, intensity: 'Z1', description: 'Form drills' },
                    {
                        type: 'main',
                        sets: 16,
                        work: { duration: 20, intensity: 'Z5', distance: 100, unit: 'm' },
                        rest: { duration: 60, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Speed, power, form',
                estimatedLoad: 80,
                equipment: ['track'],
                timeRequired: 45
            },
            {
                id: 'track_1200m_repeats',
                name: '4x1200m Track Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 4,
                        work: { duration: 300, intensity: 'Z4', distance: 1200, unit: 'm' },
                        rest: { duration: 360, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic power, threshold',
                estimatedLoad: 88,
                equipment: ['track'],
                timeRequired: 65
            },
            {
                id: 'track_150m_strides',
                name: '10x150m Strides',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { duration: 30, intensity: 'Z3-Z4', distance: 150, unit: 'm' },
                        rest: { duration: 60, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Form, turnover, efficiency',
                estimatedLoad: 60,
                equipment: ['track'],
                timeRequired: 35
            },
            {
                id: 'track_ladder_200_800',
                name: 'Ladder: 200-400-600-800-600-400-200m',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'drills', duration: 5, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Ladder workout',
                        sets: 7,
                        work: [
                            { distance: 200, intensity: 'Z4', duration: 60 },
                            { distance: 400, intensity: 'Z4', duration: 90 },
                            { distance: 600, intensity: 'Z4', duration: 120 },
                            { distance: 800, intensity: 'Z4', duration: 180 },
                            { distance: 600, intensity: 'Z4', duration: 120 },
                            { distance: 400, intensity: 'Z4', duration: 90 },
                            { distance: 200, intensity: 'Z4', duration: 60 }
                        ],
                        rest: { duration: 90, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, varied pacing',
                estimatedLoad: 87,
                equipment: ['track'],
                timeRequired: 60
            }
        ];
    }

    /**
     * Get running tempo workouts
     * @returns {Array} Tempo workout templates
     */
    getRunningTempoWorkouts() {
        return [
            {
                id: 'tempo_20min',
                name: '20min Tempo Run',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'main', duration: 20, intensity: 'Z3', description: 'Comfortably hard pace' },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold',
                estimatedLoad: 75,
                equipment: [],
                timeRequired: 45
            },
            {
                id: 'tempo_30min',
                name: '30min Tempo Run',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'main', duration: 30, intensity: 'Z3', description: 'Steady threshold pace' },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold, aerobic capacity',
                estimatedLoad: 80,
                equipment: [],
                timeRequired: 60
            },
            {
                id: 'tempo_3x10min',
                name: '3x10min Tempo Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 3,
                        work: { duration: 10, intensity: 'Z3', description: 'Threshold effort' },
                        rest: { duration: 3, intensity: 'Z1', description: 'Easy jog recovery' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold',
                estimatedLoad: 78,
                equipment: [],
                timeRequired: 55
            },
            {
                id: 'tempo_2x15min',
                name: '2x15min Tempo Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 2,
                        work: { duration: 15, intensity: 'Z3', description: 'Threshold pace' },
                        rest: { duration: 5, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold, aerobic power',
                estimatedLoad: 80,
                equipment: [],
                timeRequired: 65
            },
            {
                id: 'tempo_progressive',
                name: 'Progressive Tempo Run',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Progressive tempo: 5min Z2, 10min Z3, 5min Z4',
                        work: [
                            { duration: 5, intensity: 'Z2', description: 'Build-up' },
                            { duration: 10, intensity: 'Z3', description: 'Threshold' },
                            { duration: 5, intensity: 'Z4', description: 'Hard finish' }
                        ]
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Threshold, aerobic power',
                estimatedLoad: 82,
                equipment: [],
                timeRequired: 50
            }
        ];
    }

    /**
     * Get running hill workouts
     * @returns {Array} Hill workout templates
     */
    getRunningHillWorkouts() {
        return [
            {
                id: 'hill_8x30s',
                name: '8x30s Hill Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 8,
                        work: { duration: 30, intensity: 'Z5', description: 'Hard uphill effort' },
                        rest: { duration: 90, intensity: 'Z1', description: 'Walk down recovery' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Power, strength',
                estimatedLoad: 80,
                equipment: ['hills']
            },
            {
                id: 'hill_6x45s',
                name: '6x45s Hill Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 6,
                        work: { duration: 45, intensity: 'Z5', description: 'Hard uphill' },
                        rest: { duration: 120, intensity: 'Z1', description: 'Walk down' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Power, anaerobic capacity',
                estimatedLoad: 82,
                equipment: ['hills']
            },
            {
                id: 'hill_10x20s',
                name: '10x20s Hill Sprints',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { duration: 20, intensity: 'Z5', description: 'Max effort sprint' },
                        rest: { duration: 60, intensity: 'Z1', description: 'Walk down' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Power, speed, form',
                estimatedLoad: 78,
                equipment: ['hills']
            },
            {
                id: 'hill_long_repeats',
                name: '5x90s Hill Repeats',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 5,
                        work: { duration: 90, intensity: 'Z4', description: 'Sustained hill effort' },
                        rest: { duration: 180, intensity: 'Z1', description: 'Walk/jog down' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic power, strength',
                estimatedLoad: 85,
                equipment: ['hills']
            },
            {
                id: 'hill_continuous',
                name: '20min Continuous Hill Run',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'main', duration: 20, intensity: 'Z3-Z4', description: 'Continuous hill effort' },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic power, strength endurance',
                estimatedLoad: 83,
                equipment: ['hills']
            }
        ];
    }

    /**
     * Get soccer-specific shape sessions
     * @returns {Array} Soccer shape workout templates
     */
    getSoccerShapeWorkouts() {
        return [
            {
                id: 'soccer_shuttle_pyramid',
                name: 'Soccer Shuttle Pyramid',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Shuttle runs: 10m-20m-30m-20m-10m',
                        sets: 6,
                        work: { type: 'shuttle', pattern: [10, 20, 30, 20, 10], intensity: 'Z4', unit: 'm' },
                        rest: { duration: 60, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Agility, change of direction',
                estimatedLoad: 70,
                equipment: ['field', 'cones']
            },
            {
                id: 'soccer_yo_yo_test',
                name: 'Yo-Yo Intermittent Test Shape',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: '20m shuttle runs with progressive speed',
                        sets: 12,
                        work: { type: 'shuttle', distance: 20, intensity: 'Z4-Z5', unit: 'm' },
                        rest: { duration: 10, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Repeated sprint ability, VO2 max',
                estimatedLoad: 88,
                equipment: ['field', 'cones']
            },
            {
                id: 'soccer_30_15_ift',
                name: '30-15 Intermittent Fitness Test Shape',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: '30s run / 15s walk intervals',
                        sets: 8,
                        work: { duration: 30, intensity: 'Z4', description: 'Hard run' },
                        rest: { duration: 15, intensity: 'Z1', description: 'Walk recovery' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Intermittent fitness, game readiness',
                estimatedLoad: 75,
                equipment: ['field']
            },
            {
                id: 'soccer_5v5_shape',
                name: '5v5 Small-Sided Game Shape',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2', description: 'Dynamic warmup' },
                    {
                        type: 'main',
                        description: '5v5 game with high intensity',
                        sets: 4,
                        work: { duration: 300, intensity: 'Z4-Z5', description: '5min game' },
                        rest: { duration: 120, intensity: 'Z1', description: '2min rest' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Game fitness, decision making',
                estimatedLoad: 85,
                equipment: ['field', 'balls']
            },
            {
                id: 'soccer_300m_shuttles',
                name: '6x300m Shuttle Runs',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: '300m shuttle (6x50m out and back)',
                        sets: 6,
                        work: { type: 'shuttle', distance: 50, sets: 6, intensity: 'Z4', unit: 'm' },
                        rest: { duration: 180, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Repeated sprint ability, anaerobic capacity',
                estimatedLoad: 82,
                equipment: ['field', 'cones']
            },
            {
                id: 'soccer_400m_repeats',
                name: '8x400m Field Repeats',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 8,
                        work: { duration: 90, intensity: 'Z4', distance: 400, unit: 'm' },
                        rest: { duration: 90, intensity: 'Z1', description: 'Walk/jog recovery' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic power, game fitness',
                estimatedLoad: 80,
                equipment: ['field']
            },
            {
                id: 'soccer_sprint_recovery',
                name: 'Sprint-Recovery Intervals',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: '40m sprint / 20s recovery',
                        sets: 12,
                        work: { duration: 8, intensity: 'Z5', distance: 40, unit: 'm' },
                        rest: { duration: 20, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Repeated sprint ability, speed',
                estimatedLoad: 78,
                equipment: ['field', 'cones']
            }
        ];
    }

    /**
     * Get cycling endurance workouts
     * @returns {Array} Endurance workout templates
     */
    getCyclingEnduranceWorkouts() {
        return [
            {
                id: 'cycling_z2_60min',
                name: '60min Z2 Endurance',
                structure: [
                    { type: 'warmup', duration: 10, intensity: 'Z1' },
                    { type: 'main', duration: 50, intensity: 'Z2', description: 'Steady aerobic pace' },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic base',
                estimatedLoad: 60,
                equipment: ['bike'],
                timeRequired: 70
            },
            {
                id: 'cycling_z2_90min',
                name: '90min Z2 Endurance',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'main', duration: 75, intensity: 'Z2', description: 'Long aerobic ride' },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic base, fat oxidation',
                estimatedLoad: 70,
                equipment: ['bike'],
                timeRequired: 105
            },
            {
                id: 'cycling_z2_120min',
                name: '2 Hour Z2 Endurance',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    { type: 'main', duration: 105, intensity: 'Z2', description: 'Extended aerobic ride' },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic base, endurance',
                estimatedLoad: 75,
                equipment: ['bike'],
                timeRequired: 135
            },
            {
                id: 'cycling_sweet_spot_60',
                name: '60min Sweet Spot (Z3-Z4)',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    { type: 'main', duration: 45, intensity: 'Z3-Z4', description: 'Sweet spot training' },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic power, threshold',
                estimatedLoad: 82,
                equipment: ['bike'],
                timeRequired: 75
            },
            {
                id: 'cycling_z2_intervals',
                name: '4x20min Z2 Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 4,
                        work: { duration: 20, intensity: 'Z2', description: 'Aerobic interval' },
                        rest: { duration: 5, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic base, consistency',
                estimatedLoad: 68,
                equipment: ['bike'],
                timeRequired: 90
            }
        ];
    }

    /**
     * Get cycling tempo workouts
     * @returns {Array} Tempo workout templates
     */
    getCyclingTempoWorkouts() {
        return [
            {
                id: 'cycling_3x8_tempo',
                name: '3x8min Tempo Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 3,
                        work: { duration: 8, intensity: 'Z3', description: 'Tempo effort' },
                        rest: { duration: 3, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Threshold power',
                estimatedLoad: 75,
                equipment: ['bike'],
                timeRequired: 55
            },
            {
                id: 'cycling_2x12_tempo',
                name: '2x12min Tempo Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 2,
                        work: { duration: 12, intensity: 'Z3', description: 'Extended tempo' },
                        rest: { duration: 5, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Threshold power, aerobic capacity',
                estimatedLoad: 78,
                equipment: ['bike'],
                timeRequired: 60
            },
            {
                id: 'cycling_4x6_tempo',
                name: '4x6min Tempo Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 4,
                        work: { duration: 6, intensity: 'Z3', description: 'Tempo effort' },
                        rest: { duration: 2, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Threshold power',
                estimatedLoad: 72,
                equipment: ['bike'],
                timeRequired: 50
            },
            {
                id: 'cycling_20min_tempo',
                name: '20min Tempo Ride',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    { type: 'main', duration: 20, intensity: 'Z3', description: 'Steady tempo' },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Threshold power',
                estimatedLoad: 77,
                equipment: ['bike'],
                timeRequired: 50
            },
            {
                id: 'cycling_overunder',
                name: 'Over-Under Threshold',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        description: '3min Z3, 1min Z4, repeat 4x',
                        sets: 4,
                        work: [
                            { duration: 3, intensity: 'Z3' },
                            { duration: 1, intensity: 'Z4' }
                        ],
                        rest: { duration: 2, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'Threshold, power variability',
                estimatedLoad: 80,
                equipment: ['bike'],
                timeRequired: 55
            }
        ];
    }

    /**
     * Get cycling VO2 max workouts
     * @returns {Array} VO2 workout templates
     */
    getCyclingVO2Workouts() {
        return [
            {
                id: 'cycling_30_30',
                name: '8x(30s on / 30s off)',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 8,
                        work: { duration: 0.5, intensity: 'Z5', description: 'Hard effort' },
                        rest: { duration: 0.5, intensity: 'Z1', description: 'Easy spin' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max',
                estimatedLoad: 85,
                equipment: ['bike'],
                timeRequired: 45
            },
            {
                id: 'cycling_40_20',
                name: '10x(40s on / 20s off)',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { duration: 40, intensity: 'Z5', description: 'Hard effort' },
                        rest: { duration: 20, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max',
                estimatedLoad: 88,
                equipment: ['bike'],
                timeRequired: 45
            },
            {
                id: 'cycling_5x3min_vo2',
                name: '5x3min VO2 Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 5,
                        work: { duration: 3, intensity: 'Z5', description: 'VO2 effort' },
                        rest: { duration: 3, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, aerobic power',
                estimatedLoad: 90,
                equipment: ['bike'],
                timeRequired: 60
            },
            {
                id: 'cycling_4x4min_vo2',
                name: '4x4min VO2 Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 4,
                        work: { duration: 4, intensity: 'Z5', description: 'Hard VO2 effort' },
                        rest: { duration: 4, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max',
                estimatedLoad: 92,
                equipment: ['bike'],
                timeRequired: 65
            },
            {
                id: 'cycling_60_60',
                name: '6x(60s on / 60s off)',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 6,
                        work: { duration: 1, intensity: 'Z5', description: 'Hard effort' },
                        rest: { duration: 1, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 15, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, anaerobic capacity',
                estimatedLoad: 85,
                equipment: ['bike'],
                timeRequired: 40
            }
        ];
    }

    /**
     * Get cycling cadence drill workouts
     * @returns {Array} Cadence workout templates
     */
    getCyclingCadenceWorkouts() {
        return [
            {
                id: 'cycling_cadence_drills',
                name: 'Cadence Drill Session',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Alternating high/low cadence',
                        sets: 6,
                        work: { duration: 2, cadence: 110, intensity: 'Z2' },
                        rest: { duration: 2, cadence: 70, intensity: 'Z2' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Pedaling efficiency',
                estimatedLoad: 55,
                equipment: ['bike'],
                timeRequired: 45
            },
            {
                id: 'cycling_high_cadence_90s',
                name: '5x90s High Cadence Drills',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        sets: 5,
                        work: { duration: 1.5, cadence: 110, intensity: 'Z2' },
                        rest: { duration: 1.5, cadence: 90, intensity: 'Z2' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Pedaling efficiency, neuromuscular',
                estimatedLoad: 58,
                equipment: ['bike'],
                timeRequired: 45
            },
            {
                id: 'cycling_single_leg',
                name: 'Single-Leg Cadence Drills',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Single-leg drills: 30s each leg, 30s both',
                        sets: 6,
                        work: [
                            { duration: 0.5, cadence: 90, intensity: 'Z2', leg: 'left' },
                            { duration: 0.5, cadence: 90, intensity: 'Z2', leg: 'right' },
                            { duration: 0.5, cadence: 90, intensity: 'Z2', leg: 'both' }
                        ],
                        rest: { duration: 1, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Pedaling efficiency, balance',
                estimatedLoad: 52,
                equipment: ['bike'],
                timeRequired: 40
            },
            {
                id: 'cycling_cadence_under',
                name: 'Cadence Under Power Intervals',
                structure: [
                    { type: 'warmup', duration: 15, intensity: 'Z1' },
                    {
                        type: 'main',
                        description: 'Low cadence (60rpm) at high power',
                        sets: 6,
                        work: { duration: 3, cadence: 60, intensity: 'Z4', description: 'High power, low cadence' },
                        rest: { duration: 2, cadence: 90, intensity: 'Z1' }
                    },
                    { type: 'cooldown', duration: 10, intensity: 'Z1' }
                ],
                adaptation: 'Strength, power development',
                estimatedLoad: 75,
                equipment: ['bike'],
                timeRequired: 50
            }
        ];
    }

    /**
     * Get swimming aerobic workouts
     * @returns {Array} Aerobic swim workout templates
     */
    getSwimmingAerobicWorkouts() {
        return [
            {
                id: 'swim_3000_aerobic',
                name: '3000m Aerobic Swim',
                structure: [
                    { type: 'warmup', distance: 400, intensity: 'Z1', stroke: 'free' },
                    { type: 'main', distance: 2200, intensity: 'Z2', description: 'Steady aerobic pace' },
                    { type: 'cooldown', distance: 400, intensity: 'Z1', stroke: 'choice' }
                ],
                adaptation: 'Aerobic capacity',
                estimatedLoad: 65,
                equipment: ['pool']
            },
            {
                id: 'swim_2500_aerobic',
                name: '2500m Aerobic Swim',
                structure: [
                    { type: 'warmup', distance: 400, intensity: 'Z1', stroke: 'free' },
                    { type: 'main', distance: 1700, intensity: 'Z2', description: 'Aerobic base' },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic capacity',
                estimatedLoad: 60,
                equipment: ['pool']
            },
            {
                id: 'swim_4000_aerobic',
                name: '4000m Aerobic Swim',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1', stroke: 'free' },
                    { type: 'main', distance: 3000, intensity: 'Z2', description: 'Long aerobic swim' },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic capacity, endurance',
                estimatedLoad: 72,
                equipment: ['pool']
            },
            {
                id: 'swim_10x200_aerobic',
                name: '10x200m Aerobic Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { distance: 200, intensity: 'Z2', stroke: 'free' },
                        rest: { duration: 20, description: '20s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic capacity, consistency',
                estimatedLoad: 68,
                equipment: ['pool']
            },
            {
                id: 'swim_5x400_aerobic',
                name: '5x400m Aerobic Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 5,
                        work: { distance: 400, intensity: 'Z2', stroke: 'free' },
                        rest: { duration: 30, description: '30s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Aerobic capacity, pacing',
                estimatedLoad: 70,
                equipment: ['pool']
            }
        ];
    }

    /**
     * Get swimming threshold workouts
     * @returns {Array} Threshold swim workout templates
     */
    getSwimmingThresholdWorkouts() {
        return [
            {
                id: 'swim_10x100_threshold',
                name: '10x100m Threshold Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { distance: 100, intensity: 'Z3', stroke: 'free' },
                        rest: { duration: 20, description: '20s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold',
                estimatedLoad: 75,
                equipment: ['pool']
            },
            {
                id: 'swim_8x150_threshold',
                name: '8x150m Threshold Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 8,
                        work: { distance: 150, intensity: 'Z3', stroke: 'free' },
                        rest: { duration: 25, description: '25s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold, aerobic power',
                estimatedLoad: 78,
                equipment: ['pool']
            },
            {
                id: 'swim_5x200_threshold',
                name: '5x200m Threshold Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 5,
                        work: { distance: 200, intensity: 'Z3', stroke: 'free' },
                        rest: { duration: 30, description: '30s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold',
                estimatedLoad: 80,
                equipment: ['pool']
            },
            {
                id: 'swim_3x400_threshold',
                name: '3x400m Threshold Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 3,
                        work: { distance: 400, intensity: 'Z3', stroke: 'free' },
                        rest: { duration: 60, description: '60s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold, aerobic capacity',
                estimatedLoad: 82,
                equipment: ['pool']
            },
            {
                id: 'swim_12x75_threshold',
                name: '12x75m Threshold Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 12,
                        work: { distance: 75, intensity: 'Z3', stroke: 'free' },
                        rest: { duration: 15, description: '15s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'Lactate threshold, speed',
                estimatedLoad: 73,
                equipment: ['pool']
            }
        ];
    }

    /**
     * Get swimming VO2 max workouts
     * @returns {Array} VO2 swim workout templates
     */
    getSwimmingVO2Workouts() {
        return [
            {
                id: 'swim_20x50_vo2',
                name: '20x50m VO2 Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 20,
                        work: { distance: 50, intensity: 'Z4-Z5', stroke: 'free' },
                        rest: { duration: 10, description: '10s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max',
                estimatedLoad: 85,
                equipment: ['pool']
            },
            {
                id: 'swim_16x25_vo2',
                name: '16x25m VO2 Sprint Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 16,
                        work: { distance: 25, intensity: 'Z5', stroke: 'free' },
                        rest: { duration: 15, description: '15s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, speed',
                estimatedLoad: 82,
                equipment: ['pool']
            },
            {
                id: 'swim_12x100_vo2',
                name: '12x100m VO2 Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 12,
                        work: { distance: 100, intensity: 'Z4-Z5', stroke: 'free' },
                        rest: { duration: 30, description: '30s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, aerobic power',
                estimatedLoad: 88,
                equipment: ['pool']
            },
            {
                id: 'swim_10x75_vo2',
                name: '10x75m VO2 Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 10,
                        work: { distance: 75, intensity: 'Z4-Z5', stroke: 'free' },
                        rest: { duration: 20, description: '20s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max',
                estimatedLoad: 85,
                equipment: ['pool']
            },
            {
                id: 'swim_8x150_vo2',
                name: '8x150m VO2 Set',
                structure: [
                    { type: 'warmup', distance: 600, intensity: 'Z1-Z2' },
                    {
                        type: 'main',
                        sets: 8,
                        work: { distance: 150, intensity: 'Z4-Z5', stroke: 'free' },
                        rest: { duration: 45, description: '45s rest' }
                    },
                    { type: 'cooldown', distance: 400, intensity: 'Z1' }
                ],
                adaptation: 'VO2 max, lactate tolerance',
                estimatedLoad: 90,
                equipment: ['pool']
            }
        ];
    }

    /**
     * Get workouts by modality (running, cycling, swimming)
     * @param {string} modality - Sport modality
     * @returns {Object} Workouts organized by category
     */
    getWorkoutsByModality(modality) {
        return this.workouts[modality] || {};
    }

    /**
     * Get specific workout by ID
     * @param {string} id - Workout ID
     * @returns {Object|null} Workout with modality and category info
     */
    getWorkoutById(id) {
        for (const modality of Object.keys(this.workouts)) {
            for (const category of Object.keys(this.workouts[modality])) {
                const workout = this.workouts[modality][category].find(w => w.id === id);
                if (workout) {
                    return { ...workout, modality, category };
                }
            }
        }
        return null;
    }

    /**
     * Get workouts by adaptation type
     * @param {string} adaptation - Adaptation keyword (e.g., 'VO2 max', 'threshold')
     * @returns {Array} Matching workouts with modality and category
     */
    getWorkoutsByAdaptation(adaptation) {
        const results = [];
        const searchTerm = adaptation.toLowerCase();

        for (const modality of Object.keys(this.workouts)) {
            for (const category of Object.keys(this.workouts[modality])) {
                this.workouts[modality][category].forEach(workout => {
                    if (workout.adaptation.toLowerCase().includes(searchTerm)) {
                        results.push({ ...workout, modality, category });
                    }
                });
            }
        }

        return results;
    }

    /**
     * Get workouts by equipment requirement
     * @param {string} equipment - Equipment type (e.g., 'track', 'pool', 'bike')
     * @returns {Array} Workouts requiring that equipment
     */
    getWorkoutsByEquipment(equipment) {
        const results = [];
        const searchTerm = equipment.toLowerCase();

        for (const modality of Object.keys(this.workouts)) {
            for (const category of Object.keys(this.workouts[modality])) {
                this.workouts[modality][category].forEach(workout => {
                    const workoutEquipment = workout.equipment || [];
                    if (workoutEquipment.some(eq => eq.toLowerCase().includes(searchTerm))) {
                        results.push({ ...workout, modality, category });
                    }
                });
            }
        }

        return results;
    }

    /**
     * Get total workout count
     * @returns {number} Total number of workouts
     */
    getTotalWorkoutCount() {
        let count = 0;
        for (const modality of Object.keys(this.workouts)) {
            for (const category of Object.keys(this.workouts[modality])) {
                count += this.workouts[modality][category].length;
            }
        }
        return count;
    }

    /**
     * Get workout count by modality
     * @returns {Object} Counts by modality
     */
    getWorkoutCounts() {
        const counts = {};
        for (const modality of Object.keys(this.workouts)) {
            counts[modality] = 0;
            for (const category of Object.keys(this.workouts[modality])) {
                counts[modality] += this.workouts[modality][category].length;
            }
        }
        return counts;
    }
}

// Create global instance
window.WorkoutCatalog = new WorkoutCatalog();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkoutCatalog;
}

