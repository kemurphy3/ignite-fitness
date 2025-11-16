/**
 * LoadGuardrails - Training load safety monitoring and automatic adjustments
 * Implements ramp-rate checks, HIIT reduction, and recovery protocols
 */
class LoadGuardrails {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.loadCalculator = window.LoadCalculator;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;

    this.rampRateThresholds = this.initializeRampRateThresholds();
    this.recoveryProtocols = this.initializeRecoveryProtocols();
    this.adjustmentHistory = new Map();

    this.initializeEventListeners();
  }

  /**
   * Initialize ramp rate thresholds by experience level
   * @returns {Object} Ramp rate thresholds
   */
  initializeRampRateThresholds() {
    return {
      beginner: {
        maxWeeklyIncrease: 0.08, // 8% max increase
        hiitReduction: 0.25, // 25% HIIT reduction
        consecutiveDaysLimit: 3, // Max 3 consecutive training days
        minRestDays: 2, // Min 2 rest days per week
      },
      intermediate: {
        maxWeeklyIncrease: 0.1, // 10% max increase
        hiitReduction: 0.2, // 20% HIIT reduction
        consecutiveDaysLimit: 4, // Max 4 consecutive training days
        minRestDays: 1, // Min 1 rest day per week
      },
      advanced: {
        maxWeeklyIncrease: 0.12, // 12% max increase
        hiitReduction: 0.15, // 15% HIIT reduction
        consecutiveDaysLimit: 5, // Max 5 consecutive training days
        minRestDays: 1, // Min 1 rest day per week
      },
      elite: {
        maxWeeklyIncrease: 0.15, // 15% max increase
        hiitReduction: 0.1, // 10% HIIT reduction
        consecutiveDaysLimit: 6, // Max 6 consecutive training days
        minRestDays: 1, // Min 1 rest day per week
      },
    };
  }

  /**
   * Initialize recovery protocols for different scenarios
   * @returns {Object} Recovery protocols
   */
  initializeRecoveryProtocols() {
    return {
      rampExceeded: {
        action: 'reduce_hiit',
        duration: 7, // days
        message:
          'Training load increased too quickly. Next high-intensity session will be reduced by {percentage}%.',
      },
      missedDays: {
        action: 'gradual_return',
        rampDown: 0.15, // 15% reduction per missed day
        maxReduction: 0.4, // Maximum 40% reduction
        message: 'Missed training detected. Load reduced by {percentage}% for safe return.',
      },
      painFlag: {
        action: 'immediate_downshift',
        reduction: 0.3, // 30% immediate reduction
        duration: 14, // days
        message: 'Pain/discomfort reported. Training intensity reduced for {duration} days.',
      },
      consecutiveDays: {
        action: 'mandatory_rest',
        message: 'Too many consecutive training days. Rest day required.',
      },
    };
  }

  /**
   * Initialize event listeners for automatic monitoring
   */
  initializeEventListeners() {
    if (!this.eventBus) {
      this.logger.warn('EventBus not available, guardrails will not auto-monitor');
      return;
    }

    // Check if TOPICS exists
    if (!this.eventBus.TOPICS) {
      this.logger.warn('EventBus.TOPICS not available, guardrails will not auto-monitor');
      return;
    }

    // Listen for session completion
    this.eventBus.on(this.eventBus.TOPICS.SESSION_COMPLETED, data => {
      if (data && data.userId) {
        this.checkWeeklyRampRate(data.userId).catch(err => {
          this.logger.error('Auto ramp rate check failed', err);
        });
      }
    });

    // Listen for pain reports (if topic exists, otherwise use generic event)
    this.eventBus.on('PAIN_REPORTED', data => {
      if (data && data.userId) {
        this.handlePainFlag(data.userId, data.painLevel, data.location).catch(err => {
          this.logger.error('Pain flag handling failed', err);
        });
      }
    });

    // Listen for planned sessions
    this.eventBus.on('SESSION_PLANNED', data => {
      if (data && data.userId && data.session) {
        this.validatePlannedSession(data.userId, data.session).catch(err => {
          this.logger.error('Session validation failed', err);
        });
      }
    });
  }

  /**
   * Check weekly ramp rate and apply guardrails
   * @param {string} userId - User ID
   * @returns {Object} Guardrail analysis and actions
   */
  async checkWeeklyRampRate(userId) {
    try {
      const user = this.authManager?.getCurrentUser?.();
      if (!user) {
        // Fallback: use userId directly
        const experienceLevel = (await this.getUserExperienceLevel(userId)) || 'intermediate';
        const thresholds = this.rampRateThresholds[experienceLevel];

        const loadHistory = await this.getWeeklyLoadHistory(userId, 3);

        if (loadHistory.length < 2) {
          return {
            status: 'insufficient_data',
            message: 'Not enough training history for ramp rate analysis',
          };
        }

        const currentWeek = loadHistory[0];
        const previousWeek = loadHistory[1];

        const rampRate = (currentWeek.totalLoad - previousWeek.totalLoad) / previousWeek.totalLoad;
        const rampAnalysis = this.analyzeRampRate(rampRate, thresholds, loadHistory);

        if (rampAnalysis.exceedsThreshold) {
          const actions = await this.applyRampRateGuardrails(userId, rampAnalysis, thresholds);

          this.logger.audit('GUARDRAIL_TRIGGERED', {
            userId,
            trigger: 'ramp_rate_exceeded',
            rampRate,
            threshold: thresholds.maxWeeklyIncrease,
            actions,
          });

          return {
            status: 'guardrail_applied',
            rampRate,
            threshold: thresholds.maxWeeklyIncrease,
            actions,
            message: rampAnalysis.message,
          };
        }

        return {
          status: 'within_limits',
          rampRate,
          threshold: thresholds.maxWeeklyIncrease,
          message: 'Training load progression is within safe limits',
        };
      }

      // Use user object if available
      const experienceLevel = user.personalData?.experience || user.experience || 'intermediate';
      const thresholds = this.rampRateThresholds[experienceLevel];

      // Get last 3 weeks of load data
      const loadHistory = await this.getWeeklyLoadHistory(userId, 3);

      if (loadHistory.length < 2) {
        return {
          status: 'insufficient_data',
          message: 'Not enough training history for ramp rate analysis',
        };
      }

      const currentWeek = loadHistory[0];
      const previousWeek = loadHistory[1];

      // Calculate ramp rate
      const rampRate = (currentWeek.totalLoad - previousWeek.totalLoad) / previousWeek.totalLoad;
      const rampAnalysis = this.analyzeRampRate(rampRate, thresholds, loadHistory);

      // Apply guardrails if needed
      if (rampAnalysis.exceedsThreshold) {
        const actions = await this.applyRampRateGuardrails(userId, rampAnalysis, thresholds);

        this.logger.audit('GUARDRAIL_TRIGGERED', {
          userId,
          trigger: 'ramp_rate_exceeded',
          rampRate,
          threshold: thresholds.maxWeeklyIncrease,
          actions,
        });

        return {
          status: 'guardrail_applied',
          rampRate,
          threshold: thresholds.maxWeeklyIncrease,
          actions,
          message: rampAnalysis.message,
        };
      }

      return {
        status: 'within_limits',
        rampRate,
        threshold: thresholds.maxWeeklyIncrease,
        message: 'Training load progression is within safe limits',
      };
    } catch (error) {
      this.logger.error('Ramp rate check failed', error);
      return {
        status: 'error',
        message: 'Unable to check training load progression',
      };
    }
  }

  /**
   * Get user experience level
   * @param {string} userId - User ID
   * @returns {Promise<string>} Experience level
   */
  async getUserExperienceLevel(userId) {
    try {
      const user = await this.storageManager?.getUser?.(userId);
      return user?.personalData?.experience || user?.experience || 'intermediate';
    } catch (error) {
      this.logger.warn('Failed to get user experience level', error);
      return 'intermediate';
    }
  }

  /**
   * Analyze ramp rate against thresholds
   * @param {number} rampRate - Calculated ramp rate
   * @param {Object} thresholds - Experience-based thresholds
   * @param {Array} loadHistory - Historical load data
   * @returns {Object} Ramp rate analysis
   */
  analyzeRampRate(rampRate, thresholds, loadHistory) {
    const exceedsThreshold = rampRate > thresholds.maxWeeklyIncrease;

    let severity = 'low';
    if (rampRate > thresholds.maxWeeklyIncrease * 1.5) {
      severity = 'high';
    } else if (rampRate > thresholds.maxWeeklyIncrease * 1.2) {
      severity = 'moderate';
    }

    // Check for consecutive weeks of high increases
    const consecutiveIncreases = this.checkConsecutiveIncreases(
      loadHistory,
      thresholds.maxWeeklyIncrease
    );

    return {
      rampRate,
      exceedsThreshold,
      severity,
      consecutiveIncreases,
      recommendedReduction: this.calculateRecommendedReduction(rampRate, thresholds),
      message: this.generateRampRateMessage(rampRate, thresholds, severity),
    };
  }

  /**
   * Check for consecutive weeks of high increases
   * @param {Array} loadHistory - Load history
   * @param {number} threshold - Threshold to check
   * @returns {number} Number of consecutive increases
   */
  checkConsecutiveIncreases(loadHistory, threshold) {
    let consecutive = 0;
    for (let i = 0; i < loadHistory.length - 1; i++) {
      const current = loadHistory[i];
      const previous = loadHistory[i + 1];
      if (previous.totalLoad > 0) {
        const rate = (current.totalLoad - previous.totalLoad) / previous.totalLoad;
        if (rate > threshold) {
          consecutive++;
        } else {
          break;
        }
      }
    }
    return consecutive;
  }

  /**
   * Calculate recommended reduction percentage
   * @param {number} rampRate - Ramp rate
   * @param {Object} thresholds - Thresholds
   * @returns {number} Recommended reduction (0-1)
   */
  calculateRecommendedReduction(rampRate, thresholds) {
    const excessRate = rampRate - thresholds.maxWeeklyIncrease;
    const baseReduction = thresholds.hiitReduction;
    const scaledReduction = baseReduction + excessRate * 0.5;
    return Math.min(scaledReduction, 0.5); // Cap at 50%
  }

  /**
   * Generate ramp rate message
   * @param {number} rampRate - Ramp rate
   * @param {Object} thresholds - Thresholds
   * @param {string} severity - Severity level
   * @returns {string} Message
   */
  generateRampRateMessage(rampRate, thresholds, severity) {
    const percentage = Math.round(rampRate * 100);
    const threshold = Math.round(thresholds.maxWeeklyIncrease * 100);
    const reduction = Math.round(thresholds.hiitReduction * 100);

    if (severity === 'high') {
      return `High load increase detected (${percentage}% vs ${threshold}% max). Next high-intensity session will be reduced by ${reduction}% or more.`;
    } else if (severity === 'moderate') {
      return `Moderate load increase detected (${percentage}% vs ${threshold}% max). Next high-intensity session will be reduced by ${reduction}%.`;
    } else {
      return `Load increase detected (${percentage}% vs ${threshold}% max). Next high-intensity session will be reduced by ${reduction}%.`;
    }
  }

  /**
   * Apply ramp rate guardrails and create action plan
   * @param {string} userId - User ID
   * @param {Object} rampAnalysis - Ramp rate analysis
   * @param {Object} thresholds - Experience thresholds
   * @returns {Array} Applied actions
   */
  async applyRampRateGuardrails(userId, rampAnalysis, thresholds) {
    const actions = [];

    // Primary action: Reduce next HIIT session
    const hiitReduction = this.calculateHIITReduction(rampAnalysis, thresholds);
    actions.push({
      type: 'reduce_hiit',
      reduction: hiitReduction,
      duration: 7,
      message: `Next high-intensity session will be reduced by ${Math.round(hiitReduction * 100)}%`,
    });

    // Secondary actions based on severity
    if (rampAnalysis.severity === 'high') {
      actions.push({
        type: 'extend_recovery',
        duration: 2,
        message: 'Additional recovery day recommended this week',
      });
    }

    if (rampAnalysis.consecutiveIncreases >= 2) {
      actions.push({
        type: 'deload_week',
        reduction: 0.25,
        message: 'Deload week recommended after consecutive load increases',
      });
    }

    // Store adjustment in history
    this.recordAdjustment(userId, {
      trigger: 'ramp_rate',
      analysis: rampAnalysis,
      actions,
      timestamp: new Date().toISOString(),
    });

    // Apply immediate session modifications
    await this.applySessionModifications(userId, actions);

    return actions;
  }

  /**
   * Calculate HIIT reduction percentage
   * @param {Object} rampAnalysis - Ramp analysis
   * @param {Object} thresholds - Thresholds
   * @returns {number} Reduction percentage (0-1)
   */
  calculateHIITReduction(rampAnalysis, thresholds) {
    const baseReduction = thresholds.hiitReduction;
    const excessRate = rampAnalysis.rampRate - thresholds.maxWeeklyIncrease;

    // Scale reduction based on how much threshold was exceeded
    const scaledReduction = baseReduction + excessRate * 0.5;

    // Cap reduction at 50%
    return Math.min(scaledReduction, 0.5);
  }

  /**
   * Handle missed training days with automatic downshift
   * @param {string} userId - User ID
   * @param {number} missedDays - Number of consecutive missed days
   * @returns {Object} Downshift actions
   */
  async handleMissedDays(userId, missedDays) {
    if (missedDays < 3) {
      return { status: 'no_action', message: 'Short break, no adjustment needed' };
    }

    const protocol = this.recoveryProtocols.missedDays;
    const reductionPerDay = protocol.rampDown;
    const totalReduction = Math.min(missedDays * reductionPerDay, protocol.maxReduction);

    const actions = [
      {
        type: 'gradual_return',
        reduction: totalReduction,
        duration: Math.min(missedDays, 7),
        message: protocol.message.replace('{percentage}', Math.round(totalReduction * 100)),
      },
    ];

    await this.applySessionModifications(userId, actions);

    this.logger.audit('MISSED_DAYS_ADJUSTMENT', {
      userId,
      missedDays,
      totalReduction,
      actions,
    });

    return {
      status: 'downshift_applied',
      actions,
      message: `Training load reduced by ${Math.round(totalReduction * 100)}% for safe return`,
    };
  }

  /**
   * Handle pain flag with immediate downshift
   * @param {string} userId - User ID
   * @param {number} painLevel - Pain level (1-10)
   * @param {string} location - Pain location
   * @returns {Object} Pain response actions
   */
  async handlePainFlag(userId, painLevel, location) {
    const protocol = this.recoveryProtocols.painFlag;

    // Scale reduction based on pain level (5 is baseline)
    const baseReduction = protocol.reduction;
    const scaledReduction = Math.min(baseReduction + (painLevel - 5) * 0.05, 0.5);

    const actions = [
      {
        type: 'immediate_downshift',
        reduction: scaledReduction,
        duration: protocol.duration,
        painLocation: location,
        message: protocol.message.replace('{duration}', protocol.duration),
      },
    ];

    await this.applySessionModifications(userId, actions);

    this.logger.audit('PAIN_FLAG_RESPONSE', {
      userId,
      painLevel,
      location,
      reduction: scaledReduction,
      actions,
    });

    return {
      status: 'pain_response_applied',
      actions,
      message: `Training modified due to ${location} discomfort`,
    };
  }

  /**
   * Validate planned session against guardrails
   * @param {string} userId - User ID
   * @param {Object} session - Planned session
   * @returns {Object} Validation result
   */
  async validatePlannedSession(userId, session) {
    try {
      const experienceLevel = await this.getUserExperienceLevel(userId);
      const thresholds = this.rampRateThresholds[experienceLevel];

      // Check consecutive training days
      const recentSessions = await this.getRecentSessions(userId, 7);
      const consecutiveDays = this.countConsecutiveTrainingDays(recentSessions);

      if (consecutiveDays >= thresholds.consecutiveDaysLimit) {
        return {
          valid: false,
          reason: 'consecutive_days_exceeded',
          message: this.recoveryProtocols.consecutiveDays.message,
          recommendation: 'Schedule a rest day instead',
        };
      }

      // Check if session violates current adjustments
      const activeAdjustments = await this.getActiveAdjustments(userId);
      for (const adjustment of activeAdjustments) {
        if (this.sessionViolatesAdjustment(session, adjustment)) {
          return {
            valid: false,
            reason: 'violates_adjustment',
            adjustment,
            message: `Session conflicts with active ${adjustment.type} adjustment`,
          };
        }
      }

      return {
        valid: true,
        message: 'Session passes guardrail validation',
      };
    } catch (error) {
      this.logger.error('Session validation failed', error);
      return {
        valid: true, // Fail open for safety
        message: 'Validation error - session allowed with caution',
      };
    }
  }

  /**
   * Apply session modifications based on guardrail actions
   * @param {string} userId - User ID
   * @param {Array} actions - Guardrail actions
   */
  async applySessionModifications(userId, actions) {
    for (const action of actions) {
      switch (action.type) {
        case 'reduce_hiit':
          await this.modifyUpcomingHIIT(userId, action.reduction);
          break;
        case 'gradual_return':
          await this.setGradualReturnProtocol(userId, action.reduction, action.duration);
          break;
        case 'immediate_downshift':
          await this.applyImmediateDownshift(userId, action.reduction, action.duration);
          break;
        case 'extend_recovery':
          await this.scheduleAdditionalRecovery(userId, action.duration);
          break;
      }
    }
  }

  /**
   * Modify upcoming HIIT sessions
   * @param {string} userId - User ID
   * @param {number} reduction - Reduction percentage
   */
  async modifyUpcomingHIIT(userId, reduction) {
    const upcomingSessions = await this.getUpcomingSessions(userId, 7);
    const hiitSessions = upcomingSessions.filter(s => this.isHighIntensitySession(s));

    for (const session of hiitSessions.slice(0, 2)) {
      // Store original intensity before modification
      const originalIntensity = session.intensity?.primary_zone || session.intensity || session.structure?.[0]?.intensity;

      // Modify next 2 HIIT sessions
      session.modifications = session.modifications || [];
      session.modifications.push({
        type: 'intensity_reduction',
        amount: reduction,
        reason: 'guardrail_ramp_rate',
        appliedAt: new Date().toISOString(),
      });

      // Adjust session parameters
      if (session.intervals) {
        session.intervals = session.intervals.map(interval => ({
          ...interval,
          targetIntensity: Math.max(interval.targetIntensity * (1 - reduction), 0.6),
        }));
      }

      // Adjust structure if available
      if (session.structure && Array.isArray(session.structure)) {
        session.structure = session.structure.map(block => {
          if (block.block_type === 'main' && block.intensity) {
            // Reduce intensity zone
            const currentZone = block.intensity;
            const reducedZone = this.reduceIntensityZone(currentZone, reduction);
            return {
              ...block,
              intensity: reducedZone,
            };
          }
          return block;
        });
      }

      // Get new intensity after modification
      const newIntensity = session.intensity?.primary_zone || session.intensity || session.structure?.[0]?.intensity || originalIntensity;

      // FIX: Add the expected method call with object format as specified in TEST FIX 3
      // Pass the modified session to ensure all changes are preserved
      await this.saveSessionModification({
        sessionId: session.id,
        userId: userId,
        originalIntensity: originalIntensity,
        newIntensity: newIntensity,
        reason: 'HIIT_REDUCTION',
        reductionFactor: reduction,
      }, session);
    }

    // Emit event for UI updates
    if (this.eventBus) {
      this.eventBus.emit('GUARDRAIL_APPLIED', {
        userId,
        type: 'hiit_reduction',
        reduction,
        sessionsAffected: hiitSessions.slice(0, 2).length,
      });
    }
  }

  /**
   * Reduce intensity zone based on reduction percentage
   * @param {string} currentZone - Current zone (e.g., 'Z4', 'Z5')
   * @param {number} reduction - Reduction percentage (0-1)
   * @returns {string} Reduced zone
   */
  reduceIntensityZone(currentZone, reduction) {
    const zoneMap = { Z1: 1, Z2: 2, Z3: 3, Z4: 4, Z5: 5 };
    const currentLevel = zoneMap[currentZone] || 3;

    // Reduce by 1-2 zones based on reduction amount
    const zoneReduction = reduction >= 0.3 ? 2 : 1;
    const newLevel = Math.max(1, currentLevel - zoneReduction);

    // Map back to zone
    const reverseMap = { 1: 'Z1', 2: 'Z2', 3: 'Z3', 4: 'Z4', 5: 'Z5' };
    return reverseMap[newLevel] || 'Z3';
  }

  /**
   * Set gradual return protocol
   * @param {string} userId - User ID
   * @param {number} reduction - Reduction percentage
   * @param {number} duration - Duration in days
   */
  async setGradualReturnProtocol(userId, reduction, duration) {
    const adjustment = {
      type: 'gradual_return',
      reduction,
      duration,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
    };

    await this.saveActiveAdjustment(userId, adjustment);
  }

  /**
   * Apply immediate downshift
   * @param {string} userId - User ID
   * @param {number} reduction - Reduction percentage
   * @param {number} duration - Duration in days
   */
  async applyImmediateDownshift(userId, reduction, duration) {
    const adjustment = {
      type: 'immediate_downshift',
      reduction,
      duration,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
    };

    await this.saveActiveAdjustment(userId, adjustment);
  }

  /**
   * Schedule additional recovery days
   * @param {string} userId - User ID
   * @param {number} duration - Number of recovery days
   */
  async scheduleAdditionalRecovery(userId, duration) {
    const adjustment = {
      type: 'extend_recovery',
      duration,
      startDate: new Date().toISOString(),
    };

    await this.saveActiveAdjustment(userId, adjustment);
  }

  /**
   * Get weekly load history for user
   * @param {string} userId - User ID
   * @param {number} weeks - Number of weeks to retrieve
   * @returns {Array} Weekly load data
   */
  async getWeeklyLoadHistory(userId, weeks) {
    try {
      const sessions = await this.getUserSessions(userId);
      const weeklyData = [];

      for (let i = 0; i < weeks; i++) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - i * 7 - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const weekSessions = sessions.filter(s => {
          const sessionDate = new Date(s.date || s.start_at || s.created_at);
          return sessionDate >= weekStart && sessionDate <= weekEnd;
        });

        const weekLoad = this.loadCalculator?.calculateWeeklyLoad?.(weekSessions) || {
          total: 0,
          volumeLoad: 0,
          intensityLoad: 0,
        };

        weeklyData.push({
          week: i,
          startDate: weekStart.toISOString(),
          endDate: weekEnd.toISOString(),
          totalLoad: weekLoad.total || 0,
          sessions: weekSessions.length,
          hiitSessions: weekSessions.filter(s => this.isHighIntensitySession(s)).length,
        });
      }

      return weeklyData.reverse(); // Oldest first
    } catch (error) {
      this.logger.error('Failed to get weekly load history', error);
      return [];
    }
  }

  /**
   * Get user sessions
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User sessions
   */
  async getUserSessions(userId) {
    try {
      if (this.storageManager?.getUserSessions) {
        return await this.storageManager.getUserSessions(userId);
      }

      // Fallback: try to get from localStorage
      const stored = localStorage.getItem(`ignite_sessions_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get user sessions', error);
      return [];
    }
  }

  /**
   * Get recent sessions
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} Recent sessions
   */
  async getRecentSessions(userId, days) {
    const sessions = await this.getUserSessions(userId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return sessions.filter(s => {
      const sessionDate = new Date(s.date || s.start_at || s.created_at);
      return sessionDate >= cutoffDate;
    });
  }

  /**
   * Get upcoming sessions
   * @param {string} userId - User ID
   * @param {number} days - Number of days ahead
   * @returns {Promise<Array>} Upcoming sessions
   */
  async getUpcomingSessions(userId, days) {
    try {
      // This would typically come from a workout plan or scheduled sessions
      // For now, return empty array or use a placeholder
      const stored = localStorage.getItem(`ignite_upcoming_sessions_${userId}`);
      if (stored) {
        const sessions = JSON.parse(stored);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);

        return sessions.filter(s => {
          const sessionDate = new Date(s.date || s.start_at || s.planned_date);
          return sessionDate <= cutoffDate && sessionDate >= new Date();
        });
      }
      return [];
    } catch (error) {
      this.logger.error('Failed to get upcoming sessions', error);
      return [];
    }
  }

  /**
   * Count consecutive training days
   * @param {Array} sessions - Recent sessions
   * @returns {number} Consecutive days
   */
  countConsecutiveTrainingDays(sessions) {
    if (sessions.length === 0) {
      return 0;
    }

    const sortedSessions = sessions
      .map(s => new Date(s.date || s.start_at || s.created_at))
      .sort((a, b) => b - a); // Most recent first

    let consecutive = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const sessionDate of sortedSessions) {
      const sessionDay = new Date(sessionDate);
      sessionDay.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((currentDate - sessionDay) / (1000 * 60 * 60 * 24));

      if (daysDiff === consecutive) {
        consecutive++;
        currentDate = new Date(sessionDay);
      } else if (daysDiff > consecutive) {
        break;
      }
    }

    return consecutive;
  }

  /**
   * Check if session violates adjustment
   * @param {Object} session - Session object
   * @param {Object} adjustment - Active adjustment
   * @returns {boolean} Violates adjustment
   */
  sessionViolatesAdjustment(session, adjustment) {
    if (adjustment.type === 'reduce_hiit' && this.isHighIntensitySession(session)) {
      // Check if session has been modified
      const hasModification = session.modifications?.some(
        mod => mod.reason === 'guardrail_ramp_rate'
      );
      return !hasModification;
    }

    if (adjustment.type === 'immediate_downshift' || adjustment.type === 'gradual_return') {
      const sessionDate = new Date(session.date || session.start_at || session.planned_date);
      const adjustmentEnd = new Date(adjustment.endDate);

      if (sessionDate <= adjustmentEnd) {
        // Check if session intensity is reduced enough
        const sessionIntensity = this.getSessionIntensity(session);
        const expectedIntensity = sessionIntensity * (1 - adjustment.reduction);
        const actualIntensity = this.getSessionIntensity(session);

        return actualIntensity > expectedIntensity * 1.1; // Allow 10% tolerance
      }
    }

    return false;
  }

  /**
   * Get session intensity score
   * @param {Object} session - Session object
   * @returns {number} Intensity score (0-1)
   */
  getSessionIntensity(session) {
    if (session.rpe) {
      return session.rpe / 10;
    }
    if (session.intensity?.primary_zone) {
      const zoneMap = { Z1: 0.2, Z2: 0.4, Z3: 0.6, Z4: 0.8, Z5: 1.0 };
      return zoneMap[session.intensity.primary_zone] || 0.6;
    }
    return 0.6; // Default moderate intensity
  }

  /**
   * Get active adjustments for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active adjustments
   */
  async getActiveAdjustments(userId) {
    try {
      const stored = localStorage.getItem(`ignite_active_adjustments_${userId}`);
      if (stored) {
        const adjustments = JSON.parse(stored);
        const now = new Date();

        // Filter out expired adjustments
        return adjustments.filter(adj => {
          if (adj.endDate) {
            return new Date(adj.endDate) > now;
          }
          return true;
        });
      }
      return [];
    } catch (error) {
      this.logger.error('Failed to get active adjustments', error);
      return [];
    }
  }

  /**
   * Save active adjustment
   * @param {string} userId - User ID
   * @param {Object} adjustment - Adjustment object
   */
  async saveActiveAdjustment(userId, adjustment) {
    try {
      const adjustments = await this.getActiveAdjustments(userId);
      adjustments.push(adjustment);
      localStorage.setItem(`ignite_active_adjustments_${userId}`, JSON.stringify(adjustments));
    } catch (error) {
      this.logger.error('Failed to save active adjustment', error);
    }
  }

  /**
   * Save session modification
   * @param {string|Object} userIdOrData - User ID (legacy) or modification data object
   * @param {Object} session - Modified session (legacy format)
   */
  async saveSessionModification(userIdOrData, session) {
    try {
      // Handle new object format from TEST FIX 3
      let userId;
      let sessionToSave;
      
      if (typeof userIdOrData === 'object' && userIdOrData !== null && userIdOrData.userId) {
        // New format: object with sessionId, userId, originalIntensity, etc.
        userId = userIdOrData.userId;
        const upcomingSessions = await this.getUpcomingSessions(userId, 30);
        
        // Use provided session if available (contains all modifications from the loop)
        if (session && (session.id === userIdOrData.sessionId || session.template_id)) {
          sessionToSave = session;
          // Session already has modifications from the loop, just ensure it's saved
          // The modifications array already contains the modification with 'amount' property
        } else {
          // Find the session to update
          sessionToSave = upcomingSessions.find(s => s.id === userIdOrData.sessionId);
          if (sessionToSave) {
            // Update session with modification data
            sessionToSave.modifications = sessionToSave.modifications || [];
            sessionToSave.modifications.push({
              type: 'intensity_reduction',
              originalIntensity: userIdOrData.originalIntensity,
              newIntensity: userIdOrData.newIntensity,
              reason: userIdOrData.reason,
              reductionFactor: userIdOrData.reductionFactor,
              appliedAt: new Date().toISOString(),
            });
          } else {
            // Session not found, create a minimal session record
            sessionToSave = {
              id: userIdOrData.sessionId,
              modifications: [{
                type: 'intensity_reduction',
                originalIntensity: userIdOrData.originalIntensity,
                newIntensity: userIdOrData.newIntensity,
                reason: userIdOrData.reason,
                reductionFactor: userIdOrData.reductionFactor,
                appliedAt: new Date().toISOString(),
              }],
            };
            upcomingSessions.push(sessionToSave);
          }
        }
        
        // Update or add session to upcoming sessions
        const index = upcomingSessions.findIndex(
          s => s.id === sessionToSave.id || s.template_id === sessionToSave.template_id
        );
        if (index >= 0) {
          upcomingSessions[index] = sessionToSave;
        } else if (!upcomingSessions.includes(sessionToSave)) {
          upcomingSessions.push(sessionToSave);
        }
        
        localStorage.setItem(`ignite_upcoming_sessions_${userId}`, JSON.stringify(upcomingSessions));
      } else {
        // Legacy format: (userId, session)
        userId = userIdOrData;
        sessionToSave = session;
        
        const upcomingSessions = await this.getUpcomingSessions(userId, 30);
        const index = upcomingSessions.findIndex(
          s => s.id === sessionToSave.id || s.template_id === sessionToSave.template_id
        );

        if (index >= 0) {
          upcomingSessions[index] = sessionToSave;
        } else {
          upcomingSessions.push(sessionToSave);
        }

        localStorage.setItem(`ignite_upcoming_sessions_${userId}`, JSON.stringify(upcomingSessions));
      }
    } catch (error) {
      this.logger.error('Failed to save session modification', error);
    }
  }

  /**
   * Get current guardrail status for user
   * @param {string} userId - User ID
   * @returns {Object} Current guardrail status
   */
  async getGuardrailStatus(userId) {
    const activeAdjustments = await this.getActiveAdjustments(userId);
    const recentAnalysis = await this.checkWeeklyRampRate(userId);

    return {
      activeAdjustments,
      recentAnalysis,
      isUnderGuardrail: activeAdjustments.length > 0,
      nextReview: this.calculateNextReviewDate(),
    };
  }

  /**
   * Calculate next review date
   * @returns {Date} Next review date
   */
  calculateNextReviewDate() {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7); // Review weekly
    return nextReview.toISOString();
  }

  /**
   * Record adjustment in history
   * @param {string} userId - User ID
   * @param {Object} adjustment - Adjustment details
   */
  recordAdjustment(userId, adjustment) {
    if (!this.adjustmentHistory.has(userId)) {
      this.adjustmentHistory.set(userId, []);
    }

    const userHistory = this.adjustmentHistory.get(userId);
    userHistory.push(adjustment);

    // Keep only last 30 adjustments
    if (userHistory.length > 30) {
      userHistory.splice(0, userHistory.length - 30);
    }
  }

  /**
   * Check if session is high intensity
   * @param {Object} session - Session object
   * @returns {boolean} Is high intensity
   */
  isHighIntensitySession(session) {
    if (session.tags && Array.isArray(session.tags)) {
      if (
        session.tags.includes('HIIT') ||
        session.tags.includes('anaerobic_capacity') ||
        session.tags.includes('VO2')
      ) {
        return true;
      }
    }
    if (session.intensity) {
      const primaryZone = session.intensity.primary_zone || session.intensity;
      if (primaryZone >= 'Z4' || primaryZone === 'Z4' || primaryZone === 'Z5') {
        return true;
      }
    }
    if (session.rpe && session.rpe >= 8) {
      return true;
    }
    if (session.structure && Array.isArray(session.structure)) {
      const mainBlock = session.structure.find(b => b.block_type === 'main');
      if (mainBlock && mainBlock.intensity) {
        const zone = mainBlock.intensity.includes('Z')
          ? mainBlock.intensity.split('-')[0]
          : mainBlock.intensity;
        if (zone === 'Z4' || zone === 'Z5') {
          return true;
        }
      }
    }
    return false;
  }
}

// Create global instance
window.LoadGuardrails = new LoadGuardrails();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadGuardrails;
}
