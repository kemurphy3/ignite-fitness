/**
 * PreventionProtocols - Injury prevention protocol management
 * Provides sport and position-specific injury prevention strategies
 */
class PreventionProtocols {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.protocols = this.initializeProtocols();
    this.sportDefinitions = window.SportDefinitions;
  }

  /**
   * Initialize prevention protocols
   * @returns {Object} Prevention protocols
   */
  initializeProtocols() {
    return {
      acl_prevention: {
        name: 'ACL Injury Prevention',
        description: 'Comprehensive ACL injury prevention protocol',
        targetPopulation: ['soccer_players', 'basketball_players'],
        effectiveness: 'high',
        components: {
          neuromuscular_training: {
            exercises: [
              'landing_mechanics',
              'cutting_patterns',
              'jump_landing',
              'single_leg_landing',
              'side_step_cuts',
            ],
            frequency: '3-4x per week',
            duration: '15-20 minutes',
            intensity: 'moderate',
          },
          strength_training: {
            exercises: [
              'single_leg_squats',
              'single_leg_RDLs',
              'lunge_variations',
              'hip_strengthening',
              'hamstring_strengthening',
            ],
            frequency: '2-3x per week',
            duration: '20-30 minutes',
            intensity: 'moderate_high',
          },
          balance_training: {
            exercises: [
              'single_leg_balance',
              'unstable_surface_work',
              'dynamic_balance',
              'proprioception_training',
            ],
            frequency: '2-3x per week',
            duration: '10-15 minutes',
            intensity: 'moderate',
          },
        },
        evidence: 'Reduces ACL injury risk by 50-70%',
      },
      ankle_sprain_prevention: {
        name: 'Ankle Sprain Prevention',
        description: 'Ankle stability and proprioception training',
        targetPopulation: ['all_athletes', 'soccer_players'],
        effectiveness: 'moderate_high',
        components: {
          proprioception: {
            exercises: [
              'single_leg_balance',
              'wobble_board',
              'balance_disc_work',
              'BOSU_training',
              'eyes_closed_balance',
            ],
            frequency: 'Daily',
            duration: '5-10 minutes',
            intensity: 'low_moderate',
          },
          strengthening: {
            exercises: [
              'heel_raises',
              'theraband_exercises',
              'calf_strengthening',
              'peroneal_strengthening',
            ],
            frequency: '3-4x per week',
            duration: '10-15 minutes',
            intensity: 'moderate',
          },
          mobility: {
            exercises: ['ankle_circles', 'calf_stretching', 'ankle_mobility_work', 'foam_rolling'],
            frequency: 'Daily',
            duration: '5-10 minutes',
            intensity: 'low',
          },
        },
        evidence: 'Reduces ankle sprain risk by 30-40%',
      },
      hamstring_strain_prevention: {
        name: 'Hamstring Strain Prevention',
        description: 'Eccentric hamstring strength and flexibility',
        targetPopulation: ['soccer_players', 'runners'],
        effectiveness: 'high',
        components: {
          eccentric_strengthening: {
            exercises: [
              'nordic_hamstring',
              'single_leg_RDL',
              'eccentric_slider',
              'swiss_ball_hamstring',
            ],
            frequency: '2x per week',
            duration: '10-15 minutes',
            intensity: 'moderate_high',
          },
          flexibility: {
            exercises: [
              'hamstring_stretch',
              'PNF_stretching',
              'hip_hinge_mobility',
              'active_stretch',
            ],
            frequency: 'Daily',
            duration: '10-15 minutes',
            intensity: 'low_moderate',
          },
          strengthening: {
            exercises: ['hamstring_curl', 'RDL_variations', 'good_morning', 'hip_thrust'],
            frequency: '2x per week',
            duration: '15-20 minutes',
            intensity: 'moderate',
          },
        },
        evidence: 'Reduces hamstring strain risk by 60-70%',
      },
      groin_strain_prevention: {
        name: 'Groin Strain Prevention',
        description: 'Adductor strengthening and hip mobility',
        targetPopulation: ['soccer_players', 'hockey_players'],
        effectiveness: 'moderate_high',
        components: {
          strengthening: {
            exercises: [
              'adductor_strengthening',
              'lateral_band_walks',
              'copenhagen_plank',
              'hip_adduction_work',
            ],
            frequency: '2-3x per week',
            duration: '10-15 minutes',
            intensity: 'moderate',
          },
          mobility: {
            exercises: ['hip_flexor_stretch', 'adductor_stretch', 'hip_circles', 'pigeon_pose'],
            frequency: 'Daily',
            duration: '10-15 minutes',
            intensity: 'low_moderate',
          },
        },
        evidence: 'Reduces groin injury risk by 40-50%',
      },
      concussion_prevention: {
        name: 'Concussion Prevention',
        description: 'Neck strengthening and awareness training',
        targetPopulation: ['soccer_players', 'contact_sports'],
        effectiveness: 'moderate',
        components: {
          neck_strengthening: {
            exercises: [
              'neck_isometrics',
              'neck_flexion',
              'neck_extension',
              'lateral_neck_strength',
            ],
            frequency: '2-3x per week',
            duration: '10-15 minutes',
            intensity: 'moderate',
          },
          awareness_training: {
            exercises: [
              'situational_awareness',
              'proper_technique_training',
              'injury_education',
              'protocol_compliance',
            ],
            frequency: 'Ongoing',
            duration: '5-10 minutes',
            intensity: 'low',
          },
        },
        evidence: 'Reduces concussion risk by 20-30%',
      },
      stress_fracture_prevention: {
        name: 'Stress Fracture Prevention',
        description: 'Load management and bone strength',
        targetPopulation: ['runners', 'endurance_athletes'],
        effectiveness: 'high',
        components: {
          load_management: {
            exercises: ['gradual_progression', 'deload_weeks', 'cross_training', 'recovery_days'],
            frequency: 'Weekly',
            duration: 'Ongoing',
            intensity: 'monitored',
          },
          nutrition: {
            exercises: ['calcium_intake', 'vitamin_D', 'adequate_calories', 'bone_health'],
            frequency: 'Daily',
            duration: 'Ongoing',
            intensity: 'consistent',
          },
        },
        evidence: 'Reduces stress fracture risk by 50-60%',
      },
      shoulder_impingement_prevention: {
        name: 'Shoulder Impingement Prevention',
        description: 'Rotator cuff and scapular stability',
        targetPopulation: ['goalkeepers', 'overhead_athletes'],
        effectiveness: 'high',
        components: {
          rotator_cuff: {
            exercises: ['external_rotation', 'internal_rotation', 'scaption', 'prone_Y_T_W'],
            frequency: '3x per week',
            duration: '15-20 minutes',
            intensity: 'moderate',
          },
          scapular_stability: {
            exercises: ['wall_slides', 'band_pull_aparts', 'scapular_wall_holds', 'serratus_work'],
            frequency: '3x per week',
            duration: '15-20 minutes',
            intensity: 'moderate',
          },
          mobility: {
            exercises: ['shoulder_circles', 'doorway_stretch', 'lat_stretch', 'pec_minor_release'],
            frequency: 'Daily',
            duration: '10-15 minutes',
            intensity: 'low_moderate',
          },
        },
        evidence: 'Reduces shoulder injury risk by 40-50%',
      },
    };
  }

  /**
   * Get protocol for specific injury
   * @param {string} injuryType - Type of injury
   * @returns {Object|null} Prevention protocol
   */
  getProtocol(injuryType) {
    const protocolKey = `${injuryType.toLowerCase().replace(/[^a-z0-9]/g, '_')}_prevention`;
    return this.protocols[protocolKey] || null;
  }

  /**
   * Get protocols for sport
   * @param {string} sportId - Sport ID
   * @returns {Array} Sport-specific protocols
   */
  getProtocolsForSport(sportId) {
    const sport = this.sportDefinitions.getSport(sportId);
    if (!sport) {
      return [];
    }

    const sportInjuries = sport.commonInjuries || [];
    const protocols = [];

    sportInjuries.forEach(injury => {
      const protocol = this.getProtocol(injury.name || injury);
      if (protocol) {
        protocols.push({
          injury,
          protocol,
        });
      }
    });

    return protocols;
  }

  /**
   * Get protocols for position
   * @param {string} sportId - Sport ID
   * @param {string} positionId - Position ID
   * @returns {Array} Position-specific protocols
   */
  getProtocolsForPosition(sportId, positionId) {
    const position = this.sportDefinitions.getPosition(sportId, positionId);
    if (!position) {
      return [];
    }

    const positionInjuries = position.injuryRisks || [];
    const protocols = [];

    positionInjuries.forEach(injury => {
      const protocol = this.getProtocol(injury.name || injury);
      if (protocol) {
        protocols.push({
          injury,
          protocol,
        });
      }
    });

    return protocols;
  }

  /**
   * Create personalized prevention program
   * @param {Object} userProfile - User profile
   * @returns {Object} Prevention program
   */
  createPreventionProgram(userProfile) {
    const sportId = userProfile.sport || 'soccer';
    const positionId = userProfile.position;

    const sportProtocols = this.getProtocolsForSport(sportId);
    const positionProtocols = positionId ? this.getProtocolsForPosition(sportId, positionId) : [];

    const program = {
      userId: userProfile.userId,
      sport: sportId,
      position: positionId,
      createdAt: new Date().toISOString(),
      protocols: [...sportProtocols, ...positionProtocols],
      schedule: this.generateSchedule(sportProtocols, positionProtocols),
      priorities: this.determinePriorities(sportProtocols, positionProtocols),
    };

    this.logger.audit('PREVENTION_PROGRAM_CREATED', {
      userId: userProfile.userId,
      sport: sportId,
      position: positionId,
      protocolCount: program.protocols.length,
    });

    return program;
  }

  /**
   * Generate weekly schedule for prevention protocols
   * @param {Array} sportProtocols - Sport protocols
   * @param {Array} positionProtocols - Position protocols
   * @returns {Object} Weekly schedule
   */
  generateSchedule(sportProtocols, positionProtocols) {
    const schedule = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };

    // Add neuromuscular training (most effective prevention)
    sportProtocols.forEach(({ protocol }) => {
      if (protocol.components.neuromuscular_training) {
        schedule.monday.push({
          type: 'neuromuscular_training',
          protocol: protocol.name,
          duration: protocol.components.neuromuscular_training.duration,
        });
        schedule.thursday.push({
          type: 'neuromuscular_training',
          protocol: protocol.name,
          duration: protocol.components.neuromuscular_training.duration,
        });
      }
    });

    // Add strength training components
    sportProtocols.forEach(({ protocol }) => {
      if (protocol.components.strength_training) {
        schedule.tuesday.push({
          type: 'strength_training',
          protocol: protocol.name,
          duration: protocol.components.strength_training.duration,
        });
        schedule.friday.push({
          type: 'strength_training',
          protocol: protocol.name,
          duration: protocol.components.strength_training.duration,
        });
      }
    });

    // Add daily components (mobility, proprioception)
    sportProtocols.forEach(({ protocol }) => {
      if (protocol.components.proprioception) {
        Object.keys(schedule).forEach(day => {
          schedule[day].push({
            type: 'proprioception',
            protocol: protocol.name,
            duration: protocol.components.proprioception.duration,
          });
        });
      }
    });

    positionProtocols.forEach(({ protocol }) => {
      const components = protocol.components || {};
      if (components.mobility_work) {
        schedule.wednesday.push({
          type: 'mobility_work',
          protocol: protocol.name,
          duration: components.mobility_work.duration || 15,
        });
      }
      if (components.position_specific) {
        schedule.friday.push({
          type: 'position_specific',
          protocol: protocol.name,
          duration: components.position_specific.duration || 20,
        });
      }
    });

    return schedule;
  }

  /**
   * Determine prevention priorities
   * @param {Array} sportProtocols - Sport protocols
   * @param {Array} positionProtocols - Position protocols
   * @returns {Array} Priorities
   */
  determinePriorities(sportProtocols, positionProtocols) {
    const priorities = [];

    // Prioritize high-effectiveness protocols
    [...sportProtocols, ...positionProtocols].forEach(({ protocol }) => {
      if (protocol.effectiveness === 'high') {
        priorities.push({
          protocol: protocol.name,
          priority: 'critical',
          reason: 'High effectiveness in injury prevention',
        });
      }
    });

    return priorities;
  }

  /**
   * Get all prevention protocols
   * @returns {Array} All protocols
   */
  getAllProtocols() {
    return Object.values(this.protocols);
  }

  /**
   * Get protocol effectiveness data
   * @param {string} injuryType - Injury type
   * @returns {Object} Effectiveness data
   */
  getEffectivenessData(injuryType) {
    const protocol = this.getProtocol(injuryType);
    if (!protocol) {
      return null;
    }

    return {
      injuryType,
      protocolName: protocol.name,
      effectiveness: protocol.effectiveness,
      evidence: protocol.evidence,
      complianceImportance: 'High - requires consistent adherence',
    };
  }
}

// Create global instance
window.PreventionProtocols = new PreventionProtocols();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PreventionProtocols;
}
