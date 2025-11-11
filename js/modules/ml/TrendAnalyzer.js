/**
 * TrendAnalyzer - applies statistical techniques to fitness progress series.
 * Provides linear regression, moving averages, correlation strength and utilities
 * used by forecasting and plateau detection services.
 */
class TrendAnalyzer {
    constructor(logger = (typeof window !== 'undefined' ? window.SafeLogger : console)) {
        this.logger = logger || console;
    }

    /**
     * Perform linear regression on an ordered series.
     * @param {Array<{x:number,y:number}>} points
     * @returns {{slope:number, intercept:number, r2:number, standardError:number, meanX:number, meanY:number}}
     */
    linearRegression(points = []) {
        const series = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
        const n = series.length;
        if (n < 2) {
            return {
                slope: 0,
                intercept: series[0]?.y ?? 0,
                r2: 0,
                standardError: 0,
                meanX: series[0]?.x ?? 0,
                meanY: series[0]?.y ?? 0
            };
        }

        const meanX = series.reduce((sum, p) => sum + p.x, 0) / n;
        const meanY = series.reduce((sum, p) => sum + p.y, 0) / n;

        let numerator = 0;
        let denominator = 0;
        let ssTot = 0;
        let ssRes = 0;

        series.forEach(point => {
            const xDiff = point.x - meanX;
            const yDiff = point.y - meanY;
            numerator += xDiff * yDiff;
            denominator += xDiff * xDiff;
        });

        const slope = denominator === 0 ? 0 : numerator / denominator;
        const intercept = meanY - slope * meanX;

        series.forEach(point => {
            const predicted = intercept + slope * point.x;
            const yDiff = point.y - meanY;
            const residual = point.y - predicted;
            ssTot += yDiff * yDiff;
            ssRes += residual * residual;
        });

        const r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
        const standardError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : Math.sqrt(ssRes / Math.max(n, 1));

        return { slope, intercept, r2, standardError, meanX, meanY };
    }

    /**
     * Compute exponential moving average.
     * @param {Array<number>} values
     * @param {number} alpha - smoothing factor (0-1).
     * @returns {Array<number>}
     */
    exponentialMovingAverage(values = [], alpha = 0.2) {
        const filtered = values.filter(Number.isFinite);
        if (!filtered.length || alpha <= 0 || alpha >= 1) {
            return filtered;
        }
        const ema = [];
        filtered.forEach((value, index) => {
            if (index === 0) {
                ema.push(value);
            } else {
                const previous = ema[index - 1];
                ema.push(alpha * value + (1 - alpha) * previous);
            }
        });
        return ema;
    }

    /**
     * Compute coefficient of variation.
     * @param {Array<number>} values
     * @returns {number}
     */
    coefficientOfVariation(values = []) {
        const filtered = values.filter(Number.isFinite);
        if (!filtered.length) {return 0;}
        const mean = filtered.reduce((sum, val) => sum + val, 0) / filtered.length;
        if (mean === 0) {return 0;}
        const variance = filtered.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / filtered.length;
        return Math.sqrt(variance) / mean;
    }

    /**
     * Calculate rolling slopes for change point analysis.
     * @param {Array<{x:number,y:number}>} points
     * @param {number} window - number of points per window
     * @returns {Array<number>}
     */
    rollingSlopes(points = [], window = 4) {
        if (points.length < window) {return [];}
        const slopes = [];
        for (let i = 0; i <= points.length - window; i += 1) {
            const slice = points.slice(i, i + window);
            const { slope } = this.linearRegression(slice);
            slopes.push(slope);
        }
        return slopes;
    }
}

if (typeof window !== 'undefined') {
    window.TrendAnalyzer = TrendAnalyzer;
}

export default TrendAnalyzer;


