/**
 * AdaptiveRecommender - Bayesian recommendation engine that merges personal
 * patterns with general templates while balancing exploration vs exploitation.
 */
class AdaptiveRecommender {
  constructor(options = {}) {
    this.logger = window?.SafeLogger || console;
    this.randomFn = options.randomFn || (() => Math.random());
    this.personalLearner = this._resolvePersonalLearner(options.personalLearner);
    this.feedbackCollector = this._resolveFeedbackCollector(options.feedbackCollector);
    this.defaultPrior = options.defaultPrior || 0.6;
    this.minEvidence = options.minEvidence || 0.05;
    this.exploreProbability = options.exploreProbability || 0.1;
  }

  /**
   * Recommend an exercise or session block for a user
   * @param {Object} payload
   * @param {string} payload.userId
   * @param {Array<Object>} payload.candidates
   * @param {number} payload.baseConfidence
   * @returns {{choice:Object, metadata:Object}}
   */
  recommend(payload = {}) {
    const { userId, candidates = [], baseConfidence = 0.6 } = payload;
    if (!userId || !candidates.length) {
      this.logger.warn('AdaptiveRecommender.recommend: insufficient data', payload);
      return {
        choice: candidates[0] || null,
        metadata: { confidence: baseConfidence, strategy: 'fallback' },
      };
    }

    const personalPatterns = this.personalLearner.getUserPatterns(userId);
    const preferredExercises = this.personalLearner.getPreferredExercises(userId);
    const preferenceMap = new Map(
      preferredExercises.map(item => [item.name, item.preferenceScore])
    );

    const scored = candidates.map(candidate => {
      const prior = this._derivePrior(candidate);
      const personalConfidence =
        preferenceMap.get(candidate.name) ||
        personalPatterns.exercises?.[candidate.name]?.preferenceScore ||
        0.5;
      const likelihood = this._deriveLikelihood(candidate, personalPatterns);
      const posterior = this._calculatePosterior(prior, likelihood);
      const weight = personalConfidence > 0.7 ? 0.8 : 0.2;
      const combinedConfidence = personalConfidence * weight + posterior * (1 - weight);

      return {
        candidate,
        prior,
        likelihood,
        posterior,
        personalConfidence,
        combinedConfidence: Number(combinedConfidence.toFixed(4)),
      };
    });

    let selected;
    let strategy;

    if (this._shouldExplore()) {
      selected = this._selectExplorationCandidate(scored);
      strategy = 'exploration';
    } else {
      selected = scored.sort((a, b) => b.combinedConfidence - a.combinedConfidence)[0];
      strategy = 'exploitation';
    }

    return {
      choice: selected?.candidate || null,
      metadata: {
        prior: selected?.prior ?? this.defaultPrior,
        likelihood: selected?.likelihood ?? 0.5,
        posterior: selected?.posterior ?? 0.5,
        personalConfidence: selected?.personalConfidence ?? 0.5,
        combinedConfidence: selected?.combinedConfidence ?? baseConfidence,
        strategy,
      },
    };
  }

  /**
   * Update feedback for a previous recommendation
   * @param {Object} payload
   * @param {string} payload.userId
   * @param {string} payload.recommendationId
   * @param {'positive'|'negative'|'neutral'} payload.outcome
   * @param {Object} payload.recommendationMeta
   */
  recordOutcome(payload = {}) {
    const { userId, recommendationId, outcome, recommendationMeta = {}, sessionLoad = 0 } = payload;
    if (!userId || !recommendationId) {
      this.logger.warn('AdaptiveRecommender.recordOutcome: missing identifiers', payload);
      return;
    }

    this.feedbackCollector.recordFeedback({
      userId,
      recommendationId,
      outcome,
      previousConfidence: recommendationMeta.combinedConfidence ?? this.defaultPrior,
      sessionLoad,
    });

    this.logger.info('AdaptiveRecommender: feedback recorded', {
      userId,
      recommendationId,
      outcome,
    });
  }

  _derivePrior(candidate) {
    const base = typeof candidate.baseRate === 'number' ? candidate.baseRate : this.defaultPrior;
    return this._clamp(base, 0.05, 0.95);
  }

  _deriveLikelihood(candidate, personalPatterns) {
    const history = personalPatterns.exercises?.[candidate.name];
    if (!history || history.totalSessions < 3) {
      return this._clamp(candidate.generalLikelihood ?? 0.6, this.minEvidence, 0.95);
    }
    return this._clamp(history.successRate || 0.5, this.minEvidence, 0.99);
  }

  _calculatePosterior(prior, likelihood) {
    const priorFailure = 1 - prior;
    const likelihoodFailure = 1 - likelihood;
    const evidence = likelihood * prior + likelihoodFailure * priorFailure;
    if (evidence === 0) {
      return this._clamp(prior, 0.05, 0.95);
    }
    return this._clamp((likelihood * prior) / evidence, 0.05, 0.99);
  }

  _selectExplorationCandidate(scored) {
    const unsampled = scored.filter(item => item.candidate?.exposures < 1);
    if (unsampled.length) {
      return unsampled[Math.floor(this.randomFn() * unsampled.length)];
    }
    const lowestConfidence = scored.sort((a, b) => a.combinedConfidence - b.combinedConfidence)[0];
    return lowestConfidence || scored[0];
  }

  _shouldExplore() {
    return this.randomFn() < this.exploreProbability;
  }

  _resolvePersonalLearner(candidate) {
    if (candidate && typeof candidate.getUserPatterns === 'function') {
      return candidate;
    }
    if (typeof candidate === 'function') {
      return new candidate();
    }
    if (window?.PersonalAILearner && typeof window.PersonalAILearner === 'function') {
      return new window.PersonalAILearner();
    }
    return {
      getUserPatterns: () => ({ exercises: {}, volume: {} }),
      getPreferredExercises: () => [],
    };
  }

  _resolveFeedbackCollector(candidate) {
    if (candidate && typeof candidate.recordFeedback === 'function') {
      return candidate;
    }
    if (typeof candidate === 'function') {
      return new candidate();
    }
    if (window?.FeedbackCollector && typeof window.FeedbackCollector === 'function') {
      return new window.FeedbackCollector();
    }
    return {
      recordFeedback: () => ({ confidence: 0.5, successRate: 0.5 }),
    };
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

if (typeof window !== 'undefined') {
  window.AdaptiveRecommender = AdaptiveRecommender;
}

export default AdaptiveRecommender;
