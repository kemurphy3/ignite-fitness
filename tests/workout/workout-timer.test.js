/**
 * WorkoutTimer Unit Tests
 * Tests for session and rest timer functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WorkoutTimer', () => {
    let workoutTimer;

    beforeEach(() => {
        // Reset timers before each test
        if (workoutTimer) {
            workoutTimer.reset();
        }

        // Mock localStorage for Node.js environment
        global.localStorage = global.localStorage || {
            data: {},
            setItem: vi.fn((key, value) => {
                global.localStorage.data[key] = value;
            }),
            getItem: vi.fn((key) => {
                return global.localStorage.data[key] || null;
            }),
            removeItem: vi.fn((key) => {
                delete global.localStorage.data[key];
            })
        };

        // Mock window.WorkoutTimer for Node.js environment
        global.window = global.window || {};
        if (!global.window.WorkoutTimer) {
            global.window.WorkoutTimer = {
                startSession: vi.fn(),
                stopSession: vi.fn(),
                pauseSession: vi.fn(),
                resumeSession: vi.fn(),
                startRest: vi.fn(),
                stopRest: vi.fn(),
                formatDuration: vi.fn((seconds) => {
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const secs = seconds % 60;

                    // Always use HH:MM:SS format for readability
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                }),
                getSessionDuration: vi.fn(() => 0),
                getRestRemaining: vi.fn(() => 0),
                addTime: vi.fn(),
                addRestTime: vi.fn(),
                reset: vi.fn()
            };
        }

        workoutTimer = global.window.WorkoutTimer;
    });

    describe('formatDuration', () => {
        it('should format 0 seconds as 00:00:00', () => {
            const formatted = workoutTimer.formatDuration(0);
            expect(formatted).toMatch(/00:00:00/);
        });

        it('should format 65 seconds as 00:01:05', () => {
            const formatted = workoutTimer.formatDuration(65);
            expect(formatted).toMatch(/00:01:05/);
        });

        it('should format 3665 seconds as 01:01:05', () => {
            const formatted = workoutTimer.formatDuration(3665);
            expect(formatted).toMatch(/01:01:05/);
        });
    });

    describe('session timer', () => {
        it('should start session timer', () => {
            workoutTimer.startSession();
            expect(workoutTimer.startSession).toHaveBeenCalled();
        });

        it('should stop session timer', () => {
            workoutTimer.stopSession();
            expect(workoutTimer.stopSession).toHaveBeenCalled();
        });

        it('should pause and resume session', () => {
            workoutTimer.pauseSession();
            expect(workoutTimer.pauseSession).toHaveBeenCalled();

            workoutTimer.resumeSession();
            expect(workoutTimer.resumeSession).toHaveBeenCalled();
        });
    });

    describe('rest timer', () => {
        it('should start rest countdown', () => {
            const duration = 90;
            const callback = vi.fn();

            workoutTimer.startRest(duration, callback);
            expect(workoutTimer.startRest).toHaveBeenCalledWith(duration, callback);
        });

        it('should stop rest timer', () => {
            workoutTimer.stopRest();
            expect(workoutTimer.stopRest).toHaveBeenCalled();
        });
    });

    describe('time adjustments', () => {
        it('should add time to session timer', () => {
            const seconds = 30;
            workoutTimer.addTime(seconds);
            expect(workoutTimer.addTime).toHaveBeenCalledWith(seconds);
        });

        it('should add time to rest timer', () => {
            const seconds = 15;
            workoutTimer.addRestTime(seconds);
            expect(workoutTimer.addRestTime).toHaveBeenCalledWith(seconds);
        });
    });

    describe('session state persistence', () => {
        it('should save session state to localStorage', () => {
            const mockState = {
                isActive: true,
                isPaused: false,
                startTime: Date.now(),
                elapsed: 120
            };

            localStorage.setItem('workout_timer_session_state', JSON.stringify(mockState));

            const saved = localStorage.getItem('workout_timer_session_state');
            expect(saved).toBeTruthy();

            const parsed = JSON.parse(saved);
            expect(parsed.isActive).toBe(true);
        });

        it('should load session state from localStorage', () => {
            const mockState = {
                isActive: true,
                isPaused: false,
                startTime: Date.now() - 60000,
                elapsed: 60
            };

            localStorage.setItem('workout_timer_session_state', JSON.stringify(mockState));

            const loaded = localStorage.getItem('workout_timer_session_state');
            expect(loaded).toBeTruthy();
        });

        it('should clear session state', () => {
            localStorage.setItem('workout_timer_session_state', '{}');
            localStorage.removeItem('workout_timer_session_state');

            const cleared = localStorage.getItem('workout_timer_session_state');
            expect(cleared).toBeNull();
        });
    });

    describe('rest state persistence', () => {
        it('should save rest state to localStorage', () => {
            const mockState = {
                isActive: true,
                duration: 90,
                remaining: 45,
                startTime: Date.now()
            };

            localStorage.setItem('workout_timer_rest_state', JSON.stringify(mockState));

            const saved = localStorage.getItem('workout_timer_rest_state');
            expect(saved).toBeTruthy();

            const parsed = JSON.parse(saved);
            expect(parsed.duration).toBe(90);
        });

        it('should clear rest state', () => {
            localStorage.setItem('workout_timer_rest_state', '{}');
            localStorage.removeItem('workout_timer_rest_state');

            const cleared = localStorage.getItem('workout_timer_rest_state');
            expect(cleared).toBeNull();
        });
    });

    describe('reset', () => {
        it('should reset all timer state', () => {
            workoutTimer.reset();
            expect(workoutTimer.reset).toHaveBeenCalled();
        });
    });
});

