class ProgressTracker {
    constructor(options = {}) {
        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
        this.emaAlpha = options.emaAlpha || 0.3;
        this.significanceThreshold = options.significanceThreshold || 0.015; // 1.5% change
        this.plateauWeeks = options.plateauWeeks || 4;
    }

    analyze(history = []) {
        const cleaned = this.#validateHistory(history);
        const sorted = cleaned.sort((a, b) => new Date(a.date) - new Date(b.date));
        const summary = {
            entries: sorted.length,
            latest: sorted[sorted.length - 1] || null,
            weeklyChanges: this.#computeWeeklyChanges(sorted),
            ema: this.#computeEMA(sorted),
            plateau: this.#detectPlateau(sorted),
            recommendation: null
        };
        summary.recommendation = this.#generateRecommendation(summary);
        return summary;
    }

    #validateHistory(history) {
        if (!Array.isArray(history)) {
            throw new Error('Progress history must be an array');
        }
        return history.filter(entry => {
            if (!entry || !entry.date) {return false;}
            const date = new Date(entry.date);
            if (Number.isNaN(date.getTime())) {return false;}
            if (!Number.isFinite(entry.bodyFat) || entry.bodyFat < 2 || entry.bodyFat > 70) {return false;}
            if (!Number.isFinite(entry.weight) || entry.weight < 70 || entry.weight > 500) {return false;}
            if (entry.muscleMass !== undefined && (!Number.isFinite(entry.muscleMass) || entry.muscleMass < 10)) {return false;}
            return true;
        });
    }

    #computeWeeklyChanges(entries) {
        const changes = [];
        for (let i = 1; i < entries.length; i++) {
            const current = entries[i];
            const previous = entries[i - 1];
            const deltaDays = (new Date(current.date) - new Date(previous.date)) / (1000 * 60 * 60 * 24);
            if (deltaDays < 5) {continue;}
            const changeBF = (current.bodyFat - previous.bodyFat) / previous.bodyFat;
            const changeWeight = (current.weight - previous.weight) / previous.weight;
            const significant = Math.abs(changeBF) >= this.significanceThreshold || Math.abs(changeWeight) >= this.significanceThreshold;
            changes.push({
                start: previous.date,
                end: current.date,
                changeBodyFat: changeBF,
                changeWeight,
                significant
            });
        }
        return changes;
    }

    #computeEMA(entries) {
        if (entries.length === 0) {return [];}
        let ema = entries[0].bodyFat;
        const emaSeries = [{ date: entries[0].date, value: ema }];
        for (let i = 1; i < entries.length; i++) {
            ema = (entries[i].bodyFat * this.emaAlpha) + (ema * (1 - this.emaAlpha));
            emaSeries.push({ date: entries[i].date, value: Number(ema.toFixed(2)) });
        }
        return emaSeries;
    }

    #detectPlateau(entries) {
        if (entries.length < this.plateauWeeks) {
            return { plateau: false };
        }
        const recent = entries.slice(-this.plateauWeeks);
        const first = recent[0];
        const last = recent[recent.length - 1];
        const changeBF = Math.abs(last.bodyFat - first.bodyFat);
        const changeWeight = Math.abs(last.weight - first.weight);
        const plateau = changeBF < 0.5 && changeWeight < 1;
        return {
            plateau,
            changeBodyFat: changeBF,
            changeWeight,
            start: first.date,
            end: last.date
        };
    }

    #generateRecommendation(summary) {
        if (!summary.latest) {
            return 'Insufficient data to generate recommendations';
        }
        if (summary.plateau.plateau) {
            return 'Plateau detected. Increase training variation or adjust caloric intake.';
        }
        const recentChange = summary.weeklyChanges[summary.weeklyChanges.length - 1];
        if (recentChange && recentChange.significant) {
            if (recentChange.changeBodyFat < 0) {
                return 'Positive body composition trend. Maintain current protocol and reassess in two weeks.';
            }
            return 'Body fat trending upwards. Consider tightening nutrition or increasing conditioning work.';
        }
        return 'Continue monitoring. No significant changes detected.';
    }
}

if (typeof window !== 'undefined') {
    window.BodyProgressTracker = ProgressTracker;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressTracker;
    module.exports.default = ProgressTracker;
}
