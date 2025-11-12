/**
 * MovementScreens - Functional movement screening system
 * Comprehensive movement assessment for injury prevention
 */
class MovementScreens {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.screens = this.initializeMovementScreens();
    this.currentScreen = null;
    this.screenHistory = [];
  }

  /**
   * Initialize comprehensive movement screens
   * @returns {Object} Movement screen database
   */
  initializeMovementScreens() {
    return {
      overhead_squat: {
        name: 'Overhead Squat Assessment',
        description: 'Identifies mobility and stability issues throughout kinetic chain',
        sportRelevance: 'High - fundamental movement pattern',
        duration: '5 minutes',
        difficulty: 'moderate',
        checkpoints: {
          frontal_view: ['knee_valgus', 'foot_flattening', 'asymmetries', 'trunk_lateral_lean'],
          sagittal_view: ['forward_lean', 'heel_lift', 'arms_fall', 'thoracic_rounding'],
          posterior_view: ['heel_rise', 'knee_cave', 'asymmetric_shift', 'pelvic_tilt'],
        },
        scoring: {
          3: 'Performs movement correctly without compensation',
          2: 'Performs movement with minor deviations',
          1: 'Unable to perform movement or major compensations',
          0: 'Pain present during movement',
        },
        corrective_exercises: {
          knee_valgus: [
            'glute_activation',
            'hip_strengthening',
            'VMO_strengthening',
            'lateral_band_walks',
          ],
          heel_lift: [
            'ankle_mobility',
            'calf_stretching',
            'dorsiflexion_work',
            'wall_calf_stretch',
          ],
          forward_lean: [
            'thoracic_extension',
            'hip_flexor_stretching',
            'core_stability',
            'pigeon_pose',
          ],
          foot_flattening: ['arch_strengthening', 'short_foot_exercise', 'calf_strengthening'],
          trunk_lateral_lean: ['thoracic_mobility', 'hip_strengthening', 'single_leg_stability'],
        },
        instructions: [
          'Stand with feet shoulder-width apart',
          'Raise arms overhead, keeping elbows straight',
          'Squat down as low as possible while maintaining heels on ground',
          'Keep chest up and spine neutral',
          'Return to starting position',
        ],
        commonFindings: [
          'Limited ankle dorsiflexion',
          'Tight hip flexors',
          'Weak glutes',
          'Poor thoracic extension',
          'Core instability',
        ],
      },
      single_leg_squat: {
        name: 'Single Leg Squat',
        description: 'Evaluates single leg stability and strength',
        sportRelevance: 'Critical for soccer - single leg stability essential',
        duration: '3 minutes per leg',
        difficulty: 'advanced',
        checkpoints: {
          frontal_view: ['knee_valgus', 'hip_drop', 'trunk_lean', 'foot_pronation'],
          sagittal_view: ['forward_lean', 'heel_lift', 'knee_over_toe', 'hip_flexion'],
        },
        scoring: {
          3: 'Maintains alignment throughout movement',
          2: 'Minor compensations present',
          1: 'Significant compensations or instability',
          0: 'Unable to perform or pain present',
        },
        corrective_exercises: {
          knee_valgus: [
            'single_leg_RDL',
            'step_up_variations',
            'hip_strengthening',
            'lateral_band_work',
          ],
          hip_drop: ['hip_abduction_strengthening', 'single_leg_stability', 'lateral_plank'],
          forward_lean: ['hip_mobility', 'calf_flexibility', 'core_strengthening'],
        },
        instructions: [
          'Stand on one leg with other leg lifted',
          'Slowly squat down as low as possible',
          'Maintain balance and alignment',
          'Keep non-supporting leg off ground',
          'Return to starting position',
        ],
        injury_prediction: ['acl_tears', 'ankle_sprains', 'patellofemoral_pain', 'groin_strains'],
      },
      inline_lunge: {
        name: 'Inline Lunge',
        description: 'Assesses lateral hip stability and flexibility',
        sportRelevance: 'High - common movement in soccer',
        duration: '2 minutes per side',
        difficulty: 'moderate',
        checkpoints: {
          frontal_view: ['knee_valgus', 'hip_adduction', 'foot_drift'],
          sagittal_view: ['forward_lean', 'knee_over_toe', 'hip_extension'],
        },
        scoring: {
          3: 'Maintains alignment and stability',
          2: 'Minor deviations present',
          1: 'Significant compensations',
          0: 'Pain or unable to perform',
        },
        corrective_exercises: {
          knee_valgus: ['hip_adductor_stretch', 'glute_med_strengthening', 'lateral_band_work'],
          poor_hip_extension: ['hip_flexor_stretch', 'psoas_release', 'hip_cars'],
        },
        instructions: [
          'Step forward into lunge position',
          'Back knee should touch or nearly touch ground',
          'Keep front knee aligned over front ankle',
          'Maintain upright trunk',
          'Return to starting position',
        ],
      },
      shoulder_mobility: {
        name: 'Shoulder Mobility Assessment',
        description: 'Evaluates shoulder range of motion and stability',
        sportRelevance: 'Critical for goalkeepers',
        duration: '3 minutes',
        difficulty: 'easy',
        checkpoints: {
          arm_length_difference: {
            threshold: '2 inches difference',
            implications: 'thoracic_spine_mobility',
          },
          pain_presence: {
            threshold: 'any pain',
            implications: 'refer_to_specialist',
          },
        },
        scoring: {
          3: 'Arms within 2 inches',
          2: 'Arms within 4 inches',
          1: 'Arms more than 4 inches apart',
          0: 'Pain present',
        },
        corrective_exercises: {
          limited_shoulder_mobility: [
            'thoracic_extension',
            'lat_stretch',
            'pec_minor_release',
            'shoulder_dislocations',
          ],
          asymmetry: ['single_side_corrective_work', 'asymmetric_stretching', 'manual_therapy'],
        },
        instructions: [
          'Reach one arm up and over shoulder',
          'Reach other arm up and down back',
          'Try to touch fingers of both hands',
          'Measure hand distance or finger overlap',
          'Repeat on other side',
        ],
      },
      active_straight_leg_raise: {
        name: 'Active Straight Leg Raise',
        description: 'Assesses hamstring flexibility and core stability',
        sportRelevance: 'Critical for injury prevention',
        duration: '2 minutes',
        difficulty: 'easy',
        checkpoints: {
          hip_flexion: {
            target: '80 degrees',
            implications: 'hamstring_flexibility',
          },
          compensations: ['pelvic_rotation', 'lumbar_extension', 'hip_adduction'],
        },
        scoring: {
          3: 'Reaches 80+ degrees without compensation',
          2: 'Reaches 60-80 degrees or minor compensation',
          1: 'Reaches less than 60 degrees or significant compensation',
          0: 'Pain present',
        },
        corrective_exercises: {
          limited_hamstring_flexibility: ['hamstring_stretch', 'hip_cars', 'PNF_stretching'],
          core_instability: ['dead_bug', 'bird_dog', 'plank_variations'],
        },
        instructions: [
          'Lie supine with legs straight',
          'Flex hip to raise leg straight up',
          'Measure angle at which compensatory movement occurs',
          'Note any pelvic movement or lumbar extension',
          'Repeat on other side',
        ],
      },
      trunk_stability_pushup: {
        name: 'Trunk Stability Push-up',
        description: 'Evaluates core stability and upper body strength',
        sportRelevance: 'Important for stability and injury prevention',
        duration: '2 minutes',
        difficulty: 'moderate',
        checkpoints: {
          starting_position: ['spine_angle', 'hip_position', 'body_alignment'],
          movement: [
            'maintains_neutral_spine',
            'hip_rise',
            'lumbar_hyperextension',
            'scapular_stability',
          ],
        },
        scoring: {
          3: 'Excellent form throughout',
          2: 'Minor form deviations',
          1: 'Significant compensations',
          0: 'Unable to perform or pain',
        },
        corrective_exercises: {
          poor_starting_position: ['hip_flexor_stretch', 'thoracic_extension', 'shoulder_mobility'],
          compensations: ['core_strengthening', 'plank_progressions', 'anti_extension_work'],
        },
        instructions: [
          'Assume push-up position',
          'Adjust hands to appropriate position',
          'Perform push-up with perfect form',
          'Maintain neutral spine throughout',
          'Complete full range of motion',
        ],
      },
      rotational_stability: {
        name: 'Rotational Stability',
        description: 'Assesses ability to coordinate rotation with stability',
        sportRelevance: 'Critical for soccer - rotational movements',
        duration: '2 minutes per side',
        difficulty: 'advanced',
        checkpoints: {
          alignment: ['spine_neutral', 'hip_position', 'shoulder_position'],
          compensations: ['trunk_rotation', 'hip_shift', 'scapular_winging'],
        },
        scoring: {
          3: 'Perfect execution without compensation',
          2: 'Minor compensations acceptable',
          1: 'Significant compensations',
          0: 'Unable to perform or pain',
        },
        corrective_exercises: {
          poor_rotation: ['thoracic_rotation_mobility', 'hip_mobility', 'core_rotation_strength'],
          instability: ['side_plank', 'pallof_press', 'cable_chop'],
        },
        instructions: [
          'Assume quadruped position',
          'Extend opposite arm and leg',
          'Maintain neutral spine and alignment',
          'Hold position briefly',
          'Return to starting position',
        ],
      },
      deep_squat: {
        name: 'Deep Squat',
        description: 'Comprehensive movement screen for lower body mobility',
        sportRelevance: 'Fundamental movement pattern',
        duration: '3 minutes',
        difficulty: 'moderate',
        checkpoints: {
          mobility: ['ankle_dorsiflexion', 'hip_flexion', 'thoracic_extension'],
          stability: ['knee_position', 'core_stability', 'load_distribution'],
        },
        scoring: {
          3: 'Fully functional with excellent form',
          2: 'Functional with minor deviations',
          1: 'Significant compensations',
          0: 'Pain or unable to perform',
        },
        corrective_exercises: {
          limited_ankle_mobility: ['ankle_mobility_work', 'calf_stretching', 'goblet_squat'],
          limited_hip_mobility: ['hip_flexor_stretch', 'hip_circles', 'hip_abduction_stretch'],
          core_instability: ['core_strengthening', 'anterior_chain_work', 'posterior_chain_work'],
        },
        instructions: [
          'Squat down as deep as possible',
          'Keep heels on ground',
          'Maintain upright torso',
          'Keep knees aligned over toes',
          'Return to starting position',
        ],
      },
    };
  }

  /**
   * Get movement screen by ID
   * @param {string} screenId - Screen ID
   * @returns {Object|null} Movement screen
   */
  getScreen(screenId) {
    return this.screens[screenId] || null;
  }

  /**
   * Get all available screens
   * @returns {Array} All movement screens
   */
  getAllScreens() {
    return Object.keys(this.screens).map(id => ({
      id,
      ...this.screens[id],
    }));
  }

  /**
   * Get screens for specific sport
   * @param {string} sportId - Sport ID
   * @returns {Array} Sport-relevant screens
   */
  getScreensForSport(sportId) {
    const sportScreens = [];
    const normalizedSport = sportId?.toLowerCase() || '';

    Object.entries(this.screens).forEach(([id, screen]) => {
      const relevanceText = String(screen.sportRelevance || '').toLowerCase();
      const isHighPriority =
        relevanceText.includes('critical') ||
        relevanceText.includes('high') ||
        (normalizedSport && relevanceText.includes(normalizedSport));

      if (isHighPriority) {
        sportScreens.push({
          id,
          ...screen,
        });
      }
    });

    return sportScreens;
  }

  /**
   * Start movement screen assessment
   * @param {string} screenId - Screen ID
   * @param {Object} userProfile - User profile
   * @returns {Object} Screen session
   */
  startScreen(screenId, userProfile) {
    const screen = this.getScreen(screenId);
    if (!screen) {
      throw new Error(`Screen not found: ${screenId}`);
    }

    this.currentScreen = {
      screenId,
      screen,
      userProfile,
      startTime: new Date().toISOString(),
      checkpoints: {},
      scores: {},
      observations: [],
    };

    this.logger.audit('MOVEMENT_SCREEN_STARTED', {
      screenId,
      userId: userProfile.userId,
    });

    return this.currentScreen;
  }

  /**
   * Record checkpoint observation
   * @param {string} checkpoint - Checkpoint name
   * @param {string} view - View perspective
   * @param {Object} observation - Observation data
   */
  recordObservation(checkpoint, view, observation) {
    if (!this.currentScreen) {
      throw new Error('No active screen session');
    }

    const key = `${view}_${checkpoint}`;
    this.currentScreen.checkpoints[key] = {
      checkpoint,
      view,
      ...observation,
      recordedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate screen score
   * @param {string} screenId - Screen ID
   * @param {Object} observations - Observation data
   * @returns {number} Screen score (0-3)
   */
  calculateScore(screenId, observations) {
    const screen = this.getScreen(screenId);
    if (!screen) {
      return 0;
    }

    // Analyze observations for compensations
    let compensationCount = 0;
    let majorCompensationCount = 0;

    Object.values(observations).forEach(obs => {
      if (obs.compensation === 'major') {
        majorCompensationCount++;
      } else if (obs.compensation === 'minor') {
        compensationCount++;
      }
    });

    // Determine score based on observations
    if (majorCompensationCount > 0) {
      return 1;
    }
    if (compensationCount === 0) {
      return 3;
    }
    if (compensationCount <= 2) {
      return 2;
    }
    return 1;
  }

  /**
   * Complete movement screen
   * @returns {Object} Screen results
   */
  completeScreen() {
    if (!this.currentScreen) {
      throw new Error('No active screen session');
    }

    const { screen } = this.currentScreen;
    const observations = this.currentScreen.checkpoints;
    const score = this.calculateScore(this.currentScreen.screenId, observations);

    const results = {
      ...this.currentScreen,
      endTime: new Date().toISOString(),
      score,
      interpretation: this.interpretScore(score, screen),
      recommendations: this.generateRecommendations(this.currentScreen.screenId, observations),
      correctiveExercises: this.getCorrectiveExercises(this.currentScreen.screenId, observations),
    };

    // Save to history
    this.screenHistory.push(results);
    this.currentScreen = null;

    this.logger.audit('MOVEMENT_SCREEN_COMPLETED', {
      screenId: results.screenId,
      score,
      userId: results.userProfile.userId,
    });

    return results;
  }

  /**
   * Interpret score
   * @param {number} score - Screen score
   * @param {Object} screen - Screen definition
   * @returns {string} Interpretation
   */
  interpretScore(score, screen) {
    return screen.scoring[score] || 'Unable to assess';
  }

  /**
   * Generate recommendations from screen results
   * @param {string} screenId - Screen ID
   * @param {Object} observations - Observations
   * @returns {Array} Recommendations
   */
  generateRecommendations(screenId, observations) {
    const recommendations = [];
    const screen = this.getScreen(screenId);

    if (!screen || !screen.corrective_exercises) {
      return recommendations;
    }

    // Identify issues from observations
    Object.values(observations).forEach(obs => {
      if (obs.compensation && screen.corrective_exercises[obs.compensation]) {
        recommendations.push({
          type: 'corrective_exercise',
          issue: obs.compensation,
          priority: obs.compensation === 'major' ? 'high' : 'medium',
          exercises: screen.corrective_exercises[obs.compensation],
          description: `${obs.compensation} detected. Focus on corrective exercises.`,
        });
      }
    });

    return recommendations;
  }

  /**
   * Get corrective exercises for specific issues
   * @param {string} screenId - Screen ID
   * @param {Object} observations - Observations
   * @returns {Array} Corrective exercises
   */
  getCorrectiveExercises(screenId, observations) {
    const exercises = [];
    const screen = this.getScreen(screenId);

    if (!screen || !screen.corrective_exercises) {
      return exercises;
    }

    Object.values(observations).forEach(obs => {
      if (obs.compensation && screen.corrective_exercises[obs.compensation]) {
        exercises.push(...screen.corrective_exercises[obs.compensation]);
      }
    });

    return [...new Set(exercises)]; // Remove duplicates
  }

  /**
   * Get screen history
   * @param {string} userId - User ID (optional)
   * @returns {Array} Screen history
   */
  getHistory(userId = null) {
    if (userId) {
      return this.screenHistory.filter(screen => screen.userProfile.userId === userId);
    }
    return this.screenHistory;
  }

  /**
   * Get screen trends
   * @param {string} screenId - Screen ID
   * @param {string} userId - User ID
   * @returns {Object} Trend analysis
   */
  getTrends(screenId, userId) {
    const history = this.getHistory(userId).filter(screen => screen.screenId === screenId);

    if (history.length === 0) {
      return { available: false, message: 'No history available' };
    }

    const scores = history.map(screen => screen.score);
    const latest = history[history.length - 1];

    return {
      available: true,
      trend: this.calculateTrend(scores),
      latestScore: latest.score,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      progress: scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0,
      recommendations: latest.recommendations,
    };
  }

  /**
   * Calculate score trend
   * @param {Array} scores - Score history
   * @returns {string} Trend direction
   */
  calculateTrend(scores) {
    if (scores.length < 2) {
      return 'insufficient_data';
    }

    const recentScores = scores.slice(-3);
    const isImproving = recentScores[recentScores.length - 1] > recentScores[0];
    const isDeclining = recentScores[recentScores.length - 1] < recentScores[0];

    if (isImproving) {
      return 'improving';
    }
    if (isDeclining) {
      return 'declining';
    }
    return 'stable';
  }
}

// Create global instance
window.MovementScreens = new MovementScreens();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MovementScreens;
}
