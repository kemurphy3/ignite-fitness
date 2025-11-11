/**
 * PerformancePredictor - transforms statistical insights into actionable
 * performance projections for endurance, strength, and body composition.
 */
class PerformancePredictor {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
    }

    /**
     * Estimate days remaining to reach a goal based on average weekly progress.
     * @param {number} currentValue
     * @param {number} targetValue
     * @param {number} averageWeeklyProgress
     * @returns {{days:number, weeks:number}}
     */
    estimateGoalTimeline(currentValue, targetValue, averageWeeklyProgress) {
        if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue) || !Number.isFinite(averageWeeklyProgress)) {
            return { days: Infinity, weeks: Infinity };
        }
        if (averageWeeklyProgress === 0) {
            return { days: Infinity, weeks: Infinity };
        }
        const delta = targetValue - currentValue;
        const weeks = delta / averageWeeklyProgress;
        const days = weeks * 7;
        return {
            weeks,
            days
        };
    }

    /**
     * Predict 5K time improvement based on training weeks and improvement rate.
     * @param {number} currentTimeSeconds
     * @param {number} improvementRate - weekly fractional improvement (0-1)
     * @param {number} weeksOfTraining
     * @returns {number} projected time in seconds
     */
    predict5kTime(currentTimeSeconds, improvementRate, weeksOfTraining) {
        if (!Number.isFinite(currentTimeSeconds) || currentTimeSeconds <= 0) {
            return currentTimeSeconds;
        }
        const rate = Number.isFinite(improvementRate) ? Math.min(Math.max(improvementRate, 0), 0.2) : 0;
        const weeks = Math.max(0, weeksOfTraining || 0);
        return currentTimeSeconds * Math.pow(1 - rate, weeks);
    }

    /**
     * Predict strength progression using load, recovery, and progression rate.
     * @param {number} currentMax
     * @param {number} volumeLoad
     * @param {number} recoveryFactor
     * @param {number} progressionRate
     * @returns {number}
     */
    predictStrengthMax(currentMax, volumeLoad, recoveryFactor, progressionRate) {
        if (!Number.isFinite(currentMax) || currentMax <= 0) {return currentMax;}
        const normalizedLoad = Math.max(0, volumeLoad || 0);
        const recovery = Number.isFinite(recoveryFactor) ? Math.max(0.5, Math.min(recoveryFactor, 1.5)) : 1;
        const rate = Number.isFinite(progressionRate) ? Math.max(0, progressionRate) : 0;
        return currentMax * (1 + (normalizedLoad * recovery * rate));
    }

    /**
     * Predict weight change given recent trend.
     * @param {number} currentWeight
     * @param {number} averageWeeklyChange
     * @param {number} weeksAhead
     * @returns {number}
     */
    predictWeightChange(currentWeight, averageWeeklyChange, weeksAhead) {
        if (!Number.isFinite(currentWeight)) {return currentWeight;}
        const delta = (averageWeeklyChange || 0) * (weeksAhead || 0);
        return currentWeight + delta;
    }
}

if (typeof window !== 'undefined') {
    window.PerformancePredictor = PerformancePredictor;
}

export default PerformancePredictor;


