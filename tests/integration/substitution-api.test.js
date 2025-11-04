/**
 * Substitution API Integration Tests
 * Tests the complete API endpoint functionality
 */

import { describe, it, expect } from 'vitest';

describe('Substitution API Integration', () => {
    const API_BASE = process.env.TEST_API_BASE || 'http://localhost:8888/.netlify/functions';

    describe('POST /substitutions', () => {
        it('should handle "Run 50 min Z2" to Bike substitution', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 50,
                    intensity: 'Z2',
                    adaptation: 'aerobic_base'
                },
                target_modality: 'cycling',
                user_context: {
                    equipment: ['bike'],
                    available_time: 90
                }
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.status).toBe(200);

            const result = await response.json();
            expect(result.success).toBe(true);
            expect(result.substitutions.length).toBeGreaterThan(0);

            const substitution = result.substitutions[0];
            expect(substitution.modality).toBe('cycling');
            expect(substitution.duration_minutes).toBeGreaterThanOrEqual(60);
            expect(substitution.duration_minutes).toBeLessThanOrEqual(75);
            expect(substitution.load_variance_percent).toBeLessThanOrEqual(10);
            expect(substitution.reasoning).toContain('duration');
        });

        it('should preserve VO2 session characteristics', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 40,
                    intensity: 'Z4',
                    adaptation: 'vo2_max',
                    structure: [
                        { block_type: 'warmup', duration: 15, intensity: 'Z1' },
                        { block_type: 'main', sets: 6, work_duration: 240, rest_duration: 120, intensity: 'Z4' },
                        { block_type: 'cooldown', duration: 10, intensity: 'Z1' }
                    ]
                },
                target_modality: 'swimming',
                user_context: {
                    equipment: ['pool'],
                    available_time: 60
                }
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.status).toBe(200);

            const result = await response.json();
            expect(result.success).toBe(true);

            const substitution = result.substitutions[0];
            expect(substitution.adaptation).toContain('vo2');
            expect(substitution.confidence_score).toBeGreaterThan(0.6);

            const mainBlock = substitution.structure?.find(block => block.block_type === 'main');
            if (mainBlock && mainBlock.sets) {
                expect(mainBlock.intensity).toMatch(/Z[45]/);
            }
        });

        it('should validate required parameters', async () => {
            const invalidPayload = {
                target_modality: 'cycling'
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invalidPayload)
            });

            expect(response.status).toBe(400);

            const result = await response.json();
            expect(result.error).toContain('planned_session is required');
            expect(result.example).toBeDefined();
        });

        it('should validate modality parameter', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 30,
                    intensity: 'Z2'
                },
                target_modality: 'invalid_modality'
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            expect(response.status).toBe(400);

            const result = await response.json();
            expect(result.error).toContain('Invalid target_modality');
        });

        it('should handle CORS preflight requests', async () => {
            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'OPTIONS'
            });

            expect(response.status).toBe(200);
            expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
            expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        });

        it('should return processing time and statistics', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 45,
                    intensity: 'Z3',
                    adaptation: 'lactate_threshold'
                },
                target_modality: 'cycling'
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            expect(result.metadata).toBeDefined();
            expect(result.metadata.processing_time_ms).toBeGreaterThan(0);
            expect(result.metadata.processing_time_ms).toBeLessThan(2000);
            expect(result.metadata.stats).toBeDefined();
            expect(result.metadata.stats.count).toBeGreaterThan(0);
        });

        it('should handle equipment constraints', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 40,
                    intensity: 'Z2'
                },
                target_modality: 'swimming',
                user_context: {
                    equipment: [],
                    available_time: 60
                }
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 200) {
                const result = await response.json();
                result.substitutions.forEach(sub => {
                    expect(sub.equipment_required).not.toContain('pool');
                });
            } else {
                expect(response.status).toBe(404);
            }
        });

        it('should handle time constraints', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 120,
                    intensity: 'Z2'
                },
                target_modality: 'cycling',
                user_context: {
                    available_time: 60
                }
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 200) {
                const result = await response.json();
                result.substitutions.forEach(sub => {
                    expect(sub.duration_minutes).toBeLessThanOrEqual(60);
                });
            }
        });
    });

    describe('API Error Handling', () => {
        it('should handle malformed JSON', async () => {
            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json'
            });

            expect(response.status).toBe(500);
        });

        it('should handle method not allowed', async () => {
            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'GET'
            });

            expect(response.status).toBe(405);
        });

        it('should provide helpful error messages', async () => {
            const payload = {
                planned_session: {
                    modality: 'running',
                    duration_minutes: 30
                },
                target_modality: 'cycling'
            };

            const response = await fetch(`${API_BASE}/substitutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            expect(result.error).toBeDefined();
            expect(typeof result.error).toBe('string');
        });
    });

    describe('Load Calculation Integration', () => {
        it('should calculate loads using different methods', async () => {
            const sessionWithHR = {
                modality: 'running',
                duration_minutes: 45,
                hr_data: { avg_hr: 155 },
                user_profile: { max_hr: 190, rest_hr: 60 }
            };

            const sessionWithZones = {
                modality: 'running',
                duration_minutes: 45,
                zone_distribution: { Z2: 35, Z3: 10 }
            };

            const sessionWithRPE = {
                modality: 'running',
                duration_minutes: 45,
                rpe: 6
            };

            const payloads = [sessionWithHR, sessionWithZones, sessionWithRPE].map(session => ({
                planned_session: session,
                target_modality: 'cycling'
            }));

            for (const payload of payloads) {
                const response = await fetch(`${API_BASE}/substitutions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                expect(response.status).toBe(200);

                const result = await response.json();
                expect(result.metadata.original_session.estimated_load).toBeGreaterThan(0);
            }
        });
    });
});

