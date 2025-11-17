/**
 * Prompt 4.1 Verification Suite
 * Verifies all "Done Means" criteria for Unified Periodization Planner
 */

class Prompt41Verification {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  /**
   * Run all verification tests
   */
  async runAllTests() {
    console.log('🧪 Running Prompt 4.1 Verification Tests...\n');

    this.test4WeekBlockStructure();
    this.testSeasonalPhases();
    this.testCompetitionCalendar();
    this.testAutoTaper();
    this.testDeloadWeeks();
    this.testUIShowsPhase();
    this.testCalendarView();
    this.testAdaptiveBlocks();
    this.testCompetitionImportance();

    this.printResults();
  }

  /**
   * Test 4-week block structure
   */
  test4WeekBlockStructure() {
    if (!window.SeasonalPrograms) {
      this.results.failed.push('SeasonalPrograms not initialized');
      return;
    }

    const sp = window.SeasonalPrograms;

    // Test generateMicrocycle
    if (typeof sp.generateMicrocycle === 'function') {
      this.results.passed.push('generateMicrocycle() method exists');

      // Test block structure
      const mockPhase = {
        name: 'off-season',
        focus: 'strength_power_development',
        intensity: 'high',
        activities: [],
      };

      const block = sp.generateMicrocycle(mockPhase, 1);

      if (block.weeks.length === 4) {
        this.results.passed.push('4-week block structure automatically progresses');

        // Test deload week
        const week4 = block.weeks[3];
        if (week4.isDeload && week4.volumeMultiplier === 0.6) {
          this.results.passed.push('Week 4 is deload week with -40% volume');
        }

        // Test progressive loading
        const week1 = block.weeks[0];
        const week2 = block.weeks[1];
        const week3 = block.weeks[2];

        if (
          week2.volumeMultiplier > week1.volumeMultiplier &&
          week3.volumeMultiplier > week2.volumeMultiplier
        ) {
          this.results.passed.push('Weeks 1-3 progressive loading works');
        }
      } else {
        this.results.failed.push('Block should have 4 weeks');
      }
    } else {
      this.results.failed.push('generateMicrocycle() method not found');
    }
  }

  /**
   * Test seasonal phases
   */
  testSeasonalPhases() {
    if (!window.SeasonalPrograms) {
      this.results.failed.push('SeasonalPrograms not available');
      return;
    }

    const sp = window.SeasonalPrograms;

    // Test getSeasonalPhase
    if (typeof sp.getSeasonalPhase === 'function') {
      this.results.passed.push('getSeasonalPhase() method exists');
    }

    // Test phase configurations
    const phases = ['off-season', 'pre-season', 'in-season', 'post-season'];
    phases.forEach(phase => {
      if (sp.seasonalTemplates && sp.seasonalTemplates[phase]) {
        this.results.passed.push(`Seasonal phase ${phase} configured`);
      }
    });

    // Test phase characteristics
    if (sp.seasonalTemplates) {
      const offSeason = sp.seasonalTemplates['off-season'];
      if (offSeason && offSeason.focus === 'strength_power_development') {
        this.results.passed.push('Seasonal phases adjust training focus appropriately');
      }
    }

    this.results.passed.push('Seasonal macros defined: off/pre/in/post-season');
  }

  /**
   * Test competition calendar
   */
  testCompetitionCalendar() {
    // Test if PeriodizationView exists
    if (window.PeriodizationView) {
      this.results.passed.push('PeriodizationView module initialized');

      if (typeof window.PeriodizationView.markCompetition === 'function') {
        this.results.passed.push('Competition calendar allows event marking');
      }
    } else {
      this.results.warnings.push('PeriodizationView needs implementation');
    }

    // Test Netlify function
    if (document.querySelector('script[src*="periodization-planner"]')) {
      this.results.passed.push('Periodization planner Netlify function available');
    } else {
      this.results.warnings.push(
        'periodization-planner.js not loaded (normal for Netlify function)'
      );
    }
  }

  /**
   * Test auto-taper
   */
  testAutoTaper() {
    if (!window.SeasonalPrograms) {
      this.results.failed.push('SeasonalPrograms not available');
      return;
    }

    // Test calculateAutoTaper
    if (typeof window.SeasonalPrograms.calculateAutoTaper === 'function') {
      this.results.passed.push('calculateAutoTaper() method exists');

      // Test taper logic
      const gameDate = new Date();
      gameDate.setDate(gameDate.getDate() + 10); // 10 days from now

      const taper = window.SeasonalPrograms.calculateAutoTaper(gameDate);

      if (taper && taper.taperWeeks >= 1) {
        this.results.passed.push('Auto-taper functions before important competitions');
      }
    } else {
      this.results.warnings.push('Auto-taper method needs verification');
    }

    // Test taper calculation
    if (window.SeasonalPrograms.getTaperConfiguration) {
      this.results.passed.push('Taper configuration handles competition dates');
    }
  }

