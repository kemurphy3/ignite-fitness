/**
 * Seasonal Constraints Unit Tests
 * Tests for Prompt 6 - Seasonal phase management and game proximity
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Seasonal Constraints', () => {
    let seasonalPrograms;

    beforeEach(() => {
        // Mock SeasonalPrograms
        if (!window.SeasonalPrograms) {
            class MockSeasonalPrograms {
                constructor() {
                    this.phases = {
                        off: { name: 'Off-Season', duration: '3-4 months', focus: 'strength_power_development', key: 'off' },
                        pre: { name: 'Pre-Season', duration: '6-8 weeks', focus: 'sport_specific_preparation', key: 'pre' },
                        in: { name: 'In-Season', duration: '6-9 months', focus: 'performance_maintenance', key: 'in' },
                        post: { name: 'Post-Season', duration: '2-4 weeks', focus: 'recovery_regeneration', key: 'post' }
                    };
                }
                
                getSeasonContext(date, userProfile, calendar) {
                    const phase = this.determinePhase(date, userProfile);
                    const weekOfBlock = this.getWeekOfBlock(date);
                    const deloadThisWeek = weekOfBlock === 4;
                    
                    return {
                        phase: phase.name,
                        phaseKey: phase.key,
                        weekOfBlock,
                        deloadThisWeek,
                        volumeModifier: deloadThisWeek ? 0.8 : 1.0,
                        gameProximity: this.checkGameProximity(date, calendar, phase),
                        emphasis: phase.focus
                    };
                }
                
                determinePhase(date, userProfile) {
                    const currentMonth = date.getMonth() + 1;
                    let phaseKey = 'in';
                    
                    if (userProfile && userProfile.seasonPhase) {
                        phaseKey = userProfile.seasonPhase;
                    } else {
                        if (currentMonth >= 12 || currentMonth <= 2) phaseKey = 'off';
                        else if (currentMonth >= 3 && currentMonth <= 5) phaseKey = 'pre';
                    }
                    
                    return { ...this.phases[phaseKey], key: phaseKey };
                }
                
                getWeekOfBlock(date) {
                    const startDate = new Date(date.getFullYear(), 0, 1);
                    const daysSince = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
                    const weekNumber = Math.floor(daysSince / 7);
                    return (weekNumber % 4) + 1;
                }
                
                checkGameProximity(date, calendar, phase) {
                    const result = {
                        hasGame: false,
                        daysUntil: null,
                        isTomorrow: false,
                        isWithin48h: false,
                        suppressHeavyLower: false
                    };
                    
                    if (phase.key !== 'in') return result;
                    
                    const games = calendar.keyMatches || calendar.games || [];
                    
                    for (const game of games) {
                        const gameDate = new Date(game.date);
                        const daysUntil = Math.floor((gameDate - date) / (1000 * 60 * 60 * 24));
                        
                        if (daysUntil >= 0 && daysUntil <= 2) {
                            result.hasGame = true;
                            result.daysUntil = daysUntil;
                            result.isTomorrow = daysUntil === 1;
                            result.isWithin48h = daysUntil <= 1;
                            
                            if (result.isWithin48h) {
                                result.suppressHeavyLower = true;
                            }
                            
                            break;
                        }
                    }
                    
                    return result;
                }
            }
            
            window.SeasonalPrograms = MockSeasonalPrograms;
        }
        
        seasonalPrograms = new window.SeasonalPrograms();
    });

    describe('getSeasonContext', () => {
        it('should return phase, week, and deload info', () => {
            const context = seasonalPrograms.getSeasonContext(new Date(), {}, {});
            
            expect(context).toHaveProperty('phase');
            expect(context).toHaveProperty('phaseKey');
            expect(context).toHaveProperty('weekOfBlock');
            expect(context).toHaveProperty('deloadThisWeek');
            expect(context).toHaveProperty('volumeModifier');
        });

        it('should detect deload on week 4', () => {
            // Mock week 4
            const mockDate = new Date(2025, 0, 1 + (3 * 7)); // Week 4
            seasonalPrograms.getWeekOfBlock = () => 4;
            
            const context = seasonalPrograms.getSeasonContext(mockDate, {}, {});
            
            expect(context.deloadThisWeek).toBe(true);
            expect(context.volumeModifier).toBe(0.8);
        });

        it('should NOT deload on weeks 1-3', () => {
            seasonalPrograms.getWeekOfBlock = () => 2;
            
            const context = seasonalPrograms.getSeasonContext(new Date(), {}, {});
            
            expect(context.deloadThisWeek).toBe(false);
            expect(context.volumeModifier).toBe(1.0);
        });

        it('should detect game proximity in-season', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const calendar = {
                keyMatches: [{ date: tomorrow.toISOString() }]
            };
            
            const userProfile = { seasonPhase: 'in' };
            
            const context = seasonalPrograms.getSeasonContext(new Date(), userProfile, calendar);
            
            expect(context.gameProximity.hasGame).toBe(true);
            expect(context.gameProximity.isTomorrow).toBe(true);
            expect(context.gameProximity.suppressHeavyLower).toBe(true);
        });

        it('should NOT detect game proximity off-season', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const calendar = {
                keyMatches: [{ date: tomorrow.toISOString() }]
            };
            
            const userProfile = { seasonPhase: 'off' };
            
            const context = seasonalPrograms.getSeasonContext(new Date(), userProfile, calendar);
            
            expect(context.gameProximity.hasGame).toBe(false);
            expect(context.gameProximity.suppressHeavyLower).toBe(false);
        });

        it('should suppress heavy lower within 48h of game', () => {
            const dayAfterTomorrow = new Date();
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
            
            const calendar = {
                games: [{ date: dayAfterTomorrow.toISOString() }]
            };
            
            const userProfile = { seasonPhase: 'in' };
            
            const context = seasonalPrograms.getSeasonContext(new Date(), userProfile, calendar);
            
            expect(context.gameProximity.hasGame).toBe(true);
            expect(context.gameProximity.isWithin48h).toBe(true);
            expect(context.gameProximity.suppressHeavyLower).toBe(true);
        });
    });

    describe('phase detection', () => {
        it('should detect off-season in winter', () => {
            const winterDate = new Date(2025, 0, 15); // January
            
            const phase = seasonalPrograms.determinePhase(winterDate, {});
            
            expect(phase.key).toBe('off');
        });

        it('should detect pre-season in spring', () => {
            const springDate = new Date(2025, 3, 15); // April
            
            const phase = seasonalPrograms.determinePhase(springDate, {});
            
            expect(phase.key).toBe('pre');
        });

        it('should detect in-season in fall', () => {
            const fallDate = new Date(2025, 9, 15); // October
            
            const phase = seasonalPrograms.determinePhase(fallDate, {});
            
            expect(phase.key).toBe('in');
        });

        it('should use user override for season phase', () => {
            const userProfile = { seasonPhase: 'in' };
            
            const phase = seasonalPrograms.determinePhase(new Date(), userProfile);
            
            expect(phase.key).toBe('in');
        });
    });

    describe('with ExpertCoordinator', () => {
        it('should apply deload volume modifier', () => {
            // Mock week 4
            seasonalPrograms.getSeasonContext = () => ({
                phase: 'In-Season',
                phaseKey: 'in',
                weekOfBlock: 4,
                deloadThisWeek: true,
                volumeModifier: 0.8,
                gameProximity: { hasGame: false },
                emphasis: 'performance_maintenance'
            });
            
            expect(seasonalPrograms.getSeasonContext().volumeModifier).toBe(0.8);
        });

        it('should add game proximity to rationale', () => {
            seasonalPrograms.getSeasonContext = () => ({
                phase: 'In-Season',
                phaseKey: 'in',
                weekOfBlock: 2,
                deloadThisWeek: false,
                volumeModifier: 1.0,
                gameProximity: {
                    hasGame: true,
                    isTomorrow: true,
                    suppressHeavyLower: true
                },
                emphasis: 'performance_maintenance'
            });
            
            const context = seasonalPrograms.getSeasonContext();
            
            expect(context.gameProximity.isTomorrow).toBe(true);
            expect(context.gameProximity.suppressHeavyLower).toBe(true);
        });
    });
});

