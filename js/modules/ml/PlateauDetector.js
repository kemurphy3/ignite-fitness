import TrendAnalyzer from './TrendAnalyzer.js';

/**
 * PlateauDetector - identifies stagnation and change points in training data.
 */
class PlateauDetector {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
        this.trendAnalyzer = options.trendAnalyzer || new TrendAnalyzer(this.logger);
        this.matchWindowMs = options.matchWindowMs || (30 * 60 * 1000);
    }

    /**
     * Detect plateau using statistical features.
     * @param {Array<{timestamp:number,value:number}>} series
     * @returns {{plateau:boolean, confidence:number, reasons:Array<string>, recommendations:Array<string>, changePoint:boolean}}
     */
    detect(series = []) {
        const cleaned = series
            .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
            .sort((a, b) => a.timestamp - b.timestamp);

        if (cleaned.length < 5) {
            return {
                plateau: false,
                confidence: 0,
                reasons: ['Insufficient data'],
                recommendations: [],
                changePoint: false
            };
        }

        const midIndex = Math.floor(cleaned.length * 0.7);
        const historical = cleaned.slice(0, Math.max(midIndex, 3));
        const recent = cleaned.slice(Math.max(cleaned.length - 4, 0));

        const historicalRegression = this.trendAnalyzer.linearRegression(this.toXY(historical));
        const recentRegression = this.trendAnalyzer.linearRegression(this.toXY(recent));

        const historicalSlope = historicalRegression.slope;
        const recentSlope = recentRegression.slope;
        const reasons = [];
        const recommendations = [];

        let plateauScore = 0;

        if (historicalSlope > 0 && recentSlope < historicalSlope * 0.1) {
            plateauScore += 0.4;
            reasons.push('Recent progress slope significantly below historical trend.');
        }

        const rollingSlopes = this.trendAnalyzer.rollingSlopes(this.toXY(cleaned), 4);
        if (rollingSlopes.length > 1) {
            const meanSlope = rollingSlopes.reduce((sum, slope) => sum + slope, 0) / rollingSlopes.length;
            const variance = rollingSlopes.reduce((sum, slope) => sum + Math.pow(slope - meanSlope, 2), 0) / rollingSlopes.length;
            const stdDeviation = Math.sqrt(variance);
            const changePoint = Math.abs(recentSlope - historicalSlope) > 2 * stdDeviation;
            if (changePoint) {
                plateauScore += 0.3;
                reasons.push('Change point detected in progress trend.');
            }
        }

        const recentValues = recent.map(item => item.value);
        const coeffVar = this.trendAnalyzer.coefficientOfVariation(recentValues);
        const durationDays = (cleaned.at(-1).timestamp - cleaned[0].timestamp) / (1000 * 60 * 60 * 24);
        if (coeffVar < 0.05 && durationDays > 14) {
            plateauScore += 0.2;
            reasons.push('Low variability over the last two weeks indicates stagnation.');
        }

        if (plateauScore >= 0.6) {
            recommendations.push('Consider increasing training load by ~10%.');
            recommendations.push('Introduce exercise variation or deload week.');
        }

        return {
            plateau: plateauScore >= 0.6,
            confidence: Number(Math.min(1, plateauScore).toFixed(2)),
            reasons,
            recommendations,
            changePoint: plateauScore >= 0.4
        };
    }

    toXY(series) {
        if (!series.length) {return [];}
        const baseline = series[0].timestamp;
        const dayMs = 1000 * 60 * 60 * 24;
        return series.map(item => ({
            x: (item.timestamp - baseline) / dayMs,
            y: item.value
        }));
    }
}

if (typeof window !== 'undefined') {
    window.PlateauDetector = PlateauDetector;
}

export default PlateauDetector;


