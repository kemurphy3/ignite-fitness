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

    // Define seasonal phases with durations
    this.phases = {
      off: { name: 'Off-Season', duration: '3-4 months', focus: 'strength_power_development' },
      pre: { name: 'Pre-Season', duration: '6-8 weeks', focus: 'sport_specific_preparation' },
      in: { name: 'In-Season', duration: '6-9 months', focus: 'performance_maintenance' },
      post: { name: 'Post-Season', duration: '2-4 weeks', focus: 'recovery_regeneration' },
    };
  }

  /**
   * Get seasonal context for planning
   * @param {Date} date - Current date
   * @param {Object} userProfile - User profile with season info
   * @param {Object} calendar - Calendar with key matches
   * @returns {Object} Season context with phase, week, and deload info
   */
  getSeasonContext(date, userProfile, calendar = {}) {
    try {
      const phase = this.determinePhase(date, userProfile);
      const weekOfBlock = this.getWeekOfBlock(date);
      const deloadThisWeek = weekOfBlock === 4;

      // Check for game proximity in-season
      const gameProximity = this.checkGameProximity(date, calendar, phase);

      const context = {
        phase: phase.name,
        phaseKey: phase.key,
        weekOfBlock,
        deloadThisWeek,
        volumeModifier: this.getVolumeModifier(deloadThisWeek, phase),
        gameProximity,
        emphasis: phase.focus,
        isSpecialPhase: phase.isSpecialPhase || false,
        specialPhaseInfo: phase.isSpecialPhase
          ? {
              name: phase.specialPhaseName,
              peakPerformance: phase.peakPerformance,
              tapering: phase.tapering,
            }
          : null,
        rules: this.getPhaseRules(phase.key, gameProximity, phase),
      };

      this.logger.debug('Season context', context);

      return context;
    } catch (error) {
      this.logger.error('Failed to get season context', error);
      return {
        phase: 'In-Season',
        phaseKey: 'in',
        weekOfBlock: 1,
        deloadThisWeek: false,
        volumeModifier: 1.0,
        gameProximity: {},
        emphasis: 'performance_maintenance',
        rules: [],
      };
    }
  }

  /**
   * Determine current training phase
   * @param {Date} date - Current date
   * @param {Object} userProfile - User profile
   * @returns {Object} Phase configuration
   */
  determinePhase(date, userProfile) {
    const currentMonth = date.getMonth() + 1; // 1-12

    // Check for custom season calendar in user profile
    if (userProfile && userProfile.seasonCalendar) {
      const customPhase = this.getPhaseFromCalendar(date, userProfile.seasonCalendar);
      if (customPhase) {
        return { ...this.phases[customPhase], key: customPhase };
      }
    }

    // Check for explicit season phase override
    if (userProfile && userProfile.seasonPhase) {
      const basePhase = { ...this.phases[userProfile.seasonPhase], key: userProfile.seasonPhase };

      // Check if in a special sub-phase (playoffs, tournament, etc.)
      if (userProfile.seasonCalendar && userProfile.seasonCalendar.specialPhases) {
        for (const specialPhase of userProfile.seasonCalendar.specialPhases) {
          if (this.isDateInRange(date, specialPhase)) {
            return {
              ...basePhase,
              isSpecialPhase: true,
              specialPhaseName: specialPhase.name,
              peakPerformance: specialPhase.peakPerformance || false,
              tapering: specialPhase.tapering || false,
            };
          }
        }
      }

      return basePhase;
    }

    // Auto-detect based on month
    if (currentMonth >= 12 || currentMonth <= 2) {
      return { ...this.phases.off, key: 'off' };
    } else if (currentMonth >= 3 && currentMonth <= 5) {
      return { ...this.phases.pre, key: 'pre' };
    } else {
      return { ...this.phases.in, key: 'in' };
    }
  }

  /**
   * Get phase from custom season calendar
   * @param {Date} date - Current date
   * @param {Object} calendar - Custom season calendar
   * @returns {string|null} Phase key
   */
  getPhaseFromCalendar(date, calendar) {
    if (!calendar.phases) {
      return null;
    }

    for (const [phaseKey, phaseDates] of Object.entries(calendar.phases)) {
      if (this.isDateInRange(date, phaseDates)) {
        return phaseKey;
      }
    }

    return null;
  }

  /**
   * Check if date is within a date range
   * @param {Date} date - Date to check
   * @param {Object} range - Date range with start and end
   * @returns {boolean} Is in range
   */
  isDateInRange(date, range) {
    if (!range.start || !range.end) {
      return false;
    }

    const startDate = new Date(range.start);
    const endDate = new Date(range.end);

    return date >= startDate && date <= endDate;
  }

  /**
   * Get current week of 4-week block
   * @param {Date} date - Current date
   * @returns {number} Week number (1-4)
   */
  getWeekOfBlock(date) {
    // Assume blocks start at program start or specific date
    // For now, calculate from arbitrary start date
    const startDate = new Date(date.getFullYear(), 0, 1); // Jan 1
    const daysSince = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSince / 7);

    return (weekNumber % 4) + 1; // Returns 1-4
  }

  /**
   * Check game proximity in calendar
   * @param {Date} date - Current date
   * @param {Object} calendar - Calendar with key matches
   * @param {Object} phase - Current phase
   * @returns {Object} Game proximity info
   */
  checkGameProximity(date, calendar, phase) {
    const result = {
      hasGame: false,
      daysUntil: null,
      isTomorrow: false,
      isWithin48h: false,
      suppressHeavyLower: false,
    };

    // Only check in-season
    if (phase.key !== 'in') {
      return result;
    }

    const keyMatches = calendar.keyMatches || [];
    const games = calendar.games || [];

    for (const game of [...keyMatches, ...games]) {
      const gameDate = new Date(game.date);
      const daysUntil = Math.floor((gameDate - date) / (1000 * 60 * 60 * 24));

      if (daysUntil >= 0 && daysUntil <= 2) {
        result.hasGame = true;
        result.daysUntil = daysUntil;
        result.isTomorrow = daysUntil === 1;
        result.isWithin48h = daysUntil <= 1;

        // Suppress heavy lower body within 48h of game
        if (result.isWithin48h) {
          result.suppressHeavyLower = true;
        }

        break;
      }
    }

    return result;
  }

  /**
   * Get phase-specific rules
   * @param {string} phaseKey - Phase key
   * @param {Object} gameProximity - Game proximity info
   * @param {Object} phaseInfo - Additional phase info (special phases, etc.)
   * @returns {Array} Array of applicable rules
   */
  getPhaseRules(phaseKey, gameProximity, phaseInfo = {}) {
    const rules = [];

    // Special phases (playoffs, tournament, etc.)
    if (phaseInfo.isSpecialPhase) {
      if (phaseInfo.peakPerformance) {
        rules.push(`${phaseInfo.specialPhaseName}: Peak performance focus`);
        rules.push('Maximize readiness without fatigue');
      }

      if (phaseInfo.tapering) {
        rules.push(`${phaseInfo.specialPhaseName}: Tapering protocol`);
        rules.push('Reduce volume while maintaining intensity');
      }
    }

    // Deload rule
    if (this.getWeekOfBlock(new Date()) === 4 && !phaseInfo.isSpecialPhase) {
      rules.push('Deload week: -20% volume');
    }

    // Off-season: emphasize strength
    if (phaseKey === 'off') {
      rules.push('Off-season: Emphasize strength blocks');
      rules.push('Higher volume allowed');
    }

    // Pre-season: sport-specific prep
    if (phaseKey === 'pre') {
      rules.push('Pre-season: Sport-specific preparation');
      rules.push('Balance strength and conditioning');
    }

    // In-season: game proximity
    if (phaseKey === 'in' && gameProximity.hasGame) {
      if (gameProximity.isTomorrow) {
        rules.push('Game tomorrow: Upper body light only');
        rules.push('No heavy lower body work');
      } else if (gameProximity.isWithin48h) {
        rules.push('Game within 48h: Suppress heavy lower');
      }
    }

    // Post-season: recovery
    if (phaseKey === 'post') {
      rules.push('Post-season: Recovery and regeneration');
      rules.push('Reduce intensity and volume');
    }

    return rules;
  }

  /**
   * Generate 4-week microcycle block with automatic tapering
   * @param {Object} phase - Phase configuration
   * @param {number} blockNumber - Block number (1-4)
   * @param {Array} keyMatches - Array of key match dates
   * @returns {Object} 4-week microcycle
   */
  generateMicrocycle(phase, blockNumber, keyMatches = []) {
    const weeks = [];

    for (let week = 1; week <= 4; week++) {
      let volumeMultiplier = 1.0;
      let intensityMultiplier = 1.0;
      let isTaperWeek = false;
      let taperReason = null;

      // Apply progressive loading for weeks 1-3
      if (week <= 3) {
        volumeMultiplier = 0.7 + week * 0.1; // 0.8, 0.9, 1.0
        intensityMultiplier = 0.9 + week * 0.033; // 0.933, 0.966, 1.0

        // Check for key matches in this week
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() + (blockNumber - 1) * 28 + (week - 1) * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const hasKeyMatch = keyMatches.some(match => {
          const matchDate = new Date(match.date);
          return matchDate >= weekStart && matchDate <= weekEnd;
        });

        // Auto-taper 10 days before key match
        if (hasKeyMatch || this.isNearKeyMatch(weekStart, keyMatches)) {
          volumeMultiplier *= 0.7; // -30% volume
          intensityMultiplier *= 0.9; // -10% intensity
          isTaperWeek = true;
          taperReason = 'Tapering for key match';
        }
      } else {
        // Deload week 4
        volumeMultiplier = 0.6; // -40% volume
        intensityMultiplier = 0.85; // -15% intensity
      }

      weeks.push({
        weekNumber: week,
        volumeMultiplier,
        intensityMultiplier,
        isDeload: week === 4,
        isTaperWeek,
        taperReason,
        focus: this.getWeeklyFocus(phase, week),
        activities: phase.activities,
        trainingLoad: this.calculateTrainingLoad(week, phase),
      });
    }

    return {
      blockNumber,
      phase: phase.name,
      weeks,
      totalDuration: '4 weeks',
      startDate: this.calculateBlockStartDate(blockNumber),
      endDate: this.calculateBlockEndDate(blockNumber),
      keyMatches: keyMatches.filter(m => this.isInBlock(m.date, blockNumber)),
    };
  }

  /**
   * Check if date is near a key match (within 10 days)
   * @param {Date} date - Date to check
   * @param {Array} keyMatches - Array of key match dates
   * @returns {boolean} Is near key match
   */
  isNearKeyMatch(date, keyMatches) {
    return keyMatches.some(match => {
      const matchDate = new Date(match.date);
      const daysUntil = Math.floor((matchDate - date) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 10;
    });
  }

  /**
   * Get volume modifier based on deload and phase
   * @param {boolean} deloadThisWeek - Is this a deload week
   * @param {Object} phase - Phase information
   * @returns {number} Volume modifier (0.6-1.0)
   */
  getVolumeModifier(deloadThisWeek, phase) {
    // Special phases might have custom modifiers
    if (phase.isSpecialPhase) {
      if (phase.peakPerformance) {
        return 0.85; // Slightly reduced volume for peak performance
      }
      if (phase.tapering) {
        return 0.7; // Tapering reduces volume
      }
    }

    // Regular deload week
    if (deloadThisWeek) {
      return 0.8; // -20% volume
    }

    return 1.0; // Normal volume
  }

  /**
   * Check if key match is in this block
   * @param {Date} matchDate - Match date
   * @param {number} blockNumber - Block number
   * @returns {boolean} Is in block
   */
  isInBlock(matchDate, blockNumber) {
    const blockStart = this.calculateBlockStartDate(blockNumber);
    const blockEnd = this.calculateBlockEndDate(blockNumber);
    const match = new Date(matchDate);
    return match >= blockStart && match <= blockEnd;
  }

  /**
   * Get weekly focus based on phase
   * @param {Object} phase - Phase configuration
   * @param {number} week - Week number
   * @returns {string} Focus area
   */
  getWeeklyFocus(phase, week) {
    const phaseName = phase.name || 'General';
    const block = Math.max(1, Math.ceil(week / 4));

    if (phaseName === 'Pre-Season') {
      return block === 1 ? 'strength and power' : 'power and speed';
    }
    if (phaseName === 'In-Season') {
      return block === 1 ? 'maintenance and sprint/agility' : 'recovery and tactical sharpness';
    }
    if (phaseName === 'Off-Season') {
      return block === 1 ? 'strength development' : 'aerobic base building';
    }
    return block === 1 ? 'recovery and regeneration' : 'mobility and technique';
  }

  /**
   * Flag key match
   * @param {Date} date - Match date
   * @param {string} opponent - Opponent name
   * @returns {Promise<Object>} Flagged match
   */
  async flagKeyMatch(date, opponent = 'Match') {
    try {
      const userId = this.getUserId();
      const match = {
        date: date.toISOString(),
        opponent,
        type: 'key_match',
        flagged: true,
        taperApplied: true,
        taperDays: 10,
      };

      // Store flagged match
      const keyMatches = await this.getKeyMatches(userId);
      keyMatches.push(match);
      await this.saveKeyMatches(userId, keyMatches);

      // Recalculate upcoming blocks with taper
      const updatedPlans = await this.applyTaperingToUpcomingBlocks(userId, keyMatches);

      this.logger.audit('KEY_MATCH_FLAGGED', { match, updatedPlans });

      return match;
    } catch (error) {
      this.logger.error('Failed to flag key match', error);
      throw error;
    }
  }

  /**
   * Get key matches
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Key matches
   */
  async getKeyMatches(userId) {
    try {
      const data = await this.storageManager.getData(userId, 'key_matches');
      return data || [];
    } catch (error) {
      this.logger.error('Failed to get key matches', error);
      return [];
    }
  }

  /**
   * Save key matches
   * @param {string} userId - User ID
   * @param {Array} matches - Matches
   */
  async saveKeyMatches(userId, matches) {
    await this.storageManager.saveData(userId, 'key_matches', matches);
  }

  /**
   * Apply tapering to upcoming blocks
   * @param {string} userId - User ID
   * @param {Array} keyMatches - Key matches
   * @returns {Promise<Object>} Updated plans
   */
  async applyTaperingToUpcomingBlocks(userId, keyMatches) {
    const updatedPlans = [];
    const currentBlock = this.getCurrentBlock();

    // Update next 2 blocks (2-4 weeks ahead)
    for (let blockOffset = 1; blockOffset <= 2; blockOffset++) {
      const blockNumber = currentBlock + blockOffset;
      const phase = this.getCurrentPhase();
      const block = this.generateMicrocycle(phase, blockNumber, keyMatches);

      updatedPlans.push(block);
    }

    // Store updated plans
    await this.storageManager.saveData(userId, 'updated_periodization', updatedPlans);

    return updatedPlans;
  }

  /**
   * Get current block number
   * @returns {number} Current block
   */
  getCurrentBlock() {
    // Simplified: calculate from start of season
    const startOfSeason = new Date();
    startOfSeason.setMonth(0, 1); // January 1st
    const daysSinceStart = Math.floor(
      (Date.now() - startOfSeason.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.floor(daysSinceStart / 28) + 1; // Block number
  }

  /**
   * Get current phase
   * @returns {Object} Phase configuration
   */
  getCurrentPhase() {
    // Determine current season phase
    const month = new Date().getMonth();

    if (month >= 0 && month <= 2) {
      return { name: 'Pre-Season', focus: 'strength', intensity: 'high' };
    }
    if (month >= 3 && month <= 8) {
      return { name: 'In-Season', focus: 'maintenance', intensity: 'moderate' };
    }
    if (month >= 9 && month <= 10) {
      return { name: 'Post-Season', focus: 'recovery', intensity: 'low' };
    }
    return { name: 'Off-Season', focus: 'strength', intensity: 'high' };
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    return window.AuthManager?.getCurrentUsername() || 'anonymous';
  }

  /**
   * Calculate training load for week
   * @param {number} week - Week number (1-4)
   * @param {Object} phase - Phase configuration
   * @returns {string} Training load
   */
  calculateTrainingLoad(week, phase) {
    if (week === 4) {
      return 'low';
    } // Deload week

    const intensityMap = {
      low: ['low', 'low', 'moderate'],
      moderate: ['moderate', 'moderate', 'moderate-high'],
      high: ['moderate-high', 'high', 'high'],
    };

    return intensityMap[phase.intensity]?.[week - 1] || 'moderate';
  }

  /**
   * Calculate block start date
   * @param {number} blockNumber - Block number
   * @returns {Date} Start date
   */
  calculateBlockStartDate(blockNumber) {
    const now = new Date();
    const weeksOffset = (blockNumber - 1) * 4;
    now.setDate(now.getDate() + weeksOffset * 7);
    return now;
  }

  /**
   * Calculate block end date
   * @param {number} blockNumber - Block number
   * @returns {Date} End date
   */
  calculateBlockEndDate(blockNumber) {
    const startDate = this.calculateBlockStartDate(blockNumber);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 28); // 4 weeks
    return endDate;
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
              activities: ['swimming', 'cycling', 'light_jogging', 'yoga'],
            },
            {
              name: 'Base Building',
              duration: '4-6 weeks',
              focus: 'aerobic_base_strength',
              intensity: 'moderate',
              volume: 'moderate_high',
              activities: ['endurance_training', 'strength_training', 'mobility_work'],
            },
            {
              name: 'Strength Development',
              duration: '4-6 weeks',
              focus: 'maximal_strength_power',
              intensity: 'high',
              volume: 'moderate',
              activities: ['heavy_lifting', 'plyometrics', 'power_training'],
            },
            {
              name: 'Sport Preparation',
              duration: '2-3 weeks',
              focus: 'sport_specific_preparation',
              intensity: 'moderate_high',
              volume: 'moderate',
              activities: ['sport_specific_drills', 'tactical_training', 'match_preparation'],
            },
          ],
          weeklyStructure: {
            monday: { type: 'strength', duration: 60, intensity: 'moderate' },
            tuesday: { type: 'conditioning', duration: 45, intensity: 'moderate' },
            wednesday: { type: 'strength', duration: 60, intensity: 'moderate' },
            thursday: { type: 'conditioning', duration: 45, intensity: 'moderate' },
            friday: { type: 'strength', duration: 60, intensity: 'moderate' },
            saturday: { type: 'active_recovery', duration: 30, intensity: 'low' },
            sunday: { type: 'rest', duration: 0, intensity: 'none' },
          },
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
              activities: ['fitness_training', 'tactical_drills', 'team_building'],
            },
            {
              name: 'Match Preparation',
              duration: '2-3 weeks',
              focus: 'match_fitness_tactics',
              intensity: 'high',
              volume: 'moderate_high',
              activities: ['match_simulation', 'tactical_preparation', 'set_pieces'],
            },
            {
              name: 'Competition Ready',
              duration: '1-2 weeks',
              focus: 'peak_performance',
              intensity: 'moderate',
              volume: 'moderate',
              activities: ['taper_training', 'match_preparation', 'mental_preparation'],
            },
          ],
          weeklyStructure: {
            monday: { type: 'tactical', duration: 90, intensity: 'moderate' },
            tuesday: { type: 'fitness', duration: 60, intensity: 'high' },
            wednesday: { type: 'tactical', duration: 90, intensity: 'moderate' },
            thursday: { type: 'fitness', duration: 60, intensity: 'high' },
            friday: { type: 'tactical', duration: 75, intensity: 'moderate' },
            saturday: { type: 'match_preparation', duration: 45, intensity: 'moderate' },
            sunday: { type: 'rest', duration: 0, intensity: 'none' },
          },
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
              activities: ['maintenance_training', 'tactical_refinement', 'injury_prevention'],
            },
            {
              name: 'Mid Season',
              duration: '12-16 weeks',
              focus: 'performance_optimization',
              intensity: 'variable',
              volume: 'variable',
              activities: ['periodized_training', 'tactical_adaptation', 'recovery_management'],
            },
            {
              name: 'Late Season',
              duration: '6-12 weeks',
              focus: 'peak_performance',
              intensity: 'moderate',
              volume: 'moderate',
              activities: ['taper_training', 'match_preparation', 'mental_preparation'],
            },
          ],
          weeklyStructure: {
            monday: { type: 'recovery', duration: 30, intensity: 'low' },
            tuesday: { type: 'tactical', duration: 75, intensity: 'moderate' },
            wednesday: { type: 'fitness', duration: 45, intensity: 'moderate' },
            thursday: { type: 'tactical', duration: 75, intensity: 'moderate' },
            friday: { type: 'match_preparation', duration: 30, intensity: 'low' },
            saturday: { type: 'match', duration: 90, intensity: 'high' },
            sunday: { type: 'recovery', duration: 30, intensity: 'low' },
          },
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
              activities: ['light_activity', 'rehabilitation', 'mental_recovery'],
            },
            {
              name: 'Transition',
              duration: '1-2 weeks',
              focus: 'transition_preparation',
              intensity: 'very_low',
              volume: 'very_low',
              activities: ['planning', 'assessment', 'goal_setting'],
            },
          ],
          weeklyStructure: {
            monday: { type: 'active_recovery', duration: 20, intensity: 'very_low' },
            tuesday: { type: 'rest', duration: 0, intensity: 'none' },
            wednesday: { type: 'active_recovery', duration: 20, intensity: 'very_low' },
            thursday: { type: 'rest', duration: 0, intensity: 'none' },
            friday: { type: 'active_recovery', duration: 20, intensity: 'very_low' },
            saturday: { type: 'rest', duration: 0, intensity: 'none' },
            sunday: { type: 'rest', duration: 0, intensity: 'none' },
          },
        },
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
              volume: 'low',
            },
            {
              name: 'Skill Development',
              duration: '6-8 weeks',
              focus: 'individual_skills',
              intensity: 'moderate',
              volume: 'moderate',
            },
            {
              name: 'Strength Power',
              duration: '6-8 weeks',
              focus: 'strength_power_development',
              intensity: 'high',
              volume: 'moderate',
            },
            {
              name: 'Pre-Season Prep',
              duration: '2-3 weeks',
              focus: 'team_preparation',
              intensity: 'moderate_high',
              volume: 'moderate',
            },
          ],
        },
        // Additional basketball seasons would be added here
      },
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
      userProfile,
      customizations,
      createdAt: new Date().toISOString(),
      phases: this.adaptPhases(template.phases, userProfile, customizations),
      weeklyStructure: this.adaptWeeklyStructure(template.weeklyStructure, userProfile),
      progressTracking: this.initializeProgressTracking(template),
      adaptations: this.generateAdaptations(sportId, seasonId, userProfile),
    };

    // Store program
    this.currentPrograms.set(program.id, program);

    this.logger.audit('SEASONAL_PROGRAM_CREATED', {
      programId: program.id,
      sport: sportId,
      season: seasonId,
      userId: userProfile.userId,
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
        const trainingDays = Object.keys(adaptedStructure).filter(
          day => adaptedStructure[day].type !== 'rest' && adaptedStructure[day].type !== 'recovery'
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
        'performance_indicators',
      ],
      checkpoints: template.phases.map((phase, index) => ({
        phase: phase.name,
        week: this.calculatePhaseWeek(template.phases, index),
        assessments: ['fitness_test', 'movement_screen', 'injury_check'],
      })),
      goals: this.generateSeasonalGoals(template),
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
      monitoring: this.generateMonitoringProtocols(sportId, seasonId),
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
          maxLoadIncrease: '10%',
        },
        'pre-season': {
          progression: 'step',
          deloadFrequency: 'every_3_weeks',
          maxLoadIncrease: '15%',
        },
        'in-season': {
          progression: 'undulating',
          deloadFrequency: 'every_2_weeks',
          maxLoadIncrease: '5%',
        },
      },
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
        consistency: 'important',
      },
      nutrition: {
        hydration: 'adequate',
        protein: 'sufficient',
        timing: 'optimal',
      },
      activeRecovery: {
        activities: ['light_jogging', 'swimming', 'yoga', 'stretching'],
        frequency: 'daily',
        duration: '20-30 minutes',
      },
      passiveRecovery: {
        activities: ['massage', 'ice_baths', 'compression', 'meditation'],
        frequency: 'as_needed',
        duration: 'variable',
      },
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
        components: ['dynamic_stretching', 'movement_preparation', 'activation'],
      },
      coolDown: {
        duration: '10-15 minutes',
        components: ['static_stretching', 'foam_rolling', 'breathing'],
      },
      movementScreening: {
        frequency: 'monthly',
        tests: ['fms', 'movement_quality', 'asymmetries'],
      },
      strengthTraining: {
        focus: 'injury_prevention',
        exercises: ['single_leg', 'core_stability', 'posterior_chain'],
      },
    };

    // Add sport-specific prevention
    if (commonInjuries.includes('acl_tears')) {
      prevention.neuromuscularTraining = {
        exercises: ['landing_mechanics', 'cutting_patterns', 'balance_training'],
        frequency: '3x_weekly',
      };
    }

    // Add position-specific prevention
    if (userProfile.position) {
      const position = this.sportDefinitions.getPosition(sportId, userProfile.position);
      if (position?.injuryRisks) {
        position.injuryRisks.forEach(risk => {
          prevention[risk] = {
            exercises: [`prevention_for_${risk}`],
            frequency: 'weekly',
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
        hydration: 'adequate',
      },
      'pre-season': {
        focus: 'performance_preparation',
        calories: 'maintenance_slight_surplus',
        protein: '1.8-2.4g/kg',
        carbs: 'moderate_high',
        hydration: 'optimal',
      },
      'in-season': {
        focus: 'performance_recovery',
        calories: 'maintenance',
        protein: '1.6-2.2g/kg',
        carbs: 'high',
        hydration: 'optimal',
      },
      'post-season': {
        focus: 'recovery_regeneration',
        calories: 'maintenance',
        protein: '1.4-2.0g/kg',
        carbs: 'moderate',
        hydration: 'adequate',
      },
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
    const protocols = {
      daily: ['sleep_quality', 'mood', 'fatigue', 'soreness'],
      weekly: ['training_load', 'performance_metrics', 'body_weight'],
      monthly: ['fitness_tests', 'movement_screen', 'injury_check'],
      seasonal: ['body_composition', 'performance_assessment', 'goal_review'],
    };

    if (sportId === 'soccer' || sportId === 'football') {
      protocols.weekly.push('gps_metrics', 'technical_session_rating');
    }

    if (seasonId === 'off-season') {
      protocols.daily.push('mobility_score');
    } else if (seasonId === 'in-season') {
      protocols.daily.push('match_recovery_status');
    }

    return protocols;
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
        'Maintain injury-free training',
        `Improve ${phase.focus} capabilities`,
      ],
    }));
  }

  // Helper methods
  generateProgramId(sportId, seasonId) {
    return `${sportId}_${seasonId}_${Date.now()}`;
  }

  reduceIntensity(intensity) {
    const intensityMap = {
      very_high: 'high',
      high: 'moderate_high',
      moderate_high: 'moderate',
      moderate: 'low_moderate',
      low_moderate: 'low',
      low: 'very_low',
    };
    return intensityMap[intensity] || intensity;
  }

  increaseIntensity(intensity) {
    const intensityMap = {
      very_low: 'low',
      low: 'low_moderate',
      low_moderate: 'moderate',
      moderate: 'moderate_high',
      moderate_high: 'high',
      high: 'very_high',
    };
    return intensityMap[intensity] || intensity;
  }

  reduceVolume(volume) {
    const volumeMap = {
      very_high: 'high',
      high: 'moderate_high',
      moderate_high: 'moderate',
      moderate: 'low_moderate',
      low_moderate: 'low',
      low: 'very_low',
    };
    return volumeMap[volume] || volume;
  }

  increaseVolume(volume) {
    const volumeMap = {
      very_low: 'low',
      low: 'low_moderate',
      low_moderate: 'moderate',
      moderate: 'moderate_high',
      moderate_high: 'high',
      high: 'very_high',
    };
    return volumeMap[volume] || volume;
  }

  calculatePhaseWeek(phases, phaseIndex) {
    let week = 1;
    for (let i = 0; i < phaseIndex; i++) {
      const { duration } = phases[i];
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
        lastUpdated: new Date().toISOString(),
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
