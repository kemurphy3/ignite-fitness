/**
 * SportsCoach - AI expert for sport-specific training recommendations
 * Provides athletic performance optimization
 */
class SportsCoach {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.authManager = window.AuthManager;

    // VO₂ Max zone definitions
    this.vo2MaxZones = {
      Z2: { min: 0.6, max: 0.7, name: 'Aerobic Base', description: 'Easy conversational pace' },
      Z3: {
        min: 0.7,
        max: 0.8,
        name: 'Aerobic Threshold',
        description: 'Moderate effort, sustainable',
      },
      Z4: { min: 0.8, max: 0.9, name: 'Lactate Threshold', description: 'Hard but controlled' },
      Z5: { min: 0.9, max: 1.0, name: 'VO₂ Max', description: 'Maximum effort intervals' },
    };
  }

  /**
   * Propose session plan based on sport demands
   * @param {Object} context - User context
   * @returns {Object} Sports coach proposal
   */
  propose({ user, season, schedule, history, readiness, preferences }) {
    const sport = user.sport || 'soccer';

    const proposal = {
      blocks: [],
      constraints: [],
      priorities: [],
    };

    // Check for game day scheduling
    const daysUntilGame = this.getDaysUntilGame(schedule);

    // Get training phase (from season or user preferences)
    const trainingPhase = this.getTrainingPhase(season, user, schedule);

    // Power development or maintenance
    const powerWork = this.generatePowerWork(sport, season, daysUntilGame);

    // Sport-specific conditioning (with training phase for running)
    const conditioning = this.generateConditioning(sport, readiness, trainingPhase);

    proposal.blocks = [
      ...powerWork,
      {
        type: 'conditioning',
        exercises: conditioning,
        duration: 15,
        rationale: 'Sport-specific energy system development',
      },
    ];

    proposal.constraints = [
      {
        type: 'game_day_safety',
        rule: daysUntilGame <= 2 ? 'Lower intensity, no heavy leg work' : 'Normal programming',
        daysUntilGame,
      },
      {
        type: 'volume',
        rule: `Total volume ${this.calculateVolume(readiness)}`,
      },
    ];

    proposal.priorities = [
      { priority: 1, goal: 'Sport performance', weight: 0.3 },
      { priority: 2, goal: 'Injury prevention', weight: 0.2 },
    ];

    return proposal;
  }

  getDaysUntilGame(schedule) {
    if (!schedule || !schedule.upcomingGames) {
      return 99;
    }

    const nextGame = schedule.upcomingGames[0];
    const gameDate = new Date(nextGame.date);
    const today = new Date();
    const days = Math.ceil((gameDate - today) / (1000 * 60 * 60 * 24));

    return days;
  }

  generatePowerWork(sport, season, daysUntilGame) {
    if (daysUntilGame <= 1) {
      // Game -1: Upper body only, light
      return [
        {
          type: 'power',
          exercises: ['medicine_ball_throws', 'band_rotations'],
          sets: 3,
          rationale: 'Game tomorrow - upper body power maintenance',
        },
      ];
    }

    if (daysUntilGame <= 2) {
      // Game -2: No heavy legs, moderate power
      return [
        {
          type: 'power',
          exercises: ['jump_squats', 'box_jumps'],
          sets: 3,
          load: 'bodyweight',
          rationale: 'Game in 2 days - power without heavy loading',
        },
      ];
    }

    // Normal power work
    return [
      {
        type: 'power',
        exercises: ['power_cleans', 'jump_squats'],
        sets: 5,
        load: 'moderate',
        rationale: 'Power development for athleticism',
      },
    ];
  }

  generateConditioning(sport, readiness, trainingPhase = 'base') {
    const conditioningMap = {
      soccer: ['interval_running', 'shuttle_runs', 'agility_drills'],
      basketball: ['sprint_intervals', 'court_work', 'jump_conditioning'],
      running: ['tempo_runs', 'hill_sprints', 'fartlek'],
    };

    const exercises = conditioningMap[sport] || conditioningMap.soccer;
    const adjustedVolume = this.adjustForReadiness(readiness);

    // For running sport, add VO₂ Max zone training
    if (sport === 'running') {
      return this.generateRunningZoneTraining(readiness, trainingPhase);
    }

    return exercises.map(ex => ({
      name: ex,
      duration: adjustedVolume.duration,
      intensity: adjustedVolume.intensity,
    }));
  }

  /**
   * Get training phase from season and user data
   * @param {Object} season - Season information
   * @param {Object} user - User profile
   * @param {Object} schedule - Schedule information
   * @returns {string} Training phase
   */
  getTrainingPhase(season, user, schedule) {
    // Check user preferences first
    if (user?.trainingPhase) {
      return user.trainingPhase;
    }

    // Infer from season
    if (season?.phase) {
      const phaseMap = {
        preseason: 'build',
        in_season: 'peak',
        offseason: 'base',
        transition: 'recovery',
      };
      return phaseMap[season.phase] || 'base';
    }

    // Default based on days until game
    const daysUntilGame = this.getDaysUntilGame(schedule);
    if (daysUntilGame <= 3) {
      return 'tune'; // Tune-up before game
    }
    if (daysUntilGame <= 7) {
      return 'peak'; // Peak phase
    }

    return 'base'; // Default to base building
  }

  /**
   * Generate VO₂ Max zone-based running training
   * @param {number} readiness - User readiness score
   * @param {string} trainingPhase - Training phase (base, build, peak, recovery)
   * @returns {Array} Zone training recommendations
   */
  generateRunningZoneTraining(readiness, trainingPhase = 'base') {
    const vo2Max = this.estimateVO2Max();
    const hrZones = this.calculateHeartRateZones(vo2Max);
    const targetZone = this.selectTargetZone(trainingPhase, readiness);

    const zoneRecommendations = [];

    switch (targetZone) {
      case 'Z2':
        // Base building - easy aerobic work
        zoneRecommendations.push({
          name: 'Aerobic Base Run (Z2)',
          zone: 'Z2',
          targetHR: `${hrZones.Z2.min}-${hrZones.Z2.max} bpm`,
          duration: this.getZoneDuration('Z2', readiness),
          pace: 'Conversational, easy',
          rationale: 'Building aerobic base and mitochondrial density',
          notes: 'Should feel easy, able to hold a conversation',
        });
        break;

      case 'Z3':
        // Moderate aerobic work
        zoneRecommendations.push({
          name: 'Aerobic Threshold Run (Z3)',
          zone: 'Z3',
          targetHR: `${hrZones.Z3.min}-${hrZones.Z3.max} bpm`,
          duration: this.getZoneDuration('Z3', readiness),
          pace: 'Moderate, sustainable',
          rationale: 'Improving aerobic threshold and efficiency',
          notes: 'Comfortably hard, sustainable effort',
        });
        break;

      case 'Z4':
        // Lactate threshold work
        zoneRecommendations.push({
          name: 'Lactate Threshold Intervals (Z4)',
          zone: 'Z4',
          targetHR: `${hrZones.Z4.min}-${hrZones.Z4.max} bpm`,
          duration: this.getZoneDuration('Z4', readiness),
          intervals: this.getZoneIntervals('Z4', readiness),
          pace: 'Hard but controlled',
          rationale: 'Raising lactate threshold for faster sustainable pace',
          notes: 'Hard effort, can maintain for intervals',
        });
        break;

      case 'Z5':
        // VO₂ Max intervals
        zoneRecommendations.push({
          name: 'VO₂ Max Intervals (Z5)',
          zone: 'Z5',
          targetHR: `${hrZones.Z5.min}-${hrZones.Z5.max} bpm`,
          duration: this.getZoneDuration('Z5', readiness),
          intervals: this.getZoneIntervals('Z5', readiness),
          pace: 'Maximum effort',
          rationale: 'Increasing VO₂ Max capacity',
          notes: 'All-out effort, full recovery between intervals',
        });
        break;
    }

    return zoneRecommendations;
  }

  /**
   * Estimate VO₂ Max (ml/kg/min)
   * Uses Cooper test estimation if no actual VO₂ Max data
   * @returns {number} Estimated VO₂ Max
   */
  estimateVO2Max() {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        return this.getDefaultVO2Max();
      }

      // Check for stored VO₂ Max
      const storedVO2 = localStorage.getItem(`ignitefitness_vo2max_${userId}`);
      if (storedVO2) {
        const parsed = parseFloat(storedVO2);
        if (!isNaN(parsed) && parsed > 20 && parsed < 80) {
          return parsed;
        }
      }

      // Estimate from user profile if available
      const userProfile = this.getUserProfile();
      if (userProfile && userProfile.age && userProfile.restingHeartRate) {
        return this.estimateVO2FromProfile(userProfile);
      }

      // Default estimation based on age and fitness level
      return this.getDefaultVO2Max();
    } catch (error) {
      this.logger.error('Failed to estimate VO₂ Max:', error);
      return this.getDefaultVO2Max();
    }
  }

  /**
   * Estimate VO₂ Max from user profile
   * @param {Object} profile - User profile with age, RHR, etc.
   * @returns {number} Estimated VO₂ Max
   */
  estimateVO2FromProfile(profile) {
    const age = profile.age || 30;
    const restingHR = profile.restingHeartRate || 60;
    const maxHR = 220 - age;
    const hrReserve = maxHR - restingHR;

    // Simple estimation based on HR reserve (rough approximation)
    // Athletes typically have higher VO₂ Max
    const isAthlete = profile.sport && profile.sport !== 'general_fitness';
    const baseVO2 = isAthlete ? 45 : 35;

    // Adjust based on HR reserve (better cardiovascular fitness = higher VO₂ Max)
    const hrReserveFactor = hrReserve > 50 ? 1.2 : hrReserve > 40 ? 1.0 : 0.8;

    return Math.round(baseVO2 * hrReserveFactor);
  }

  /**
   * Get default VO₂ Max estimate
   * @returns {number} Default VO₂ Max (ml/kg/min)
   */
  getDefaultVO2Max() {
    // Average untrained male: ~35-40, female: ~27-35
    // Average trained: ~50-60
    // Elite: 60-80+
    return 45; // Default to moderate fitness level
  }

  /**
   * Store user's actual VO₂ Max (from testing)
   * @param {number} vo2Max - Actual VO₂ Max value (ml/kg/min)
   * @returns {boolean} Success
   */
  storeVO2Max(vo2Max) {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        this.logger.error('No user ID for VO₂ Max storage');
        return false;
      }

      // Validate VO₂ Max value
      if (typeof vo2Max !== 'number' || isNaN(vo2Max) || vo2Max < 20 || vo2Max > 80) {
        this.logger.error('Invalid VO₂ Max value:', vo2Max);
        return false;
      }

      // Store in localStorage
      const storageKey = `ignitefitness_vo2max_${userId}`;
      localStorage.setItem(storageKey, vo2Max.toString());

      this.logger.audit('VO2_MAX_STORED', { userId, vo2Max });
      return true;
    } catch (error) {
      this.logger.error('Failed to store VO₂ Max:', error);
      return false;
    }
  }

  /**
   * Get all heart rate zones for display
   * @returns {Object} All heart rate zones
   */
  getAllHeartRateZones() {
    const vo2Max = this.estimateVO2Max();
    return this.calculateHeartRateZones(vo2Max);
  }

  /**
   * Get user profile from storage
   * @returns {Object|null} User profile
   */
  getUserProfile() {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        return null;
      }

      const profileKey = `ignitefitness_profile_${userId}`;
      const stored = localStorage.getItem(profileKey);

      if (stored) {
        return JSON.parse(stored);
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Calculate heart rate zones from VO₂ Max
   * @param {number} vo2Max - VO₂ Max (ml/kg/min)
   * @returns {Object} Heart rate zones
   */
  calculateHeartRateZones(vo2Max) {
    const userProfile = this.getUserProfile();
    const age = userProfile?.age || 30;
    const restingHR = userProfile?.restingHeartRate || 60;
    const maxHR = 220 - age; // Simple max HR estimation
    const hrReserve = maxHR - restingHR;

    // Convert VO₂ Max zones to HR zones using Karvonen formula
    // VO₂ Max percentage ≈ HR percentage for trained individuals
    const zones = {};

    for (const [zoneName, zoneConfig] of Object.entries(this.vo2MaxZones)) {
      // Use VO₂ Max percentages as HR percentages
      const minHR = restingHR + hrReserve * zoneConfig.min;
      const maxHR = restingHR + hrReserve * zoneConfig.max;

      zones[zoneName] = {
        min: Math.round(minHR),
        max: Math.round(maxHR),
        name: zoneConfig.name,
        description: zoneConfig.description,
        vo2Range: `${Math.round(zoneConfig.min * 100)}-${Math.round(zoneConfig.max * 100)}%`,
      };
    }

    return zones;
  }

  /**
   * Select target zone based on training phase and readiness
   * @param {string} trainingPhase - Training phase (base, build, peak, recovery)
   * @param {number} readiness - Readiness score
   * @returns {string} Target zone (Z2-Z5)
   */
  selectTargetZone(trainingPhase, readiness) {
    // Adjust for readiness
    if (readiness < 5) {
      return 'Z2'; // Low readiness = easy base work
    }

    if (readiness < 7) {
      return 'Z3'; // Moderate readiness = moderate work
    }

    // Phase-based selection
    switch (trainingPhase) {
      case 'base':
        return 'Z2'; // Base building = mostly Z2
      case 'build':
        return 'Z3'; // Build phase = Z3 threshold work
      case 'peak':
        if (readiness >= 8) {
          return 'Z4'; // Peak with high readiness = threshold intervals
        }
        return 'Z3';
      case 'tune':
        if (readiness >= 9) {
          return 'Z5'; // Tune-up = VO₂ Max intervals
        }
        return 'Z4';
      case 'recovery':
        return 'Z2'; // Recovery = easy base
      default:
        return 'Z3'; // Default to moderate work
    }
  }

  /**
   * Get duration for zone training
   * @param {string} zone - Zone (Z2-Z5)
   * @param {number} readiness - Readiness score
   * @returns {string} Duration recommendation
   */
  getZoneDuration(zone, readiness) {
    const readinessMultiplier = Math.max(0.5, readiness / 10);

    const baseDurations = {
      Z2: { min: 30, max: 90 }, // Longer easy runs
      Z3: { min: 20, max: 60 }, // Moderate duration
      Z4: { min: 20, max: 40 }, // Threshold work
      Z5: { min: 15, max: 30 }, // Shorter intense intervals
    };

    const base = baseDurations[zone] || baseDurations.Z3;
    const adjustedMin = Math.round(base.min * readinessMultiplier);
    const adjustedMax = Math.round(base.max * readinessMultiplier);

    if (zone === 'Z4' || zone === 'Z5') {
      return `${adjustedMin}-${adjustedMax} min total (with intervals)`;
    }

    return `${adjustedMin}-${adjustedMax} min`;
  }

  /**
   * Get interval structure for zone training
   * @param {string} zone - Zone (Z4 or Z5)
   * @param {number} readiness - Readiness score
   * @returns {string} Interval structure
   */
  getZoneIntervals(zone, readiness) {
    if (zone === 'Z2' || zone === 'Z3') {
      return null; // Continuous effort zones
    }

    const readinessMultiplier = Math.max(0.5, readiness / 10);

    if (zone === 'Z4') {
      // Lactate threshold intervals: 5-8 min on, 1-2 min off
      const intervalMin = Math.round(5 * readinessMultiplier);
      const intervalMax = Math.round(8 * readinessMultiplier);
      const restMin = Math.max(1, Math.round(2 * readinessMultiplier));
      const sets = readiness >= 8 ? 4 : readiness >= 6 ? 3 : 2;

      return `${sets}x${intervalMin}-${intervalMax} min @ Z4, ${restMin} min rest`;
    }

    if (zone === 'Z5') {
      // VO₂ Max intervals: 3-5 min on, 2-3 min off
      const intervalMin = Math.round(3 * readinessMultiplier);
      const intervalMax = Math.round(5 * readinessMultiplier);
      const restMin = Math.max(2, Math.round(3 * readinessMultiplier));
      const sets = readiness >= 9 ? 5 : readiness >= 7 ? 4 : 3;

      return `${sets}x${intervalMin}-${intervalMax} min @ Z5, ${restMin} min rest`;
    }

    return null;
  }

  adjustForReadiness(readiness) {
    if (readiness >= 8) {
      return { duration: '15-20min', intensity: 'high' };
    } else if (readiness >= 5) {
      return { duration: '10-15min', intensity: 'moderate' };
    } else {
      return { duration: '5-10min', intensity: 'low' };
    }
  }

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

window.SportsCoach = SportsCoach;
