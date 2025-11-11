/**
 * PersonalAILearner - Learns individual user patterns from historical sessions.
 * Uses moving averages and linear regression to identify preferred exercises,
 * volume tolerance, and goal momentum. Persists lightweight summaries locally so
 * the recommender can adapt client-side between sync cycles.
 */
class PersonalAILearner {
  constructor(options = {}) {
    this.logger = window?.SafeLogger || console;
    this.storage = options.storage || window?.localStorage;
    this.namespace = options.namespace || 'ignite.ai.personal_patterns';
    this.windowSize = options.windowSize || 5;
    this.minSamplesForTrend = options.minSamplesForTrend || 4;
  }

  /**
   * Load all patterns for a user
   * @param {string} userId
   * @returns {Object}
   */
  getUserPatterns(userId) {
    const all = this._readStore();
    return (
      all[userId] || {
        exercises: {},
        volume: {
          window: [],
          movingAverage: 0,
          baseline: 0,
          trend: 0,
        },
        goals: {},
      }
    );
  }

  /**
   * Persist patterns for a user
   * @param {string} userId
   * @param {Object} data
   */
  saveUserPatterns(userId, data) {
    const all = this._readStore();
    all[userId] = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    this._writeStore(all);
  }

  /**
   * Update learner with a completed session
   * @param {string} userId
   * @param {Object} sessionMetrics - { exerciseName, load, perceivedEffort, outcome: 'positive'|'negative', goalType }
   */
  updateFromSession(userId, sessionMetrics = {}) {
    if (!userId) {
      this.logger.warn('PersonalAILearner.updateFromSession: missing userId');
      return;
    }

    const { exerciseName, load, perceivedEffort, outcome, goalType } = sessionMetrics;
    const patterns = this.getUserPatterns(userId);

    if (typeof load === 'number' && load > 0) {
      this._updateVolumePattern(patterns, load);
    }

    if (exerciseName) {
      this._updateExercisePattern(patterns, exerciseName, outcome, load, perceivedEffort);
    }

    if (goalType && typeof sessionMetrics.goalProgress === 'number') {
      this._updateGoalProgress(patterns, goalType, sessionMetrics.goalProgress);
    }

    this.saveUserPatterns(userId, patterns);
  }

  /**
   * Returns list of preferred exercises with metadata
   * @param {string} userId
   * @returns {Array<{name:string, preferenceScore:number, volumeTolerance:number, successRate:number}>}
   */
  getPreferredExercises(userId) {
    const patterns = this.getUserPatterns(userId);
    const entries = Object.entries(patterns.exercises || {});
    return entries
      .filter(([, data]) => data.preferenceScore >= 0.8 && data.successRate >= 0.75)
      .map(([name, data]) => ({
        name,
        preferenceScore: Number(data.preferenceScore.toFixed(2)),
        volumeTolerance: Number((data.volumeTolerance || 0).toFixed(2)),
        successRate: Number((data.successRate || 0).toFixed(2)),
      }))
      .sort((a, b) => b.preferenceScore - a.preferenceScore || b.successRate - a.successRate);
  }

  /**
   * Returns personal volume insights
   * @param {string} userId
   * @returns {{movingAverage:number, trend:number, baseline:number}}
   */
  getVolumeInsights(userId) {
    const patterns = this.getUserPatterns(userId);
    return {
      movingAverage: Number((patterns.volume?.movingAverage || 0).toFixed(2)),
      trend: Number((patterns.volume?.trend || 0).toFixed(4)),
      baseline: Number((patterns.volume?.baseline || 0).toFixed(2)),
    };
  }

  /**
   * Calculate moving average and baseline
   * @param {Object} patterns
   * @param {number} load
   * @private
   */
  _updateVolumePattern(patterns, load) {
    const volume = patterns.volume || {
      window: [],
      movingAverage: 0,
      baseline: 0,
      trend: 0,
    };

    volume.window.push(load);
    if (volume.window.length > this.windowSize) {
      volume.window.shift();
    }

    volume.movingAverage = this._calculateMovingAverage(volume.window);

    if (volume.baseline === 0) {
      volume.baseline = volume.movingAverage || load;
    } else {
      // Blend baseline slowly toward new moving average
      volume.baseline = volume.baseline * 0.9 + volume.movingAverage * 0.1;
    }

    if (volume.window.length >= this.minSamplesForTrend) {
      volume.trend = this._calculateTrend(volume.window);
    }

    patterns.volume = volume;
  }

