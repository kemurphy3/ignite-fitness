class BodyCompositionTracker {
    constructor(options = {}) {
        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
    }

    analyze(history = [], goals = {}) {
        if (!Array.isArray(history) || history.length === 0) {
            throw new Error('Body composition history is required');
        }
        const sorted = history
            .map(entry => this.#normalizeEntry(entry))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        const bmiSeries = sorted.map(entry => ({ date: entry.date, bmi: this.#calculateBMI(entry) }));
        const trends = this.#calculateTrends(sorted);
        const goalRecommendations = this.#evaluateGoals(sorted, goals);
        const alerts = this.#generateAlerts(sorted, trends);

        return {
            latest: sorted[sorted.length - 1],
            bmiSeries,
            trends,
            goalRecommendations,
            alerts
        };
    }

    #normalizeEntry(entry) {
        if (!entry || !entry.date) {
            throw new Error('Composition entry requires a date');
        }
        const normalized = { ...entry };
        normalized.date = new Date(entry.date).toISOString();
        normalized.weight = Number(entry.weight);
        normalized.bodyFat = Number(entry.bodyFat ?? entry.bodyFatPercentage);
        normalized.height = Number(entry.height || 0);
        if (!Number.isFinite(normalized.weight) || normalized.weight <= 70) {
            throw new Error('Weight must be provided in pounds');
        }
        if (!Number.isFinite(normalized.bodyFat) || normalized.bodyFat < 2 || normalized.bodyFat > 70) {
            throw new Error('Body fat percentage must be between 2 and 70');
        }
        if (normalized.height && (normalized.height < 120 || normalized.height > 220)) {
            throw new Error('Height must be realistic centimeters');
        }
        return normalized;
    }

    #calculateBMI(entry) {
        if (!entry.height) {return null;}
        const heightM = entry.height / 100;
        const weightKg = entry.weight * 0.45359237;
        return Number((weightKg / (heightM * heightM)).toFixed(2));
    }

    #calculateTrends(entries) {
        if (entries.length < 2) {return { weightChangePerWeek: 0, bodyFatChangePerWeek: 0 };}
        const first = entries[0];
        const last = entries[entries.length - 1];
        const weeks = Math.max((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24 * 7), 1);
        return {
            weightChangePerWeek: (last.weight - first.weight) / weeks,
            bodyFatChangePerWeek: (last.bodyFat - first.bodyFat) / weeks
        };
    }

    #evaluateGoals(entries, goals) {
        if (!goals || typeof goals !== 'object') {
            return [];
        }
        const recommendations = [];
        const latest = entries[entries.length - 1];
        if (goals.targetWeightLossRate) {
            const trend = this.#calculateTrends(entries);
            if (trend.weightChangePerWeek > -goals.targetWeightLossRate) {
                recommendations.push({
                    type: 'nutrition',
                    message: 'Weight loss slower than target – recommend reducing calories by ~200kcal/day.'
                });
            }
        }
        return recommendations;
    }

    #generateAlerts(entries, trends) {
        const alerts = [];
        const latest = entries[entries.length - 1];
        const threeWeeksAgo = new Date(latest.date);
        threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
        const recentEntries = entries.filter(entry => new Date(entry.date) >= threeWeeksAgo);
        if (recentEntries.length >= 3) {
            const weightVariance = Math.max(...recentEntries.map(e => e.weight)) - Math.min(...recentEntries.map(e => e.weight));
            if (weightVariance < 0.5) {
                alerts.push({ type: 'plateau', message: 'No significant weight change for 3 weeks – plateau protocol recommended.' });
            }
        }
        return alerts;
    }
}

if (typeof window !== 'undefined') {
    window.BodyCompositionTracker = BodyCompositionTracker;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BodyCompositionTracker;
    module.exports.default = BodyCompositionTracker;
}
