/**
 * Expert Coordinator Standalone Test
 * Run this in browser console for manual QA
 */

// Helper to load dependencies (ensure modules are loaded)
function setupTestEnvironment() {
  // Make sure all modules are loaded
  if (!window.ExpertCoordinator) {
    console.error('ExpertCoordinator not loaded');
    return false;
  }
  if (!window.ExerciseAdapter) {
    console.error('ExerciseAdapter not loaded');
    return false;
  }
  if (!window.SafeLogger) {
    window.SafeLogger = console;
  }
  return true;
}

// Test fixtures
const fixtures = {
  normal: {
    user: { sport: 'soccer', position: 'midfielder', weight: 75, height: 180, age: 25 },
    season: 'in-season',
    schedule: { upcomingGames: [], isGameDay: false, isRestDay: false },
    history: { lastSession: { mainMovement: 'deadlift', averageRPE: 7 } },
    readiness: 8,
    preferences: {
      aestheticFocus: 'functional',
      trainingMode: 'simple',
      availableDays: 4,
      sessionLength: 45,
    },
    constraints: { timeLimit: 45, equipment: ['barbell', 'dumbbells', 'bench'], flags: [] },
  },
  gameTomorrow: {
    user: { sport: 'soccer', position: 'midfielder', weight: 75, height: 180, age: 25 },
    season: 'in-season',
    schedule: {
      upcomingGames: [
        {
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          type: 'game',
          importance: 'high',
        },
      ],
      daysUntilGame: 1,
      isGameDay: false,
    },
    history: { lastSession: { mainMovement: 'deadlift', averageRPE: 7 } },
    readiness: 8,
    preferences: {
      aestheticFocus: 'functional',
      trainingMode: 'simple',
      availableDays: 4,
      sessionLength: 45,
    },
    constraints: {
      timeLimit: 45,
      equipment: ['barbell', 'dumbbells', 'bench'],
      flags: ['game_safety'],
    },
  },
  lowReadiness: {
    user: { sport: 'soccer', position: 'midfielder', weight: 75, height: 180, age: 25 },
    season: 'in-season',
    schedule: { upcomingGames: [], isGameDay: false, isRestDay: false },
    history: { lastSession: { mainMovement: 'squat', averageRPE: 9, totalVolume: 5000 } },
    readiness: 3,
    preferences: {
      aestheticFocus: 'functional',
      trainingMode: 'simple',
      availableDays: 4,
      sessionLength: 45,
    },
    constraints: { timeLimit: 45, equipment: ['barbell', 'dumbbells', 'bench'], flags: [] },
  },
  timeCrushed: {
    user: { sport: 'soccer', position: 'midfielder', weight: 75, height: 180, age: 25 },
    season: 'in-season',
    schedule: { upcomingGames: [], isGameDay: false, isRestDay: false },
    history: { lastSession: { mainMovement: 'deadlift', averageRPE: 7 } },
    readiness: 8,
    preferences: {
      aestheticFocus: 'functional',
      trainingMode: 'simple',
      availableDays: 4,
      sessionLength: 20,
    },
    constraints: { timeLimit: 20, equipment: ['barbell', 'dumbbells', 'bench'], flags: [] },
  },
  kneePain: {
    user: { sport: 'soccer', position: 'midfielder', weight: 75, height: 180, age: 25 },
    season: 'in-season',
    schedule: { upcomingGames: [], isGameDay: false, isRestDay: false },
    history: { lastSession: { mainMovement: 'deadlift', averageRPE: 7 } },
    readiness: 8,
    preferences: {
      aestheticFocus: 'functional',
      trainingMode: 'simple',
      availableDays: 4,
      sessionLength: 45,
    },
    constraints: {
      timeLimit: 45,
      equipment: ['barbell', 'dumbbells', 'bench'],
      flags: ['knee_pain'],
      painLocation: 'knee',
    },
  },
};

