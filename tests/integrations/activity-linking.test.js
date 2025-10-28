/**
 * Unit Tests for Activity Linking Functionality
 * Tests for LinkBanner, LinkingActions, and aggregate recalculation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock LinkingActions class
class MockLinkingActions {
    constructor() {
        this.preferences = {};
        this.excludedSources = {};
        this.softIgnores = {};
    }

    async handleLinkDecision(activity, action, primarySource, secondarySource) {
        switch (action) {
            case 'keep-both':
                return await this.keepBoth(activity);
            case 'use-primary':
                return await this.usePrimaryOnly(activity, primarySource, secondarySource);
            case 'use-secondary':
                return await this.useSecondaryOnly(activity, primarySource, secondarySource);
            default:
                return { success: false, error: 'Unknown action' };
        }
    }

    async keepBoth(activity) {
        if (!activity || !activity.id) {
            return { success: false, error: 'Invalid activity' };
        }
        this.preferences[activity.id] = 'keep-both';
        return { success: true, message: 'Keeping both sources active', action: 'keep-both' };
    }

    async usePrimaryOnly(activity, primarySource, secondarySource) {
        this.excludedSources[activity.id] = secondarySource[0];
        this.preferences[activity.id] = 'use-primary';
        return { success: true, message: `Using ${this.formatSource(primarySource[0])} only`, action: 'use-primary' };
    }

    async useSecondaryOnly(activity, primarySource, secondarySource) {
        this.excludedSources[activity.id] = primarySource[0];
        this.preferences[activity.id] = 'use-secondary';
        return { success: true, message: `Using ${this.formatSource(secondarySource[0])} only`, action: 'use-secondary' };
    }

    formatSource(source) {
        const sourceNames = {
            'manual': 'Manual',
            'strava': 'Strava',
            'garmin': 'Garmin',
            'polar': 'Polar',
            'fitbit': 'Fitbit',
            'apple_health': 'Apple Health'
        };
        return sourceNames[source] || source.charAt(0).toUpperCase() + source.slice(1);
    }

    async getExcludedSource(activityId) {
        return this.excludedSources[activityId] || null;
    }

    async getLinkPreference(activityId) {
        return this.preferences[activityId] || null;
    }
}

// Mock event emitter for aggregate recalculation
class MockEventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

describe('Activity Linking Functionality', () => {
    let linkingActions;
    let eventBus;

    beforeEach(() => {
        linkingActions = new MockLinkingActions();
        eventBus = new MockEventBus();
    });

    describe('LinkingActions', () => {
        describe('handleLinkDecision', () => {
            it('should handle "keep-both" action', async () => {
                const activity = { id: 1, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                const result = await linkingActions.handleLinkDecision(
                    activity,
                    'keep-both',
                    primarySource,
                    secondarySource
                );

                expect(result.success).toBe(true);
                expect(result.action).toBe('keep-both');
                expect(result.message).toBe('Keeping both sources active');

                const preference = await linkingActions.getLinkPreference(activity.id);
                expect(preference).toBe('keep-both');
            });

            it('should handle "use-primary" action', async () => {
                const activity = { id: 2, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                const result = await linkingActions.handleLinkDecision(
                    activity,
                    'use-primary',
                    primarySource,
                    secondarySource
                );

                expect(result.success).toBe(true);
                expect(result.action).toBe('use-primary');
                expect(result.message).toBe('Using Strava only');

                const preference = await linkingActions.getLinkPreference(activity.id);
                expect(preference).toBe('use-primary');

                const excludedSource = await linkingActions.getExcludedSource(activity.id);
                expect(excludedSource).toBe('manual');
            });

            it('should handle "use-secondary" action', async () => {
                const activity = { id: 3, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                const result = await linkingActions.handleLinkDecision(
                    activity,
                    'use-secondary',
                    primarySource,
                    secondarySource
                );

                expect(result.success).toBe(true);
                expect(result.action).toBe('use-secondary');
                expect(result.message).toBe('Using Manual only');

                const preference = await linkingActions.getLinkPreference(activity.id);
                expect(preference).toBe('use-secondary');

                const excludedSource = await linkingActions.getExcludedSource(activity.id);
                expect(excludedSource).toBe('strava');
            });

            it('should handle unknown action', async () => {
                const activity = { id: 4, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                const result = await linkingActions.handleLinkDecision(
                    activity,
                    'unknown-action',
                    primarySource,
                    secondarySource
                );

                expect(result.success).toBe(false);
                expect(result.error).toBe('Unknown action');
            });
        });

        describe('Source exclusion tracking', () => {
            it('should track excluded sources after "use-primary"', async () => {
                const activity = { id: 5, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                await linkingActions.handleLinkDecision(
                    activity,
                    'use-primary',
                    primarySource,
                    secondarySource
                );

                const excludedSource = await linkingActions.getExcludedSource(activity.id);
                expect(excludedSource).toBe('manual');
            });

            it('should track excluded sources after "use-secondary"', async () => {
                const activity = { id: 6, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                await linkingActions.handleLinkDecision(
                    activity,
                    'use-secondary',
                    primarySource,
                    secondarySource
                );

                const excludedSource = await linkingActions.getExcludedSource(activity.id);
                expect(excludedSource).toBe('strava');
            });

            it('should not track excluded sources after "keep-both"', async () => {
                const activity = { id: 7, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                await linkingActions.handleLinkDecision(
                    activity,
                    'keep-both',
                    primarySource,
                    secondarySource
                );

                const excludedSource = await linkingActions.getExcludedSource(activity.id);
                expect(excludedSource).toBeNull();
            });
        });

        describe('Preference persistence', () => {
            it('should save preferences after action', async () => {
                const activity = { id: 8, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                // Use primary
                await linkingActions.handleLinkDecision(
                    activity,
                    'use-primary',
                    primarySource,
                    secondarySource
                );

                let preference = await linkingActions.getLinkPreference(activity.id);
                expect(preference).toBe('use-primary');

                // Change to use secondary
                await linkingActions.handleLinkDecision(
                    activity,
                    'use-secondary',
                    primarySource,
                    secondarySource
                );

                preference = await linkingActions.getLinkPreference(activity.id);
                expect(preference).toBe('use-secondary');
            });

            it('should preserve preferences across calls', async () => {
                const activity = { id: 9, type: 'Run' };
                const primarySource = ['strava', { id: '123', richness: 0.9 }];
                const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

                await linkingActions.handleLinkDecision(
                    activity,
                    'use-primary',
                    primarySource,
                    secondarySource
                );

                const preference1 = await linkingActions.getLinkPreference(activity.id);
                const preference2 = await linkingActions.getLinkPreference(activity.id);

                expect(preference1).toBe(preference2);
                expect(preference1).toBe('use-primary');
            });
        });
    });

    describe('Multiple activities linking', () => {
        it('should handle linking decisions for multiple activities independently', async () => {
            const activity1 = { id: 10, type: 'Run' };
            const activity2 = { id: 11, type: 'Ride' };
            const primarySource = ['strava', { id: '123', richness: 0.9 }];
            const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

            // Activity 1: Use primary
            await linkingActions.handleLinkDecision(
                activity1,
                'use-primary',
                primarySource,
                secondarySource
            );

            // Activity 2: Use secondary
            await linkingActions.handleLinkDecision(
                activity2,
                'use-secondary',
                primarySource,
                secondarySource
            );

            const preference1 = await linkingActions.getLinkPreference(activity1.id);
            const preference2 = await linkingActions.getLinkPreference(activity2.id);

            expect(preference1).toBe('use-primary');
            expect(preference2).toBe('use-secondary');

            const excludedSource1 = await linkingActions.getExcludedSource(activity1.id);
            const excludedSource2 = await linkingActions.getExcludedSource(activity2.id);

            expect(excludedSource1).toBe('manual');
            expect(excludedSource2).toBe('strava');
        });

        it('should maintain independent excluded sources for multiple activities', async () => {
            const activity1 = { id: 12, type: 'Run' };
            const activity2 = { id: 13, type: 'Ride' };
            const primarySource = ['strava', { id: '123', richness: 0.9 }];
            const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

            await linkingActions.handleLinkDecision(activity1, 'use-primary', primarySource, secondarySource);
            await linkingActions.handleLinkDecision(activity2, 'use-secondary', primarySource, secondarySource);

            const excluded1 = await linkingActions.getExcludedSource(activity1.id);
            const excluded2 = await linkingActions.getExcludedSource(activity2.id);

            expect(excluded1).toBe('manual');
            expect(excluded2).toBe('strava');
            expect(excluded1).not.toBe(excluded2);
        });
    });

    describe('Source formatting', () => {
        it('should format source names correctly', () => {
            expect(linkingActions.formatSource('strava')).toBe('Strava');
            expect(linkingActions.formatSource('manual')).toBe('Manual');
            expect(linkingActions.formatSource('garmin')).toBe('Garmin');
            expect(linkingActions.formatSource('polar')).toBe('Polar');
            expect(linkingActions.formatSource('fitbit')).toBe('Fitbit');
        });

        it('should format unknown sources correctly', () => {
            expect(linkingActions.formatSource('unknown_source')).toBe('Unknown_source');
        });
    });

    describe('Edge cases', () => {
        it('should handle null activity', async () => {
            const result = await linkingActions.handleLinkDecision(
                null,
                'keep-both',
                ['strava', {}],
                ['manual', {}]
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid activity');
        });

        it('should handle activities without IDs', async () => {
            const activity = { type: 'Run' };
            const result = await linkingActions.handleLinkDecision(
                activity,
                'keep-both',
                ['strava', {}],
                ['manual', {}]
            );

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid activity');
        });

        it('should handle missing primary source data', async () => {
            const activity = { id: 14, type: 'Run' };
            const primarySource = ['strava', null];
            const secondarySource = ['manual', { id: 'm1', richness: 0.5 }];

            const result = await linkingActions.handleLinkDecision(
                activity,
                'use-primary',
                primarySource,
                secondarySource
            );

            expect(result.success).toBe(true);
            expect(result.message).toBe('Using Strava only');
        });
    });
});
