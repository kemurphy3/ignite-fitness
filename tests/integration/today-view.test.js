/**
 * Today View Integration Tests
 * Tests Today view with substitution integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import TodayView from '../../js/modules/ui/TodayView.js';

describe('TodayView Integration', () => {
  let todayView;
  let mockStorageManager;
  let mockAuthManager;
  let mockEventBus;

  beforeEach(() => {
    mockStorageManager = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    mockAuthManager = {
      getCurrentUserId: vi.fn().mockReturnValue('test_user_123'),
      getCurrentUsername: vi.fn().mockReturnValue('test_user_123'),
      getToken: vi.fn().mockReturnValue('mock_token'),
    };

    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn(),
    };

    todayView = new TodayView();
    todayView.storageManager = mockStorageManager;
    todayView.authManager = mockAuthManager;
    todayView.eventBus = mockEventBus;

    // Mock fetch
    global.fetch = vi.fn();
  });

  describe('Data Loading', () => {
    it('should load planned session for today', async () => {
      const plannedSession = {
        name: 'Morning Run',
        modality: 'running',
        duration_minutes: 45,
        intensity: 'Z2',
        adaptation: 'aerobic_base',
        estimated_load: 90,
      };

      mockStorageManager.getItem.mockResolvedValue({
        [todayView.todayData.date]: plannedSession,
      });

      const result = await todayView.loadPlannedSession();

      expect(result).toEqual(plannedSession);
    });

    it('should load completed sessions for today', async () => {
      const completedSessions = [
        {
          session_id: 'session_1',
          date: todayView.todayData.date,
          workout_name: 'Quick Ride',
          duration: 30,
          rpe: 5,
          calculated_load: 75,
        },
      ];

      mockStorageManager.getItem.mockResolvedValue(completedSessions);

      const result = await todayView.loadCompletedSessions();

      expect(result).toEqual(completedSessions);
    });

    it('should handle missing data gracefully', async () => {
      mockStorageManager.getItem.mockResolvedValue(null);

      const plannedSession = await todayView.loadPlannedSession();
      const completedSessions = await todayView.loadCompletedSessions();

      expect(plannedSession).toBe(null);
      expect(completedSessions).toEqual([]);
    });
  });

  describe('Substitution Integration', () => {
    beforeEach(() => {
      todayView.todayData.planned_session = {
        name: 'Evening Run',
        modality: 'running',
        duration_minutes: 50,
        intensity: 'Z2',
        adaptation: 'aerobic_base',
        estimated_load: 100,
      };

      mockStorageManager.getItem.mockResolvedValue({
        equipment_access: ['bike', 'pool'],
        time_windows: { typical_duration: 90 },
        training_level: 'intermediate',
      });
    });

    it('should request substitutions from API', async () => {
      const mockSubstitutions = [
        {
          id: 'cycle_endurance_60min_z2',
          name: '60min Z2 Cycling',
          modality: 'cycling',
          duration_minutes: 65,
          estimated_load: 95,
          load_variance_percent: 5,
          confidence_score: 0.88,
          reasoning: 'Equivalent aerobic training with 30% longer duration',
          quality_score: 85,
        },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            substitutions: mockSubstitutions,
          }),
      });

      const result = await todayView.requestSubstitutions(
        todayView.todayData.planned_session,
        'cycling',
        { equipment: ['bike'] }
      );

      expect(result).toEqual(mockSubstitutions);
      expect(global.fetch).toHaveBeenCalledWith(
        '/.netlify/functions/substitutions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('cycling'),
        })
      );
    });

    it('should show substitutions for multiple modalities', async () => {
      const cyclingSubstitutions = [
        {
          name: 'Cycling Option',
          modality: 'cycling',
          quality_score: 85,
        },
      ];

      const swimmingSubstitutions = [
        {
          name: 'Swimming Option',
          modality: 'swimming',
          quality_score: 80,
        },
      ];

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ substitutions: cyclingSubstitutions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ substitutions: swimmingSubstitutions }),
        });

      await todayView.showSubstitutions();

      expect(todayView.todayData.substitutions).toHaveLength(2);
      expect(todayView.todayData.substitutions[0].quality_score).toBeGreaterThanOrEqual(
        todayView.todayData.substitutions[1].quality_score
      );
    });

    it('should handle substitution API errors gracefully', async () => {
      global.fetch.mockRejectedValue(new Error('API error'));

      // Should not throw
      await expect(todayView.showSubstitutions()).resolves.not.toThrow();

      expect(todayView.isLoadingSubstitutions).toBe(false);
    });

    it('should use selected substitution', async () => {
      const substitution = {
        id: 'cycle_test',
        name: 'Test Cycling',
        modality: 'cycling',
        duration_minutes: 60,
        estimated_load: 95,
      };

      todayView.todayData.substitutions = [substitution];

      await todayView.useSubstitution(0);

      expect(todayView.todayData.planned_session.name).toBe('Test Cycling');
      expect(todayView.todayData.planned_session.is_substitution).toBe(true);
      expect(todayView.todayData.substitutions).toHaveLength(0);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'session:substituted',
        expect.objectContaining({
          substitution,
        })
      );
    });
  });

  describe('Session Actions', () => {
    beforeEach(() => {
      todayView.todayData.planned_session = {
        name: 'Test Workout',
        modality: 'running',
      };
    });

    it('should start workout and emit event', () => {
      todayView.startWorkout();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'workout:start',
        expect.objectContaining({
          session: todayView.todayData.planned_session,
        })
      );
    });

    it('should skip workout with confirmation', async () => {
      // Mock confirm dialog
      global.confirm = vi.fn().mockReturnValue(true);

      await todayView.skipWorkout();

      expect(todayView.todayData.planned_session).toBe(null);
      expect(mockStorageManager.setItem).toHaveBeenCalled();
    });

    it('should not skip workout without confirmation', async () => {
      global.confirm = vi.fn().mockReturnValue(false);
      const originalSession = todayView.todayData.planned_session;

      await todayView.skipWorkout();

      expect(todayView.todayData.planned_session).toBe(originalSession);
    });
  });

  describe('Rendering', () => {
    it('should render empty state when no planned session', () => {
      todayView.todayData.planned_session = null;

      const content = todayView.renderPlannedSession();

      expect(content).toContain('No Planned Workout');
      expect(content).toContain('rest day');
    });

    it('should render planned session with details', () => {
      todayView.todayData.planned_session = {
        name: 'Morning Run',
        modality: 'running',
        time_required: 45,
        adaptation: 'aerobic_base',
        estimated_load: 90,
        equipment_required: ['road'],
      };

      const content = todayView.renderPlannedSession();

      expect(content).toContain('Morning Run');
      expect(content).toContain('Running');
      expect(content).toContain('45min');
      expect(content).toContain('Load: 90');
      expect(content).toContain('aerobic_base');
      expect(content).toContain('road');
    });

    it('should render substitution cards', () => {
      const substitution = {
        name: 'Bike Alternative',
        modality: 'cycling',
        duration_minutes: 60,
        estimated_load: 85,
        load_variance_percent: 8,
        confidence_score: 0.82,
        reasoning: 'Great alternative workout',
      };

      const content = todayView.renderSubstitutionCard(substitution, 0);

      expect(content).toContain('Bike Alternative');
      expect(content).toContain('Cycling');
      expect(content).toContain('60min');
      expect(content).toContain('8% load difference');
      expect(content).toContain('82% confidence');
      expect(content).toContain('Great alternative workout');
    });

    it('should render completed sessions', () => {
      const session = {
        workout_name: 'Quick Swim',
        duration: 30,
        rpe: 6,
        calculated_load: 75,
        logged_at: '2024-01-15T10:30:00Z',
      };

      const content = todayView.renderCompletedSession(session);

      expect(content).toContain('Quick Swim');
      expect(content).toContain('30min');
      expect(content).toContain('RPE 6');
      expect(content).toContain('Load 75');
    });
  });

  describe('Utility Functions', () => {
    it('should format dates correctly', () => {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // formatDate may return 'Today' or a formatted date string
      const todayFormatted = todayView.formatDate(today);
      expect(todayFormatted === 'Today' || todayFormatted.includes('day')).toBe(true);
      expect(todayView.formatDate(yesterday)).toContain('day'); // Should be a day name
    });

    it('should format duration from seconds', () => {
      expect(todayView.formatDuration(30)).toBe('30s');
      expect(todayView.formatDuration(120)).toBe('2min');
      expect(todayView.formatDuration(300)).toBe('5min');
      expect(todayView.formatDuration(3900)).toBe('1h 5min');
      expect(todayView.formatDuration(7200)).toBe('2h');
    });

    it('should get variance classes correctly', () => {
      expect(todayView.getVarianceClass(3)).toBe('excellent');
      expect(todayView.getVarianceClass(8)).toBe('good');
      expect(todayView.getVarianceClass(12)).toBe('acceptable');
      expect(todayView.getVarianceClass(20)).toBe('high');
    });

    it('should capitalize first letter', () => {
      expect(todayView.capitalizeFirst('running')).toBe('Running');
      expect(todayView.capitalizeFirst('multi_sport')).toBe('Multi_sport');
    });
  });

  describe('Event Handling', () => {
    it('should attach event listeners on initialize', async () => {
      mockStorageManager.getItem.mockResolvedValue({});

      await todayView.initialize();

      expect(mockEventBus.on).toHaveBeenCalledWith('session:logged', expect.any(Function));
    });

    it('should reload data when session is logged', async () => {
      const mockCallback = vi.fn();
      mockEventBus.on.mockImplementation((event, callback) => {
        if (event === 'session:logged') {
          mockCallback.mockImplementation(callback);
        }
      });

      await todayView.initialize();

      // Simulate session logged event
      mockStorageManager.getItem.mockResolvedValue([]);
      await mockCallback();

      expect(mockStorageManager.getItem).toHaveBeenCalled();
    });
  });
});