// Run all tests
async function runAllTests() {
  console.log('🧪 Expert Coordinator Tests\n');

  if (!setupTestEnvironment()) {
    console.error('❌ Test environment not ready');
    return;
  }

  const coordinator = new ExpertCoordinator();
  let passed = 0;
  let failed = 0;

  // Test 1: Normal context
  console.log('Test 1: Normal Context');
  try {
    const plan = await coordinator.planToday(fixtures.normal);
    validatePlan(plan);
    console.log('✅ PASSED\n');
    passed++;
  } catch (e) {
    console.error('❌ FAILED:', e.message, '\n');
    failed++;
  }

  // Test 2: Game tomorrow
  console.log('Test 2: Game Tomorrow');
  try {
    const plan = await coordinator.planToday(fixtures.gameTomorrow);
    const mainBlock = plan.blocks?.find(b => b.name === 'Main');
    const hasHeavyLower = mainBlock?.items?.some(
      ex => ex.name && (ex.name.includes('squat') || ex.name.includes('deadlift'))
    );
    if (hasHeavyLower) {
      throw new Error('Heavy lower body work still present');
    }
    if (
      !plan.why.some(r => r.toLowerCase().includes('game') || r.toLowerCase().includes('tomorrow'))
    ) {
      throw new Error('Rationale does not mention game');
    }
    console.log('✅ PASSED\n');
    passed++;
  } catch (e) {
    console.error('❌ FAILED:', e.message, '\n');
    failed++;
  }

  // Test 3: Low readiness
  console.log('Test 3: Low Readiness');
  try {
    const plan = await coordinator.planToday(fixtures.lowReadiness);
    if (plan.intensityScale >= 0.85) {
      throw new Error('Intensity not reduced enough');
    }
    if (
      !plan.why.some(
        r => r.toLowerCase().includes('readiness') || r.toLowerCase().includes('recover')
      )
    ) {
      throw new Error('Rationale does not mention readiness');
    }
    console.log('✅ PASSED\n');
    passed++;
  } catch (e) {
    console.error('❌ FAILED:', e.message, '\n');
    failed++;
  }

  // Test 4: Time-crunched
  console.log('Test 4: Time-Crunched');
  try {
    const plan = await coordinator.planToday(fixtures.timeCrushed);
    const totalDuration = plan.blocks?.reduce((sum, b) => sum + (b.durationMin || 0), 0) || 0;
    if (totalDuration > 25) {
      throw new Error('Plan too long for time limit');
    }
    const hasTimeOptimization =
      plan.blocks?.some(b => b.items?.some(ex => ex.notes && ex.notes.includes('superset'))) ||
      plan.why?.some(r => r.toLowerCase().includes('time'));
    if (!hasTimeOptimization) {
      throw new Error('No time optimization found');
    }
    console.log('✅ PASSED\n');
    passed++;
  } catch (e) {
    console.error('❌ FAILED:', e.message, '\n');
    failed++;
  }

  // Test 5: Knee pain
  console.log('Test 5: Knee Pain');
  try {
    const plan = await coordinator.planToday(fixtures.kneePain);
    const hasBSS = plan.blocks?.some(b =>
      b.items?.some(ex => ex.name && ex.name.includes('Bulgarian Split Squat'))
    );
    if (hasBSS) {
      throw new Error('Bulgarian Split Squats still present');
    }
    if (
      !plan.why?.some(r => r.toLowerCase().includes('safe') || r.toLowerCase().includes('knee'))
    ) {
      throw new Error('Rationale does not mention safe alternatives');
    }
    console.log('✅ PASSED\n');
    passed++;
  } catch (e) {
    console.error('❌ FAILED:', e.message, '\n');
    failed++;
  }

  // Summary
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
}

// Validate plan structure
function validatePlan(plan) {
  if (!plan.blocks || !Array.isArray(plan.blocks)) {
    throw new Error('Missing blocks array');
  }
  if (plan.blocks.length === 0) {
    throw new Error('Empty blocks array');
  }
  if (typeof plan.intensityScale !== 'number') {
    throw new Error('Missing or invalid intensityScale');
  }
  if (plan.intensityScale < 0.6 || plan.intensityScale > 1.1) {
    throw new Error('intensityScale out of range');
  }
  if (!plan.why || !Array.isArray(plan.why)) {
    throw new Error('Missing why array');
  }
  if (plan.why.length === 0) {
    throw new Error('Empty why array');
  }

  plan.blocks.forEach(block => {
    if (!block.name) {
      throw new Error('Block missing name');
    }
    if (!['Warm-up', 'Main', 'Accessories', 'Recovery'].includes(block.name)) {
      throw new Error('Invalid block name');
    }
    if (!block.items || !Array.isArray(block.items)) {
      throw new Error('Missing items array');
    }
    if (block.durationMin === undefined) {
      throw new Error('Missing durationMin');
    }
  });
}

// Export for use
window.runExpertCoordinatorTests = runAllTests;

console.log('Expert Coordinator Test loaded. Run: runExpertCoordinatorTests()');
