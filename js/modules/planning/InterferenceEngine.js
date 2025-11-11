/**
 * InterferenceEngine - quantifies concurrent training interference based on
 * established molecular signaling, hormonal, and substrate competition models.
 */
class InterferenceEngine {
  constructor(options = {}) {
    this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
    this.timeDecay = options.timeDecay ?? 0.85;
    this.hormonalSensitivity = options.hormonalSensitivity ?? 0.6;
    this.glycogenCapacity = options.glycogenCapacity ?? 450; // grams
  }

  calculateInterference(sessionPlan, recoveryProfile = {}) {
    if (!Array.isArray(sessionPlan)) {
      throw new Error('sessionPlan must be an array');
    }

    const sorted = sessionPlan
      .map(session => ({
        ...session,
        timestamp: Number(session.timestamp ?? session.day ?? 0),
        modalities: session.modalities || [],
        intensity: Number(session.intensity ?? 0.7),
        duration: Number(session.duration ?? 45),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const outputs = sorted.map((session, index) => {
      const previous = index > 0 ? sorted[index - 1] : null;
      const intervalHours = previous
        ? (session.timestamp - previous.timestamp) / (1000 * 60 * 60)
        : Infinity;
      const molecular = this.#molecularSignaling(session, intervalHours);
      const hormonal = this.#hormonalResponse(session, recoveryProfile);
      const glycogen = this.#glycogenAvailability(session, previous, recoveryProfile);
      const recovery = this.#recoveryCompetition(session, intervalHours, recoveryProfile);
      const total = Math.min(1, molecular + hormonal + glycogen + recovery);
      return {
        session,
        molecular,
        hormonal,
        glycogen,
        recovery,
        total,
      };
    });

    const aggregated = outputs.reduce(
      (acc, current) => {
        acc.molecular += current.molecular;
        acc.hormonal += current.hormonal;
        acc.glycogen += current.glycogen;
        acc.recovery += current.recovery;
        return acc;
      },
      { molecular: 0, hormonal: 0, glycogen: 0, recovery: 0 }
    );

    const average = Object.keys(aggregated).reduce((avg, key) => {
      avg[key] = aggregated[key] / outputs.length;
      return avg;
    }, {});

    average.total = Math.min(
      1,
      average.molecular + average.hormonal + average.glycogen + average.recovery
    );

    return { sessions: outputs, average };
  }

  #molecularSignaling(session, intervalHours) {
    const hasStrength = session.modalities.includes('strength');
    const hasEndurance = session.modalities.includes('endurance');
    if (!hasStrength || !hasEndurance) {
      return 0;
    }
    const concurrentFactor = 0.4;
    const adjustedInterval = !Number.isFinite(intervalHours) ? 0 : Math.max(0, intervalHours - 6);
    const timeFactor = intervalHours <= 6 ? 1 : Math.exp(-0.1 * adjustedInterval);
    return Math.min(1, concurrentFactor * timeFactor * session.intensity);
  }

  #hormonalResponse(session, recoveryProfile) {
    const stressScore = session.intensity * (session.duration / 60);
    const cortisolBaseline = recoveryProfile.cortisolBaseline ?? 0.4;
    const testosteroneBaseline = recoveryProfile.testosteroneBaseline ?? 0.6;
    const anabolicBalance = testosteroneBaseline - cortisolBaseline;
    const hormonalDisruption = stressScore * this.hormonalSensitivity * (1 - anabolicBalance);
    return Math.min(1, Math.max(0, hormonalDisruption));
  }

  #glycogenAvailability(session, previous, recoveryProfile) {
    const enduranceHeavy =
      session.modalities.includes('endurance') || session.modalities.includes('conditioning');
    if (!enduranceHeavy) {
      return 0;
    }
    const previousGlycogenUse = previous
      ? previous.duration *
        previous.intensity *
        (previous.modalities.includes('endurance') ? 1.2 : 0.6)
      : 0;
    const availableGlycogen = this.glycogenCapacity * (recoveryProfile.glycogenStatus ?? 0.8);
    const deficit = Math.max(0, (previousGlycogenUse - availableGlycogen) / this.glycogenCapacity);
    return Math.min(1, deficit + (session.duration * session.intensity) / 600);
  }

  #recoveryCompetition(session, intervalHours, recoveryProfile) {
    if (!Number.isFinite(intervalHours)) {
      intervalHours = Infinity;
    }
    const recoveryRate = recoveryProfile.recoveryRate ?? 0.85;
    const recovered =
      1 - Math.pow(this.timeDecay * (1 - recoveryRate), Math.max(intervalHours, 0) / 12);
    const fatigueContribution = (session.duration * session.intensity) / 200;
    const competition = Math.max(0, fatigueContribution * (1 - recovered));
    return Math.min(1, competition);
  }
}

if (typeof window !== 'undefined') {
  window.InterferenceEngine = InterferenceEngine;
}

export default InterferenceEngine;
