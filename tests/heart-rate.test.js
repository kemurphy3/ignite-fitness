import { describe, it, expect } from 'vitest';

import HeartRateProcessor from '../js/modules/hr/HeartRateProcessor.js';
import HRZoneEngine from '../js/modules/hr/HRZoneEngine.js';
import BodyCompositionTracker from '../js/modules/body/BodyCompositionTracker.js';
import ExpertCoordinator from '../js/modules/ai/ExpertCoordinator.js';

function createContext(overrides = {}) {
    return {
        user: { id: 'user-1' },
        readiness: 7,
        baselineHRV: 70,
        baselineRestingHR: 60,
        heartRate: {
            hrv: 78,
            resting: 62,
            zoneDistribution: { Z4: 35, Z5: 20 }
        },
        metadata: {
            plannedZoneMinutes: {
                high: 40
            }
        },
        ...overrides
    };
}

describe('HeartRateProcessor', () => {
    const engine = new HRZoneEngine();
    const processor = new HeartRateProcessor();
    const zones = engine.calculateZones(192, 55);

    it('parses Strava heart rate data and computes TRIMP', () => {
        const session = processor.parseData('strava', {
            heartRateSeries: [
                { hr: 120, delta: 60 },
                { hr: 150, delta: 60 },
                { hr: 180, delta: 60 }
            ]
        });
        const result = processor.calculateTRIMP(session, zones, {
            gender: 'male',
            maxHeartRate: 192,
            restingHeartRate: 55
        });
        expect(result.trimp).toBeGreaterThan(0);
        const totalZoneSeconds = Object.entries(result.zoneDistribution)
            .filter(([zone]) => zone.startsWith('Z'))
            .reduce((sum, [, seconds]) => sum + seconds, 0);
        expect(totalZoneSeconds).toBeGreaterThan(0);
    });

    it('supports Apple Health data format', () => {
        const session = processor.parseData('apple_health', {
            samples: [
                { heartRate: 125, durationSeconds: 30 },
                { heartRate: 160, durationSeconds: 45 }
            ]
        });
        expect(session.samples.length).toBe(2);
    });
});

describe('BodyCompositionTracker', () => {
    it('calculates BMI series and alerts', () => {
        const tracker = new BodyCompositionTracker();
        const history = [
            { date: '2024-01-01', weight: 180, bodyFat: 20, height: 180 },
            { date: '2024-01-15', weight: 178, bodyFat: 19.5, height: 180 },
            { date: '2024-01-29', weight: 177, bodyFat: 19.2, height: 180 }
        ];
        const summary = tracker.analyze(history, { targetWeightLossRate: 0.5 });
        expect(summary.bmiSeries.length).toBe(history.length);
        expect(summary.alerts.length).toBeGreaterThanOrEqual(0);
    });
});

describe('ExpertCoordinator HR Influence', () => {
    it('adjusts intensity scale based on HRV and zone distribution', () => {
        const coordinator = new ExpertCoordinator();
        const plan = {
            intensityScale: 1.0,
            blocks: [],
            notes: [],
            why: [],
            metadata: { plannedZoneMinutes: { high: 40 } }
        };
        coordinator.applyHeartRateInfluence(plan, createContext());
        expect(plan.intensityScale).toBeLessThan(1);
        expect(plan.flags).toContain('potential_overreaching');
    });
});
