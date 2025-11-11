import { describe, it, expect } from 'vitest';
import MultiObjectiveOptimizer from '../../js/modules/planning/MultiObjectiveOptimizer.js';
import InterferenceEngine from '../../js/modules/planning/InterferenceEngine.js';
import PeriodizationEngine from '../../js/modules/planning/PeriodizationEngine.js';
import ProgressionCalculator from '../../js/modules/planning/ProgressionCalculator.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('MultiObjectiveOptimizer', () => {
    it('produces Pareto-efficient plans for competing goals', () => {
        const optimizer = new MultiObjectiveOptimizer({ populationSize: 40, maxGenerations: 40 });
        const goals = [
            { type: 'strength', priority: 1 },
            { type: 'endurance', priority: 1 }
        ];
        const constraints = {
            maxWeeklySessions: 8,
            maxDailyDuration: 85,
            minRecoveryHours: 10,
            fatigueCeiling: 0.7
        };
        const summary = optimizer.optimizeTrainingPlan(goals, constraints, 28);
        expect(summary.schedule.length).toBeGreaterThan(0);
        expect(summary.objectiveScores.length).toBe(goals.length);
        expect(summary.loadDistribution.strength).toBeGreaterThan(0);
        expect(summary.loadDistribution.endurance).toBeGreaterThan(0);
        const simplePopulation = [
            { objectives: [5, 2] },
            { objectives: [4, 4] },
            { objectives: [2, 6] }
        ];
        simplePopulation.forEach(individual => {
            individual.rank = 0;
            individual.crowdingDistance = 0;
        });
        const fronts = optimizer.fastNonDominatedSort(simplePopulation);
        expect(fronts[0]).toHaveLength(3);
    });
});

describe('InterferenceEngine', () => {
    it('detects high interference in concurrent modalities', () => {
        const engine = new InterferenceEngine();
        const baseTime = Date.now();
        const sessionPlan = [
            {
                timestamp: baseTime,
                modalities: ['strength', 'endurance'],
                intensity: 0.85,
                duration: 70
            },
            {
                timestamp: baseTime + (2 * DAY_MS),
                modalities: ['endurance'],
                intensity: 0.75,
                duration: 60
            }
        ];
        const result = engine.calculateInterference(sessionPlan, {
            cortisolBaseline: 0.45,
            testosteroneBaseline: 0.65,
            glycogenStatus: 0.7
        });
        expect(result.average.molecular).toBeGreaterThan(0.15);
        expect(result.average.total).toBeLessThanOrEqual(1);
        expect(result.sessions[0].total).toBeGreaterThan(result.sessions[1].total);
    });
});

describe('PeriodizationEngine', () => {
    it('builds multi-phase plans with progressive intensity', () => {
        const engine = new PeriodizationEngine();
        const goals = [
            { type: 'strength' },
            { type: 'endurance' }
        ];
        const plan = engine.designPeriodizationPlan(goals, {
            sessionsPerWeek: 5,
            timeFrame: 12,
            fatigueSensitivity: 0.55
        });
        expect(plan.phases.length).toBeGreaterThanOrEqual(3);
        const accumulationIntensity = plan.phases[0].weeklyPlan.reduce((sum, session) => sum + session.intensity, 0) / plan.phases[0].weeklyPlan.length;
        const intensificationIntensity = plan.phases[1].weeklyPlan.reduce((sum, session) => sum + session.intensity, 0) / plan.phases[1].weeklyPlan.length;
        expect(intensificationIntensity).toBeGreaterThan(accumulationIntensity);
        expect(plan.performanceScore).toBeGreaterThan(0);
    });
});

describe('ProgressionCalculator', () => {
    it('generates progression models and schedules deloads', () => {
        const calculator = new ProgressionCalculator({
            fatigueThreshold: 0.6,
            deloadFraction: 0.5
        });
        const phase = { weeks: 8, emphasis: [{ key: 'strength', value: 0.6 }] };
        const weeklyPlan = Array.from({ length: 5 }, (_, day) => ({
            day,
            sessionLoad: 120 + (day * 10),
            intensity: 0.75,
            primaryFocus: 'strength',
            modalities: ['strength']
        }));
        const model = calculator.createProgressionModel(phase, weeklyPlan);
        expect(model.doubleProgression[0].weightProgression[0]).toBeLessThan(model.doubleProgression[0].weightProgression[3]);
        expect(model.deloadWeeks.length).toBeGreaterThan(0);
        expect(model.autoRegulation[0].loadAdjustment).toBeLessThanOrEqual(0);
    });
});


