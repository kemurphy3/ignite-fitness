import { describe, it, expect, beforeEach, vi } from 'vitest';
import PersonalAILearner from '../../js/modules/ai/PersonalAILearner.js';
import FeedbackCollector from '../../js/modules/ai/FeedbackCollector.js';
import AdaptiveRecommender from '../../js/modules/ai/AdaptiveRecommender.js';
import ExpertCoordinator from '../../js/modules/ai/ExpertCoordinator.js';

class MemoryStorage {
    constructor() {
        this.store = new Map();
    }
    getItem(key) {
        return this.store.get(key) || null;
    }
    setItem(key, value) {
        this.store.set(key, value);
    }
    removeItem(key) {
        this.store.delete(key);
    }
    clear() {
        this.store.clear();
    }
}

const createLogger = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
});

describe('Personal AI learning stack', () => {
    let storage;

    beforeEach(() => {
        storage = new MemoryStorage();
        global.window = {
            SafeLogger: createLogger(),
            localStorage: storage,
            EventBus: { emit: vi.fn(), TOPICS: {} },
            MemoizedCoordinator: class {
                registerExpert() {}
                clearCaches() {}
                async planToday() { throw new Error('force-fallback'); }
                getStats() { return {}; }
            },
            StrengthCoach: class { propose() { return { blocks: [] }; } },
            SportsCoach: class { propose() { return { blocks: [] }; } },
            PhysioCoach: class { propose() { return { blocks: [] }; } },
            NutritionCoach: class { propose() { return { blocks: [] }; } },
            AestheticsCoach: class { propose() { return { blocks: [] }; } },
            ClimbingCoach: class { propose() { return { blocks: [] }; } },
            WhyThisDecider: class { generateRationales() { return []; } },
            AIDataValidator: { validateContext: ctx => ctx, generateConservativeRecommendations: () => ({ volume: 'low', intensity: 'light', duration: 25 }), generateSafetyFlags: () => [] },
            ErrorAlert: { showExpertFailureAlert: vi.fn(), showErrorAlert: vi.fn() },
            ReadinessInference: {},
            SeasonalPrograms: {},
            CoordinatorContext: {},
            PersonalAILearner,
            FeedbackCollector,
            AdaptiveRecommender
        };
    });

    it('learns preferred exercises using moving averages and regression', () => {
        const learner = new PersonalAILearner({ storage, namespace: 'test.ai' });
        const sessions = [
            { load: 90, exerciseName: 'Back Squat', outcome: 'positive' },
            { load: 95, exerciseName: 'Back Squat', outcome: 'positive' },
            { load: 110, exerciseName: 'Back Squat', outcome: 'positive' },
            { load: 130, exerciseName: 'Back Squat', outcome: 'positive' },
            { load: 140, exerciseName: 'Back Squat', outcome: 'positive' }
        ];
        sessions.forEach(metrics => learner.updateFromSession('user-1', metrics));

        const volume = learner.getVolumeInsights('user-1');
        expect(volume.movingAverage).toBeGreaterThan(110);
        expect(volume.trend).toBeGreaterThan(0);

        const preferred = learner.getPreferredExercises('user-1');
        expect(preferred.length).toBe(1);
        expect(preferred[0].name).toBe('Back Squat');
        expect(preferred[0].preferenceScore).toBeGreaterThan(0.8);
    });

    it('blends feedback confidence with decay', () => {
        const collector = new FeedbackCollector({ storage, namespace: 'test.feedback', decay: 0.9 });
        const result = collector.recordFeedback({
            userId: 'user-2',
            recommendationId: 'rec-1',
            outcome: 'positive',
            previousConfidence: 0.5,
            sessionLoad: 120
        });
        expect(result.confidence).toBeCloseTo(0.55, 2);
        expect(result.successRate).toBeCloseTo(1, 2);
    });

    it('performs Bayesian recommendation with personal weighting', () => {
        const personalLearner = {
            getUserPatterns: vi.fn(() => ({
                exercises: {
                    'Tempo Run': { successRate: 0.9, totalSessions: 6, preferenceScore: 0.82 }
                }
            })),
            getPreferredExercises: vi.fn(() => [{ name: 'Tempo Run', preferenceScore: 0.85 }])
        };

        const recommender = new AdaptiveRecommender({
            personalLearner,
            feedbackCollector: {
                recordFeedback: vi.fn(() => ({ confidence: 0.6, successRate: 0.8 }))
            },
            randomFn: () => 0.5 // avoid exploration
        });

        const { choice, metadata } = recommender.recommend({
            userId: 'user-3',
            candidates: [
                { name: 'Tempo Run', baseRate: 0.65, generalLikelihood: 0.7 },
                { name: 'Easy Spin', baseRate: 0.6, generalLikelihood: 0.65 }
            ],
            baseConfidence: 0.6
        });

        expect(choice?.name).toBe('Tempo Run');
        expect(metadata.posterior).toBeGreaterThan(0.7);
        expect(metadata.personalConfidence).toBeGreaterThan(0.8);
    });

    it('integrates personal AI adjustments into ExpertCoordinator fallback plan', async () => {
        const coordinator = new ExpertCoordinator();
        const learner = coordinator.personalLearner;

        // Build strong preference
        [
            { load: 90, exerciseName: 'Goblet Squat', outcome: 'positive' },
            { load: 100, exerciseName: 'Goblet Squat', outcome: 'positive' },
            { load: 120, exerciseName: 'Goblet Squat', outcome: 'positive' },
            { load: 140, exerciseName: 'Goblet Squat', outcome: 'positive' }
        ].forEach(metrics => learner.updateFromSession('user-4', metrics));

        const plan = {
            mainSets: [
                { name: 'Front Squat', sets: 3 },
                { name: 'Goblet Squat', sets: 3 }
            ],
            accessories: [{ name: 'Plank', sets: 2 }],
            notes: [],
            why: [],
            metadata: { baseConfidence: 0.6 }
        };

        coordinator.adaptiveRecommender.randomFn = () => 0.5;

        coordinator.applyPersonalAIAdjustments(plan, { user: { id: 'user-4' } });

        expect(plan.metadata.personalAI).toBeDefined();
        expect(plan.mainSets[0].name).toBe('Goblet Squat');
        expect(plan.notes.some(note => note.includes('Personal AI weighting'))).toBe(true);
    });
});


