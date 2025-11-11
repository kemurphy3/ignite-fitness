import { describe, it, expect } from 'vitest';
import PredictionEngine from '../../js/modules/ml/PredictionEngine.js';
import FeatureExtractor from '../../js/modules/ml/FeatureExtractor.js';
import AdaptationClassifier from '../../js/modules/ml/AdaptationClassifier.js';
import ModelValidator from '../../js/modules/ml/ModelValidator.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const buildSeasonalSeries = (length = 60) => {
    const points = [];
    const start = Date.now() - (length * DAY_MS);
    for (let i = 0; i < length; i++) {
        const baseline = 150 + (i * 2.5);
        const seasonal = Math.sin((2 * Math.PI * i) / 14);
        const noise = Math.sin(i * 0.2) * 0.3;
        points.push({ date: new Date(start + (i * DAY_MS)).toISOString(), value: baseline + seasonal + noise });
    }
    return points;
};

describe('PredictionEngine', () => {
    it('achieves high directional accuracy on synthetic trend', () => {
        const engine = new PredictionEngine({ seasonLength: 7, alpha: 0.35, beta: 0.12, gamma: 0.1 });
        const series = buildSeasonalSeries(90);
        const backtest = engine.backtestPerformance(series, 7);
        expect(backtest.accuracy).toBeGreaterThanOrEqual(0.75);
        const forecast = engine.predictPerformance(series, 14);
        expect(forecast).toHaveLength(14);
        forecast.forEach(entry => {
            expect(Number.isFinite(entry.value)).toBe(true);
            expect(entry.upper_ci).toBeGreaterThan(entry.lower_ci);
        });
    });
});

describe('FeatureExtractor', () => {
    it('computes rolling statistics and significant correlations', () => {
        const extractor = new FeatureExtractor({ windows: [7] });
        const series = buildSeasonalSeries(50).map(point => ({
            ...point,
            load: point.value * 1.2,
            performance: point.value
        }));
        const features = extractor.addRollingStatistics(series, ['load', 'performance']);
        expect(features[features.length - 1]).toHaveProperty('load_ma_7');
        const correlations = extractor.correlationAnalysis(series, 'load', 'performance');
        expect(correlations.correlation).toBeGreaterThan(0.9);
        expect(correlations.pValue).toBeLessThan(0.05);
    });
});

describe('AdaptationClassifier', () => {
    it('separates adaptation clusters with strong silhouette score', () => {
        const classifier = new AdaptationClassifier({ k: 3, maxIterations: 200 });
        const dataset = [];
        for (let i = 0; i < 30; i++) {
            dataset.push({ load: 40 + (Math.random() * 2), performance: 45 + (Math.random() * 2) });
            dataset.push({ load: 120 + (Math.random() * 3), performance: 118 + (Math.random() * 3) });
            dataset.push({ load: 220 + (Math.random() * 3), performance: 210 + (Math.random() * 3) });
        }
        const result = classifier.runKMeans(dataset, ['load', 'performance']);
        expect(result.silhouette).toBeGreaterThan(0.6);

        const logisticData = dataset.map((entry, index) => ({
            ...entry,
            plateau: index % 2 === 0 ? 1 : 0
        }));
        const logistic = classifier.trainLogisticRegression(logisticData, 'plateau', ['load', 'performance']);
        logistic.weights.forEach(weight => expect(Number.isFinite(weight)).toBe(true));

        const tree = classifier.decisionTreeClassifier(logisticData, 'plateau', ['load', 'performance'], 2);
        expect(tree).toHaveProperty('type');

        const forest = classifier.randomForest(logisticData, 'plateau', ['load', 'performance'], 3, 2);
        const prediction = classifier.predictRandomForest(forest, { load: 120, performance: 125 });
        expect([0, 1, '0', '1']).toContain(prediction);
    });
});

describe('ModelValidator', () => {
    it('reports directional accuracy above threshold and detects drift', () => {
        const series = buildSeasonalSeries(80);
        const validator = new ModelValidator({ requiredAccuracy: 0.75 });
        const backtest = validator.backtest(series, 7);
        expect(backtest.accuracy).toBeGreaterThan(0.7);

        const history = series.slice(0, 40).map(point => ({
            date: point.date,
            weight: point.value,
            load: point.value * 1.1
        }));
        const recent = series.slice(40).map(point => ({
            date: point.date,
            weight: point.value * 1.05,
            load: point.value * 1.2
        }));
        const drift = validator.detectDrift(history, recent, 'weight');
        expect(typeof drift.driftDetected).toBe('boolean');
        expect(Number.isFinite(drift.driftMagnitude)).toBe(true);
    });
});


