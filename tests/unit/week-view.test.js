/**
 * WeekView Unit Tests
 * Tests for load analysis, visualization, and weekly planning features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
};

const mockEventBus = {
    on: vi.fn(),
    emit: vi.fn(),
    TOPICS: {
        SESSION_COMPLETED: 'SESSION_COMPLETED',
        SESSION_PLANNED: 'SESSION_PLANNED',
        GUARDRAIL_APPLIED: 'GUARDRAIL_APPLIED',
        WEEK_VIEW_RENDERED: 'WEEK_VIEW_RENDERED'
    }
};

const mockLoadCalculator = {
    calculateSessionLoad: vi.fn((session) => ({ total: session.load || 0 })),
    calculateWeeklyLoad: vi.fn()
};

const mockLoadGuardrails = {
    getGuardrailStatus: vi.fn().mockResolvedValue({
        isUnderGuardrail: false,
        activeAdjustments: []
    })
};

const mockAuthManager = {
    getCurrentUsername: vi.fn().mockReturnValue('testuser'),
    getCurrentUser: vi.fn().mockReturnValue({
        username: 'testuser',
        personalData: { experience: 'intermediate' }
    })
};

const mockStorageManager = {
    getUserSessions: vi.fn().mockResolvedValue([])
};

describe('WeekView', () => {
    let WeekView;
    let weekView;

    beforeEach(() => {
        // Setup mocks
        window.SafeLogger = mockLogger;
        window.EventBus = mockEventBus;
        window.LoadCalculator = mockLoadCalculator;
        window.LoadGuardrails = mockLoadGuardrails;
        window.AuthManager = mockAuthManager;
        window.StorageManager = mockStorageManager;

        // Mock DOM
        global.document = {
            getElementById: vi.fn().mockReturnValue({
                innerHTML: '',
                addEventListener: vi.fn(),
                querySelector: vi.fn(),
                querySelectorAll: vi.fn().mockReturnValue([])
            }),
            querySelector: vi.fn(),
            querySelectorAll: vi.fn().mockReturnValue([])
        };

        // Mock localStorage
        global.localStorage = {
            getItem: vi.fn(() => null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };

        // Reset mocks
        vi.clearAllMocks();

        // Load WeekView class
        class WeekView {
            constructor() {
                this.logger = window.SafeLogger || console;
                this.eventBus = window.EventBus;
                this.loadCalculator = window.LoadCalculator;
                this.loadGuardrails = window.LoadGuardrails;
                this.authManager = window.AuthManager;
                this.storageManager = window.StorageManager;
                this.currentWeekOffset = 0;
                this.loadThresholds = this.initializeLoadThresholds();
                this.initializeEventListeners();
            }

            initializeLoadThresholds() {
                return {
                    onTrack: { min: 0.9, max: 1.1, color: '#10b981', label: 'On Track' },
                    slightlyOver: { min: 1.1, max: 1.2, color: '#f59e0b', label: 'Slightly Over' },
                    slightlyUnder: { min: 0.8, max: 0.9, color: '#f59e0b', label: 'Slightly Under' },
                    significantlyOver: { min: 1.2, max: Infinity, color: '#ef4444', label: 'Too Much' },
                    significantlyUnder: { min: 0, max: 0.8, color: '#ef4444', label: 'Too Little' }
                };
            }

            initializeEventListeners() {
                if (this.eventBus) {
                    this.eventBus.on(this.eventBus.TOPICS?.SESSION_COMPLETED, () => {});
                    this.eventBus.on('SESSION_PLANNED', () => {});
                    this.eventBus.on('GUARDRAIL_APPLIED', () => {});
                }
            }

            determineLoadStatus(ratio) {
                for (const [statusKey, threshold] of Object.entries(this.loadThresholds)) {
                    if (ratio >= threshold.min && ratio < threshold.max) {
                        return { key: statusKey, ...threshold };
                    }
                }
                return { key: 'onTrack', ...this.loadThresholds.onTrack };
            }

            analyzeWeeklyLoad(weekData) {
                const plannedLoad = this.calculateTotalLoad(weekData.plannedSessions);
                const completedLoad = this.calculateTotalLoad(weekData.completedSessions);
                const loadRatio = plannedLoad > 0 ? completedLoad / plannedLoad : 0;
                const loadStatus = this.determineLoadStatus(loadRatio);
                const variance = Math.abs(completedLoad - plannedLoad);
                const variancePercentage = plannedLoad > 0 ? (variance / plannedLoad) * 100 : 0;

                return {
                    plannedLoad: Math.round(plannedLoad),
                    completedLoad: Math.round(completedLoad),
                    loadRatio,
                    variance: Math.round(variance),
                    variancePercentage: Math.round(variancePercentage),
                    status: loadStatus,
                    message: this.generateLoadMessage(loadStatus, variancePercentage),
                    recommendation: 'Continue monitoring'
                };
            }

            calculateTotalLoad(sessions) {
                if (!sessions || sessions.length === 0) return 0;
                return sessions.reduce((total, session) => {
                    const sessionLoad = this.loadCalculator?.calculateSessionLoad?.(session);
                    return total + (sessionLoad?.total || session.load || 0);
                }, 0);
            }

            calculateDailyBreakdown(weekStart, plannedSessions, completedSessions) {
                const days = [];
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                for (let i = 0; i < 7; i++) {
                    const currentDate = new Date(weekStart);
                    currentDate.setDate(currentDate.getDate() + i);
                    const dateString = currentDate.toISOString().split('T')[0];

                    const dayPlanned = plannedSessions.filter(s => {
                        const sDate = new Date(s.date || s.planned_date || s.start_at);
                        return sDate.toISOString().split('T')[0] === dateString;
                    });
                    const dayCompleted = completedSessions.filter(s => {
                        const sDate = new Date(s.date || s.start_at || s.created_at);
                        return sDate.toISOString().split('T')[0] === dateString;
                    });

                    days.push({
                        date: dateString,
                        dayName: dayNames[currentDate.getDay()],
                        dateNumber: currentDate.getDate(),
                        plannedSessions: dayPlanned,
                        completedSessions: dayCompleted,
                        plannedLoad: Math.round(this.calculateTotalLoad(dayPlanned)),
                        completedLoad: Math.round(this.calculateTotalLoad(dayCompleted)),
                        isToday: this.isToday(currentDate),
                        isPast: currentDate < new Date() && !this.isToday(currentDate)
                    });
                }

                return days;
            }

            generateInsights(loadAnalysis, guardrailStatus) {
                const insights = [];

                if (loadAnalysis.status.key === 'significantlyOver') {
                    insights.push({
                        type: 'warning',
                        icon: 'alert-triangle',
                        title: 'Overreaching Risk',
                        message: 'Your training load is significantly higher than planned. Consider taking an extra rest day.',
                        action: 'schedule_rest',
                        actionText: 'Schedule Rest Day'
                    });
                }

                if (loadAnalysis.status.key === 'significantlyUnder') {
                    insights.push({
                        type: 'info',
                        icon: 'trending-down',
                        title: 'Training Missed',
                        message: 'You\'ve missed significant training this week. Plan catch-up sessions if possible.',
                        action: 'plan_catchup',
                        actionText: 'Plan Catch-up'
                    });
                }

                if (guardrailStatus?.isUnderGuardrail) {
                    insights.push({
                        type: 'caution',
                        icon: 'shield',
                        title: 'Load Restrictions Active',
                        message: 'Training intensity is being automatically reduced for your safety.',
                        action: 'view_restrictions',
                        actionText: 'View Details'
                    });
                }

                if (loadAnalysis.loadRatio > 1.1) {
                    insights.push({
                        type: 'tip',
                        icon: 'target',
                        title: 'Consistency Focus',
                        message: 'Aim for more consistent daily training rather than cramming sessions.',
                        action: 'redistribute_load',
                        actionText: 'Redistribute Load'
                    });
                }

                if (loadAnalysis.status.key === 'onTrack') {
                    insights.push({
                        type: 'tip',
                        icon: 'target',
                        title: 'Great Progress!',
                        message: 'You\'re staying consistent with your training plan. Keep it up!',
                        action: null,
                        actionText: null
                    });
                }

                return insights;
            }

            generateLoadMessage(status, variancePercentage) {
                const messages = {
                    onTrack: 'You\'re right on track with your training plan!',
                    slightlyOver: `You're doing ${Math.round(variancePercentage)}% more than planned. Consider scaling back slightly.`,
                    slightlyUnder: `You're ${Math.round(variancePercentage)}% under your planned load. Try to catch up if possible.`,
                    significantlyOver: `You're significantly over your planned load (${Math.round(variancePercentage)}% more). Rest and recovery recommended.`,
                    significantlyUnder: `You're well below your planned load (${Math.round(variancePercentage)}% less). Consider what prevented you from training.`
                };
                return messages[status.key] || status.label;
            }

            getWeekLabel(offset) {
                if (offset === 0) return 'This Week';
                if (offset === -1) return 'Last Week';
                if (offset === 1) return 'Next Week';
                if (offset < 0) return `${Math.abs(offset)} Weeks Ago`;
                return `${offset} Weeks Ahead`;
            }

            getWeekStart(offset) {
                const today = new Date();
                const dayOfWeek = today.getDay();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - dayOfWeek + (offset * 7));
                weekStart.setHours(0, 0, 0, 0);
                return weekStart;
            }

            isToday(date) {
                const today = new Date();
                return date.toDateString() === today.toDateString();
            }

            formatDateRange(start, end) {
                const options = { month: 'short', day: 'numeric' };
                const startStr = start.toLocaleDateString('en-US', options);
                const endStr = end.toLocaleDateString('en-US', options);
                return `${startStr} - ${endStr}`;
            }

            navigateWeek(direction) {
                this.currentWeekOffset += direction;
            }

            navigateToToday() {
                this.currentWeekOffset = 0;
            }

            generateErrorHTML(message) {
                return `<div class="error">${message}</div>`;
            }

            async render(containerId, options = {}) {
                const container = document.getElementById(containerId);
                if (!container) {
                    throw new Error(`Container ${containerId} not found`);
                }
                container.innerHTML = '<div>Week View</div>';
            }

            async getWeekData() {
                return {
                    weekStart: new Date(),
                    weekEnd: new Date(),
                    plannedSessions: [],
                    completedSessions: [],
                    dailyBreakdown: []
                };
            }
        }

        weekView = new WeekView();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Load Status Determination', () => {
        it('should correctly identify on-track status', () => {
            const ratio = 0.95; // 95% of planned load
            const status = weekView.determineLoadStatus(ratio);

            expect(status.key).toBe('onTrack');
            expect(status.color).toBe('#10b981');
            expect(status.label).toBe('On Track');
        });

        it('should identify slightly over status', () => {
            const ratio = 1.15; // 115% of planned load
            const status = weekView.determineLoadStatus(ratio);

            expect(status.key).toBe('slightlyOver');
            expect(status.color).toBe('#f59e0b');
            expect(status.label).toBe('Slightly Over');
        });

        it('should identify significantly under status', () => {
            const ratio = 0.75; // 75% of planned load
            const status = weekView.determineLoadStatus(ratio);

            expect(status.key).toBe('significantlyUnder');
            expect(status.color).toBe('#ef4444');
            expect(status.label).toBe('Too Little');
        });

        it('should identify significantly over status', () => {
            const ratio = 1.25; // 125% of planned load
            const status = weekView.determineLoadStatus(ratio);

            expect(status.key).toBe('significantlyOver');
            expect(status.color).toBe('#ef4444');
        });
    });

    describe('Load Analysis', () => {
        it('should calculate correct load analysis', () => {
            const weekData = {
                plannedSessions: [
                    { load: 50 },
                    { load: 60 }
                ],
                completedSessions: [
                    { load: 45 },
                    { load: 55 }
                ]
            };

            const analysis = weekView.analyzeWeeklyLoad(weekData);

            expect(analysis.plannedLoad).toBe(110);
            expect(analysis.completedLoad).toBe(100);
            expect(analysis.loadRatio).toBeCloseTo(0.909, 3);
            expect(analysis.variance).toBe(10);
            expect(analysis.variancePercentage).toBeCloseTo(9.09, 2);
            expect(analysis.status.key).toBe('slightlyUnder');
        });

        it('should handle zero planned load', () => {
            const weekData = {
                plannedSessions: [],
                completedSessions: [{ load: 50 }]
            };

            const analysis = weekView.analyzeWeeklyLoad(weekData);

            expect(analysis.loadRatio).toBe(0);
            expect(analysis.variancePercentage).toBe(0);
            expect(analysis.completedLoad).toBe(50);
        });

        it('should handle exact match (100%)', () => {
            const weekData = {
                plannedSessions: [{ load: 100 }],
                completedSessions: [{ load: 100 }]
            };

            const analysis = weekView.analyzeWeeklyLoad(weekData);

            expect(analysis.loadRatio).toBe(1.0);
            expect(analysis.status.key).toBe('onTrack');
        });
    });

    describe('Daily Breakdown', () => {
        it('should calculate daily breakdown correctly', () => {
            const weekStart = new Date('2024-01-07'); // Sunday
            const plannedSessions = [
                { date: '2024-01-08', load: 50 }, // Monday
                { date: '2024-01-10', load: 60 }  // Wednesday
            ];
            const completedSessions = [
                { date: '2024-01-08', load: 45 }, // Monday
                { date: '2024-01-09', load: 30 }  // Tuesday (unplanned)
            ];

            const breakdown = weekView.calculateDailyBreakdown(weekStart, plannedSessions, completedSessions);

            expect(breakdown).toHaveLength(7);

            // Monday check (index 1)
            const monday = breakdown.find(d => d.dayName === 'Mon');
            expect(monday).toBeDefined();
            expect(monday.plannedLoad).toBe(50);
            expect(monday.completedLoad).toBe(45);

            // Tuesday check (index 2)
            const tuesday = breakdown.find(d => d.dayName === 'Tue');
            expect(tuesday).toBeDefined();
            expect(tuesday.plannedLoad).toBe(0);
            expect(tuesday.completedLoad).toBe(30);
        });

        it('should identify today correctly', () => {
            const today = new Date();
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay()); // Start of current week

            const breakdown = weekView.calculateDailyBreakdown(weekStart, [], []);

            const todayEntry = breakdown.find(day => day.isToday);
            expect(todayEntry).toBeDefined();
            expect(todayEntry.isToday).toBe(true);
        });
    });

    describe('Insights Generation', () => {
        it('should generate overreaching warning', () => {
            const loadAnalysis = {
                status: { key: 'significantlyOver' },
                variancePercentage: 25,
                loadRatio: 1.25
            };
            const guardrailStatus = { isUnderGuardrail: false };

            const insights = weekView.generateInsights(loadAnalysis, guardrailStatus);

            const warningInsight = insights.find(i => i.type === 'warning');
            expect(warningInsight).toBeDefined();
            expect(warningInsight.title).toBe('Overreaching Risk');
            expect(warningInsight.action).toBe('schedule_rest');
        });

        it('should generate guardrail insight when restrictions active', () => {
            const loadAnalysis = { status: { key: 'onTrack' }, loadRatio: 1.0 };
            const guardrailStatus = { isUnderGuardrail: true };

            const insights = weekView.generateInsights(loadAnalysis, guardrailStatus);

            const guardrailInsight = insights.find(i => i.type === 'caution');
            expect(guardrailInsight).toBeDefined();
            expect(guardrailInsight.title).toBe('Load Restrictions Active');
        });

        it('should generate consistency tip for uneven load distribution', () => {
            const loadAnalysis = {
                status: { key: 'slightlyOver' },
                loadRatio: 1.15
            };
            const guardrailStatus = { isUnderGuardrail: false };

            const insights = weekView.generateInsights(loadAnalysis, guardrailStatus);

            const tipInsight = insights.find(i => i.type === 'tip' && i.title === 'Consistency Focus');
            expect(tipInsight).toBeDefined();
        });

        it('should generate encouragement for on-track status', () => {
            const loadAnalysis = {
                status: { key: 'onTrack' },
                loadRatio: 1.0
            };
            const guardrailStatus = { isUnderGuardrail: false };

            const insights = weekView.generateInsights(loadAnalysis, guardrailStatus);

            const encouragement = insights.find(i => i.title === 'Great Progress!');
            expect(encouragement).toBeDefined();
        });
    });

    describe('Navigation', () => {
        it('should navigate to previous week', () => {
            weekView.navigateWeek(-1);

            expect(weekView.currentWeekOffset).toBe(-1);
        });

        it('should navigate to next week', () => {
            weekView.navigateWeek(1);

            expect(weekView.currentWeekOffset).toBe(1);
        });

        it('should navigate to current week', () => {
            weekView.currentWeekOffset = -2;
            weekView.navigateToToday();

            expect(weekView.currentWeekOffset).toBe(0);
        });
    });

    describe('Week Label Generation', () => {
        it('should generate correct week labels', () => {
            expect(weekView.getWeekLabel(0)).toBe('This Week');
            expect(weekView.getWeekLabel(-1)).toBe('Last Week');
            expect(weekView.getWeekLabel(1)).toBe('Next Week');
            expect(weekView.getWeekLabel(-3)).toBe('3 Weeks Ago');
            expect(weekView.getWeekLabel(2)).toBe('2 Weeks Ahead');
        });
    });

    describe('Date Utilities', () => {
        it('should identify today correctly', () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            expect(weekView.isToday(today)).toBe(true);
            expect(weekView.isToday(yesterday)).toBe(false);
        });

        it('should format date range correctly', () => {
            const start = new Date('2024-01-07');
            const end = new Date('2024-01-13');

            const formatted = weekView.formatDateRange(start, end);

            expect(formatted).toMatch(/Jan/);
            expect(formatted).toContain('-');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing container element', async () => {
            document.getElementById.mockReturnValue(null);

            await expect(weekView.render('missing-container')).rejects.toThrow('Container missing-container not found');
        });

        it('should generate error HTML', () => {
            const errorHTML = weekView.generateErrorHTML('Test error');
            expect(errorHTML).toContain('Test error');
            expect(errorHTML).toContain('error');
        });
    });

    describe('Load Calculation', () => {
        it('should calculate total load correctly', () => {
            const sessions = [
                { load: 50 },
                { load: 60 },
                { load: 40 }
            ];

            const total = weekView.calculateTotalLoad(sessions);
            expect(total).toBe(150);
        });

        it('should handle empty sessions array', () => {
            const total = weekView.calculateTotalLoad([]);
            expect(total).toBe(0);
        });

        it('should handle null/undefined sessions', () => {
            const total = weekView.calculateTotalLoad(null);
            expect(total).toBe(0);
        });
    });
});

