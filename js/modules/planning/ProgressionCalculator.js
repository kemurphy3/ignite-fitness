/**
 * ProgressionCalculator - computes progressive overload models for multi-modal training.
 * Supports double progression, linear/exponential/undulating curves, deload scheduling,
 * and auto-regulation using RPE/HRV feedback.
 */
class ProgressionCalculator {
  constructor(options = {}) {
    this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
    this.defaultRepRange = options.defaultRepRange || [5, 12];
    this.defaultIntensity = options.defaultIntensity || 0.72;
    this.fatigueThreshold = options.fatigueThreshold || 0.7;
    this.deloadFraction = options.deloadFraction || 0.6;
  }

  createProgressionModel(phase, weeklyPlan) {
    const curves = this.#buildCurves(phase);
    const doubleProgression = weeklyPlan.map(session =>
      this.calculateDoubleProgression(session, phase.emphasis)
    );
    const deloadWeeks = this.scheduleDeloads(curves.fatigueCurve, phase.weeks);
    return {
      doubleProgression,
      progressionCurves: curves,
      deloadWeeks,
      autoRegulation: this.autoRegulate(weeklyPlan),
    };
  }

  calculateDoubleProgression(session, emphasis) {
    const repRange = this.#repRangeForEmphasis(emphasis);
    const baseIntensity = this.#intensityForEmphasis(emphasis);
    const initialWeight = session.sessionLoad / (repRange.min * session.intensity);
    const increment = baseIntensity * 0.025;
    return {
      session,
      repRange,
      weightProgression: Array.from({ length: 4 }, (_, week) =>
        Number((initialWeight * (1 + week * increment)).toFixed(2))
      ),
    };
  }

  scheduleDeloads(fatigueCurve, weeks) {
    const deloads = [];
    let cumulative = 0;
    for (let week = 1; week <= weeks; week++) {
      cumulative += fatigueCurve[week - 1];
      if (cumulative >= this.fatigueThreshold) {
        deloads.push({ week, loadReduction: this.deloadFraction });
        cumulative = 0.3;
      }
    }
    return deloads;
  }

  autoRegulate(sessions) {
    return sessions.map(session => {
      const targetRPE = session.intensity * 10;
      const hrv = session.recoveryFocus === 'neuromuscular' ? 0.52 : 0.6;
      const adjustment = this.#autoRegulationAdjustment(targetRPE, hrv);
      return {
        session,
        targetRPE,
        hrvBaseline: hrv,
        loadAdjustment: adjustment,
      };
    });
  }

  #repRangeForEmphasis(emphasis) {
    switch (emphasis.key) {
      case 'strength':
        return { min: 3, max: 6 };
      case 'endurance':
        return { min: 10, max: 15 };
      case 'speed':
        return { min: 2, max: 5 };
      default:
        return { min: this.defaultRepRange[0], max: this.defaultRepRange[1] };
    }
  }

  #intensityForEmphasis(emphasis) {
    switch (emphasis.key) {
      case 'strength':
        return 0.82;
      case 'endurance':
        return 0.68;
      case 'speed':
        return 0.75;
      default:
        return this.defaultIntensity;
    }
  }

  #buildCurves(phase) {
    const weeks = Math.max(phase.weeks, 4);
    const linear = Array.from({ length: weeks }, (_, i) => 0.6 + i * 0.05);
    const exponential = Array.from({ length: weeks }, (_, i) => 0.6 * Math.exp(i / (weeks * 1.8)));
    const undulating = Array.from(
      { length: weeks },
      (_, i) => 0.65 + 0.1 * Math.sin((i * Math.PI) / 2)
    );
    const fatigueCurve = Array.from({ length: weeks }, (_, i) => Math.min(0.25, 0.12 + i * 0.05));
    return {
      linear,
      exponential,
      undulating,
      fatigueCurve,
    };
  }

  #autoRegulationAdjustment(targetRPE, hrv) {
    const hrvDelta = hrv - 0.6;
    if (hrvDelta >= 0.05) {
      return targetRPE >= 8 ? -0.05 : 0;
    }
    if (hrvDelta <= -0.05) {
      return -0.1;
    }
    return -0.02;
  }
}

if (typeof window !== 'undefined') {
  window.ProgressionCalculator = ProgressionCalculator;
}

export default ProgressionCalculator;
