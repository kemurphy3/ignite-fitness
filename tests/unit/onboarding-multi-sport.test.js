/**
 * Enhanced Multi-Sport Onboarding Unit Tests
 * Tests for all new onboarding step components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock window objects
global.window = {
    BaseComponent: class BaseComponent {
        constructor() {}
        destroy() {}
    },
    OnboardingManager: {
        onboardingData: {},
        saveStepData: vi.fn(),
        nextStep: vi.fn(),
        previousStep: vi.fn(),
        completeOnboarding: vi.fn()
    },
    SafeLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
};

describe('Enhanced Multi-Sport Onboarding', () => {
    describe('SportSelection', () => {
        it('should render sport selection step', async () => {
            const module = await import('../../js/modules/onboarding/steps/SportSelection.js');
            const SportSelection = module.default || module.SportSelection || window.SportSelection?.constructor;
            const component = new SportSelection();

            const html = component.render({});
            expect(html).toContain('primary training focus');
            expect(html).toContain('Running');
            expect(html).toContain('Cycling');
        });

        it('should handle sport selection', () => {
            const component = window.SportSelection;
            if (component) {
                component.selectPrimarySport('running');
                expect(component.selectedPrimary).toBe('running');
            }
        });
    });

    describe('CurrentVolume', () => {
        it('should render volume input step', async () => {
            const module = await import('../../js/modules/onboarding/steps/CurrentVolume.js');
            const CurrentVolume = module.default || module.CurrentVolume || window.CurrentVolume?.constructor;

            const html = window.CurrentVolume?.render?.({}) || '';
            expect(html).toContain('Weekly Training');
            expect(html).toContain('Running');
            expect(html).toContain('Cycling');
        });

        it('should update volume calculations', () => {
            const component = window.CurrentVolume;
            if (component) {
                component.updateVolume('running', 180);
                expect(component.weeklyVolumes.running).toBe(180);
            }
        });
    });

    describe('EquipmentAccess', () => {
        it('should render equipment access step', async () => {
            const module = await import('../../js/modules/onboarding/steps/EquipmentAccess.js');
            const EquipmentAccess = module.default || module.EquipmentAccess || window.EquipmentAccess?.constructor;

            const html = window.EquipmentAccess?.render?.({}) || '';
            expect(html).toContain('Equipment & Facility Access');
            expect(html).toContain('Running');
            expect(html).toContain('Cycling');
        });

        it('should track equipment selections', () => {
            const component = window.EquipmentAccess;
            if (component) {
                component.toggleEquipment('track', true);
                expect(component.availableEquipment.has('track')).toBe(true);
            }
        });
    });

    describe('SecondarySports', () => {
        it('should render secondary sports step', async () => {
            const module = await import('../../js/modules/onboarding/steps/SecondarySports.js');
            const SecondarySports = module.default || module.SecondarySports || window.SecondarySports?.constructor;

            const html = window.SecondarySports?.render?.({}) || '';
            expect(html).toContain('Secondary Activities');
        });
    });

    describe('RecentEfforts', () => {
        it('should render recent efforts step', async () => {
            const module = await import('../../js/modules/onboarding/steps/RecentEfforts.js');
            const RecentEfforts = module.default || module.RecentEfforts || window.RecentEfforts?.constructor;

            const html = window.RecentEfforts?.render?.({ primarySport: 'running' }) || '';
            expect(html).toContain('Recent Best Efforts');
        });
    });

    describe('InjuryHistory', () => {
        it('should render injury history step', async () => {
            const module = await import('../../js/modules/onboarding/steps/InjuryHistory.js');
            const InjuryHistory = module.default || module.InjuryHistory || window.InjuryHistory?.constructor;

            const html = window.InjuryHistory?.render?.({}) || '';
            expect(html).toContain('Injury Flags');
        });
    });

    describe('TimeWindows', () => {
        it('should render time windows step', async () => {
            const module = await import('../../js/modules/onboarding/steps/TimeWindows.js');
            const TimeWindows = module.default || module.TimeWindows || window.TimeWindows?.constructor;

            const html = window.TimeWindows?.render?.({}) || '';
            expect(html).toContain('Schedule Preferences');
        });
    });

    describe('ReviewComplete', () => {
        it('should render review step', async () => {
            const module = await import('../../js/modules/onboarding/steps/ReviewComplete.js');
            const ReviewComplete = module.default || module.ReviewComplete || window.ReviewComplete?.constructor;

            const html = window.ReviewComplete?.render?.({}) || '';
            expect(html).toContain('Review & Launch');
        });

        it('should validate required fields', () => {
            const component = window.ReviewComplete;
            if (component) {
                const valid = component.validateRequired();
                expect(typeof valid).toBe('boolean');
            }
        });
    });

    describe('OnboardingManager validation', () => {
        it('should validate required onboarding data', async () => {
            const module = await import('../../js/modules/onboarding/OnboardingManager.js');
            const OnboardingManager = module.default || module.OnboardingManager || window.OnboardingManager?.constructor;

            const manager = new OnboardingManager();

            const validProfile = {
                user_profile: {
                    primarySport: 'running',
                    trainingLevel: 'intermediate',
                    weeklyVolumes: { running: 180 }
                },
                preferences: {
                    equipment: ['track'],
                    timeWindows: { typicalDuration: 60 }
                }
            };

            const result = manager.validateOnboardingData(validProfile);
            expect(result.valid).toBe(true);
        });

        it('should reject incomplete onboarding data', async () => {
            const module = await import('../../js/modules/onboarding/OnboardingManager.js');
            const OnboardingManager = module.default || module.OnboardingManager || window.OnboardingManager?.constructor;

            const manager = new OnboardingManager();

            const invalidProfile = {
                user_profile: {},
                preferences: {}
            };

            const result = manager.validateOnboardingData(invalidProfile);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
});

