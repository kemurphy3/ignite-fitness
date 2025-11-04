/**
 * Session Logger Tests
 * Tests session logging and load calculation integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import SessionLogger from '../../js/modules/ui/SessionLogger.js';
import LoadCalculationEngine from '../../js/modules/load/LoadCalculationEngine.js';

// Mock LoadCalculationEngine
vi.mock('../../js/modules/load/LoadCalculationEngine.js', () => ({
    default: {
        compute_load: vi.fn(),
        estimateMaxHR: vi.fn().mockReturnValue(185)
    }
}));

describe('SessionLogger', () => {
    let sessionLogger;
    let mockStorageManager;
    let mockAuthManager;
    let mockEventBus;

    beforeEach(() => {
        mockStorageManager = {
            getItem: vi.fn(),
            setItem: vi.fn()
        };

        mockAuthManager = {
            getCurrentUserId: vi.fn().mockReturnValue('test_user_123'),
            getCurrentUsername: vi.fn().mockReturnValue('test_user_123'),
            getToken: vi.fn().mockReturnValue('mock_token')
        };

        mockEventBus = {
            emit: vi.fn()
        };

        sessionLogger = new SessionLogger();
        sessionLogger.storageManager = mockStorageManager;
        sessionLogger.authManager = mockAuthManager;
        sessionLogger.eventBus = mockEventBus;

        // Mock fetch
        global.fetch = vi.fn();

        // Reset load calculation mock
        LoadCalculationEngine.compute_load.mockReset();
    });

    describe('Form Data Management', () => {
        it('should initialize with default session data', () => {
            expect(sessionLogger.sessionData.date).toBe(new Date().toISOString().split('T')[0]);
            expect(sessionLogger.sessionData.modality).toBe('');
            expect(sessionLogger.sessionData.duration_minutes).toBe('');
            expect(sessionLogger.sessionData.rpe).toBe('');
        });

        it('should update form fields correctly', () => {
            sessionLogger.updateField('modality', 'running');
            sessionLogger.updateField('duration_minutes', 45);

            expect(sessionLogger.sessionData.modality).toBe('running');
            expect(sessionLogger.sessionData.duration_minutes).toBe(45);
        });

        it('should update HR fields correctly', () => {
            sessionLogger.updateHRField('avg_hr', 150);
            sessionLogger.updateHRField('max_hr', 180);

            expect(sessionLogger.sessionData.hr_data.avg_hr).toBe(150);
            expect(sessionLogger.sessionData.hr_data.max_hr).toBe(180);
        });

        it('should auto-estimate intensity from RPE', () => {
            sessionLogger.updateRPE(3);
            expect(sessionLogger.sessionData.rpe).toBe(3);
            expect(sessionLogger.sessionData.intensity).toBe('Z1');

            sessionLogger.updateRPE(6);
            expect(sessionLogger.sessionData.intensity).toBe('Z3');

            sessionLogger.updateRPE(9);
            expect(sessionLogger.sessionData.intensity).toBe('Z4');
        });
    });

    describe('Load Calculation Integration', () => {
        beforeEach(() => {
            // Setup basic session data
            sessionLogger.sessionData = {
                modality: 'running',
                duration_minutes: 45,
                rpe: 6,
                intensity: 'Z3'
            };
        });

        it('should determine when load can be calculated', () => {
            expect(sessionLogger.canCalculateLoad()).toBe(true);

            // Remove RPE
            sessionLogger.sessionData.rpe = '';
            expect(sessionLogger.canCalculateLoad()).toBe(false);

            // Add HR data
            sessionLogger.sessionData.hr_data.avg_hr = 150;
            expect(sessionLogger.canCalculateLoad()).toBe(true);
        });

        it('should calculate load deterministically', () => {
            // Mock deterministic load calculation
            LoadCalculationEngine.compute_load.mockReturnValue({
                total_load: 270,
                method_used: 'RPE_Duration',
                confidence: 0.75
            });

            const result1 = sessionLogger.calculateCurrentLoad();
            const result2 = sessionLogger.calculateCurrentLoad();

            expect(result1.total_load).toBe(270);
            expect(result2.total_load).toBe(270);
            expect(result1.method_used).toBe(result2.method_used);

            // Should call with same parameters
            expect(LoadCalculationEngine.compute_load).toHaveBeenCalledWith({
                duration_minutes: 45,
                rpe: 6,
                modality: 'running',
                intensity: 'Z3',
                user_profile: expect.any(Object)
            });
        });

        it('should include HR data in load calculation when available', () => {
            sessionLogger.sessionData.hr_data.avg_hr = 155;

            LoadCalculationEngine.compute_load.mockReturnValue({
                total_load: 320,
                method_used: 'TRIMP',
                confidence: 0.95
            });

            sessionLogger.calculateCurrentLoad();

            expect(LoadCalculationEngine.compute_load).toHaveBeenCalledWith(
                expect.objectContaining({
                    hr_data: { avg_hr: 155 },
                    user_profile: expect.objectContaining({
                        age: expect.any(Number),
                        gender: expect.any(String)
                    })
                })
            );
        });

        it('should render load preview correctly', () => {
            LoadCalculationEngine.compute_load.mockReturnValue({
                total_load: 180,
                method_used: 'Zone_RPE',
                confidence: 0.85
            });

            const preview = sessionLogger.renderLoadPreview();

            expect(preview).toContain('180');
            expect(preview).toContain('Zone_RPE');
            expect(preview).toContain('85%');
        });
    });

    describe('Session Validation', () => {
        it('should validate required fields', () => {
            // Empty session
            expect(sessionLogger.validateSession()).toBe(false);

            // With modality only
            sessionLogger.sessionData.modality = 'running';
            expect(sessionLogger.validateSession()).toBe(false);

            // With modality and duration
            sessionLogger.sessionData.duration_minutes = 45;
            expect(sessionLogger.validateSession()).toBe(false);

            // With RPE
            sessionLogger.sessionData.rpe = 6;
            expect(sessionLogger.validateSession()).toBe(true);
        });

        it('should accept HR data instead of RPE', () => {
            sessionLogger.sessionData.modality = 'cycling';
            sessionLogger.sessionData.duration_minutes = 60;
            sessionLogger.sessionData.hr_data.avg_hr = 140;

            expect(sessionLogger.validateSession()).toBe(true);
        });

        it('should reject invalid duration', () => {
            sessionLogger.sessionData.modality = 'swimming';
            sessionLogger.sessionData.duration_minutes = 0;
            sessionLogger.sessionData.rpe = 5;

            expect(sessionLogger.validateSession()).toBe(false);
        });
    });

    describe('Session Persistence', () => {
        beforeEach(() => {
            sessionLogger.sessionData = {
                date: '2024-01-15',
                workout_name: 'Test Run',
                modality: 'running',
                duration_minutes: 30,
                rpe: 7,
                intensity: 'Z3',
                notes: 'Felt good today'
            };

            LoadCalculationEngine.compute_load.mockReturnValue({
                total_load: 210,
                method_used: 'RPE_Duration',
                confidence: 0.75
            });
        });

        it('should save session with computed load', async () => {
            mockStorageManager.getItem.mockResolvedValue([]);

            // Mock successful API response
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });

            await sessionLogger.saveSession({
                user_id: 'test_user_123',
                session_id: 'test_session',
                calculated_load: 210,
                load_method: 'RPE_Duration'
            });

            // Should save to local storage
            expect(mockStorageManager.setItem).toHaveBeenCalledWith(
                'logged_sessions',
                expect.arrayContaining([
                    expect.objectContaining({
                        calculated_load: 210,
                        load_method: 'RPE_Duration'
                    })
                ])
            );

            // Should make API call
            expect(global.fetch).toHaveBeenCalledWith(
                '/.netlify/functions/sessions-create',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('210')
                })
            );
        });

        it('should handle API failure gracefully', async () => {
            mockStorageManager.getItem.mockResolvedValue([]);

            // Mock API failure
            global.fetch.mockRejectedValueOnce(new Error('Network error'));

            // Should not throw
            await expect(
                sessionLogger.saveSession({ session_id: 'test' })
            ).resolves.not.toThrow();

            // Should still save to local storage
            expect(mockStorageManager.setItem).toHaveBeenCalled();
        });

        it('should generate session ID and workout name', () => {
            const sessionId = sessionLogger.generateSessionId();
            expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);

            // Test workout name generation
            sessionLogger.sessionData.modality = 'running';
            sessionLogger.sessionData.duration_minutes = 45;
            sessionLogger.sessionData.distance = 5;
            sessionLogger.sessionData.distance_unit = 'km';

            const name = sessionLogger.generateWorkoutName();
            expect(name).toBe('5km Run');

            // Without distance
            sessionLogger.sessionData.distance = '';
            const nameWithoutDistance = sessionLogger.generateWorkoutName();
            expect(nameWithoutDistance).toBe('45min Run');
        });
    });

    describe('Form Submission', () => {
        beforeEach(() => {
            // Setup valid session data
            sessionLogger.sessionData = {
                date: '2024-01-15',
                modality: 'cycling',
                duration_minutes: 60,
                rpe: 5,
                intensity: 'Z2'
            };

            LoadCalculationEngine.compute_load.mockReturnValue({
                total_load: 120,
                method_used: 'RPE_Duration',
                confidence: 0.75
            });

            mockStorageManager.getItem.mockResolvedValue([]);
            global.fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true })
            });
        });

        it('should handle successful form submission', async () => {
            const mockEvent = {
                preventDefault: vi.fn()
            };

            await sessionLogger.handleSubmit(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockEventBus.emit).toHaveBeenCalledWith(
                'session:logged',
                expect.objectContaining({
                    session: expect.objectContaining({
                        modality: 'cycling',
                        calculated_load: 120
                    })
                })
            );
        });

        it('should prevent double submission', async () => {
            const mockEvent = { preventDefault: vi.fn() };

            sessionLogger.isLogging = true;
            await sessionLogger.handleSubmit(mockEvent);

            // Should return early
            expect(LoadCalculationEngine.compute_load).not.toHaveBeenCalled();
        });

        it('should handle validation failure', async () => {
            // Remove required field
            sessionLogger.sessionData.modality = '';

            const mockEvent = { preventDefault: vi.fn() };
            await sessionLogger.handleSubmit(mockEvent);

            // Should not save
            expect(mockStorageManager.setItem).not.toHaveBeenCalled();
            expect(sessionLogger.isLogging).toBe(false);
        });
    });

    describe('RPE Helpers', () => {
        it('should provide correct RPE labels', () => {
            expect(sessionLogger.getRPELabel(1)).toBe('Very Easy');
            expect(sessionLogger.getRPELabel(5)).toBe('Moderate');
            expect(sessionLogger.getRPELabel(10)).toBe('Maximal');
        });

        it('should estimate intensity from RPE correctly', () => {
            expect(sessionLogger.estimateIntensityFromRPE(2)).toBe('Z1');
            expect(sessionLogger.estimateIntensityFromRPE(4)).toBe('Z2');
            expect(sessionLogger.estimateIntensityFromRPE(6)).toBe('Z3');
            expect(sessionLogger.estimateIntensityFromRPE(8)).toBe('Z4');
            expect(sessionLogger.estimateIntensityFromRPE(10)).toBe('Z5');
        });
    });

    describe('Load Categories', () => {
        it('should categorize load correctly', () => {
            expect(sessionLogger.getLoadCategory(30)).toBe('Light');
            expect(sessionLogger.getLoadCategory(75)).toBe('Moderate');
            expect(sessionLogger.getLoadCategory(150)).toBe('High');
            expect(sessionLogger.getLoadCategory(250)).toBe('Very High');
        });
    });
});

