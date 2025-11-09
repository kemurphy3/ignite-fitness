#!/usr/bin/env node

/**
 * Demo Data Seeding Script
 * Populates database or local storage with demo data for beta testing
 */

const fs = require('fs');
const path = require('path');

class DemoDataSeeder {
    constructor() {
        this.configPath = path.join(process.cwd(), 'data', 'demo-config.json');
        this.supabaseUrl = process.env.SUPABASE_URL;
        this.supabaseKey = process.env.SUPABASE_ANON_KEY;
        this.fetch = globalThis.fetch || null;
    }

    async seed() {
        console.log('🌱 Seeding demo data...');

        try {
            const config = this.loadConfig();
            const canUseDatabase = await this.canSeedDatabase();

            if (canUseDatabase) {
                await this.seedDatabase(config);
            } else {
                console.log('📂 Database unavailable, preparing local demo data');
                await this.seedLocal(config);
            }

            console.log('✅ Demo data seeding complete');
        } catch (error) {
            console.error('❌ Demo data seeding failed:', error.message);
            this.createMinimalFallback();
        }
    }

    loadConfig() {
        if (!fs.existsSync(this.configPath)) {
            throw new Error('Demo configuration missing. Run npm run demo first.');
        }
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    }

    async canSeedDatabase() {
        if (!this.supabaseUrl || !this.supabaseKey ||
            this.supabaseUrl.includes('your-') || this.supabaseKey.includes('your-')) {
            return false;
        }

        try {
            const response = await this.fetchFn(`${this.supabaseUrl}/rest/v1/`, {
                headers: {
                    apikey: this.supabaseKey,
                    Authorization: `Bearer ${this.supabaseKey}`
                },
                method: 'HEAD'
            });
            return response.ok;
        } catch (error) {
            console.warn('⚠️  Unable to reach Supabase:', error.message);
            return false;
        }
    }

    async seedDatabase(config) {
        console.log('🗄️  Seeding Supabase with demo data...');

        await this.seedUserProfile(config.user);
        await this.seedSessions(config.sessions);
        await this.seedWorkouts(config.workouts);
        await this.seedSubstitutionExamples(config.substitutionExamples);

        console.log('\n✅ Supabase demo data ready');
    }

    async seedUserProfile(user) {
        try {
            const response = await this.fetchFn(`${this.supabaseUrl}/rest/v1/user_profiles`, {
                method: 'POST',
                headers: this.supabaseHeaders('return=minimal'),
                body: JSON.stringify({
                    username: user.username,
                    email: user.email,
                    athlete_name: user.athleteName,
                    personal_data: user.personalData,
                    goals: user.goals,
                    equipment: user.equipment,
                    time_windows: user.timeWindows,
                    injury_flags: user.injuryFlags,
                    preferences: user.preferences,
                    onboarding_completed: true
                })
            });

            if (!response.ok) {
                console.log('ℹ️  User profile may already exist (skipping)');
            } else {
                console.log('✅ User profile seeded');
            }
        } catch (error) {
            console.log('⚠️  Failed to seed user profile:', error.message);
        }
    }

    async seedSessions(sessions) {
        process.stdout.write('📊 Seeding sessions ');
        for (const session of sessions) {
            const payload = {
                user_id: 'demo_user',
                session_id: session.id,
                session_date: session.date,
                session_name: session.name,
                category: session.category,
                type: session.type,
                duration_minutes: session.duration || session.plannedDuration || null,
                rpe: session.rpe || session.plannedRpe || null,
                load_score: session.load || session.plannedLoad || null,
                notes: session.notes || null,
                tags: session.tags || [],
                completed: session.completed ?? (session.type === 'completed'),
                planned: session.planned ?? (session.type === 'planned'),
                metadata: session.scenarios || null
            };

            try {
                const response = await this.fetchFn(`${this.supabaseUrl}/rest/v1/sessions`, {
                    method: 'POST',
                    headers: this.supabaseHeaders('return=minimal'),
                    body: JSON.stringify(payload)
                });

                process.stdout.write(response.ok ? '.' : 'x');
            } catch (error) {
                process.stdout.write('!');
            }
        }
        process.stdout.write('\n');
    }

