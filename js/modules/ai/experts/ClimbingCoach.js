/**
 * ClimbingCoach - AI expert for climbing-specific training recommendations
 * Provides grip strength, finger strength, and route-type training based on climbing style
 */
class ClimbingCoach {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;

    // Climbing style types
    this.climbingStyles = {
      bouldering: {
        name: 'Bouldering',
        focus: ['finger_strength', 'power', 'core', 'shoulder_stability'],
        routeTypes: ['overhang', 'slab', 'cave', 'compression'],
      },
      sport: {
        name: 'Sport Climbing',
        focus: ['endurance', 'finger_strength', 'forearm_strength', 'technique'],
        routeTypes: ['vertical', 'slight_overhang', 'pumpy'],
      },
      trad: {
        name: 'Trad Climbing',
        focus: ['endurance', 'mental_strength', 'technique', 'route_finding'],
        routeTypes: ['crack', 'face', 'chimney', 'offwidth'],
      },
      mixed: {
        name: 'Mixed Climbing',
        focus: ['finger_strength', 'endurance', 'power', 'technique'],
        routeTypes: ['varied'],
      },
    };

    // Climbing-specific exercise database
    this.climbingExercises = this.initializeClimbingExercises();
  }

  /**
   * Initialize climbing-specific exercises
   * @returns {Object} Exercise database by category
   */
  initializeClimbingExercises() {
    return {
      gripStrength: [
        {
          name: 'Hangboard - Open Hand',
          difficulty: 'beginner',
          grip: 'open',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'Hangboard - Half Crimp',
          difficulty: 'intermediate',
          grip: 'half_crimp',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'Hangboard - Full Crimp',
          difficulty: 'advanced',
          grip: 'full_crimp',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'Pinch Block Training',
          difficulty: 'beginner',
          grip: 'pinch',
          muscles: ['forearms', 'thumbs'],
        },
        { name: 'Wrist Curls', difficulty: 'beginner', muscles: ['forearms'] },
        { name: 'Reverse Wrist Curls', difficulty: 'beginner', muscles: ['forearms'] },
        { name: 'Rice Bucket Training', difficulty: 'beginner', muscles: ['forearms', 'fingers'] },
        { name: "Farmer's Walk", difficulty: 'intermediate', muscles: ['forearms', 'core'] },
        { name: 'Gripper Squeezes', difficulty: 'beginner', muscles: ['forearms', 'fingers'] },
      ],
      fingerStrength: [
        {
          name: 'Campus Board - Rung Laddering',
          difficulty: 'advanced',
          type: 'power',
          muscles: ['forearms', 'fingers', 'shoulders'],
        },
        {
          name: 'Campus Board - Bumping',
          difficulty: 'advanced',
          type: 'power',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'Hangboard - Max Hangs',
          difficulty: 'intermediate',
          type: 'strength',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'Hangboard - Repeaters',
          difficulty: 'intermediate',
          type: 'endurance',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'No-Hang Device Training',
          difficulty: 'intermediate',
          type: 'strength',
          muscles: ['forearms', 'fingers'],
        },
        {
          name: 'Finger Extensions (Rubber Bands)',
          difficulty: 'beginner',
          type: 'rehabilitation',
          muscles: ['fingers'],
        },
        {
          name: 'Finger Pulley Strengthening',
          difficulty: 'beginner',
          type: 'rehabilitation',
          muscles: ['fingers'],
        },
      ],
      upperBody: [
        {
          name: 'Weighted Pull-ups',
          difficulty: 'intermediate',
          muscles: ['lats', 'biceps', 'forearms'],
        },
        { name: 'Lock-off Training', difficulty: 'intermediate', muscles: ['lats', 'biceps'] },
        {
          name: 'Frenchies (Pull-up Holds)',
          difficulty: 'intermediate',
          muscles: ['lats', 'biceps', 'core'],
        },
        {
          name: 'Typewriter Pull-ups',
          difficulty: 'advanced',
          muscles: ['lats', 'shoulders', 'core'],
        },
        { name: 'Muscle-ups', difficulty: 'advanced', muscles: ['lats', 'shoulders', 'chest'] },
        {
          name: 'Shoulder Stability Work',
          difficulty: 'beginner',
          muscles: ['shoulders', 'rotator_cuff'],
        },
        {
          name: 'Antagonist Training (Push)',
          difficulty: 'beginner',
          muscles: ['chest', 'triceps', 'shoulders'],
        },
      ],
      core: [
        { name: 'Front Lever Progressions', difficulty: 'advanced', muscles: ['core', 'lats'] },
        { name: 'L-Sit / V-Sit', difficulty: 'intermediate', muscles: ['core', 'hip_flexors'] },
        { name: 'Dragon Flag', difficulty: 'advanced', muscles: ['core'] },
        {
          name: 'Hanging Leg Raises',
          difficulty: 'intermediate',
          muscles: ['core', 'hip_flexors'],
        },
        { name: 'Plank Variations', difficulty: 'beginner', muscles: ['core'] },
        { name: 'Hollow Body Hold', difficulty: 'beginner', muscles: ['core'] },
      ],
      lowerBody: [
        {
          name: 'Weighted Step-ups',
          difficulty: 'intermediate',
          muscles: ['quadriceps', 'glutes'],
        },
        {
          name: 'Bulgarian Split Squats',
          difficulty: 'intermediate',
          muscles: ['quadriceps', 'glutes'],
        },
        { name: 'Calf Raises', difficulty: 'beginner', muscles: ['calves'] },
        { name: 'Hip Mobility Work', difficulty: 'beginner', muscles: ['hip_flexors', 'glutes'] },
        {
          name: 'Pistol Squats',
          difficulty: 'advanced',
          muscles: ['quadriceps', 'glutes', 'core'],
        },
      ],
      flexibility: [
        { name: 'Hip Flexibility', difficulty: 'beginner', muscles: ['hip_flexors', 'hamstrings'] },
        { name: 'Shoulder Mobility', difficulty: 'beginner', muscles: ['shoulders', 'lats'] },
        { name: 'Hip Flexor Stretches', difficulty: 'beginner', muscles: ['hip_flexors'] },
        {
          name: 'Pigeon Pose Variations',
          difficulty: 'beginner',
          muscles: ['hip_flexors', 'glutes'],
        },
      ],
    };
  }

  /**
   * Propose session plan based on climbing style and goals
   * @param {Object} context - User context
   * @returns {Object} Climbing coach proposal
   */
  propose({ user, season, schedule, history, readiness, preferences }) {
    const climbingStyle = this.getClimbingStyle(user, preferences);
    const routeType = this.getRouteType(user, preferences);
    const trainingPhase = this.getTrainingPhase(season, user);

    const proposal = {
      blocks: [],
      constraints: [],
      priorities: [],
    };

    // Warm-up block
    proposal.blocks.push({
      type: 'warmup',
      exercises: this.generateWarmup(climbingStyle),
      duration: 10,
      rationale: 'Activate climbing-specific movement patterns',
    });

    // Main training block based on style and phase
    const mainBlock = this.generateMainTraining(climbingStyle, routeType, trainingPhase, readiness);
    proposal.blocks.push(mainBlock);

    // Antagonist and flexibility block
    proposal.blocks.push({
      type: 'antagonist',
      exercises: this.generateAntagonistWork(climbingStyle, readiness),
      duration: 10,
      rationale: 'Balance climbing-specific muscle development',
    });

    proposal.constraints = [
      {
        type: 'finger_recovery',
        rule: 'Minimum 48 hours between intense finger work',
      },
      {
        type: 'grip_fatigue',
        rule: 'Prioritize form over load for grip exercises',
      },
      {
        type: 'volume',
        rule: `Total volume adjusted for readiness: ${this.calculateVolume(readiness)}`,
      },
    ];

    proposal.priorities = [
      { priority: 1, goal: `${climbingStyle} performance`, weight: 0.3 },
      { priority: 2, goal: 'Injury prevention (fingers/elbows)', weight: 0.25 },
      { priority: 3, goal: 'Grip strength development', weight: 0.2 },
    ];

    return proposal;
  }

  /**
   * Get user's climbing style
   * @param {Object} user - User profile
   * @param {Object} preferences - User preferences
   * @returns {string} Climbing style
   */
  getClimbingStyle(user, preferences) {
    // Check preferences first
    if (preferences?.climbingStyle) {
      return preferences.climbingStyle;
    }

    // Check user profile
    if (user?.climbingStyle) {
      return user.climbingStyle;
    }

    // Default to mixed for versatility
    return 'mixed';
  }

  /**
   * Get route type preference
   * @param {Object} user - User profile
   * @param {Object} preferences - User preferences
   * @returns {string} Route type
   */
  getRouteType(user, preferences) {
    if (preferences?.routeType) {
      return preferences.routeType;
    }

    if (user?.routeType) {
      return user.routeType;
    }

    return 'varied';
  }

  /**
   * Get training phase
   * @param {Object} season - Season info
   * @param {Object} user - User profile
   * @returns {string} Training phase
   */
  getTrainingPhase(season, user) {
    if (user?.trainingPhase) {
      return user.trainingPhase;
    }

    if (season?.phase === 'in_season') {
      return 'maintenance';
    }

    return 'build'; // Default to building phase
  }

  /**
   * Generate warm-up exercises
   * @param {string} climbingStyle - Climbing style
   * @returns {Array} Warm-up exercises
   */
  generateWarmup(climbingStyle) {
    const baseWarmup = [
      'Shoulder Circles',
      'Wrist Circles',
      'Hip Circles',
      'Light Hangboard (30s open hand)',
      'Finger Extensions',
    ];

    // Style-specific additions
    if (climbingStyle === 'bouldering') {
      baseWarmup.push('Easy Campus Board Laddering', 'Dynamic Stretches');
    } else if (climbingStyle === 'sport' || climbingStyle === 'trad') {
      baseWarmup.push('Light Hangboard Repeaters', 'Shoulder Mobility');
    }

    return baseWarmup;
  }

  /**
   * Generate main training block
   * @param {string} climbingStyle - Climbing style
   * @param {string} routeType - Route type
   * @param {string} trainingPhase - Training phase
   * @param {number} readiness - Readiness score
   * @returns {Object} Main training block
   */
  generateMainTraining(climbingStyle, routeType, trainingPhase, readiness) {
    const styleConfig = this.climbingStyles[climbingStyle] || this.climbingStyles.mixed;
    const focusAreas = styleConfig.focus;

    const block = {
      type: 'main_training',
      exercises: [],
      duration: this.getTrainingDuration(readiness),
      rationale: `${climbingStyle} training for ${routeType} routes`,
    };

    // Determine training focus based on phase
    if (trainingPhase === 'base' || trainingPhase === 'build') {
      // Base building phase - focus on strength and technique
      block.exercises = this.generateBaseBuildingExercises(focusAreas, readiness);
    } else if (trainingPhase === 'peak' || trainingPhase === 'maintenance') {
      // Peak/maintenance phase - maintain strength, focus on performance
      block.exercises = this.generatePeakPhaseExercises(focusAreas, readiness);
    } else if (trainingPhase === 'recovery') {
      // Recovery phase - light work, rehabilitation
      block.exercises = this.generateRecoveryExercises(readiness);
    }

    // Adjust for route type
    if (routeType === 'overhang' || routeType === 'cave') {
      block.exercises = this.addOverhangSpecificWork(block.exercises, readiness);
    } else if (routeType === 'crack' || routeType === 'offwidth') {
      block.exercises = this.addCrackSpecificWork(block.exercises, readiness);
    }

    return block;
  }

  /**
   * Generate base building exercises
   * @param {Array} focusAreas - Focus areas for style
   * @param {number} readiness - Readiness score
   * @returns {Array} Exercise recommendations
   */
  generateBaseBuildingExercises(focusAreas, readiness) {
    const exercises = [];

    // Always include finger strength for climbing
    if (focusAreas.includes('finger_strength')) {
      exercises.push({
        name: 'Hangboard - Max Hangs',
        category: 'finger_strength',
        sets: this.getSets('finger', readiness),
        duration: '7s hang',
        rest: '3min',
        load: 'Bodyweight or +10-20lbs',
        rationale: 'Building maximum finger strength',
      });
    }

    // Grip strength work
    if (focusAreas.includes('finger_strength') || focusAreas.includes('power')) {
      exercises.push({
        name: 'Hangboard - Open Hand Repeaters',
        category: 'grip_strength',
        sets: this.getSets('grip', readiness),
        duration: '6x (7s on, 3s off)',
        rest: '3min between sets',
        load: 'Bodyweight',
        rationale: 'Building grip endurance',
      });
    }

    // Upper body pulling
    exercises.push({
      name: 'Weighted Pull-ups',
      category: 'upper_body',
      sets: this.getSets('upper', readiness),
      reps: '5-8',
      load: 'Add weight based on readiness',
      rationale: 'Building pulling strength for climbing',
    });

    // Core work
    if (focusAreas.includes('core')) {
      exercises.push({
        name: 'Front Lever Progressions',
        category: 'core',
        sets: this.getSets('core', readiness),
        duration: 'Hold time or reps based on level',
        rationale: 'Core strength for body tension on climbs',
      });
    }

    return exercises;
  }

  /**
   * Generate peak phase exercises
   * @param {Array} focusAreas - Focus areas
   * @param {number} readiness - Readiness score
   * @returns {Array} Exercise recommendations
   */
  generatePeakPhaseExercises(focusAreas, readiness) {
    const exercises = [];

    // Maintain finger strength with lighter volume
    exercises.push({
      name: 'Hangboard - Maintenance Hangs',
      category: 'finger_strength',
      sets: this.getSets('finger', readiness) - 1, // Reduced volume
      duration: '7s hang',
      rest: '3min',
      load: 'Bodyweight',
      rationale: 'Maintaining finger strength without overloading',
    });

    // Power work for peak performance
    if (readiness >= 7) {
      exercises.push({
        name: 'Campus Board - Power Laddering',
        category: 'power',
        sets: 3, // Lower volume for peak phase
        reps: '3-5 moves',
        rest: '3-5min',
        rationale: 'Maintaining power for hard moves',
      });
    }

    // Maintenance pulling
    exercises.push({
      name: 'Pull-ups (Maintenance)',
      category: 'upper_body',
      sets: this.getSets('upper', readiness),
      reps: '8-10',
      load: 'Bodyweight or lighter',
      rationale: 'Maintaining pulling strength',
    });

    return exercises;
  }

  /**
   * Generate recovery exercises
   * @param {number} readiness - Readiness score
   * @returns {Array} Exercise recommendations
   */
  generateRecoveryExercises(readiness) {
    return [
      {
        name: 'Finger Extensions (Rubber Bands)',
        category: 'rehabilitation',
        sets: 3,
        reps: '20-30',
        rationale: 'Promote blood flow and recovery',
      },
      {
        name: 'Light Hangboard - Open Hand',
        category: 'recovery',
        sets: 2,
        duration: '20s hang (easy)',
        rest: '2min',
        load: 'Bodyweight only',
        rationale: 'Maintain mobility without stressing tissues',
      },
      {
        name: 'Antagonist Push Work',
        category: 'recovery',
        sets: 3,
        reps: '10-15',
        rationale: 'Balance pulling muscles, promote recovery',
      },
    ];
  }

  /**
   * Add overhang-specific work
   * @param {Array} exercises - Current exercises
   * @param {number} readiness - Readiness score
   * @returns {Array} Exercises with overhang-specific additions
   */
  addOverhangSpecificWork(exercises, readiness) {
    // Add exercises for overhang climbing (more core, shoulder stability)
    exercises.push({
      name: 'Typewriter Pull-ups',
      category: 'upper_body',
      sets: this.getSets('upper', readiness),
      reps: '3-5 per side',
      rationale: 'Building shoulder stability for overhangs',
    });

    exercises.push({
      name: 'Hanging Leg Raises',
      category: 'core',
      sets: this.getSets('core', readiness),
      reps: '10-15',
      rationale: 'Core strength for keeping feet on overhangs',
    });

    return exercises;
  }

  /**
   * Add crack-specific work
   * @param {Array} exercises - Current exercises
   * @param {number} readiness - Readiness score
   * @returns {Array} Exercises with crack-specific additions
   */
  addCrackSpecificWork(exercises, readiness) {
    // Crack climbing requires different grip types
    exercises.push({
      name: 'Pinch Block Training',
      category: 'grip_strength',
      sets: this.getSets('grip', readiness),
      duration: '10s hold',
      rest: '2min',
      rationale: 'Building pinch strength for crack jamming',
    });

    exercises.push({
      name: 'Wrist Curls & Extensions',
      category: 'forearms',
      sets: this.getSets('grip', readiness),
      reps: '15-20',
      rationale: 'Building wrist strength for crack techniques',
    });

    return exercises;
  }

  /**
   * Generate antagonist work
   * @param {string} climbingStyle - Climbing style
   * @param {number} readiness - Readiness score
   * @returns {Array} Antagonist exercises
   */
  generateAntagonistWork(climbingStyle, readiness) {
    const exercises = [
      {
        name: 'Push-ups or Dips',
        category: 'antagonist',
        sets: this.getSets('antagonist', readiness),
        reps: '10-15',
        rationale: 'Balance pulling muscles to prevent injury',
      },
      {
        name: 'Shoulder External Rotation',
        category: 'shoulder_health',
        sets: 3,
        reps: '15-20',
        rationale: 'Prevent rotator cuff imbalances',
      },
    ];

    return exercises;
  }

  /**
   * Get sets based on exercise category and readiness
   * @param {string} category - Exercise category
   * @param {number} readiness - Readiness score
   * @returns {number} Number of sets
   */
  getSets(category, readiness) {
    const baseSets = {
      finger: readiness >= 8 ? 4 : readiness >= 5 ? 3 : 2,
      grip: readiness >= 8 ? 4 : readiness >= 5 ? 3 : 2,
      upper: readiness >= 8 ? 4 : readiness >= 5 ? 3 : 3,
      core: readiness >= 8 ? 3 : readiness >= 5 ? 3 : 2,
      antagonist: 3, // Always moderate for antagonist work
    };

    return baseSets[category] || 3;
  }

  /**
   * Get training duration
   * @param {number} readiness - Readiness score
   * @returns {string} Duration recommendation
   */
  getTrainingDuration(readiness) {
    if (readiness >= 8) {
      return '60-90 min';
    } else if (readiness >= 5) {
      return '45-60 min';
    } else {
      return '30-45 min';
    }
  }

  /**
   * Calculate volume based on readiness
   * @param {number} readiness - Readiness score
   * @returns {string} Volume description
   */
  calculateVolume(readiness) {
    if (readiness >= 8) {
      return 'high';
    }
    if (readiness >= 5) {
      return 'moderate';
    }
    return 'low';
  }
}

window.ClimbingCoach = ClimbingCoach;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClimbingCoach;
}
