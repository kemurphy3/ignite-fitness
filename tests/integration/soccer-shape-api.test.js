/**
 * Soccer-Shape API Integration Tests
 * Tests for /workouts-soccer-shape and /workouts-substitutions endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDB, teardownTestDB, createTestUser, getTestDatabase } from '../helpers/db.js';

// Mock API endpoint URLs (adjust based on your test setup)
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:8888/.netlify/functions';
const WORKOUTS_SOCCER_SHAPE_ENDPOINT = `${API_BASE}/workouts-soccer-shape`;
const WORKOUTS_SUBSTITUTIONS_ENDPOINT = `${API_BASE}/workouts-substitutions`;

describe('Soccer-Shape API Integration', () => {
  let testUserId;
  let apiKey;
  let sql;

  beforeAll(async () => {
    await setupTestDB();
    const { userId, key } = await createTestUser();
    testUserId = userId;
    apiKey = key;
    sql = getTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe('GET /workouts-soccer-shape', () => {
    it('should return at least 8 soccer-shape workouts', async () => {
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.workouts).toBeDefined();
      expect(result.data.workouts.length).toBeGreaterThanOrEqual(8);

      // Verify all workouts have required properties
      result.data.workouts.forEach(workout => {
        expect(workout).toHaveProperty('name');
        expect(workout).toHaveProperty('template_id');
        expect(workout).toHaveProperty('tags');
        expect(workout.category).toBe('soccer_shape');
        expect(workout.calculated_load).toBeGreaterThan(0);
        expect(Array.isArray(workout.tags)).toBe(true);
      });
    });

    it('should filter by experience level', async () => {
      const response = await fetch(`${WORKOUTS_SOCCER_SHAPE_ENDPOINT}?experience_level=beginner`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.workouts.length > 0) {
        result.data.workouts.forEach(workout => {
          expect(workout.difficulty_level).toBe('beginner');
        });
      }
    });

    it('should filter by tags correctly', async () => {
      const response = await fetch(`${WORKOUTS_SOCCER_SHAPE_ENDPOINT}?tags=acceleration,COD`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.workouts.length > 0) {
        result.data.workouts.forEach(workout => {
          const hasAcceleration = workout.tags.includes('acceleration');
          const hasCOD = workout.tags.includes('COD');
          expect(hasAcceleration || hasCOD).toBe(true);
        });
      }
    });

    it('should filter by equipment', async () => {
      const response = await fetch(`${WORKOUTS_SOCCER_SHAPE_ENDPOINT}?equipment=track`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.workouts.length > 0) {
        result.data.workouts.forEach(workout => {
          expect(workout.equipment).toContain('track');
        });
      }
    });

    it('should return workouts with calculated load', async () => {
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      result.data.workouts.forEach(workout => {
        expect(workout.calculated_load).toBeGreaterThan(0);
        expect(typeof workout.calculated_load).toBe('number');
      });
    });

    it('should return substitution count for each workout', async () => {
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      result.data.workouts.forEach(workout => {
        expect(workout.substitution_count).toBeGreaterThanOrEqual(3);
        expect(workout.substitution_count).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('POST /workouts-substitutions', () => {
    let testWorkout;

    beforeAll(async () => {
      // Get a soccer-shape workout to test substitutions
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (result.success && result.data.workouts.length > 0) {
        testWorkout = result.data.workouts[0];
      }
    });

    it('should return 3 viable substitutions for each soccer-shape workout', async () => {
      if (!testWorkout) {
        console.warn('No test workout available, skipping substitution test');
        return;
      }

      const response = await fetch(WORKOUTS_SUBSTITUTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: testWorkout.template_id,
        }),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);
      expect(result.data.substitutions).toBeDefined();
      expect(result.data.substitutions.length).toBe(3);

      // Verify substitution quality
      result.data.substitutions.forEach(sub => {
        expect(sub.load_equivalency).toBeGreaterThan(70); // Within 30% load
        expect(sub.load_equivalency).toBeLessThan(130);
        expect(sub.adaptation_match).toBeGreaterThan(50); // At least 50% adaptation match
        expect(sub).toHaveProperty('reasoning');
      });
    });

    it('should handle equipment constraints', async () => {
      if (!testWorkout) {
        console.warn('No test workout available, skipping equipment constraint test');
        return;
      }

      // Find a workout that requires track
      const trackWorkout = await fetch(`${WORKOUTS_SOCCER_SHAPE_ENDPOINT}?equipment=track`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const trackResult = await trackWorkout.json();
      if (!trackResult.success || trackResult.data.workouts.length === 0) {
        console.warn('No track workouts available, skipping equipment constraint test');
        return;
      }

      const testTrackWorkout = trackResult.data.workouts[0];

      const response = await fetch(WORKOUTS_SUBSTITUTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: testTrackWorkout.template_id,
          constraints: {
            equipment: ['field', 'bodyweight'],
          },
        }),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      if (result.data.substitutions.length > 0) {
        result.data.substitutions.forEach(sub => {
          const hasAllowedEquipment = sub.equipment.some(eq =>
            ['field', 'bodyweight'].includes(eq)
          );
          expect(hasAllowedEquipment).toBe(true);
        });
      }
    });

    it('should provide reasoning for each substitution', async () => {
      if (!testWorkout) {
        console.warn('No test workout available, skipping reasoning test');
        return;
      }

      const response = await fetch(WORKOUTS_SUBSTITUTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: testWorkout.template_id,
        }),
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.substitution_reasoning).toBeDefined();
      expect(result.data.substitution_reasoning.length).toBe(3);

      result.data.substitution_reasoning.forEach((reasoning, index) => {
        expect(reasoning).toHaveProperty('workout_id');
        expect(reasoning).toHaveProperty('reasoning');
        expect(typeof reasoning.reasoning).toBe('string');
        expect(reasoning.reasoning.length).toBeGreaterThan(0);
      });
    });

    it('should return 404 for non-existent workout', async () => {
      const response = await fetch(WORKOUTS_SUBSTITUTIONS_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: 'non_existent_workout_id_12345',
        }),
      });

      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('WORKOUT_NOT_FOUND');
    });
  });

  describe('Tag System Validation', () => {
    it('should validate required soccer-shape tags exist', async () => {
      const requiredTags = ['acceleration', 'COD', 'VO2', 'anaerobic_capacity', 'neuromotor'];

      for (const tag of requiredTags) {
        const response = await fetch(`${WORKOUTS_SOCCER_SHAPE_ENDPOINT}?tags=${tag}`, {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();
        expect(response.status).toBe(200);
        expect(result.success).toBe(true);

        if (result.data.workouts.length > 0) {
          result.data.workouts.forEach(workout => {
            expect(workout.tags).toContain(tag);
          });
        }
      }
    });

    it('should correctly calculate load for tagged workouts', async () => {
      const response = await fetch(`${WORKOUTS_SOCCER_SHAPE_ENDPOINT}?tags=anaerobic_capacity`, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);

      if (result.data.workouts.length > 0) {
        result.data.workouts.forEach(workout => {
          if (workout.tags.includes('anaerobic_capacity')) {
            expect(workout.calculated_load).toBeGreaterThan(50); // Minimum expected load
          }
        });
      }
    });
  });

  describe('Database Integration', () => {
    it('should persist soccer-shape workouts correctly', async () => {
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.success).toBe(true);

      // Verify specific seed workouts exist (check for expected names)
      const expectedWorkoutNames = ['200m', '300m', 'shuttle', 'hill', 'sprint'];

      const workoutNames = result.data.workouts.map(w => w.name.toLowerCase()).join(' ');

      // At least one expected workout name should be present
      const found = expectedWorkoutNames.some(expectedName => workoutNames.includes(expectedName));

      expect(found).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT);

      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('AUTH_ERROR');
    });

    it('should reject invalid API key', async () => {
      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': 'invalid_key_12345',
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms', async () => {
      const startTime = Date.now();

      const response = await fetch(WORKOUTS_SOCCER_SHAPE_ENDPOINT, {
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(200); // Should respond within 200ms
    });
  });
});
