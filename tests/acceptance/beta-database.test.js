/**
 * Acceptance Tests for Beta Database Schema and Seed Data
 * Tests the complete flow from user creation to workout catalog access
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import DatabaseSeeder from '../../scripts/seed-database.js';

describe('Beta Database Acceptance Tests', () => {
    let seeder;
    let sql;

    beforeAll(async () => {
        seeder = new DatabaseSeeder();
        await seeder.initialize();
        sql = seeder.sql;

        // Run migrations and seeding
        console.log('🔧 Running database setup for acceptance tests...');
        await seeder.run();
    });

    describe('User Creation and Profile Setup', () => {
        it('should create a test user and setup multi-sport profile', async () => {
            const userId = 'test_user_' + Date.now();

            // Create user profile
            await sql`
                INSERT INTO user_profiles (user_id, profile_data, sport, position)
                VALUES (${userId}, '{"sports": ["running", "cycling", "swimming"]}'::jsonb, 'multi_sport', 'athlete')
            `;

            // Verify user creation
            const [user] = await sql`
                SELECT user_id, sport FROM user_profiles WHERE user_id = ${userId}
            `;

            expect(user).toBeDefined();
            expect(user.user_id).toBe(userId);
            expect(user.sport).toBe('multi_sport');
        });
    });

    describe('Workout Catalog Access', () => {
        it('should fetch non-empty catalogs for all 3 modalities', async () => {
            // Test running workouts
            const runningWorkouts = await sql`
                SELECT template_id, name, modality, category, adaptation
                FROM workout_templates
                WHERE modality = 'running' AND is_active = true
            `;

            expect(runningWorkouts.length).toBeGreaterThan(0);
            expect(runningWorkouts.length).toBeGreaterThanOrEqual(12);

            // Verify soccer-shape workouts exist
            const soccerWorkouts = runningWorkouts.filter(w => w.category === 'soccer');
            expect(soccerWorkouts.length).toBeGreaterThanOrEqual(4);

            // Verify track workouts exist
            const trackWorkouts = runningWorkouts.filter(w => w.category === 'track');
            expect(trackWorkouts.length).toBeGreaterThanOrEqual(4);

            // Test cycling workouts
            const cyclingWorkouts = await sql`
                SELECT template_id, name, modality, category
                FROM workout_templates
                WHERE modality = 'cycling' AND is_active = true
            `;

            expect(cyclingWorkouts.length).toBeGreaterThan(0);
            expect(cyclingWorkouts.length).toBeGreaterThanOrEqual(12);

            // Verify required cycling categories
            const enduranceWorkouts = cyclingWorkouts.filter(w => w.category === 'endurance');
            const tempoWorkouts = cyclingWorkouts.filter(w => w.category === 'tempo');
            const vo2Workouts = cyclingWorkouts.filter(w => w.category === 'vo2');

            expect(enduranceWorkouts.length).toBeGreaterThanOrEqual(4);
            expect(tempoWorkouts.length).toBeGreaterThanOrEqual(4);
            expect(vo2Workouts.length).toBeGreaterThanOrEqual(2);

            // Test swimming workouts
            const swimmingWorkouts = await sql`
                SELECT template_id, name, modality, category
                FROM workout_templates
                WHERE modality = 'swimming' AND is_active = true
            `;

            expect(swimmingWorkouts.length).toBeGreaterThan(0);
            expect(swimmingWorkouts.length).toBeGreaterThanOrEqual(12);

            // Verify required swimming categories
            const aerobicWorkouts = swimmingWorkouts.filter(w => w.category === 'aerobic');
            const thresholdWorkouts = swimmingWorkouts.filter(w => w.category === 'threshold');
            const swimmingVo2Workouts = swimmingWorkouts.filter(w => w.category === 'vo2');

            expect(aerobicWorkouts.length).toBeGreaterThanOrEqual(4);
            expect(thresholdWorkouts.length).toBeGreaterThanOrEqual(4);
            expect(swimmingVo2Workouts.length).toBeGreaterThanOrEqual(4);

            console.log(`✅ Workout catalogs verified: ${runningWorkouts.length} running, ${cyclingWorkouts.length} cycling, ${swimmingWorkouts.length} swimming`);
        });

        it('should have properly structured workout templates', async () => {
            // Get a sample workout and verify its structure
            const [workout] = await sql`
                SELECT template_id, name, structure, estimated_load, time_required
                FROM workout_templates
                WHERE template_id = 'run_track_200m_repeats'
            `;

            expect(workout).toBeDefined();
            expect(workout.structure).toBeDefined();
            expect(Array.isArray(workout.structure)).toBe(true);
            expect(workout.structure.length).toBeGreaterThan(0);

            // Verify structure has required blocks
            const structure = workout.structure;
            const hasWarmup = structure.some(block => block.block_type === 'warmup');
            const hasMain = structure.some(block => block.block_type === 'main');
            const hasCooldown = structure.some(block => block.block_type === 'cooldown');

            expect(hasWarmup).toBe(true);
            expect(hasMain).toBe(true);
            expect(hasCooldown).toBe(true);

            // Verify load and time estimates
            expect(workout.estimated_load).toBeGreaterThan(0);
            expect(workout.time_required).toBeGreaterThan(0);
        });
    });

    describe('Substitution Rules Verification', () => {
        it('should query substitution rules for Run→Bike Z2 and return scale ~1.3±0.05', async () => {
            const [rule] = await sql`
                SELECT rule_id, time_factor, load_factor, confidence_score
                FROM substitution_rules
                WHERE from_modality = 'running'
                AND to_modality = 'cycling'
                AND from_zone = 'Z2'
                AND is_active = true
            `;

            expect(rule).toBeDefined();
            expect(rule.time_factor).toBeGreaterThan(1.25);
            expect(rule.time_factor).toBeLessThan(1.35);
            expect(Math.abs(rule.time_factor - 1.3)).toBeLessThanOrEqual(0.05);
            expect(rule.confidence_score).toBeGreaterThan(0.5);

            console.log(`✅ Run→Bike Z2 substitution verified: factor=${rule.time_factor}, confidence=${rule.confidence_score}`);
        });

        it('should have complete substitution rule matrix', async () => {
            const modalities = ['running', 'cycling', 'swimming'];
            const zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

            for (const fromMod of modalities) {
                for (const toMod of modalities) {
                    if (fromMod === toMod) continue;

                    for (const zone of zones) {
                        const [rule] = await sql`
                            SELECT rule_id FROM substitution_rules
                            WHERE from_modality = ${fromMod}
                            AND to_modality = ${toMod}
                            AND from_zone = ${zone}
                            AND is_active = true
                        `;

                        expect(rule).toBeDefined();
                        expect(rule.rule_id).toBe(`${fromMod}_to_${toMod}_${zone.toLowerCase()}`);
                    }
                }
            }

            console.log('✅ Complete substitution rule matrix verified');
        });

        it('should have modality conversion factors', async () => {
            const factors = await sql`
                SELECT from_modality, to_modality, base_time_factor, met_ratio
                FROM modality_factors
            `;

            expect(factors.length).toBe(6); // 3 modalities × 2 directions each

            // Verify specific conversions exist
            const runToCycle = factors.find(f => f.from_modality === 'running' && f.to_modality === 'cycling');
            const cycleToRun = factors.find(f => f.from_modality === 'cycling' && f.to_modality === 'running');

            expect(runToCycle).toBeDefined();
            expect(cycleToRun).toBeDefined();
            expect(runToCycle.base_time_factor).toBeGreaterThan(1.0); // Running to cycling should be longer
            expect(cycleToRun.base_time_factor).toBeLessThan(1.0); // Cycling to running should be shorter
        });
    });

    describe('Guardrails Configuration', () => {
        it('should load guardrails successfully for all training levels', async () => {
            const levels = ['beginner', 'intermediate', 'advanced', 'elite'];

            for (const level of levels) {
                const [config] = await sql`
                    SELECT config_name, training_level, weekly_load_cap,
                           weekly_hard_minutes_cap, max_weekly_load_increase
                    FROM guardrails_config
                    WHERE training_level = ${level} AND is_active = true
                `;

                expect(config).toBeDefined();
                expect(config.training_level).toBe(level);
                expect(config.weekly_load_cap).toBeGreaterThan(0);
                expect(config.weekly_hard_minutes_cap).toBeGreaterThan(0);
                expect(config.max_weekly_load_increase).toBeGreaterThan(0);
                expect(config.max_weekly_load_increase).toBeLessThanOrEqual(0.15); // Max 15% increase
            }

            console.log(`✅ Guardrails verified for all ${levels.length} training levels`);
        });

        it('should have progressive guardrail restrictions by level', async () => {
            const configs = await sql`
                SELECT training_level, weekly_load_cap, weekly_hard_minutes_cap,
                       max_weekly_load_increase, min_hours_between_hard
                FROM guardrails_config
                WHERE is_active = true
                ORDER BY
                    CASE training_level
                        WHEN 'beginner' THEN 1
                        WHEN 'intermediate' THEN 2
                        WHEN 'advanced' THEN 3
                        WHEN 'elite' THEN 4
                    END
            `;

            expect(configs.length).toBe(4);

            // Verify progressive increases
            for (let i = 1; i < configs.length; i++) {
                const current = configs[i];
                const previous = configs[i - 1];

                expect(current.weekly_load_cap).toBeGreaterThan(previous.weekly_load_cap);
                expect(current.weekly_hard_minutes_cap).toBeGreaterThan(previous.weekly_hard_minutes_cap);
            }

            // Verify beginner has strictest safety margins
            const beginner = configs[0];
            expect(beginner.min_hours_between_hard).toBeGreaterThanOrEqual(48);
            expect(beginner.max_weekly_load_increase).toBeLessThanOrEqual(0.10);
        });

        it('should have zone definitions for training zones', async () => {
            const zones = await sql`
                SELECT zone_name, zone_number, description, primary_adaptations
                FROM zone_definitions
                ORDER BY zone_number
            `;

            expect(zones.length).toBe(5); // Z1 through Z5

            const zoneNames = zones.map(z => z.zone_name);
            expect(zoneNames).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);

            // Verify each zone has adaptations
            zones.forEach(zone => {
                expect(zone.primary_adaptations).toBeDefined();
                expect(Array.isArray(zone.primary_adaptations)).toBe(true);
                expect(zone.primary_adaptations.length).toBeGreaterThan(0);
            });

            console.log('✅ All 5 training zones defined with adaptations');
        });
    });

    describe('Database Integration', () => {
        it('should support workout planning workflow', async () => {
            const userId = 'test_planner_' + Date.now();

            // Create user
            await sql`
                INSERT INTO user_profiles (user_id, profile_data, sport)
                VALUES (${userId}, '{"trainingLevel": "intermediate"}'::jsonb, 'running')
            `;

            // Get a workout template
            const [template] = await sql`
                SELECT template_id, estimated_load FROM workout_templates
                WHERE modality = 'running' AND category = 'track'
                LIMIT 1
            `;

            // Create a planned session
            const sessionId = 'session_' + Date.now();
            await sql`
                INSERT INTO session_logs (user_id, session_id, date, workout_name)
                VALUES (${userId}, ${sessionId}, CURRENT_DATE, 'Test Workout')
            `;

            // Add enhanced session data
            await sql`
                INSERT INTO session_enhancements (
                    session_id, user_id, workout_template_id, modality,
                    planned_load, was_substituted
                ) VALUES (
                    ${sessionId}, ${userId}, ${template.template_id}, 'running',
                    ${template.estimated_load}, false
                )
            `;

            // Verify workflow
            const [result] = await sql`
                SELECT se.workout_template_id, se.planned_load, sl.workout_name
                FROM session_enhancements se
                JOIN session_logs sl ON se.session_id = sl.session_id
                WHERE se.user_id = ${userId}
            `;

            expect(result).toBeDefined();
            expect(result.workout_template_id).toBe(template.template_id);
            expect(result.planned_load).toBe(template.estimated_load);

            console.log('✅ Workout planning workflow verified');
        });

        it('should enforce foreign key constraints', async () => {
            // Test that we cannot insert invalid references
            const invalidUserId = 'nonexistent_user';

            await expect(async () => {
                await sql`
                    INSERT INTO load_tracking (user_id, date, session_load, modality)
                    VALUES (${invalidUserId}, CURRENT_DATE, 50, 'running')
                `;
            }).rejects.toThrow();

            console.log('✅ Foreign key constraints working');
        });
    });

    afterAll(async () => {
        // Cleanup test data
        console.log('🧹 Cleaning up test data...');

        try {
            await sql`DELETE FROM session_enhancements WHERE user_id LIKE 'test_%'`;
            await sql`DELETE FROM session_logs WHERE user_id LIKE 'test_%'`;
            await sql`DELETE FROM user_profiles WHERE user_id LIKE 'test_%'`;
            console.log('✅ Test cleanup completed');
        } catch (error) {
            console.warn('⚠️ Cleanup error (may be expected):', error.message);
        }
    });
});

