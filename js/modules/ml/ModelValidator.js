import PredictionEngine from './PredictionEngine.js';
import FeatureExtractor from './FeatureExtractor.js';

/**
 * ModelValidator - provides time-series cross validation, backtesting,
 * drift detection, and domain-specific accuracy metrics.
 */
class ModelValidator {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
        this.predictionEngine = options.predictionEngine || new PredictionEngine(options.predictionOptions || {});
        this.featureExtractor = options.featureExtractor || new FeatureExtractor({});
        this.requiredAccuracy = options.requiredAccuracy ?? 0.75;
    }

    timeSeriesSplit(series, splits = 3, minTrainSize = null) {
        const values = this.predictionEngine.preprocessSeries(series);
        const total = values.length;
        const minSize = minTrainSize ?? this.predictionEngine.minDataPoints;
        const foldSize = Math.floor((total - minSize) / (splits + 1));
        if (foldSize <= 0) {
            throw new Error('Insufficient data for time series split');
        }

        const folds = [];
        for (let i = 0; i < splits; i++) {
            const trainEnd = minSize + (i * foldSize);
            const testEnd = trainEnd + foldSize;
            const training = values.slice(0, trainEnd);
            const testing = values.slice(trainEnd, testEnd);
            folds.push({ training, testing });
        }
        return folds;
    }

    backtest(series, horizon = 7) {
        const folds = this.timeSeriesSplit(series, 3);
        const results = [];
        folds.forEach(({ training, testing }) => {
            const forecasts = this.predictionEngine.predictPerformance(training, horizon);
            const accuracy = this.predictionEngine.computeDirectionalAccuracy([...training, ...testing], forecasts);
            const mape = this.predictionEngine.calculateMAPE(testing, forecasts.slice(0, testing.length));
            results.push({ accuracy, mape, trainingSize: training.length, testingSize: testing.length });
        });
        const avgAccuracy = results.reduce((sum, result) => sum + result.accuracy, 0) / results.length;
        return { folds: results, averageAccuracy: avgAccuracy, accuracy: avgAccuracy };
    }

    evaluateFeatureCorrelation(series, metricKeys) {
        const features = this.featureExtractor.addRollingStatistics(series, metricKeys);
        const correlations = metricKeys.map(key => {
            const paired = features.map(entry => ({
                load: entry[`${key}_ma_${this.featureExtractor.windows[0]}`],
                performance: entry[key]
            }));
            const result = this.featureExtractor.correlationAnalysis(paired, 'load', 'performance');
            return { key, ...result };
        });
        return correlations;
    }

    detectDrift(history, recent, metricKey) {
        const historyFeature = this.featureExtractor.addRollingStatistics(history, [metricKey]);
        const recentFeature = this.featureExtractor.addRollingStatistics(recent, [metricKey]);
        const lastHistory = historyFeature.at(-1)[`${metricKey}_ma_${this.featureExtractor.windows[0]}`];
        const lastRecent = recentFeature.at(-1)[`${metricKey}_ma_${this.featureExtractor.windows[0]}`];
        const driftMagnitude = Math.abs(lastRecent - lastHistory);
        const threshold = Math.abs(lastHistory) * 0.15; // 15% shift
        return {
            driftDetected: driftMagnitude > threshold,
            driftMagnitude,
            threshold
        };
    }

    directionalAccuracy(series, horizon = 7) {
        const values = this.predictionEngine.preprocessSeries(series);
        const windowSize = this.predictionEngine.minDataPoints;
        const comparisons = [];
        for (let start = windowSize; start + horizon <= values.length; start += horizon) {
            const training = values.slice(0, start);
            const actual = values.slice(start, start + horizon);
            const forecasts = this.predictionEngine.predictPerformance(training, horizon);
            const accuracy = this.predictionEngine.computeDirectionalAccuracy([...training, ...actual], forecasts);
            comparisons.push(accuracy);
        }
        const average = comparisons.reduce((sum, value) => sum + value, 0) / (comparisons.length || 1);
        return { comparisons, average };
    }

    meetsDirectionalAccuracy(series, horizon = 7) {
        const { average } = this.directionalAccuracy(series, horizon);
        return average >= this.requiredAccuracy;
    }
}

if (typeof window !== 'undefined') {
    window.ModelValidator = ModelValidator;
}

export default ModelValidator;


