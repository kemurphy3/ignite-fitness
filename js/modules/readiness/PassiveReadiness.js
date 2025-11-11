/**
 * PassiveReadiness - Infers readiness without user check-in
 * Uses prior session RPE, volume changes, streaks, injury flags, and external activities
 */
class PassiveReadiness {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.eventBus = window.EventBus;

    this.cache = {
      lastReadiness: null,
      lastCalculation: null,
    };
  }

  /**
   * Infer readiness without user check-in
   * @param {Object} context - User context
   * @returns {Promise<Object>} Inferred readiness
   */
  async inferReadiness(context = {}) {
    try {
      const userId = context.userId || this.getUserId();

      // Gather all passive inputs
      const priorSession = await this.getLastSession(userId);
      const volumeChange = await this.calculateVolumeChange(userId);
      const hardDaysStreak = await this.getHardDaysStreak(userId);
      const injuryFlags = await this.getRecentInjuryFlags(userId);
      const externalActivities = await this.getExternalActivities(userId);

      // Calculate inferred readiness
      const inferredReadiness = this.calculateInferredReadiness({
        priorSession,
        volumeChange,
        hardDaysStreak,
        injuryFlags,
        externalActivities,
      });

      // Cache result
      this.cache = {
        lastReadiness: inferredReadiness,
        lastCalculation: new Date(),
      };

      // Log inference
      await this.logInference(userId, inferredReadiness, {
        priorSession,
        volumeChange,
        hardDaysStreak,
        injuryFlags,
        externalActivities,
      });

      // Emit event
      this.eventBus?.emit(this.eventBus?.TOPICS?.READINESS_UPDATED, {
        readiness: inferredReadiness,
        source: 'passive_inference',
      });

      return inferredReadiness;
    } catch (error) {
      this.logger.error('Failed to infer readiness', error);
      return this.getDefaultReadiness();
    }
  }

  /**
   * Get last session data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Last session data
   */
  async getLastSession(userId) {
    try {
      const sessionLogs = await this.storageManager.getSessionLogs(userId);
      if (!sessionLogs || sessionLogs.length === 0) {
        return null;
      }

      const lastSession = sessionLogs[sessionLogs.length - 1];

      return {
        rpe: lastSession.averageRPE || null,
        volume: lastSession.totalVolume || 0,
        duration: lastSession.duration || 0,
        timestamp: lastSession.timestamp,
      };
    } catch (error) {
      this.logger.error('Failed to get last session', error);
      return null;
    }
  }

  /**
   * Calculate volume change percentage
   * @param {string} userId - User ID
   * @returns {Promise<number>} Volume change percentage
   */
  async calculateVolumeChange(userId) {
    try {
      const sessionLogs = await this.storageManager.getSessionLogs(userId);
      if (!sessionLogs || sessionLogs.length < 2) {
        return 0;
      }

      const last = sessionLogs[sessionLogs.length - 1];
      const previous = sessionLogs[sessionLogs.length - 2];

      if (!last.totalVolume || !previous.totalVolume) {
        return 0;
      }

      const change = ((last.totalVolume - previous.totalVolume) / previous.totalVolume) * 100;
      return Math.round(change);
    } catch (error) {
      this.logger.error('Failed to calculate volume change', error);
      return 0;
    }
  }

  /**
   * Get hard days streak
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of consecutive hard days
   */
  async getHardDaysStreak(userId) {
    try {
      const sessionLogs = await this.storageManager.getSessionLogs(userId);
      if (!sessionLogs || sessionLogs.length === 0) {
        return 0;
      }

      let streak = 0;

      // Go backwards from most recent session
      for (let i = sessionLogs.length - 1; i >= 0; i--) {
        const session = sessionLogs[i];
        const rpe = session.averageRPE || 0;

        // Hard day = RPE >= 8 OR volume increase > 20%
        if (rpe >= 8 || (session.volumeIncrease && session.volumeIncrease > 0.2)) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      this.logger.error('Failed to get hard days streak', error);
      return 0;
    }
  }

  /**
   * Get recent injury flags
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Recent injury flags
   */
  async getRecentInjuryFlags(userId) {
    try {
      const flags = await this.storageManager.getInjuryFlags(userId);
      if (!flags) {
        return [];
      }

      // Filter to last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      return flags.filter(flag => {
        const flagDate = new Date(flag.timestamp);
        return flagDate >= sevenDaysAgo;
      });
    } catch (error) {
      this.logger.error('Failed to get injury flags', error);
      return [];
    }
  }

  /**
   * Get external activities (e.g., Strava)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} External activities
   */
  async getExternalActivities(userId) {
    try {
      const activities = await this.storageManager.getData(userId, 'external_activities');
      if (!activities || activities.length === 0) {
        return [];
      }

      // Filter to last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      return activities.filter(activity => {
        const activityDate = new Date(activity.timestamp);
        return activityDate >= yesterday;
      });
    } catch (error) {
      this.logger.error('Failed to get external activities', error);
      return [];
    }
  }

  /**
   * Calculate inferred readiness from passive inputs
   * @param {Object} inputs - Passive inputs
   * @returns {Object} Inferred readiness
   */
  calculateInferredReadiness(inputs) {
    let readinessScore = 8; // Default optimistic
    const reasons = [];

    // Factor 1: Prior session RPE (30% weight)
    if (inputs.priorSession?.rpe) {
      const { rpe } = inputs.priorSession;
      if (rpe >= 9) {
        readinessScore -= 2; // Hard session yesterday
        reasons.push(`Yesterday's session was very hard (RPE ${rpe})`);
      } else if (rpe >= 8) {
        readinessScore -= 1; // Moderate-hard session
        reasons.push(`Yesterday's session was hard (RPE ${rpe})`);
      } else if (rpe <= 6) {
        readinessScore += 1; // Easy session yesterday
        reasons.push(`Yesterday's session was light (RPE ${rpe})`);
      }
    }

    // Factor 2: Volume change (25% weight)
    if (inputs.volumeChange) {
      const change = inputs.volumeChange;
      if (change > 25) {
        readinessScore -= 1.5; // Large volume increase
        reasons.push(`Large volume increase (+${change}%)`);
      } else if (change > 10) {
        readinessScore -= 1; // Moderate increase
      } else if (change < -20) {
        readinessScore += 0.5; // Volume decreased significantly
        reasons.push('Volume decreased - well recovered');
      }
    }

    // Factor 3: Hard days streak (20% weight)
    if (inputs.hardDaysStreak >= 3) {
      readinessScore -= 2;
      reasons.push(`${inputs.hardDaysStreak} consecutive hard days`);
    } else if (inputs.hardDaysStreak >= 2) {
      readinessScore -= 1;
      reasons.push(`${inputs.hardDaysStreak} consecutive hard days`);
    }

    // Factor 4: Recent injury flags (15% weight)
    if (inputs.injuryFlags && inputs.injuryFlags.length > 0) {
      const recentFlag = inputs.injuryFlags[inputs.injuryFlags.length - 1];
      readinessScore -= 1.5;
      reasons.push(`Recent injury flag: ${recentFlag.location} (${recentFlag.severity}/10)`);
    }

    // Factor 5: External activities (10% weight)
    if (inputs.externalActivities && inputs.externalActivities.length > 0) {
      const totalDuration = inputs.externalActivities.reduce(
        (sum, act) => sum + (act.duration || 0),
        0
      );
      const totalIntensity = inputs.externalActivities.reduce(
        (sum, act) => sum + (act.intensity || 0),
        0
      );

      if (totalDuration > 60 && totalIntensity > 5) {
        readinessScore -= 1;
        reasons.push(
          `External activity today: ${totalDuration}min at intensity ${totalIntensity}/10`
        );
      }
    }

    // Normalize to 1-10 scale
    readinessScore = Math.max(1, Math.min(10, Math.round(readinessScore)));

    return {
      score: readinessScore,
      reasons: reasons.join('. '),
      source: 'passive_inference',
      confidence: this.calculateConfidence(inputs),
      inputs: {
        priorSession: inputs.priorSession?.rpe || 'unknown',
        volumeChange: inputs.volumeChange || 0,
        hardDaysStreak: inputs.hardDaysStreak || 0,
        injuryFlagsCount: inputs.injuryFlags?.length || 0,
        externalActivitiesCount: inputs.externalActivities?.length || 0,
      },
    };
  }

  /**
   * Calculate confidence in inference
   * @param {Object} inputs - Passive inputs
   * @returns {string} Confidence level
   */
  calculateConfidence(inputs) {
    let dataPoints = 0;

    if (inputs.priorSession?.rpe) {
      dataPoints++;
    }
    if (inputs.volumeChange !== 0) {
      dataPoints++;
    }
    if (inputs.hardDaysStreak > 0) {
      dataPoints++;
    }
    if (inputs.injuryFlags && inputs.injuryFlags.length > 0) {
      dataPoints++;
    }
    if (inputs.externalActivities && inputs.externalActivities.length > 0) {
      dataPoints++;
    }

    if (dataPoints >= 4) {
      return 'high';
    }
    if (dataPoints >= 2) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Log inference for audit
   * @param {string} userId - User ID
   * @param {Object} inferredReadiness - Inferred readiness
   * @param {Object} inputs - Passive inputs used
   */
  async logInference(userId, inferredReadiness, inputs) {
    try {
      await this.storageManager.logProgressionEvent(userId, {
        eventType: 'PASSIVE_READINESS_INFERRED',
        readiness: inferredReadiness,
        inputs,
        timestamp: new Date().toISOString(),
        metadata: {
          confidence: inferredReadiness.confidence,
          reasonCount: inferredReadiness.reasons.split('. ').length,
        },
      });

      this.logger.debug('Passive readiness inferred', { userId, readiness: inferredReadiness });
    } catch (error) {
      this.logger.error('Failed to log inference', error);
    }
  }

  /**
   * Get default readiness when no data available
   * @returns {Object} Default readiness
   */
  getDefaultReadiness() {
    return {
      score: 7,
      reasons: 'No data available - assuming moderate readiness',
      source: 'default',
      confidence: 'low',
      inputs: {},
    };
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    return window.AuthManager?.getCurrentUsername() || 'anonymous';
  }
}

window.PassiveReadiness = PassiveReadiness;
