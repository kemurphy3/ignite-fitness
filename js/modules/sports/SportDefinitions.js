/**
 * SportDefinitions - Comprehensive sport-specific training definitions
 * Defines positions, attributes, injury risks, and training focus for each sport
 */
class SportDefinitions {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.sports = this.initializeSports();
  }

  /**
   * Initialize comprehensive sport definitions
   * @returns {Object} Sport definitions
   */
  initializeSports() {
    return {
      soccer: {
        name: 'Soccer/Football',
        icon: '⚽',
        color: '#22c55e',
        description: 'Beautiful game training',
        positions: {
          goalkeeper: {
            name: 'Goalkeeper',
            primaryAttributes: [
              'reaction_time',
              'diving_reach',
              'distribution_accuracy',
              'commanding_area',
            ],
            secondaryAttributes: [
              'agility',
              'core_strength',
              'hand_eye_coordination',
              'decision_making',
            ],
            injuryRisks: [
              'finger_injuries',
              'shoulder_impingement',
              'knee_strain',
              'back_injuries',
            ],
            trainingFocus: [
              'shot_stopping',
              'distribution',
              'agility',
              'core_strength',
              'reaction_training',
            ],
            physicalDemands: {
              strength: 'high',
              endurance: 'medium',
              speed: 'medium',
              agility: 'high',
              power: 'high',
            },
            trainingFrequency: {
              strength: 3,
              conditioning: 2,
              technical: 4,
              tactical: 3,
            },
          },
          defender: {
            name: 'Defender',
            primaryAttributes: [
              'aerial_ability',
              'tackling',
              'positioning',
              'strength',
              'communication',
            ],
            secondaryAttributes: ['passing_accuracy', 'ball_control', 'pace', 'endurance'],
            injuryRisks: ['ankle_sprains', 'head_injuries', 'muscle_strains', 'concussions'],
            trainingFocus: ['strength_training', 'aerial_work', 'recovery_speed', 'positioning'],
            physicalDemands: {
              strength: 'very_high',
              endurance: 'high',
              speed: 'medium',
              agility: 'medium',
              power: 'high',
            },
            trainingFrequency: {
              strength: 4,
              conditioning: 3,
              technical: 3,
              tactical: 4,
            },
          },
          midfielder: {
            name: 'Midfielder',
            primaryAttributes: ['endurance', 'passing_accuracy', 'vision', 'agility', 'work_rate'],
            secondaryAttributes: ['ball_control', 'shooting', 'tackling', 'creativity'],
            injuryRisks: ['overuse_injuries', 'groin_strains', 'ankle_sprains', 'hamstring_pulls'],
            trainingFocus: [
              'aerobic_capacity',
              'agility',
              'ball_work',
              'core_stability',
              'endurance',
            ],
            physicalDemands: {
              strength: 'medium',
              endurance: 'very_high',
              speed: 'medium',
              agility: 'high',
              power: 'medium',
            },
            trainingFrequency: {
              strength: 2,
              conditioning: 4,
              technical: 4,
              tactical: 4,
            },
          },
          forward: {
            name: 'Forward',
            primaryAttributes: ['speed', 'finishing', 'first_touch', 'movement', 'composure'],
            secondaryAttributes: ['aerial_ability', 'strength', 'agility', 'decision_making'],
            injuryRisks: ['hamstring_strains', 'ankle_sprains', 'knee_injuries', 'muscle_pulls'],
            trainingFocus: [
              'sprint_training',
              'plyometrics',
              'finishing',
              'acceleration',
              'agility',
            ],
            physicalDemands: {
              strength: 'medium',
              endurance: 'medium',
              speed: 'very_high',
              agility: 'high',
              power: 'high',
            },
            trainingFrequency: {
              strength: 2,
              conditioning: 3,
              technical: 4,
              tactical: 3,
            },
          },
        },
        seasons: {
          'off-season': {
            duration: '3-4 months',
            focus: 'strength_power_development',
            trainingLoad: 'high',
            intensity: 'moderate',
            priorities: ['strength_gains', 'injury_prevention', 'base_fitness'],
            weeklyStructure: {
              strength: 4,
              conditioning: 3,
              technical: 2,
              tactical: 1,
            },
          },
          'pre-season': {
            duration: '6-8 weeks',
            focus: 'sport_specific_preparation',
            trainingLoad: 'very_high',
            intensity: 'high',
            priorities: ['match_fitness', 'tactical_preparation', 'team_cohesion'],
            weeklyStructure: {
              strength: 2,
              conditioning: 4,
              technical: 4,
              tactical: 5,
            },
          },
          'in-season': {
            duration: '6-9 months',
            focus: 'performance_maintenance',
            trainingLoad: 'moderate',
            intensity: 'variable',
            priorities: ['recovery', 'match_performance', 'injury_prevention'],
            weeklyStructure: {
              strength: 2,
              conditioning: 2,
              technical: 3,
              tactical: 4,
            },
          },
          'post-season': {
            duration: '2-4 weeks',
            focus: 'recovery_regeneration',
            trainingLoad: 'low',
            intensity: 'low',
            priorities: ['active_recovery', 'injury_rehabilitation', 'mental_refresh'],
            weeklyStructure: {
              strength: 1,
              conditioning: 2,
              technical: 1,
              tactical: 0,
            },
          },
        },
        commonInjuries: [
          {
            name: 'ACL Tears',
            prevalence: 'high',
            riskFactors: ['female', 'previous_injury', 'poor_landing_mechanics'],
            prevention: ['neuromuscular_training', 'strength_training', 'movement_screening'],
          },
          {
            name: 'Ankle Sprains',
            prevalence: 'very_high',
            riskFactors: ['previous_sprain', 'poor_balance', 'weak_peroneals'],
            prevention: ['balance_training', 'proprioception', 'strengthening'],
          },
          {
            name: 'Hamstring Strains',
            prevalence: 'high',
            riskFactors: ['muscle_imbalance', 'fatigue', 'poor_warm_up'],
            prevention: ['eccentric_training', 'flexibility', 'strength_balance'],
          },
          {
            name: 'Groin Pulls',
            prevalence: 'medium',
            riskFactors: ['hip_flexor_tightness', 'weak_adductors', 'sudden_direction_change'],
            prevention: ['hip_mobility', 'adductor_strengthening', 'gradual_progression'],
          },
          {
            name: 'Concussions',
            prevalence: 'medium',
            riskFactors: ['heading_ball', 'collision_play', 'previous_concussion'],
            prevention: ['proper_technique', 'neck_strengthening', 'awareness_training'],
          },
        ],
        trainingPrinciples: {
          periodization: 'block_periodization',
          loadProgression: 'linear_progression',
          recovery: 'active_recovery_focused',
          monitoring: 'heart_rate_variability',
          adaptation: 'sport_specific_movements',
        },
      },
      basketball: {
        name: 'Basketball',
        icon: '🏀',
        color: '#f59e0b',
        description: 'Court performance training',
        positions: {
          pointGuard: {
            name: 'Point Guard',
            primaryAttributes: ['ball_handling', 'court_vision', 'decision_making', 'leadership'],
            secondaryAttributes: ['speed', 'agility', 'shooting', 'defense'],
            injuryRisks: ['ankle_sprains', 'knee_injuries', 'finger_injuries'],
            trainingFocus: ['ball_handling', 'court_vision', 'speed', 'agility'],
            physicalDemands: {
              strength: 'medium',
              endurance: 'high',
              speed: 'high',
              agility: 'very_high',
              power: 'medium',
            },
          },
          shootingGuard: {
            name: 'Shooting Guard',
            primaryAttributes: [
              'shooting_accuracy',
              'off_ball_movement',
              'defense',
              'clutch_performance',
            ],
            secondaryAttributes: ['ball_handling', 'speed', 'agility', 'court_vision'],
            injuryRisks: ['shoulder_injuries', 'ankle_sprains', 'knee_injuries'],
            trainingFocus: ['shooting', 'movement', 'defense', 'conditioning'],
            physicalDemands: {
              strength: 'medium',
              endurance: 'high',
              speed: 'high',
              agility: 'high',
              power: 'medium',
            },
          },
          smallForward: {
            name: 'Small Forward',
            primaryAttributes: ['versatility', 'athleticism', 'defense', 'scoring'],
            secondaryAttributes: ['ball_handling', 'shooting', 'rebounding', 'speed'],
            injuryRisks: ['ankle_sprains', 'knee_injuries', 'muscle_strains'],
            trainingFocus: ['versatility', 'athleticism', 'defense', 'scoring'],
            physicalDemands: {
              strength: 'high',
              endurance: 'high',
              speed: 'high',
              agility: 'high',
              power: 'high',
            },
          },
          powerForward: {
            name: 'Power Forward',
            primaryAttributes: ['strength', 'rebounding', 'post_play', 'defense'],
            secondaryAttributes: ['shooting', 'ball_handling', 'athleticism', 'endurance'],
            injuryRisks: ['back_injuries', 'knee_injuries', 'shoulder_injuries'],
            trainingFocus: ['strength', 'rebounding', 'post_play', 'defense'],
            physicalDemands: {
              strength: 'very_high',
              endurance: 'medium',
              speed: 'medium',
              agility: 'medium',
              power: 'very_high',
            },
          },
          center: {
            name: 'Center',
            primaryAttributes: ['height', 'strength', 'rebounding', 'shot_blocking'],
            secondaryAttributes: ['post_play', 'shooting', 'athleticism', 'endurance'],
            injuryRisks: ['back_injuries', 'knee_injuries', 'ankle_injuries'],
            trainingFocus: ['strength', 'rebounding', 'shot_blocking', 'post_play'],
            physicalDemands: {
              strength: 'very_high',
              endurance: 'medium',
              speed: 'low',
              agility: 'low',
              power: 'very_high',
            },
          },
        },
        seasons: {
          'off-season': {
            duration: '4-5 months',
            focus: 'skill_development_strength',
            trainingLoad: 'high',
            intensity: 'moderate',
          },
          'pre-season': {
            duration: '6-8 weeks',
            focus: 'team_preparation',
            trainingLoad: 'very_high',
            intensity: 'high',
          },
          'in-season': {
            duration: '6-7 months',
            focus: 'performance_maintenance',
            trainingLoad: 'moderate',
            intensity: 'variable',
          },
          'post-season': {
            duration: '2-3 weeks',
            focus: 'recovery_regeneration',
            trainingLoad: 'low',
            intensity: 'low',
          },
        },
        commonInjuries: [
          'ankle_sprains',
          'knee_injuries',
          'finger_injuries',
          'back_injuries',
          'shoulder_injuries',
          'muscle_strains',
        ],
      },
      running: {
        name: 'Running',
        icon: '🏃‍♂️',
        color: '#3b82f6',
        description: 'Endurance and speed training',
        disciplines: {
          sprint: {
            name: 'Sprint',
            primaryAttributes: ['explosive_power', 'max_speed', 'acceleration', 'reaction_time'],
            injuryRisks: ['hamstring_strains', 'calf_strains', 'achilles_tendinitis'],
            trainingFocus: ['power_development', 'speed_work', 'acceleration', 'recovery'],
          },
          middleDistance: {
            name: 'Middle Distance',
            primaryAttributes: [
              'lactate_tolerance',
              'speed_endurance',
              'tactical_awareness',
              'mental_toughness',
            ],
            injuryRisks: ['stress_fractures', 'shin_splints', 'overuse_injuries'],
            trainingFocus: [
              'speed_endurance',
              'lactate_tolerance',
              'tactical_training',
              'mental_preparation',
            ],
          },
          longDistance: {
            name: 'Long Distance',
            primaryAttributes: [
              'aerobic_capacity',
              'running_economy',
              'mental_endurance',
              'fatigue_resistance',
            ],
            injuryRisks: ['stress_fractures', 'itb_syndrome', 'plantar_fasciitis'],
            trainingFocus: [
              'aerobic_development',
              'running_economy',
              'mental_training',
              'injury_prevention',
            ],
          },
          marathon: {
            name: 'Marathon',
            primaryAttributes: [
              'aerobic_capacity',
              'fatigue_resistance',
              'mental_endurance',
              'nutrition_strategy',
            ],
            injuryRisks: ['stress_fractures', 'itb_syndrome', 'dehydration', 'hyponatremia'],
            trainingFocus: [
              'aerobic_development',
              'fatigue_resistance',
              'nutrition',
              'mental_preparation',
            ],
          },
        },
        seasons: {
          base_training: {
            duration: '3-4 months',
            focus: 'aerobic_development',
            trainingLoad: 'moderate',
            intensity: 'low_moderate',
          },
          build_training: {
            duration: '2-3 months',
            focus: 'speed_endurance',
            trainingLoad: 'high',
            intensity: 'moderate_high',
          },
          peak_training: {
            duration: '4-6 weeks',
            focus: 'race_preparation',
            trainingLoad: 'very_high',
            intensity: 'high',
          },
          recovery: {
            duration: '2-4 weeks',
            focus: 'active_recovery',
            trainingLoad: 'low',
            intensity: 'low',
          },
        },
        commonInjuries: [
          'stress_fractures',
          'shin_splints',
          'itb_syndrome',
          'plantar_fasciitis',
          'achilles_tendinitis',
          'runner_knee',
        ],
      },
      general: {
        name: 'General Fitness',
        icon: '💪',
        color: '#8b5cf6',
        description: 'Overall health and strength',
        focus: {
          strength: {
            name: 'Strength Training',
            primaryAttributes: ['muscular_strength', 'power', 'muscle_mass', 'bone_density'],
            injuryRisks: ['muscle_strains', 'joint_injuries', 'back_injuries'],
            trainingFocus: ['progressive_overload', 'movement_patterns', 'injury_prevention'],
          },
          cardio: {
            name: 'Cardiovascular',
            primaryAttributes: ['aerobic_capacity', 'heart_health', 'endurance', 'fat_burning'],
            injuryRisks: ['overuse_injuries', 'joint_stress', 'fatigue'],
            trainingFocus: ['aerobic_development', 'heart_rate_training', 'variety'],
          },
          flexibility: {
            name: 'Flexibility',
            primaryAttributes: ['range_of_motion', 'mobility', 'injury_prevention', 'recovery'],
            injuryRisks: ['muscle_strains', 'joint_hyperextension'],
            trainingFocus: ['dynamic_stretching', 'static_stretching', 'mobility_work'],
          },
          balance: {
            name: 'Balance',
            primaryAttributes: ['proprioception', 'stability', 'coordination', 'injury_prevention'],
            injuryRisks: ['falls', 'ankle_injuries'],
            trainingFocus: ['single_leg_training', 'unstable_surfaces', 'coordination'],
          },
        },
        seasons: {
          strength_phase: {
            duration: '8-12 weeks',
            focus: 'strength_development',
            trainingLoad: 'high',
            intensity: 'moderate_high',
          },
          hypertrophy_phase: {
            duration: '6-8 weeks',
            focus: 'muscle_building',
            trainingLoad: 'moderate',
            intensity: 'moderate',
          },
          endurance_phase: {
            duration: '6-8 weeks',
            focus: 'cardiovascular_fitness',
            trainingLoad: 'moderate',
            intensity: 'moderate',
          },
          maintenance_phase: {
            duration: '4-6 weeks',
            focus: 'fitness_maintenance',
            trainingLoad: 'low_moderate',
            intensity: 'low_moderate',
          },
        },
        commonInjuries: [
          'muscle_strains',
          'joint_injuries',
          'back_injuries',
          'overuse_injuries',
          'falls',
          'dehydration',
        ],
      },
    };
  }

  /**
   * Get sport definition
   * @param {string} sportId - Sport ID
   * @returns {Object|null} Sport definition
   */
  getSport(sportId) {
    return this.sports[sportId] || null;
  }

  /**
   * Get position definition
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID
   * @returns {Object|null} Position definition
   */
  getPosition(sportId, positionId) {
    const sport = this.getSport(sportId);
    if (!sport || !sport.positions) {
      return null;
    }
    return sport.positions[positionId] || null;
  }

  /**
   * Get season definition
   * @param {string} sportId - Sport ID
   * @param {string} seasonId - Season ID
   * @returns {Object|null} Season definition
   */
  getSeason(sportId, seasonId) {
    const sport = this.getSport(sportId);
    if (!sport || !sport.seasons) {
      return null;
    }
    return sport.seasons[seasonId] || null;
  }

  /**
   * Get injury risks for sport/position
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID (optional)
   * @returns {Array} Injury risks
   */
  getInjuryRisks(sportId, positionId = null) {
    const sport = this.getSport(sportId);
    if (!sport) {
      return [];
    }

    let risks = [...(sport.commonInjuries || [])];

    if (positionId && sport.positions && sport.positions[positionId]) {
      const positionRisks = sport.positions[positionId].injuryRisks || [];
      risks = [...risks, ...positionRisks];
    }

    return [...new Set(risks)]; // Remove duplicates
  }

  /**
   * Get training focus for sport/position
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID (optional)
   * @returns {Array} Training focus areas
   */
  getTrainingFocus(sportId, positionId = null) {
    const sport = this.getSport(sportId);
    if (!sport) {
      return [];
    }

    if (positionId && sport.positions && sport.positions[positionId]) {
      return sport.positions[positionId].trainingFocus || [];
    }

    return sport.trainingFocus || [];
  }

  /**
   * Get physical demands for position
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID
   * @returns {Object|null} Physical demands
   */
  getPhysicalDemands(sportId, positionId) {
    const position = this.getPosition(sportId, positionId);
    return position ? position.physicalDemands : null;
  }

  /**
   * Get training frequency recommendations
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID
   * @returns {Object|null} Training frequency
   */
  getTrainingFrequency(sportId, positionId) {
    const position = this.getPosition(sportId, positionId);
    return position ? position.trainingFrequency : null;
  }

  /**
   * Get all available sports
   * @returns {Array} Available sports
   */
  getAllSports() {
    return Object.keys(this.sports).map(id => ({
      id,
      ...this.sports[id],
    }));
  }

  /**
   * Get positions for sport
   * @param {string} sportId - Sport ID
   * @returns {Array} Positions
   */
  getPositions(sportId) {
    const sport = this.getSport(sportId);
    if (!sport || !sport.positions) {
      return [];
    }

    return Object.keys(sport.positions).map(id => ({
      id,
      ...sport.positions[id],
    }));
  }

  /**
   * Get seasons for sport
   * @param {string} sportId - Sport ID
   * @returns {Array} Seasons
   */
  getSeasons(sportId) {
    const sport = this.getSport(sportId);
    if (!sport || !sport.seasons) {
      return [];
    }

    return Object.keys(sport.seasons).map(id => ({
      id,
      ...sport.seasons[id],
    }));
  }

  /**
   * Validate sport configuration
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID
   * @param {string} seasonId - Season ID
   * @returns {Object} Validation result
   */
  validateConfiguration(sportId, positionId = null, seasonId = null) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    if (!this.getSport(sportId)) {
      result.valid = false;
      result.errors.push(`Sport '${sportId}' not found`);
    }

    if (positionId && !this.getPosition(sportId, positionId)) {
      result.valid = false;
      result.errors.push(`Position '${positionId}' not found for sport '${sportId}'`);
    }

    if (seasonId && !this.getSeason(sportId, seasonId)) {
      result.valid = false;
      result.errors.push(`Season '${seasonId}' not found for sport '${sportId}'`);
    }

    return result;
  }

  /**
   * Get sport-specific training principles
   * @param {string} sportId - Sport ID
   * @returns {Object|null} Training principles
   */
  getTrainingPrinciples(sportId) {
    const sport = this.getSport(sportId);
    return sport ? sport.trainingPrinciples : null;
  }
}

// Create global instance
window.SportDefinitions = new SportDefinitions();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SportDefinitions;
}