    async seedWorkouts(workouts) {
        process.stdout.write('🏃 Seeding soccer-shape workouts ');
        for (const workout of workouts) {
            try {
                const response = await this.fetchFn(`${this.supabaseUrl}/rest/v1/exercises`, {
                    method: 'POST',
                    headers: this.supabaseHeaders('return=minimal'),
                    body: JSON.stringify({
                        exercise_id: workout.id,
                        name: workout.name,
                        modality: workout.modality,
                        subcategory: workout.subcategory,
                        structure: workout.structure,
                        intensity: workout.intensity,
                        tags: workout.tags,
                        duration_minutes: workout.duration_minutes,
                        equipment: workout.equipment,
                        load_factors: workout.load_factors
                    })
                });
                process.stdout.write(response.ok ? '.' : 'x');
            } catch (error) {
                process.stdout.write('!');
            }
        }
        process.stdout.write('\n');
    }

    async seedSubstitutionExamples(examples) {
        if (!examples || examples.length === 0) return;

        process.stdout.write('🔁 Seeding substitution examples ');
        for (const example of examples) {
            try {
                const response = await this.fetchFn(`${this.supabaseUrl}/rest/v1/substitution_examples`, {
                    method: 'POST',
                    headers: this.supabaseHeaders('return=minimal'),
                    body: JSON.stringify(example)
                });
                process.stdout.write(response.ok ? '.' : 'x');
            } catch (error) {
                process.stdout.write('!');
            }
        }
        process.stdout.write('\n');
    }

    async seedLocal(config) {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const localData = {
            demoMode: true,
            loadedAt: new Date().toISOString(),
            user: config.user,
            sessions: config.sessions,
            workouts: config.workouts,
            substitutionExamples: config.substitutionExamples
        };

        fs.writeFileSync(path.join(dataDir, 'local-demo.json'), JSON.stringify(localData, null, 2));

        const browserDataPath = path.join(dataDir, 'demo-data.js');
        const browserScript = `// Auto-generated demo data\n(function() {\n  const data = ${JSON.stringify(localData, null, 2)};\n  window.DEMO_DATA = data;\n  try {\n    if (typeof localStorage !== 'undefined') {\n      localStorage.setItem('DEMO_MODE', 'true');\n      localStorage.setItem('demo_user', JSON.stringify(data.user));\n      localStorage.setItem('demo_sessions', JSON.stringify(data.sessions));\n      localStorage.setItem('demo_workouts', JSON.stringify(data.workouts));\n      localStorage.setItem('demo_substitutions', JSON.stringify(data.substitutionExamples));\n      localStorage.setItem('onboarding_completed', 'true');\n      console.log('✅ Demo data loaded into localStorage');\n    }\n  } catch (error) {\n    console.warn('⚠️  Unable to write demo data to localStorage:', error);\n  }\n})();\n`;

        fs.writeFileSync(browserDataPath, browserScript);

        console.log('✅ Local demo data prepared (data/local-demo.json)');
    }

    createMinimalFallback() {
        const fallbackDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(fallbackDir)) {
            fs.mkdirSync(fallbackDir, { recursive: true });
        }

        const fallback = {
            demoMode: true,
            user: {
                username: 'demo_user',
                onboardingCompleted: true,
                personalData: { experience: 'intermediate' }
            },
            sessions: [
                {
                    id: 'fallback_session',
                    date: new Date().toISOString().split('T')[0],
                    name: 'Demo Session',
                    category: 'strength',
                    type: 'completed',
                    duration: 40,
                    rpe: 7,
                    load: 45,
                    completed: true
                }
            ],
            workouts: [],
            substitutionExamples: []
        };

        fs.writeFileSync(path.join(fallbackDir, 'minimal-demo.json'), JSON.stringify(fallback, null, 2));
        console.log('✅ Minimal fallback data written to data/minimal-demo.json');
    }

    supabaseHeaders(prefer = null) {
        const headers = {
            'Content-Type': 'application/json',
            apikey: this.supabaseKey,
            Authorization: `Bearer ${this.supabaseKey}`
        };
        if (prefer) headers.Prefer = prefer;
        return headers;
    }

    async fetchFn(url, options) {
        if (this.fetch) {
            return this.fetch(url, options);
        }
        const { default: nodeFetch } = await import('node-fetch');
        this.fetch = nodeFetch;
        return nodeFetch(url, options);
    }
}

if (require.main === module) {
    const seeder = new DemoDataSeeder();
    seeder.seed().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = DemoDataSeeder;
