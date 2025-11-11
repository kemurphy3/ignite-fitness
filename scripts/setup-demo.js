#!/usr/bin/env node

/**
 * Demo Setup Script - Prepares demo environment with realistic data
 * Usage: npm run demo
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DemoSetup {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
    };

    this.steps = [
      'Validating Environment',
      'Checking Dependencies',
      'Generating Demo Configuration',
      'Seeding Demo Data',
      'Starting Development Server',
    ];

    this.currentStep = 0;
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  logStep(message) {
    this.currentStep += 1;
    this.log(`\n[${this.currentStep}/${this.steps.length}] ${message}`, 'cyan');
  }

  logSuccess(message) {
    this.log(`✓ ${message}`, 'green');
  }

  logWarning(message) {
    this.log(`⚠ ${message}`, 'yellow');
  }

  logError(message) {
    this.log(`✗ ${message}`, 'red');
  }

  async run() {
    try {
      this.log('\n🚀 Ignite Fitness Demo Setup', 'bright');
      this.log('==================================', 'blue');

      await this.validateEnvironment();
      await this.checkDependencies();
      const config = await this.generateDemoConfiguration();
      await this.seedDemoData();
      await this.prepareServer();

      this.showSuccessMessage(config);
    } catch (error) {
      this.logError(`Demo setup failed: ${error.message}`);
      if (error.stack) {
        this.log(error.stack, 'red');
      }
      this.showTroubleshootingGuide();
      process.exit(1);
    }
  }

  async validateEnvironment() {
    this.logStep('Validating Environment');

    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      const examplePath = path.join(process.cwd(), 'env.example');
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, envPath);
        this.logWarning('Created .env from env.example');
        this.logWarning('Update SUPABASE_URL and SUPABASE_ANON_KEY with your credentials');
      } else {
        throw new Error('env.example file not found. Cannot create .env file.');
      }
    }

    const envVars = this.parseEnv(envPath);
    const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missing = required.filter(key => {
      const value = envVars[key];
      return !value || value.includes('your-') || value.length < 10;
    });

    if (missing.length > 0) {
      this.logWarning(`Missing or invalid environment variables: ${missing.join(', ')}`);
      this.logWarning('Demo will fall back to local data if database connection fails.');
    }

    this.updateEnv(envPath, 'DEMO_MODE', 'true');
    this.updateEnv(envPath, 'DEMO_AUTO_LOGIN', 'true');
    this.updateEnv(envPath, 'BETA_TESTING_ENABLED', 'true');
    this.updateEnv(envPath, 'GUARDRAILS_ENABLED', 'true');
    this.updateEnv(envPath, 'SOCCER_SHAPE_ENABLED', 'true');
    this.updateEnv(envPath, 'WEEK_VIEW_ENABLED', 'true');

    this.logSuccess('Environment validated and configured for demo');
  }

  parseEnv(envPath) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex > 0) {
        const key = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim();
        envVars[key] = value;
      }
    });
    return envVars;
  }

  updateEnv(envPath, key, value) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, envContent);
  }

  async checkDependencies() {
    this.logStep('Checking Dependencies');

    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      this.log('Installing dependencies...', 'yellow');
      execSync('npm install', { stdio: 'inherit' });
    }

    this.logSuccess('Dependencies ready');
  }

  async generateDemoConfiguration() {
    this.logStep('Generating Demo Configuration');

    const config = {
      user: this.buildDemoUser(),
      sessions: this.buildTrainingHistory(),
      workouts: this.buildSoccerShapeWorkouts(),
      substitutionExamples: this.buildSubstitutionExamples(),
      scenarios: {
        rampRateViolation: true,
        missedDaysExample: true,
        painFlagExample: true,
        substitutionExamples: true,
      },
    };

    const dataDir = path.join(process.cwd(), 'data');
    this.ensureDir(dataDir);
    fs.writeFileSync(path.join(dataDir, 'demo-config.json'), JSON.stringify(config, null, 2));

    this.logSuccess('Demo configuration saved to data/demo-config.json');
    return config;
  }

  buildDemoUser() {
    return {
      username: 'demo_user',
      email: 'demo@ignitefitness.local',
      athleteName: 'Alex Demo',
      personalData: {
        experience: 'intermediate',
        age: 28,
        weightKg: 70,
        heightCm: 175,
      },
      goals: {
        primary: 'strength',
        secondary: ['endurance', 'speed'],
        target: 'improve_performance',
      },
      equipment: ['barbell', 'dumbbell', 'bodyweight', 'track', 'field', 'hill'],
      timeWindows: ['morning', 'evening'],
      injuryFlags: [],
      preferences: {
        aestheticFocus: 'functional',
        preferredDuration: 60,
        restDayPattern: 'sunday',
      },
      onboardingCompleted: true,
    };
  }

  buildTrainingHistory() {
    const sessions = [];
    const today = new Date();

    const weeks = [
      { load: 80, focus: 'base', notes: 'Building aerobic base' },
      { load: 88, focus: 'strength', notes: 'Strength emphasis with speed work' },
      { load: 95, focus: 'speed', notes: 'Speed and power development' },
      { load: 116, focus: 'peak', notes: 'High-intensity week (guardrail trigger)' },
    ];

    weeks.forEach((week, weekIndex) => {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (weeks.length - weekIndex) * 7);

      const sessionTemplates = [
        {
          name: 'Soccer Shape Track Session',
          category: 'soccer_shape',
          duration: 48,
          rpe: 8,
          tags: ['soccer_shape', 'intervals', 'speed'],
          notes: 'Sharp turnover on all 200s. Focused on efficient pacing.',
          multiplier: 1.45,
        },
        {
          name: 'Strength & Power',
          category: 'strength',
          duration: 60,
          rpe: 7,
          tags: ['strength', 'power'],
          notes: 'Lower body strength with acceleration drills.',
          multiplier: 1.2,
        },
        {
          name: 'Endurance Base Run',
          category: 'endurance',
          duration: 65,
          rpe: 6,
          tags: ['endurance', 'aerobic'],
          notes: 'Comfortable zone 2 effort. Focus on cadence.',
          multiplier: 1.0,
        },
        {
          name: 'Game Speed Field Drills',
          category: 'soccer_shape',
          duration: 42,
          rpe: 8,
          tags: ['soccer_shape', 'cod', 'acceleration'],
          notes: 'Reactive shuttles and COD work. Great sharpness.',
          multiplier: 1.5,
        },
      ];

      sessionTemplates.forEach((template, index) => {
        const sessionDate = new Date(weekStart);
        sessionDate.setDate(weekStart.getDate() + [1, 3, 5, 6][index]);

        const load = this.calculateLoad(template.duration, template.rpe, template.multiplier);

        sessions.push({
          id: `demo_completed_${sessionDate.toISOString().split('T')[0]}_${index}`,
          date: sessionDate.toISOString().split('T')[0],
          name: template.name,
          category: template.category,
          type: 'completed',
          duration: template.duration,
          rpe: template.rpe,
          load,
          notes: template.notes,
          tags: template.tags,
          completed: true,
          scenarios: {
            rampRateRisk: weekIndex === 3,
            missedDayRecovery: false,
            painFlagResponse: false,
          },
        });
      });

      if (weekIndex === 1) {
        const missedDate = new Date(weekStart);
        missedDate.setDate(weekStart.getDate() + 4);
        sessions.push({
          id: `demo_missed_${missedDate.toISOString().split('T')[0]}`,
          date: missedDate.toISOString().split('T')[0],
          name: 'Missed Training Day',
          category: 'recovery',
          type: 'missed',
          duration: 0,
          rpe: 0,
          load: 0,
          notes: 'Travel day - missed scheduled session',
          tags: ['missed_day', 'recovery'],
          completed: false,
          scenarios: {
            rampRateRisk: false,
            missedDayRecovery: true,
            painFlagResponse: false,
          },
        });
      }

      if (weekIndex === 2) {
        const painDate = new Date(weekStart);
        painDate.setDate(weekStart.getDate() + 2);
        sessions.push({
          id: `demo_pain_${painDate.toISOString().split('T')[0]}`,
          date: painDate.toISOString().split('T')[0],
          name: 'Report Pain',
          category: 'injury',
          type: 'pain_flag',
          duration: 0,
          rpe: 0,
          load: 0,
          notes: 'Reported knee tightness after sprint work. Guardrail triggers reduction.',
          tags: ['pain_flag', 'recovery'],
          completed: false,
          scenarios: {
            rampRateRisk: false,
            missedDayRecovery: false,
            painFlagResponse: true,
          },
        });
      }
    });

    const currentWeekPlan = this.buildCurrentWeekPlan(today);
    sessions.push(...currentWeekPlan);

    return sessions;
  }

  buildCurrentWeekPlan(today) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const plannedSessions = [
      {
        id: 'demo_planned_track',
        offset: 1,
        name: 'Track Intervals',
        category: 'soccer_shape',
        estimatedDuration: 45,
        estimatedRpe: 8,
        estimatedLoad: 70,
        summary: '12 x 200m @ 90s, progressive pace',
      },
      {
        id: 'demo_planned_strength',
        offset: 3,
        name: 'Strength & Acceleration',
        category: 'strength',
        estimatedDuration: 60,
        estimatedRpe: 7,
        estimatedLoad: 60,
        summary: 'Lower body strength with sled pushes',
      },
      {
        id: 'demo_planned_field',
        offset: 5,
        name: 'Field Shuttles',
        category: 'soccer_shape',
        estimatedDuration: 40,
        estimatedRpe: 8,
        estimatedLoad: 72,
        summary: '5-10-5 shuttle series with reactive cues',
      },
    ];

    return plannedSessions.map(session => {
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(weekStart.getDate() + session.offset);

      const base = {
        id: session.id,
        date: sessionDate.toISOString().split('T')[0],
        name: session.name,
        category: session.category,
        summary: session.summary,
      };

      if (sessionDate < today) {
        const duration = session.estimatedDuration - 3;
        const rpe = session.estimatedRpe;
        return {
          ...base,
          type: 'completed',
          duration,
          rpe,
          load: this.calculateLoad(duration, rpe, 1.4),
          completed: true,
          notes: 'Completed planned session. Felt controlled and efficient.',
          tags: this.getSessionTags(session.category),
        };
      }

      return {
        ...base,
        type: 'planned',
        planned: true,
        plannedDuration: session.estimatedDuration,
        plannedRpe: session.estimatedRpe,
        plannedLoad: session.estimatedLoad,
        tags: this.getSessionTags(session.category),
      };
    });
  }

  buildSoccerShapeWorkouts() {
    return [
      {
        id: 'soccer_track_12x200',
        name: 'Track 12x200 Speed Endurance',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '15min easy jog + dynamic drills',
          main: '12 x 200m @ 85-90% effort, 90s jog recovery',
          cooldown: '10min easy jog + mobility',
        },
        intensity: {
          primary_zone: 'Z4',
          secondary_zone: 'Z5',
          rpe_range: '7-9',
        },
        tags: ['soccer_shape', 'speed_endurance', 'anaerobic_capacity', 'acceleration'],
        duration_minutes: 45,
        equipment: ['track', 'stopwatch'],
        load_factors: {
          intensity_multiplier: 1.45,
          volume_factor: 0.8,
          complexity_score: 6,
        },
      },
      {
        id: 'soccer_field_5_10_5',
        name: 'Field 5-10-5 Shuttle Series',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '10min mobility + neural activation',
          main: '3 blocks x (6 x 5-10-5 shuttle), 60s rest',
          cooldown: '8min walk + stretching',
        },
        intensity: {
          primary_zone: 'Z5',
          secondary_zone: 'Z4',
          rpe_range: '8-9',
        },
        tags: ['soccer_shape', 'COD', 'acceleration', 'neuromotor'],
        duration_minutes: 35,
        equipment: ['cones', 'field'],
        load_factors: {
          intensity_multiplier: 1.5,
          volume_factor: 0.75,
          complexity_score: 5,
        },
      },
      {
        id: 'soccer_hill_sprints',
        name: 'Hill Sprints 10x25s',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '12min easy jog + leg swings',
          main: '10 x 25s hill sprints (6-8% grade), walk-back recovery',
          cooldown: '10min jog + foam rolling',
        },
        intensity: {
          primary_zone: 'Z5',
          secondary_zone: 'Z4',
          rpe_range: '8-10',
        },
        tags: ['soccer_shape', 'power', 'acceleration', 'neuromotor'],
        duration_minutes: 40,
        equipment: ['hill'],
        load_factors: {
          intensity_multiplier: 1.6,
          volume_factor: 0.65,
          complexity_score: 5,
        },
      },
      {
        id: 'soccer_crossover_runs',
        name: 'Crossover Runs & Finishing',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '12min movement prep + passing drills',
          main: '4 sets x (4 crossover runs + finish), 2min rest',
          cooldown: '10min easy dribble + mobility',
        },
        intensity: {
          primary_zone: 'Z4',
          secondary_zone: 'Z5',
          rpe_range: '7-9',
        },
        tags: ['soccer_shape', 'neuromotor', 'finishing', 'acceleration'],
        duration_minutes: 50,
        equipment: ['goal', 'balls', 'cones'],
        load_factors: {
          intensity_multiplier: 1.4,
          volume_factor: 0.85,
          complexity_score: 6,
        },
      },
      {
        id: 'soccer_speed_ladders',
        name: 'Speed Ladders & Reactive Sprints',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '10min mobility + neural warm-up',
          main: '3 sets x (ladder patterns + 3 reactive sprints)',
          cooldown: '10min mobility + breathing',
        },
        intensity: {
          primary_zone: 'Z4',
          secondary_zone: 'Z5',
          rpe_range: '7-8',
        },
        tags: ['soccer_shape', 'neuromotor', 'reaction', 'agility'],
        duration_minutes: 38,
        equipment: ['speed ladder', 'cones'],
        load_factors: {
          intensity_multiplier: 1.3,
          volume_factor: 0.6,
          complexity_score: 7,
        },
      },
      {
        id: 'soccer_tempos',
        name: 'Tempo Runs 6x400',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '15min jog + drills',
          main: '6 x 400m @ 10k pace, 90s rest',
          cooldown: '10min jog + stretch',
        },
        intensity: {
          primary_zone: 'Z3',
          secondary_zone: 'Z4',
          rpe_range: '6-7',
        },
        tags: ['soccer_shape', 'tempo', 'endurance', 'aerobic_base'],
        duration_minutes: 50,
        equipment: ['track'],
        load_factors: {
          intensity_multiplier: 1.25,
          volume_factor: 0.9,
          complexity_score: 4,
        },
      },
      {
        id: 'soccer_small_sided',
        name: 'Small-Sided Games Conditioning',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '15min rondo + dynamic warm-up',
          main: '5 x 4min small-sided games, 2min rest',
          cooldown: '12min easy juggle + stretch',
        },
        intensity: {
          primary_zone: 'Z4',
          secondary_zone: 'Z5',
          rpe_range: '7-8',
        },
        tags: ['soccer_shape', 'endurance', 'decision_making', 'anaerobic_capacity'],
        duration_minutes: 60,
        equipment: ['cones', 'goals', 'balls'],
        load_factors: {
          intensity_multiplier: 1.35,
          volume_factor: 1.0,
          complexity_score: 6,
        },
      },
      {
        id: 'soccer_recovery_cod',
        name: 'Recovery + COD Technique',
        modality: 'running',
        subcategory: 'soccer_shape',
        structure: {
          warmup: '10min mobility + activation',
          main: '3 rounds technical COD patterns (low intensity)',
          cooldown: '15min guided recovery',
        },
        intensity: {
          primary_zone: 'Z2',
          secondary_zone: 'Z3',
          rpe_range: '4-5',
        },
        tags: ['soccer_shape', 'recovery', 'technique', 'cod'],
        duration_minutes: 45,
        equipment: ['cones'],
        load_factors: {
          intensity_multiplier: 0.9,
          volume_factor: 0.6,
          complexity_score: 3,
        },
      },
    ];
  }

  buildSubstitutionExamples() {
    return [
      {
        original: {
          name: 'Track 5 Mile Z2 Run',
          modality: 'running',
          duration: 50,
          load: 55,
        },
        alternatives: [
          {
            name: '75min Zone 2 Cycling',
            modality: 'cycling',
            load: 57,
            reason: 'Maintains aerobic load with bike-friendly option',
            confidence: 0.92,
          },
          {
            name: '40min Steady Swim',
            modality: 'swimming',
            load: 52,
            reason: 'Low impact option with similar aerobic benefit',
            confidence: 0.88,
          },
          {
            name: 'Trail Run with Hill Repeats',
            modality: 'running',
            load: 58,
            reason: 'Terrain variation with comparable load',
            confidence: 0.9,
          },
        ],
      },
      {
        original: {
          name: 'Hill Sprints 12x25s',
          modality: 'running',
          duration: 40,
          load: 60,
        },
        alternatives: [
          {
            name: 'Treadmill Sprints 12x20s @ 6% incline',
            modality: 'running',
            load: 58,
            reason: 'Indoor alternative replicating hill profile',
            confidence: 0.9,
          },
          {
            name: 'Stadium Steps Power Session',
            modality: 'running',
            load: 62,
            reason: 'Similar neuromuscular demand with accessible equipment',
            confidence: 0.87,
          },
          {
            name: 'Bike Anaerobic Power 10x30/30',
            modality: 'cycling',
            load: 55,
            reason: 'Cross-modal option targeting anaerobic power',
            confidence: 0.84,
          },
        ],
      },
    ];
  }

  async seedDemoData() {
    this.logStep('Seeding Demo Data');
    try {
      execSync('node scripts/seed-demo-data.js', { stdio: 'inherit' });
      this.logSuccess('Demo data seeded successfully');
    } catch (error) {
      this.logWarning(`Demo data seeding failed: ${error.message}`);
      this.createFallbackData();
    }
  }

  createFallbackData() {
    const configPath = path.join(process.cwd(), 'data', 'demo-config.json');
    if (!fs.existsSync(configPath)) {
      this.logWarning('Demo configuration not found, creating minimal fallback data');
      const fallback = {
        user: this.buildDemoUser(),
        sessions: [
          {
            id: 'demo_fallback_session',
            date: new Date().toISOString().split('T')[0],
            name: 'Demo Strength Session',
            category: 'strength',
            type: 'completed',
            duration: 45,
            rpe: 7,
            load: 52,
            notes: 'Fallback session when database unavailable',
            tags: ['strength', 'demo'],
            completed: true,
          },
        ],
        workouts: this.buildSoccerShapeWorkouts().slice(0, 3),
        substitutionExamples: this.buildSubstitutionExamples(),
      };
      this.ensureDir(path.join(process.cwd(), 'data'));
      fs.writeFileSync(configPath, JSON.stringify(fallback, null, 2));
    }

    const fallbackPath = path.join(process.cwd(), 'data', 'fallback-demo.json');
    const localData = {
      demoMode: true,
      loadedAt: new Date().toISOString(),
      configPath: 'data/demo-config.json',
    };
    fs.writeFileSync(fallbackPath, JSON.stringify(localData, null, 2));
    this.logSuccess('Fallback demo data prepared');
  }

  async prepareServer() {
    this.logStep('Starting Development Server');
    const defaultPort = 3000;
    const port = (await this.isPortAvailable(defaultPort))
      ? defaultPort
      : await this.findFreePort(defaultPort + 1);
    if (port !== defaultPort) {
      this.logWarning(`Port ${defaultPort} in use, using port ${port} instead`);
      this.updateEnv(path.join(process.cwd(), '.env'), 'DEV_SERVER_PORT', String(port));
    }
    this.logSuccess(`Development server will run on http://localhost:${port}`);
    // Server is started by subsequent npm run serve command
  }

  async isPortAvailable(port) {
    const net = require('net');
    return new Promise(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port);
    });
  }

  async findFreePort(start) {
    for (let port = start; port < start + 100; port += 1) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    return 8080;
  }

  showSuccessMessage(config) {
    this.log('\n🎉 Demo Setup Complete!', 'green');
    this.log('========================', 'green');

    this.log("\nWhat's ready:", 'bright');
    this.log('• Demo user with 4 weeks of realistic training history', 'green');
    this.log('• Soccer-shape workout catalog (8+ specialized sessions)', 'green');
    this.log('• Guardrail scenarios (ramp rate, missed days, pain flags)', 'green');
    this.log('• Planned vs completed data for Week view validation', 'green');
    this.log('• Cross-modal substitution examples', 'green');

    this.log('\nNext steps:', 'cyan');
    this.log('1. npm run serve (automatically invoked by npm run demo)', 'cyan');
    this.log('2. Open http://localhost:3000 (or configured port)', 'cyan');
    this.log('3. Auto-login with demo user (DEMO_AUTO_LOGIN=true)', 'cyan');
    this.log('4. Follow docs/beta_checklist.md for complete validation', 'cyan');

    this.log('\nDemo credentials:', 'blue');
    this.log(`• Email: ${config.user.email}`, 'blue');
    this.log('• Auto-login enabled: no password required', 'blue');

    this.log('\n📖 Detailed testing guide: docs/beta_checklist.md', 'bright');
  }

  showTroubleshootingGuide() {
    this.log('\n🔧 Troubleshooting Guide', 'yellow');
    this.log('========================', 'yellow');
    this.log('• Ensure Node.js 18+ is installed', 'yellow');
    this.log('• Verify npm install completed successfully', 'yellow');
    this.log('• Check .env for valid SUPABASE_URL and SUPABASE_ANON_KEY', 'yellow');
    this.log('• If database unavailable, demo falls back to local data', 'yellow');
    this.log('• After issues resolved, rerun: npm run demo', 'yellow');
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  calculateLoad(durationMinutes, rpe, multiplier) {
    return Math.round(rpe * (durationMinutes / 60) * multiplier * 10) / 10;
  }

  getSessionTags(category) {
    const tagMap = {
      strength: ['strength', 'progressive_overload'],
      soccer_shape: ['soccer_shape', 'game_ready'],
      endurance: ['endurance', 'aerobic'],
      speed: ['speed', 'power'],
      injury: ['recovery'],
    };
    return tagMap[category] || ['general'];
  }
}

if (require.main === module) {
  const setup = new DemoSetup();
  setup.run().catch(error => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = DemoSetup;
