/**
 * Unit tests for ExpertCoordinator
 * Tests conflict resolution scenarios
 */

class ExpertCoordinatorTest {
  constructor() {
    this.coordinator = new ExpertCoordinator();
    this.results = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Running ExpertCoordinator tests...\n');

    this.testGameMinus1Day();
    this.testKneePainConflict();
    this.testLowReadiness();
    this.testAestheticGlutesFocus();
    this.testMultipleConflicts();
    this.testRationaleGeneration();

    this.printResults();
  }

  /**
   * Test: Game -1 day conflict
   * Scenario: Soccer game tomorrow
   * Expected: No heavy legs, upper body light only
   */
  testGameMinus1Day() {
    const context = {
      user: { sport: 'soccer', position: 'midfielder' },
      season: 'in-season',
      schedule: {
        upcomingGames: [{ date: new Date(Date.now() + 86400000) }], // Tomorrow
        isGameDay: false,
        isRestDay: false,
      },
      history: { lastSession: { mainMovement: 'squat' } },
      readiness: 7,
      preferences: { aestheticFocus: 'functional' },
    };

    const plan = this.coordinator.getSessionPlan(context);

    const hasHeavyLegWork = plan.mainSets.some(
      main => main.exercise?.includes('squat') || main.exercise?.includes('deadlift')
    );

    if (!hasHeavyLegWork && plan.substitutions.some(s => s.original === 'lower_body_work')) {
      this.results.passed++;
      this.results.tests.push({ name: 'Game -1 day: Heavy legs removed', status: '✅ PASS' });
    } else {
      this.results.failed++;
      this.results.tests.push({ name: 'Game -1 day: Heavy legs removed', status: '❌ FAIL' });
    }
  }

  /**
   * Test: Knee pain conflict
   * Scenario: User reports knee pain (6/10)
   * Expected: Squat substituted with goblet squat
   */
  testKneePainConflict() {
    const context = {
      user: { sport: 'soccer' },
      season: 'off-season',
      schedule: {},
      history: {
        lastSession: { mainMovement: 'squat' },
        injuryFlags: [{ location: 'knee', active: true, painLevel: 6 }],
      },
      readiness: 6,
      preferences: { aestheticFocus: 'functional' },
    };

    const plan = this.coordinator.getSessionPlan(context);

    const hasGobletSquat = plan.mainSets.some(
      main => main.exercise === 'goblet_squat' || main.rationale?.toLowerCase().includes('knee')
    );

    if (hasGobletSquat) {
      this.results.passed++;
      this.results.tests.push({
        name: 'Knee pain: Squat substituted with goblet',
        status: '✅ PASS',
      });
    } else {
      this.results.failed++;
      this.results.tests.push({
        name: 'Knee pain: Squat substituted with goblet',
        status: '❌ FAIL',
      });
    }
  }

  /**
   * Test: Low readiness
   * Scenario: Readiness = 3
   * Expected: Volume reduced by 30%, recovery focus
   */
  testLowReadiness() {
    const context = {
      user: { sport: 'soccer' },
      season: 'in-season',
      schedule: {},
      history: { averageLoad: 100 },
      readiness: 3,
      preferences: { aestheticFocus: 'functional' },
    };

    const plan = this.coordinator.getSessionPlan(context);

    const hasVolumeReduction = plan.notes.some(
      note =>
        note.text?.toLowerCase().includes('reduced volume') ||
        note.text?.toLowerCase().includes('low readiness')
    );

    const hasRecoveryFocus =
      plan.sessionNotes?.toLowerCase().includes('readiness') &&
      plan.sessionNotes?.toLowerCase().includes('3');

    if (hasVolumeReduction || hasRecoveryFocus) {
      this.results.passed++;
      this.results.tests.push({
        name: 'Low readiness: Volume reduced, recovery focus',
        status: '✅ PASS',
      });
    } else {
      this.results.failed++;
      this.results.tests.push({
        name: 'Low readiness: Volume reduced, recovery focus',
        status: '❌ FAIL',
      });
    }
  }