  /**
   * Update exercise adaptation statistics
   * @param {Object} patterns
   * @param {string} exerciseName
   * @param {'positive'|'negative'} outcome
   * @param {number} load
   * @param {number} perceivedEffort
   * @private
   */
  _updateExercisePattern(patterns, exerciseName, outcome, load, perceivedEffort) {
    const exercises = patterns.exercises || {};
    const record = exercises[exerciseName] || {
      positiveOutcomes: 0,
      negativeOutcomes: 0,
      totalSessions: 0,
      successRate: 0,
      preferenceScore: 0.5,
      volumeTolerance: 0,
      baselineVolume: load || 0,
      perceivedEffortHistory: [],
    };

    if (outcome === 'positive') {
      record.positiveOutcomes += 1;
    } else if (outcome === 'negative') {
      record.negativeOutcomes += 1;
    }
    record.totalSessions += 1;

    if (record.totalSessions > 0) {
      record.successRate = record.positiveOutcomes / record.totalSessions;
      const netOutcomes = record.positiveOutcomes - record.negativeOutcomes;
      record.preferenceScore = this._clamp((netOutcomes / record.totalSessions + 1) / 2, 0, 1);
    }

    if (typeof perceivedEffort === 'number' && perceivedEffort > 0) {
      record.perceivedEffortHistory.push(perceivedEffort);
      if (record.perceivedEffortHistory.length > this.windowSize) {
        record.perceivedEffortHistory.shift();
      }
    }

    if (typeof load === 'number' && load > 0) {
      if (!record.baselineVolume || record.baselineVolume === 0) {
        record.baselineVolume = load;
      } else {
        record.baselineVolume = record.baselineVolume * 0.8 + load * 0.2;
      }
      record.volumeTolerance = this._calculateMovingAverage([record.volumeTolerance || load, load]);
    }

    // Identify preference if success rate and tolerance criteria met
    if (record.successRate > 0.8 && record.volumeTolerance > record.baselineVolume * 1.2) {
      record.isPreferred = true;
    } else if (record.successRate < 0.6) {
      record.isPreferred = false;
    }

    exercises[exerciseName] = record;
    patterns.exercises = exercises;
  }

  /**
   * Update goal progress trend via regression
   * @param {Object} patterns
   * @param {string} goalType
   * @param {number} value
   * @private
   */
  _updateGoalProgress(patterns, goalType, value) {
    if (typeof value !== 'number') {
      return;
    }

    const goals = patterns.goals || {};
    const goalRecord = goals[goalType] || {
      history: [],
      trend: 0,
      lastValue: value,
    };

    goalRecord.history.push({
      timestamp: Date.now(),
      value,
    });
    if (goalRecord.history.length > 30) {
      goalRecord.history.shift();
    }

    if (goalRecord.history.length >= this.minSamplesForTrend) {
      goalRecord.trend = this._calculateTrend(goalRecord.history.map(item => item.value));
    }
    goalRecord.lastValue = value;

    goals[goalType] = goalRecord;
    patterns.goals = goals;
  }

  _calculateMovingAverage(values = []) {
    if (!values.length) {
      return 0;
    }
    const sum = values.reduce((total, current) => total + current, 0);
    return sum / values.length;
  }

  /**
   * Simple linear regression slope calculation
   * @param {Array<number>} values
   * @returns {number}
   */
  _calculateTrend(values) {
    const n = values.length;
    if (n < 2) {
      return 0;
    }

    const xValues = Array.from({ length: n }, (_, idx) => idx + 1);
    const sumX = xValues.reduce((total, x) => total + x, 0);
    const sumY = values.reduce((total, y) => total + y, 0);
    const sumXY = values.reduce((total, y, idx) => total + xValues[idx] * y, 0);
    const sumX2 = xValues.reduce((total, x) => total + x * x, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = n * sumX2 - sumX * sumX;

    if (denominator === 0) {
      return 0;
    }
    return numerator / denominator;
  }

  _readStore() {
    if (!this.storage) {
      return {};
    }
    try {
      const raw = this.storage.getItem(this.namespace);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      this.logger.warn('PersonalAILearner: failed to read store', error);
      return {};
    }
  }

  _writeStore(payload) {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(this.namespace, JSON.stringify(payload));
    } catch (error) {
      this.logger.error('PersonalAILearner: failed to persist patterns', error);
    }
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

if (typeof window !== 'undefined') {
  window.PersonalAILearner = PersonalAILearner;
}

export default PersonalAILearner;
