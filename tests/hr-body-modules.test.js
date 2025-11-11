import HRZoneEngine from '../js/modules/hr/HRZoneEngine.js';
import ZoneAnalyzer from '../js/modules/hr/ZoneAnalyzer.js';
import CompositionCalculator from '../js/modules/body/CompositionCalculator.js';
import ProgressTracker from '../js/modules/body/ProgressTracker.js';

import { describe, it, expect } from 'vitest';

describe('HRZoneEngine', () => {
    it('calculates Karvonen zones correctly', () => {
        const engine = new HRZoneEngine();
        const zones = engine.calculateZones(190, 55, 'karvonen', { gender: 'female' });
        expect(zones.Z1.min).toBeLessThan(zones.Z1.max);
        expect(zones.Z5.max).toBe(190);
    });

    it('estimates max heart rate with gender adjustments', () => {
        const engine = new HRZoneEngine();
        const male = engine.estimateMaxHeartRate(35, 'male');
        const female = engine.estimateMaxHeartRate(35, 'female');
        expect(female).toBeLessThan(male);
    });
});

describe('ZoneAnalyzer', () => {
    const engine = new HRZoneEngine();
    const zones = engine.calculateZones(190, 55);

    it('computes time in zones and detects anomalies', () => {
        const analyzer = new ZoneAnalyzer();
        const series = [
            { hr: 110, delta: 30, time: 0 },
            { hr: 130, delta: 30, time: 30 },
            { hr: 170, delta: 30, time: 60 },
            { hr: 210, delta: 30, time: 90 }
        ];
        const result = analyzer.computeTimeInZones(series, zones);
        expect(Object.values(result.totals).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    });

    it('detects drift events', () => {
        const analyzer = new ZoneAnalyzer({ driftWindow: 2, driftThreshold: 5 });
        const series = [
            { hr: 120, time: 0, delta: 1 },
            { hr: 122, time: 10, delta: 1 },
            { hr: 135, time: 20, delta: 1 },
            { hr: 140, time: 30, delta: 1 }
        ];
        const drift = analyzer.detectDrift(series);
        expect(drift.driftEvents.length).toBeGreaterThan(0);
    });
});

describe('CompositionCalculator', () => {
    const calculator = new CompositionCalculator();

    it('estimates body fat with DEXA alignment', () => {
        const result = calculator.estimateBodyFat({
            gender: 'male',
            age: 32,
            height: 180,
            weight: 185,
            neck: 40,
            abdomen: 85,
            ethnicity: 'default'
        });
        expect(result.value).toBeGreaterThan(5);
        expect(result.value).toBeLessThan(40);
    });

    it('estimates muscle mass using lean mass calculations', () => {
        const result = calculator.estimateMuscleMass({
            gender: 'female',
            age: 28,
            height: 165,
            weight: 140,
            neck: 33,
            waist: 70,
            hip: 92,
            ethnicity: 'asian'
        });
        expect(result.valueKg).toBeGreaterThan(20);
    });

    it('estimates bone density', () => {
        const result = calculator.estimateBoneDensity({
            gender: 'male',
            age: 45,
            height: 178,
            weight: 190,
            neck: 41,
            abdomen: 90,
            ethnicity: 'black'
        });
        expect(result.density).toBeGreaterThan(1);
    });
});

describe('ProgressTracker', () => {
    const tracker = new ProgressTracker();
    const history = [
        { date: '2024-01-01', bodyFat: 18, weight: 185 },
        { date: '2024-01-08', bodyFat: 17.5, weight: 183 },
        { date: '2024-01-15', bodyFat: 17.2, weight: 182 },
        { date: '2024-01-22', bodyFat: 17.1, weight: 181 }
    ];

    it('computes weekly changes and EMA', () => {
        const summary = tracker.analyze(history);
        expect(summary.weeklyChanges.length).toBeGreaterThan(0);
        expect(summary.ema.length).toBe(history.length);
    });

    it('detects plateau when changes are minimal', () => {
        const plateauHistory = history.map(entry => ({ ...entry, bodyFat: 18, weight: 185 }));
        const summary = tracker.analyze(plateauHistory);
        expect(summary.plateau.plateau).toBe(true);
    });
});
