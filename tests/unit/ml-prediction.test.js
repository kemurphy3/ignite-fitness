import { describe, it, expect } from 'vitest';
import TrendAnalyzer from '../../js/modules/ml/TrendAnalyzer.js';
import PerformancePredictor from '../../js/modules/ml/PerformancePredictor.js';
import PlateauDetector from '../../js/modules/ml/PlateauDetector.js';
import ProgressProjector from '../../js/modules/ml/ProgressProjector.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('TrendAnalyzer', () => {
  it('computes linear regression and correlation strength', () => {
    const analyzer = new TrendAnalyzer();
    const points = [
      { x: 0, y: 2 },
      { x: 1, y: 4 },
      { x: 2, y: 6 },
      { x: 3, y: 8 },
    ];
    const result = analyzer.linearRegression(points);
    expect(result.slope).toBeCloseTo(2, 5);
    expect(result.intercept).toBeCloseTo(2, 5);
    expect(result.r2).toBeCloseTo(1, 5);
  });

  it('computes exponential moving average', () => {
    const analyzer = new TrendAnalyzer();
    const ema = analyzer.exponentialMovingAverage([10, 20, 30, 40], 0.5);
    expect(ema).toEqual([10, 15, 22.5, 31.25]);
  });
});

describe('PlateauDetector', () => {
  it('detects plateau when recent slope collapses', () => {
    const detector = new PlateauDetector();
    const start = Date.now() - 10 * DAY_MS;
    const series = [];
    for (let i = 0; i < 6; i += 1) {
      series.push({ timestamp: start + i * DAY_MS, value: 50 + i * 5 });
    }
    for (let i = 6; i < 10; i += 1) {
      series.push({ timestamp: start + i * DAY_MS, value: 80 });
    }
    const result = detector.detect(series);
    expect(result.plateau).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe('PerformancePredictor', () => {
  it('estimates goal timeline', () => {
    const predictor = new PerformancePredictor();
    const timeline = predictor.estimateGoalTimeline(100, 150, 10);
    expect(timeline.weeks).toBeCloseTo(5, 5);
    expect(timeline.days).toBeCloseTo(35, 5);
  });

  it('predicts endurance and strength metrics', () => {
    const predictor = new PerformancePredictor();
    const projected5k = predictor.predict5kTime(1500, 0.01, 4);
    expect(projected5k).toBeCloseTo(1500 * Math.pow(0.99, 4), 4);

    const strength = predictor.predictStrengthMax(200, 0.05, 1.1, 0.02);
    expect(strength).toBeCloseTo(200 * (1 + 0.05 * 1.1 * 0.02), 6);

    const weight = predictor.predictWeightChange(180, -0.5, 6);
    expect(weight).toBeCloseTo(177, 5);
  });
});

describe('ProgressProjector', () => {
  it('projects future values with confidence intervals', () => {
    const projector = new ProgressProjector();
    const start = Date.now() - 5 * 7 * DAY_MS;
    const series = [];
    for (let i = 0; i < 6; i += 1) {
      const noise = i % 2 === 0 ? 2 : -2;
      series.push({
        timestamp: start + i * 7 * DAY_MS,
        value: 100 + i * 20 + noise,
      });
    }

    const projection = projector.project(series, { steps: 2, intervalDays: 7 });
    expect(projection.baseline.length).toBe(2);
    expect(projection.upper.length).toBe(2);
    expect(projection.lower.length).toBe(2);

    const firstForecast = projection.baseline[0].value;
    expect(firstForecast).toBeGreaterThan(series.at(-1).value);
    expect(projection.upper[0].value).toBeGreaterThan(firstForecast);
    expect(projection.lower[0].value).toBeLessThan(firstForecast);
    expect(projection.r2).toBeGreaterThan(0.8);
  });
});
