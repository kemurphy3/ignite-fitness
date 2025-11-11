/**
 * FeedbackCollector - Aggregates explicit and implicit feedback signals
 * from user interactions to refine AI confidence scores.
 */
class FeedbackCollector {
  constructor(options = {}) {
    this.logger = window?.SafeLogger || console;
    this.storage = options.storage || window?.localStorage;
    this.namespace = options.namespace || 'ignite.ai.feedback_history';
    this.decay = options.decay || 0.9;
  }

  /**
   * Record user feedback for a recommendation
   * @param {Object} payload
   * @param {string} payload.userId
   * @param {string} payload.recommendationId
   * @param {'positive'|'negative'|'neutral'} payload.outcome
   * @param {number} payload.previousConfidence - 0..1
   * @param {number} [payload.sessionLoad] - training load associated
   * @returns {{confidence:number, successRate:number}}
   */
  recordFeedback(payload = {}) {
    const {
      userId,
      recommendationId,
      outcome,
      previousConfidence = 0.5,
      sessionLoad = 0,
    } = payload;
    if (!userId || !recommendationId) {
      this.logger.warn('FeedbackCollector.recordFeedback: missing identifiers', payload);
      return { confidence: previousConfidence, successRate: 0.5 };
    }

    const feedbackValue = this._mapOutcome(outcome);
    const history = this._loadHistory(userId, recommendationId);

    history.entries.push({
      outcome,
      timestamp: Date.now(),
      sessionLoad,
    });

    if (history.entries.length > 50) {
      history.entries.shift();
    }

    const confidence = this._blendConfidence(previousConfidence, feedbackValue);
    history.confidence = confidence;

    const successRate = this._calculateSuccessRate(history.entries);
    history.successRate = successRate;

    this._storeHistory(userId, recommendationId, history);

    return { confidence, successRate };
  }

  _blendConfidence(previous, feedbackValue) {
    const boundedPrevious = this._clamp(previous, 0, 1);
    const boundedFeedback = this._clamp(feedbackValue, 0, 1);
    return Number((boundedPrevious * this.decay + boundedFeedback * (1 - this.decay)).toFixed(4));
  }

  _calculateSuccessRate(entries) {
    if (!entries.length) {
      return 0.5;
    }
    const positives = entries.filter(entry => entry.outcome === 'positive').length;
    return Number((positives / entries.length).toFixed(4));
  }

  _mapOutcome(outcome) {
    if (outcome === 'positive') {
      return 1;
    }
    if (outcome === 'negative') {
      return 0;
    }
    return 0.5;
  }

  _loadHistory(userId, recommendationId) {
    const store = this._readStore();
    const key = `${userId}:${recommendationId}`;
    if (!store[key]) {
      store[key] = {
        entries: [],
        confidence: 0.5,
        successRate: 0.5,
      };
    }
    return store[key];
  }

  _storeHistory(userId, recommendationId, history) {
    const store = this._readStore();
    const key = `${userId}:${recommendationId}`;
    store[key] = history;
    this._writeStore(store);
  }

  _readStore() {
    if (!this.storage) {
      return {};
    }
    try {
      const raw = this.storage.getItem(this.namespace);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      this.logger.warn('FeedbackCollector: failed to read history', error);
      return {};
    }
  }

  _writeStore(value) {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(this.namespace, JSON.stringify(value));
    } catch (error) {
      this.logger.error('FeedbackCollector: failed to persist history', error);
    }
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

if (typeof window !== 'undefined') {
  window.FeedbackCollector = FeedbackCollector;
}

export default FeedbackCollector;
