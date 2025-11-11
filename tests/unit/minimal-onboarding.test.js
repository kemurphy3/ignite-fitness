/**
 * Minimal Onboarding Tests
 * Tests onboarding flow and data persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import MinimalOnboarding from '../../js/modules/onboarding/MinimalOnboarding.js';

describe('MinimalOnboarding', () => {
  let onboarding;
  let mockStorageManager;
  let mockAuthManager;

  beforeEach(() => {
    // Mock storage manager
    mockStorageManager = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };

    // Mock auth manager
    mockAuthManager = {
      getCurrentUserId: vi.fn().mockReturnValue('test_user_123'),
      getCurrentUsername: vi.fn().mockReturnValue('test_user_123'),
      getToken: vi.fn().mockReturnValue('mock_token'),
    };

    onboarding = new MinimalOnboarding();
    onboarding.storageManager = mockStorageManager;
    onboarding.authManager = mockAuthManager;

    // Mock fetch for API calls
    global.fetch = vi.fn();
  });

  describe('Onboarding Flow', () => {
    it('should initialize with default data', () => {
      expect(onboarding.currentStep).toBe(0);
      expect(onboarding.onboardingData.sport_focus).toBe(null);
      expect(onboarding.onboardingData.equipment_access).toEqual([]);
      expect(onboarding.onboardingData.injury_flags).toEqual([]);
    });

    it('should persist sport focus selection', () => {
      onboarding.selectSport('running');

      expect(onboarding.onboardingData.sport_focus).toBe('running');
    });

    it('should persist equipment selections', () => {
      const mockCheckbox = { value: 'road_bike', checked: true };
      onboarding.toggleEquipment(mockCheckbox);

      expect(onboarding.onboardingData.equipment_access).toContain('road_bike');

      // Test removal
      mockCheckbox.checked = false;
      onboarding.toggleEquipment(mockCheckbox);

      expect(onboarding.onboardingData.equipment_access).not.toContain('road_bike');
    });

    it('should persist time window preferences', () => {
      const mockCheckbox = { value: 'morning', checked: true };
      onboarding.toggleTimeSlot(mockCheckbox);

      expect(onboarding.onboardingData.time_windows.preferred_times).toContain('morning');

      onboarding.setDuration(60);
      expect(onboarding.onboardingData.time_windows.typical_duration).toBe(60);

      onboarding.setTrainingDays(5);
      expect(onboarding.onboardingData.time_windows.days_per_week).toBe(5);
    });

    it('should persist injury flags', () => {
      const mockCheckbox = { value: 'knee', checked: true };
      onboarding.toggleInjury(mockCheckbox);

      expect(onboarding.onboardingData.injury_flags).toContain('knee');

      // Test no injuries
      onboarding.setNoInjuries();
      expect(onboarding.onboardingData.injury_flags).toEqual([]);
    });
  });

  describe('Navigation', () => {
    it('should advance to next step when validation passes', () => {
      // Set required data for first step
      onboarding.onboardingData.sport_focus = 'running';

      const result = onboarding.validateCurrentStep();
      expect(result).toBe(true);

      onboarding.nextStep();
      expect(onboarding.currentStep).toBe(1);
    });

    it('should not advance without required data', () => {
      // Don't set sport focus
      const result = onboarding.validateCurrentStep();
      expect(result).toBe(false);

      // Should stay on same step
      expect(onboarding.currentStep).toBe(0);
    });

    it('should go back to previous step', () => {
      onboarding.currentStep = 2;
      onboarding.previousStep();

      expect(onboarding.currentStep).toBe(1);
    });

    it('should not go below step 0', () => {
      onboarding.currentStep = 0;
      onboarding.previousStep();

      expect(onboarding.currentStep).toBe(0);
    });
  });

  describe('Data Persistence', () => {
    it('should save complete profile on completion', async () => {
      // Set up complete onboarding data
      onboarding.onboardingData = {
        sport_focus: 'running',
        secondary_sports: ['strength'],
        equipment_access: ['road_bike', 'pool'],
        time_windows: {
          preferred_times: ['morning'],
          typical_duration: 60,
          days_per_week: 4,
        },
        injury_flags: [],
        training_level: 'intermediate',
      };

      // Mock successful API response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const profile = await onboarding.saveOnboardingData();

      expect(profile).toMatchObject({
        user_id: 'test_user_123',
        sport_focus: 'running',
        secondary_sports: ['strength'],
        equipment_access: ['road_bike', 'pool'],
        onboarding_completed: true,
      });

      // Should save to local storage
      expect(mockStorageManager.setItem).toHaveBeenCalledWith('user_profile', profile);

      // Should make API call
      expect(global.fetch).toHaveBeenCalledWith(
        '/.netlify/functions/users-profile-post',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('running'),
        })
      );
    });

    it('should handle API failure gracefully', async () => {
      onboarding.onboardingData.sport_focus = 'cycling';

      // Mock API failure
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const profile = await onboarding.saveOnboardingData();

      // Should still return profile from local storage
      expect(profile.sport_focus).toBe('cycling');
      expect(mockStorageManager.setItem).toHaveBeenCalled();
    });

    it('should load existing profile if completed', async () => {
      const existingProfile = {
        user_id: 'test_user_123',
        sport_focus: 'swimming',
        onboarding_completed: true,
      };

      mockStorageManager.getItem.mockResolvedValue(existingProfile);

      const result = await onboarding.initialize();

      expect(result.completed).toBe(true);
      expect(result.profile).toEqual(existingProfile);
    });
  });

  describe('Validation', () => {
    it('should validate sport focus step', () => {
      // Without sport focus
      expect(onboarding.validateCurrentStep()).toBe(false);

      // With sport focus
      onboarding.onboardingData.sport_focus = 'running';
      expect(onboarding.validateCurrentStep()).toBe(true);
    });

    it('should validate equipment step', () => {
      onboarding.currentStep = 1; // Equipment step

      // Without equipment
      expect(onboarding.validateCurrentStep()).toBe(false);

      // With equipment
      onboarding.onboardingData.equipment_access = ['road_bike'];
      expect(onboarding.validateCurrentStep()).toBe(true);
    });

    it('should provide defaults for optional fields', () => {
      onboarding.currentStep = 2; // Time windows step

      // Should set defaults
      onboarding.validateCurrentStep();

      expect(onboarding.onboardingData.time_windows.typical_duration).toBe(60);
      expect(onboarding.onboardingData.time_windows.days_per_week).toBe(4);
    });
  });

  describe('Secondary Sports', () => {
    beforeEach(() => {
      onboarding.onboardingData.sport_focus = 'running';
    });

    it('should add secondary sports', () => {
      const mockCheckbox = { value: 'strength', checked: true };
      onboarding.toggleSecondarySport(mockCheckbox);

      expect(onboarding.onboardingData.secondary_sports).toContain('strength');
    });

    it('should remove secondary sports', () => {
      onboarding.onboardingData.secondary_sports = ['strength', 'yoga'];

      const mockCheckbox = { value: 'strength', checked: false };
      onboarding.toggleSecondarySport(mockCheckbox);

      expect(onboarding.onboardingData.secondary_sports).toEqual(['yoga']);
    });

    it('should not add duplicates', () => {
      onboarding.onboardingData.secondary_sports = ['strength'];

      const mockCheckbox = { value: 'strength', checked: true };
      onboarding.toggleSecondarySport(mockCheckbox);

      expect(onboarding.onboardingData.secondary_sports).toEqual(['strength']);
    });
  });

  describe('Completion Summary', () => {
    it('should format sport focus correctly', () => {
      expect(onboarding.formatSportFocus('running')).toBe('Running');
      expect(onboarding.formatSportFocus('multi_sport')).toBe('Multi-Sport');
      expect(onboarding.formatSportFocus('unknown')).toBe('unknown');
    });

    it('should show equipment count', () => {
      onboarding.onboardingData.equipment_access = ['bike', 'pool', 'track'];
      onboarding.currentStep = 4; // Completion step

      const summary = onboarding.renderCompletionStep();
      expect(summary).toContain('3 items available');
    });

    it('should show training schedule', () => {
      onboarding.onboardingData.time_windows = {
        days_per_week: 5,
        typical_duration: 45,
      };
      onboarding.currentStep = 4;

      const summary = onboarding.renderCompletionStep();
      expect(summary).toContain('5 days/week');
      expect(summary).toContain('45min sessions');
    });

    it('should show injury status', () => {
      onboarding.currentStep = 4;

      // No injuries
      onboarding.onboardingData.injury_flags = [];
      let summary = onboarding.renderCompletionStep();
      expect(summary).toContain('No current limitations');

      // With injuries
      onboarding.onboardingData.injury_flags = ['knee', 'ankle'];
      summary = onboarding.renderCompletionStep();
      expect(summary).toContain('2 area(s) to accommodate');
    });
  });
});
