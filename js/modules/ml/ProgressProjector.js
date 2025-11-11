import TrendAnalyzer from './TrendAnalyzer.js';

/**
 * ProgressProjector - produces forward-looking projections with confidence bands.
 */
class ProgressProjector {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
        this.trendAnalyzer = options.trendAnalyzer || new TrendAnalyzer(this.logger);
    }

    /**
     * Project future values based on regression.
     * @param {Array<{timestamp:number,value:number}>} series
     * @param {Object} options
     * @param {number} options.steps - number of forward steps
     * @param {number} options.intervalDays - days between projections
     * @returns {{baseline:Array<{timestamp:number,value:number}>, upper:Array<{timestamp:number,value:number}>, lower:Array<{timestamp:number,value:number}>, slope:number, intercept:number, standardError:number}}
     */
    project(series = [], options = {}) {
        const cleaned = series
            .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
            .sort((a, b) => a.timestamp - b.timestamp);
        if (cleaned.length < 2) {
            return {
                baseline: cleaned,
                upper: cleaned,
                lower: cleaned,
                slope: 0,
                intercept: cleaned[0]?.value ?? 0,
                standardError: 0
            };
        }

        const { steps = 4, intervalDays = 7 } = options;
        const xy = this.toXY(cleaned);
        const regression = this.trendAnalyzer.linearRegression(xy);
        const dayMs = 1000 * 60 * 60 * 24;
        const lastTimestamp = cleaned.at(-1).timestamp;

        const baseline = [];
        const upper = [];
        const lower = [];

        for (let step = 1; step <= steps; step += 1) {
            const futureX = xy.at(-1).x + step * intervalDays;
            const futureTimestamp = lastTimestamp + step * intervalDays * dayMs;
            const predicted = regression.intercept + regression.slope * futureX;
            const margin = 1.96 * regression.standardError;
            baseline.push({ timestamp: futureTimestamp, value: predicted });
            upper.push({ timestamp: futureTimestamp, value: predicted + margin });
            lower.push({ timestamp: futureTimestamp, value: predicted - margin });
        }

        return {
            baseline,
            upper,
            lower,
            slope: regression.slope,
            intercept: regression.intercept,
            standardError: regression.standardError,
            r2: regression.r2
        };
    }

    toXY(series) {
        const baseline = series[0].timestamp;
        const dayMs = 1000 * 60 * 60 * 24;
        return series.map(item => ({
            x: (item.timestamp - baseline) / dayMs,
            y: item.value
        }));
    }
}

if (typeof window !== 'undefined') {
    window.ProgressProjector = ProgressProjector;
}

export default ProgressProjector;


