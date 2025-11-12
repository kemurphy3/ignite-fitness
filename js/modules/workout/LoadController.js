/**
 * LoadController - Manages load adjustments and progression rules
 * Implements deload logic, RPE-based adjustments, and readiness inference
 */
class LoadController {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.eventBus = window.EventBus;
    this.progressionEngine = window.ProgressionEngine;

    this.deloadWeekFrequency = 4;
    this.weekNumber = this.getCurrentWeekNumber();

    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Listen for session completion
    this.eventBus.on(this.eventBus.TOPICS.SESSION_COMPLETED, async data => {
      await this.processSessionCompletion(data);
    });

    // Listen for readiness updates
    this.eventBus.on(this.eventBus.TOPICS.READINESS_UPDATED, async data => {
      await this.inferReadinessIfMissing(data);
    });
  }

  /**
   * Process session completion and update loads
   * @param {Object} sessionData - Session completion data
   */
  async processSessionCompletion(sessionData) {
    try {
      const userId = sessionData.userId || this.getUserId();
      const sessionLog = await this.getLastSessionLog(userId);

      if (!sessionLog) {
        this.logger.warn('No session log found for processing');
        return;
      }

      // Get RPE-based adjustments
      const rpeAdjustments = await this.getRPEAdjustments(sessionLog);

      // Check for deload week
      const deloadAdjustments = this.checkDeloadWeek();

      // Merge adjustments
      const finalAdjustments = this.mergeAdjustments(rpeAdjustments, deloadAdjustments);

      // Update loads for next session
      await this.updateNextSessionLoads(userId, finalAdjustments);

      // Emit event
      this.eventBus.emit('LOADS_UPDATED', {
        userId,
        adjustments: finalAdjustments,
        rationale: this.generateAdjustmentRationale(finalAdjustments),
      });

      this.logger.debug('Loads updated based on session completion', finalAdjustments);
    } catch (error) {
      this.logger.error('Failed to process session completion', error);
    }
  }

  /**
   * Get RPE-based adjustments
   * @param {Object} sessionLog - Session log data
   * @returns {Object} RPE adjustments
   */
  async getRPEAdjustments(sessionLog) {
    const adjustments = {
      intensityMultiplier: 1.0,
      volumeMultiplier: 1.0,
      rationale: '',
    };

    const avgRPE = sessionLog.averageRPE;

    if (!avgRPE) {
      return adjustments;
    }

    // RPE ≥ 8 with full volume → +2.5% load next time
    if (avgRPE >= 8 && sessionLog.totalVolume > 0) {
      adjustments.intensityMultiplier = 1.025;
      adjustments.rationale = 'Previous session RPE ≥ 8 with full volume → increase load 2.5%';
    }

    // RPE ≥ 9 or failed reps → -5% load or reduce volume
    if (avgRPE >= 9 || sessionLog.modifications?.some(m => m.includes('failed'))) {
      adjustments.intensityMultiplier = 0.95;
      adjustments.rationale = 'Previous session RPE ≥ 9 or failed reps → reduce load 5%';
    }

    // RPE < 6 → increase load more
    if (avgRPE < 6) {
      adjustments.intensityMultiplier = 1.05;
      adjustments.rationale = 'Previous session too easy (RPE < 6) → increase load 5%';
    }

    return adjustments;
  }

  /**
   * Check if deload week and return adjustments
   * @returns {Object} Deload adjustments
   */
  checkDeloadWeek() {
    const adjustments = {
      intensityMultiplier: 1.0,
      volumeMultiplier: 1.0,
      rationale: '',
    };

    // Every 4th microcycle → -20% volume
    if (this.weekNumber % this.deloadWeekFrequency === 0) {
      adjustments.volumeMultiplier = 0.8;
      adjustments.rationale = `Deload week (week ${this.weekNumber}) → reduce volume 20% for recovery`;
    }

    return adjustments;
  }

  /**
   * Merge multiple adjustment types
   * @param {Object} rpeAdj - RPE adjustments
   * @param {Object} deloadAdj - Deload adjustments
   * @returns {Object} Final adjustments
   */
  mergeAdjustments(rpeAdj, deloadAdj) {
    return {
      intensityMultiplier: rpeAdj.intensityMultiplier * (deloadAdj.intensityMultiplier || 1.0),
      volumeMultiplier: rpeAdj.volumeMultiplier * (deloadAdj.volumeMultiplier || 1.0),
      rationales: [rpeAdj.rationale, deloadAdj.rationale].filter(r => r),
      source: 'LoadController',
    };
  }

  /**
   * Update loads for next session
   * @param {string} userId - User ID
   * @param {Object} adjustments - Load adjustments
   */
  async updateNextSessionLoads(userId, adjustments) {
    try {
      const nextSessionConfig = {
        intensityMultiplier: adjustments.intensityMultiplier,
        volumeMultiplier: adjustments.volumeMultiplier,
        deloadActive: adjustments.volumeMultiplier < 1.0,
        appliedAt: new Date().toISOString(),
        rationales: adjustments.rationales,
      };

      // Save to storage
      await this.storageManager.savePreferences(userId, {
        ...(await this.storageManager.getPreferences(userId)),
        nextSessionConfig,
      });

      this.logger.debug('Next session loads updated', nextSessionConfig);
    } catch (error) {
      this.logger.error('Failed to update next session loads', error);
    }
  }

  /**
   * Infer readiness if missing from check-in
   * Use: yesterday's RPE, volume change, recent injuries, external activities
   * @param {Object} data - Readiness data
   */
  async inferReadinessIfMissing(data) {
    // If readiness already provided, use it
    if (data.readinessScore) {
      return;
    }

    try {
      const userId = data.userId || this.getUserId();

      // Get yesterday's session
      const yesterdaySession = await this.getYesterdaySession(userId);

      // Get volume changes
      const volumeChange = this.calculateVolumeChange(userId);

      // Get recent injuries
      const recentInjuries = await this.getRecentInjuries(userId);

      // Infer readiness
      const inferredReadiness = this.inferReadiness(yesterdaySession, volumeChange, recentInjuries);

      if (inferredReadiness) {
        data.readinessScore = inferredReadiness;
        this.eventBus.emit(this.eventBus.TOPICS.READINESS_UPDATED, {
          userId,
          readinessScore: inferredReadiness,
          inferred: true,
          source: 'LoadController',
        });
      }
    } catch (error) {
      this.logger.error('Failed to infer readiness', error);
    }
  }

  /**
   * Infer readiness from available data
   * @param {Object} yesterdaySession - Yesterday's session
   * @param {number} volumeChange - Volume change %
   * @param {Array} recentInjuries - Recent injuries
   * @returns {number} Inferred readiness score
   */
  inferReadiness(yesterdaySession, volumeChange, recentInjuries) {
    let readiness = 7; // Default moderate

    // If yesterday was hard (RPE ≥ 8), reduce readiness
    if (yesterdaySession?.averageRPE >= 8) {
      readiness -= 2; // Lower readiness after hard session
    }

    // If volume increased significantly, reduce readiness
    if (volumeChange > 25) {
      readiness -= 1; // Fatigue from volume spike
    }

    // If recent injuries, reduce readiness
    if (recentInjuries && recentInjuries.length > 0) {
      readiness -= 2; // Conservative after injuries
    }

    // Clamp to 1-10
    return Math.max(1, Math.min(10, readiness));
  }

  /**
   * Get yesterday's session
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Yesterday's session
   */
  async getYesterdaySession(userId) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      return await this.storageManager.getSessionLog(userId, yesterdayStr);
    } catch (error) {
      this.logger.error('Failed to get yesterday session', error);
      return null;
    }
  }

  /**
   * Calculate volume change
   * @param {string} userId - User ID
   * @returns {number} Volume change %
   */
  calculateVolumeChange(_userId) {
    // Simplified - would calculate from session history
    return 0;
  }

  /**
   * Get recent injuries
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Recent injuries
   */
  async getRecentInjuries(userId) {
    try {
      const flags = await this.storageManager.getInjuryFlags(userId);

      if (!flags || !Array.isArray(flags)) {
        return [];
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      return flags.filter(flag => {
        const flagDate = new Date(flag.date);
        return flagDate >= sevenDaysAgo && flag.active;
      });
    } catch (error) {
      this.logger.error('Failed to get recent injuries', error);
      return [];
    }
  }

  /**
   * Get last session log
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Last session log
   */
  async getLastSessionLog(userId) {
    try {
      const logs = await this.storageManager.getSessionLogs(userId);
      if (!logs || logs.length === 0) {
        return null;
      }

      return logs[logs.length - 1];
    } catch (error) {
      this.logger.error('Failed to get last session log', error);
      return null;
    }
  }

  /**
   * Generate adjustment rationale
   * @param {Object} adjustments - Load adjustments
   * @returns {string} Rationale
   */
  generateAdjustmentRationale(adjustments) {
    const rationales = adjustments.rationales || [];
    return rationales.join('. ') || 'Load maintained at current level.';
  }

  /**
   * Get current week number
   * @returns {number} Current week number
   */
  getCurrentWeekNumber() {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const days = Math.floor((new Date() - startOfYear) / (1000 * 60 * 60 * 24));
    return Math.ceil(days / 7);
  }

  getUserId() {
    return window.AuthManager?.getCurrentUsername() || 'anonymous';
  }
}

window.LoadController = LoadController;