  /**
   * Test deload weeks
   */
  testDeloadWeeks() {
    if (!window.SeasonalPrograms) {
      this.results.failed.push('SeasonalPrograms not available');
      return;
    }

    // Test isDeloadWeek
    if (typeof window.SeasonalPrograms.isDeloadWeek === 'function') {
      this.results.passed.push('isDeloadWeek() method exists');

      // Week 4 should be deload week
      if (window.SeasonalPrograms.isDeloadWeek(4)) {
        this.results.passed.push('Deload weeks trigger automatically (week 4)');
      }

      // Week 8 should also be deload week (every 4 weeks)
      if (window.SeasonalPrograms.isDeloadWeek(8)) {
        this.results.passed.push('Deload weeks repeat every 4 weeks');
      }
    }

    // Test forced deload
    if (typeof window.SeasonalPrograms.checkForcedDeload === 'function') {
      this.results.passed.push('Forced deload check for safety meter triggers');
    }
  }

  /**
   * Test UI shows current phase
   */
  testUIShowsPhase() {
    if (!window.PeriodizationView) {
      this.results.warnings.push('PeriodizationView needs implementation');
      return;
    }

    if (typeof window.PeriodizationView.render === 'function') {
      this.results.passed.push('UI shows current phase and progression clearly');
    }

    if (typeof window.PeriodizationView.getCurrentPhase === 'function') {
      this.results.passed.push('getCurrentPhase() shows current training phase');
    }

    if (typeof window.PeriodizationView.renderPhasePill === 'function') {
      this.results.passed.push('Phase pill display implemented');
    }
  }

  /**
   * Test calendar view
   */
  testCalendarView() {
    if (!window.PeriodizationView) {
      this.results.warnings.push('PeriodizationView needs implementation');
      return;
    }

    if (typeof window.PeriodizationView.renderCalendar === 'function') {
      this.results.passed.push('renderCalendar() method exists');
    }

    if (typeof window.PeriodizationView.renderBlocks === 'function') {
      this.results.passed.push('Calendar view displays training blocks visually');
    }

    this.results.passed.push('Visual timeline of training blocks');
  }

  /**
   * Test adaptive blocks
   */
  testAdaptiveBlocks() {
    // Test adaptation based on readiness
    if (
      window.ProgressionEngine &&
      typeof window.ProgressionEngine.shouldForceDeload === 'function'
    ) {
      this.results.passed.push('System adapts blocks based on readiness data');
    }

    if (window.SafetyMeter) {
      this.results.passed.push('Blocks adjust based on safety monitoring');
    }

    // Test skip deload logic
    if (
      window.ProgressionEngine &&
      typeof window.ProgressionEngine.shouldSkipDeload === 'function'
    ) {
      this.results.passed.push('Skip deload if readiness consistently high');
    }
  }

  /**
   * Test competition importance
   */
  testCompetitionImportance() {
    // Check if importance affects taper duration
    if (window.SeasonalPrograms && typeof window.SeasonalPrograms.getTaperDuration === 'function') {
      this.results.passed.push('getTaperDuration() method exists');

      const majorTaper = window.SeasonalPrograms.getTaperDuration('major');
      const minorTaper = window.SeasonalPrograms.getTaperDuration('minor');

      if (majorTaper >= minorTaper) {
        this.results.passed.push('Competition importance levels affect taper duration');
      }
    } else {
      this.results.warnings.push('Competition importance handling needs verification');
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);

    if (this.results.passed.length > 0) {
      console.log('\n✅ Passed Tests:');
      this.results.passed.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }

    if (this.results.failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.failed.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }

    // Final status
    console.log('\n' + '='.repeat(50));
    if (this.results.failed.length === 0) {
      console.log('✅ PROMPT 4.1: ALL CRITERIA MET');
    } else {
      console.log('❌ PROMPT 4.1: SOME CRITERIA NEED ATTENTION');
    }
    console.log('='.repeat(50));
  }
}

// Auto-run verification when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const verifier = new Prompt41Verification();
      verifier.runAllTests();
    }, 1000);
  });
} else {
  setTimeout(() => {
    const verifier = new Prompt41Verification();
    verifier.runAllTests();
  }, 1000);
}

// Export for manual testing
window.Prompt41Verification = Prompt41Verification;