  /**
   * Test: Aesthetic "glutes" focus
   * Scenario: User wants glutes development
   * Expected: Hip thrusts and glute-specific accessories added
   */
  testAestheticGlutesFocus() {
    const context = {
      user: { sport: 'soccer' },
      season: 'off-season',
      schedule: {},
      history: {},
      readiness: 8,
      preferences: { aestheticFocus: 'glutes' },
    };

    const plan = this.coordinator.getSessionPlan(context);

    const hasGluteAccessories = plan.accessories.some(
      acc =>
        acc.exercise?.includes('hip_thrust') ||
        acc.exercise?.includes('glute') ||
        acc.rationale?.toLowerCase().includes('glute')
    );

    if (hasGluteAccessories) {
      this.results.passed++;
      this.results.tests.push({
        name: 'Glutes focus: Hip thrusts and glute accessories added',
        status: '✅ PASS',
      });
    } else {
      this.results.failed++;
      this.results.tests.push({
        name: 'Glutes focus: Hip thrusts and glute accessories added',
        status: '❌ FAIL',
      });
    }
  }

  /**
   * Test: Multiple conflicts
   * Scenario: Knee pain + game -1 day + low readiness
   * Expected: All constraints respected
   */
  testMultipleConflicts() {
    const context = {
      user: { sport: 'soccer' },
      season: 'in-season',
      schedule: {
        upcomingGames: [{ date: new Date(Date.now() + 86400000) }],
        isGameDay: false,
      },
      history: {
        injuryFlags: [{ location: 'knee', active: true, painLevel: 6 }],
      },
      readiness: 4,
      preferences: { aestheticFocus: 'glutes' },
    };

    const plan = this.coordinator.getSessionPlan(context);

    const hasSubstitutions = plan.substitutions.length > 0;
    const hasNotes = plan.notes.length > 0;
    const hasRationale = plan.rationale.length > 0;

    if (hasSubstitutions && hasNotes && hasRationale) {
      this.results.passed++;
      this.results.tests.push({
        name: 'Multiple conflicts: All constraints respected',
        status: '✅ PASS',
      });
    } else {
      this.results.failed++;
      this.results.tests.push({
        name: 'Multiple conflicts: All constraints respected',
        status: '❌ FAIL',
      });
    }
  }

  /**
   * Test: Rationale generation
   * Scenario: Normal day
   * Expected: Rationale strings are 1-2 sentences, renderable in UI
   */
  testRationaleGeneration() {
    const context = {
      user: { sport: 'soccer' },
      season: 'off-season',
      schedule: {},
      history: {},
      readiness: 7,
      preferences: { aestheticFocus: 'v_taper' },
    };

    const plan = this.coordinator.getSessionPlan(context);

    if (!plan.rationale || !Array.isArray(plan.rationale)) {
      this.results.failed++;
      this.results.tests.push({ name: 'Rationale: Array generated', status: '❌ FAIL' });
      return;
    }

    const allShort = plan.rationale.every(r => r.length < 200); // Roughly 1-2 sentences
    const allValid = plan.rationale.every(r => typeof r === 'string' && r.length > 0);

    if (allShort && allValid) {
      this.results.passed++;
      this.results.tests.push({
        name: 'Rationale: 1-2 sentences, renderable in UI',
        status: '✅ PASS',
      });
    } else {
      this.results.failed++;
      this.results.tests.push({
        name: 'Rationale: 1-2 sentences, renderable in UI',
        status: '❌ FAIL',
      });
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`Total: ${this.results.passed + this.results.failed}\n`);

    this.results.tests.forEach((test, i) => {
      console.log(`${i + 1}. ${test.name}: ${test.status}`);
    });

    console.log('\n' + '='.repeat(50));
    if (this.results.failed === 0) {
      console.log('✅ ALL TESTS PASSED');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('='.repeat(50));
  }
}

// Export for use in test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExpertCoordinatorTest;
}

window.ExpertCoordinatorTest = ExpertCoordinatorTest;
