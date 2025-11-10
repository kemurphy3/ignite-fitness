#!/usr/bin/env node

/**
 * Database Seeding Script for Ignite Fitness Beta
 * Seeds workout templates, substitution rules, and guardrails
 */

const fs = require('fs').promises;
const path = require('path');

// Database connection (adjust based on your setup)
const { neon } = require('@neondatabase/serverless');

class DatabaseSeeder {
    constructor() {
        this.sql = null;
        this.seedDataPath = path.join(__dirname, '../data/seed');
    }

    async initialize() {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable is required');
        }

        this.sql = neon(databaseUrl);
        console.log('🔗 Database connection initialized');
    }

    async seedWorkoutTemplates() {
        console.log('🏃‍♂️ Seeding workout templates...');

        const workoutFiles = [
            'workouts_running.json',
            'workouts_cycling.json',
            'workouts_swimming.json',
            'soccer_shape_workouts.json'
        ];

        let totalWorkouts = 0;

        for (const file of workoutFiles) {
            const filePath = path.join(this.seedDataPath, file);
            const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

            const workoutArray = data.workouts || [];
            console.log(`  📄 Processing ${file} (${workoutArray.length} workouts)`);

            for (const workout of workoutArray) {
                try {
                    // Insert workout template
                    await this.sql`
                        INSERT INTO workout_templates (
                            template_id, name, modality, category, adaptation,
                            estimated_load, time_required, difficulty_level,
                            equipment_required, description, structure, tags
                        ) VALUES (
                            ${workout.template_id}, ${workout.name}, ${workout.modality},
                            ${workout.category}, ${workout.adaptation}, ${workout.estimated_load},
                            ${workout.time_required}, ${workout.difficulty_level},
                            ${JSON.stringify(workout.equipment_required)}::jsonb, ${workout.description},
                            ${JSON.stringify(workout.structure)}::jsonb, ${JSON.stringify(workout.tags)}::jsonb
                        ) ON CONFLICT (template_id) DO UPDATE SET
                            name = EXCLUDED.name,
                            adaptation = EXCLUDED.adaptation,
                            estimated_load = EXCLUDED.estimated_load,
                            structure = EXCLUDED.structure,
                            updated_at = CURRENT_TIMESTAMP
                    `;

                    // Insert workout blocks
                    for (let i = 0; i < workout.structure.length; i++) {
                        const block = workout.structure[i];
                        await this.sql`
                            INSERT INTO workout_blocks (
                                template_id, block_order, block_type, duration, sets,
                                work_duration, rest_duration, intensity, distance, description
                            ) VALUES (
                                ${workout.template_id}, ${i + 1}, ${block.block_type},
                                ${block.duration || null}, ${block.sets || null},
                                ${block.work_duration || null}, ${block.rest_duration || null},
                                ${block.intensity}, ${block.distance || null}, ${block.description || null}
                            ) ON CONFLICT (template_id, block_order) DO UPDATE SET
                                block_type = EXCLUDED.block_type,
                                duration = EXCLUDED.duration,
                                intensity = EXCLUDED.intensity,
                                description = EXCLUDED.description
                        `;
                    }

                    totalWorkouts++;
                } catch (error) {
                    console.error(`  ❌ Error seeding workout ${workout.template_id}:`, error.message);
                }
            }
        }

        console.log(`  ✅ Seeded ${totalWorkouts} workout templates`);
    }

    async seedSubstitutionRules() {
        console.log('🔄 Seeding substitution rules...');

        const filePath = path.join(this.seedDataPath, 'substitution_rules.json');
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

        // Seed modality factors
        for (const factor of data.modality_factors) {
            try {
                await this.sql`
                    INSERT INTO modality_factors (
                        from_modality, to_modality, base_time_factor, met_ratio,
                        biomechanical_factor, z1_adjustment, z2_adjustment,
                        z3_adjustment, z4_adjustment, z5_adjustment
                    ) VALUES (
                        ${factor.from_modality}, ${factor.to_modality}, ${factor.base_time_factor},
                        ${factor.met_ratio}, ${factor.biomechanical_factor}, ${factor.z1_adjustment},
                        ${factor.z2_adjustment}, ${factor.z3_adjustment}, ${factor.z4_adjustment},
                        ${factor.z5_adjustment}
                    ) ON CONFLICT (from_modality, to_modality) DO UPDATE SET
                        base_time_factor = EXCLUDED.base_time_factor,
                        met_ratio = EXCLUDED.met_ratio,
                        z1_adjustment = EXCLUDED.z1_adjustment,
                        z2_adjustment = EXCLUDED.z2_adjustment,
                        z3_adjustment = EXCLUDED.z3_adjustment,
                        z4_adjustment = EXCLUDED.z4_adjustment,
                        z5_adjustment = EXCLUDED.z5_adjustment
                `;
            } catch (error) {
                console.error(`  ❌ Error seeding modality factor ${factor.from_modality} to ${factor.to_modality}:`,
                    error.message);
            }
        }

        // Seed substitution rules
        let rulesSeeded = 0;
        for (const rule of data.substitution_rules) {
            try {
                await this.sql`
                    INSERT INTO substitution_rules (
                        rule_id, from_modality, to_modality, from_zone, to_zone,
                        time_factor, load_factor, confidence_score, min_duration,
                        max_duration, equipment_required, user_level, description,
                        research_citation
                    ) VALUES (
                        ${rule.rule_id}, ${rule.from_modality}, ${rule.to_modality},
                        ${rule.from_zone}, ${rule.to_zone}, ${rule.time_factor},
                        ${rule.load_factor}, ${rule.confidence_score}, ${rule.min_duration},
                        ${rule.max_duration}, ${JSON.stringify(rule.equipment_required)}::jsonb,
                        ${rule.user_level}, ${rule.description}, ${rule.research_citation}
                    ) ON CONFLICT (rule_id) DO UPDATE SET
                        time_factor = EXCLUDED.time_factor,
                        load_factor = EXCLUDED.load_factor,
                        confidence_score = EXCLUDED.confidence_score,
                        updated_at = CURRENT_TIMESTAMP
                `;
                rulesSeeded++;
            } catch (error) {
                console.error(`  ❌ Error seeding substitution rule ${rule.rule_id}:`, error.message);
            }
        }

        console.log(`  ✅ Seeded ${data.modality_factors.length} modality factors and ${rulesSeeded} substitution rules`);
    }

    async seedGuardrails() {
        console.log('🛡️ Seeding safety guardrails...');

        const filePath = path.join(this.seedDataPath, 'guardrails.json');
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

        // Seed guardrail configurations
        let configsSeeded = 0;
        for (const config of data.guardrails_configs) {
            try {
                await this.sql`
                    INSERT INTO guardrails_config (
                        config_name, training_level, weekly_load_cap, weekly_hard_minutes_cap,
                        daily_load_cap, max_weekly_load_increase, max_weekly_volume_increase,
                        max_weekly_intensity_increase, min_hours_between_hard, max_consecutive_hard_days,
                        required_easy_days_per_week, deload_frequency_weeks, max_pain_threshold,
                        high_soreness_threshold, soreness_load_reduction, missed_days_auto_deload
                    ) VALUES (
                        ${config.config_name}, ${config.training_level}, ${config.weekly_load_cap},
                        ${config.weekly_hard_minutes_cap}, ${config.daily_load_cap}, ${config.max_weekly_load_increase},
                        ${config.max_weekly_volume_increase}, ${config.max_weekly_intensity_increase},
                        ${config.min_hours_between_hard}, ${config.max_consecutive_hard_days},
                        ${config.required_easy_days_per_week}, ${config.deload_frequency_weeks},
                        ${config.max_pain_threshold}, ${config.high_soreness_threshold},
                        ${config.soreness_load_reduction}, ${config.missed_days_auto_deload}
                    ) ON CONFLICT (config_name) DO UPDATE SET
                        weekly_load_cap = EXCLUDED.weekly_load_cap,
                        weekly_hard_minutes_cap = EXCLUDED.weekly_hard_minutes_cap,
                        max_weekly_load_increase = EXCLUDED.max_weekly_load_increase,
                        updated_at = CURRENT_TIMESTAMP
                `;
                configsSeeded++;
            } catch (error) {
                console.error(`  ❌ Error seeding guardrail config ${config.config_name}:`, error.message);
            }
        }

        // Seed zone definitions
        let zonesSeeded = 0;
        for (const zone of data.zone_definitions) {
            try {
                await this.sql`
                    INSERT INTO zone_definitions (
                        zone_name, zone_number, description, physiological_marker,
                        perceived_exertion_range, hr_percent_min, hr_percent_max,
                        power_percent_min, power_percent_max, lactate_min, lactate_max,
                        primary_adaptations, typical_durations
                    ) VALUES (
                        ${zone.zone_name}, ${zone.zone_number}, ${zone.description},
                        ${zone.physiological_marker}, ${zone.perceived_exertion_range},
                        ${zone.hr_percent_min}, ${zone.hr_percent_max}, ${zone.power_percent_min},
                        ${zone.power_percent_max}, ${zone.lactate_min}, ${zone.lactate_max},
                        ${JSON.stringify(zone.primary_adaptations)}::jsonb, ${JSON.stringify(zone.typical_durations)}::jsonb
                    ) ON CONFLICT (zone_name) DO UPDATE SET
                        description = EXCLUDED.description,
                        physiological_marker = EXCLUDED.physiological_marker,
                        primary_adaptations = EXCLUDED.primary_adaptations
                `;
                zonesSeeded++;
            } catch (error) {
                console.error(`  ❌ Error seeding zone definition ${zone.zone_name}:`, error.message);
            }
        }

        console.log(`  ✅ Seeded ${configsSeeded} guardrail configs and ${zonesSeeded} zone definitions`);
    }

    async verifySeeding() {
        console.log('🔍 Verifying seeded data...');

        try {
            const [templates] = await this.sql`SELECT COUNT(*) as count FROM workout_templates WHERE is_active = true`;
            const [rules] = await this.sql`SELECT COUNT(*) as count FROM substitution_rules WHERE is_active = true`;
            const [configs] = await this.sql`SELECT COUNT(*) as count FROM guardrails_config WHERE is_active = true`;
            const [zones] = await this.sql`SELECT COUNT(*) as count FROM zone_definitions`;

            console.log(`  📊 Workout Templates: ${templates.count}`);
            console.log(`  📊 Substitution Rules: ${rules.count}`);
            console.log(`  📊 Guardrail Configs: ${configs.count}`);
            console.log(`  📊 Zone Definitions: ${zones.count}`);

            // Verify specific test cases
            const [runToBikeZ2] = await this.sql`
                SELECT time_factor FROM substitution_rules
                WHERE from_modality = 'running' AND to_modality = 'cycling' AND from_zone = 'Z2'
            `;

            if (runToBikeZ2 && Math.abs(runToBikeZ2.time_factor - 1.3) <= 0.05) {
                console.log(`  ✅ Run→Bike Z2 factor verified: ${runToBikeZ2.time_factor}`);
            } else {
                console.log(`  ❌ Run→Bike Z2 factor incorrect: ${runToBikeZ2?.time_factor || 'not found'}`);
            }

            return {
                templates: templates.count,
                rules: rules.count,
                configs: configs.count,
                zones: zones.count
            };
        } catch (error) {
            console.error('❌ Error verifying seeded data:', error.message);
            return null;
        }
    }

    async run() {
        try {
            console.log('🌱 Starting database seeding...');

            await this.initialize();
            await this.seedWorkoutTemplates();
            await this.seedSubstitutionRules();
            await this.seedGuardrails();

            const verification = await this.verifySeeding();

            if (verification) {
                console.log('\n✅ Database seeding completed successfully!');
                console.log(`📈 Total records seeded: ${verification.templates + verification.rules + verification.configs + verification.zones}`);
            } else {
                console.log('\n⚠️ Seeding completed but verification failed');
                process.exit(1);
            }
        } catch (error) {
            console.error('💥 Seeding failed:', error.message);
            process.exit(1);
        }
    }
}

// Run seeding if called directly
if (require.main === module) {
    const seeder = new DatabaseSeeder();
    seeder.run();
}

module.exports = DatabaseSeeder;

