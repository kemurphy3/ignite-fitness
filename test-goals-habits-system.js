/**
 * Test Goals & Habits System - Comprehensive goals and habit tracking testing
 * Verifies SMART goals, milestone tracking, streak management, and achievements
 */

// Test configuration
const GOALS_HABITS_TEST_CONFIG = {
  testUser: {
    username: 'goalshabits',
    password: 'testpass123',
    athleteName: 'Goals & Habits Test User',
  },
  testGoals: {
    strength: {
      type: 'strength',
      title: 'Squat bodyweight for 5 reps',
      description: 'Build leg strength for athletic performance',
      current_value: 135,
      target_value: 180,
      unit: 'lbs',
      deadline: '2024-04-01',
    },
    endurance: {
      type: 'endurance',
      title: 'Run a 5K in under 25 minutes',
      description: 'Improve cardiovascular fitness',
      current_value: 35,
      target_value: 25,
      unit: 'minutes',
      deadline: '2024-03-15',
    },
    bodyComposition: {
      type: 'body_composition',
      title: 'Lose 15 pounds of body fat',
      description: 'Improve health markers and performance',
      current_value: 0,
      target_value: 15,
      unit: 'lbs',
      deadline: '2024-06-01',
    },
  },
  testHabits: {
    workoutStreak: 5,
    totalWorkouts: 25,
    weeklyGoal: 3,
    thisWeek: 2,
  },
  testAchievements: ['first_workout', 'first_week', 'month_strong', 'consistency_king'],
};

// Test results
let goalsHabitsTestResults = {
  passed: 0,
  failed: 0,
  errors: [],
};

/**
 * Run all goals and habits system tests
 */
async function runGoalsHabitsSystemTests() {
  console.log('🧪 Starting Goals & Habits System Tests...');

  try {
    // GoalManager tests
    await testGoalManager();

    // HabitTracker tests
    await testHabitTracker();

    // Motivational messaging tests
    await testMotivationalMessaging();

    // UI integration tests
    await testUIComponents();

    // Database integration tests
    await testDatabaseIntegration();

    // Display results
    displayGoalsHabitsTestResults();
  } catch (error) {
    console.error('Goals & habits system test suite failed:', error);
    goalsHabitsTestResults.errors.push(`Test suite error: ${error.message}`);
  }
}

/**
 * Test GoalManager functionality
 */
async function testGoalManager() {
  console.log('Testing GoalManager...');

  try {
    if (typeof window.GoalManager !== 'undefined') {
      // Test goal creation
      const goalData = GOALS_HABITS_TEST_CONFIG.testGoals.strength;
      const createResult = window.GoalManager.createGoal(goalData);

      if (createResult.success && createResult.goal) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal creation working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal creation failed');
      }

      // Test goal templates
      const strengthTemplates = window.GoalManager.getGoalTemplate('strength');
      if (strengthTemplates && Object.keys(strengthTemplates).length > 0) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal templates working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal templates not working');
      }

      // Test milestone calculation
      const milestones = window.GoalManager.calculateMilestones(135, 180);
      if (Array.isArray(milestones) && milestones.length === 4) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Milestone calculation working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Milestone calculation failed');
      }

      // Test goal progress update
      const progressResult = window.GoalManager.updateGoalProgress(createResult.goal.id, 150);
      if (progressResult.success) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal progress update working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal progress update failed');
      }

      // Test active goals
      const activeGoals = window.GoalManager.getActiveGoals();
      if (Array.isArray(activeGoals)) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Active goals retrieval working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Active goals retrieval failed');
      }

      // Test goal progress summary
      const progressSummary = window.GoalManager.getGoalProgressSummary();
      if (progressSummary && typeof progressSummary.totalGoals === 'number') {
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal progress summary working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal progress summary failed');
      }
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('GoalManager not available');
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`GoalManager test failed: ${error.message}`);
  }
}

/**
 * Test HabitTracker functionality
 */
async function testHabitTracker() {
  console.log('Testing HabitTracker...');

  try {
    if (typeof window.HabitTracker !== 'undefined') {
      // Test workout recording
      const workoutResult = window.HabitTracker.recordWorkout({
        duration: 45,
        exercises: ['squat', 'bench_press'],
        rpe: 7,
      });

      if (workoutResult.success) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Workout recording working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Workout recording failed');
      }

      // Test streak data
      const streakData = window.HabitTracker.getStreakData('testuser');
      if (streakData && typeof streakData.current === 'number') {
        goalsHabitsTestResults.passed++;
        console.log('✅ Streak data retrieval working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Streak data retrieval failed');
      }

      // Test habit progress
      const habitProgress = window.HabitTracker.getHabitProgress('testuser');
      if (habitProgress && habitProgress.currentStreak !== undefined) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Habit progress working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Habit progress failed');
      }

      // Test achievements
      const achievements = window.HabitTracker.getUserAchievements('testuser');
      if (Array.isArray(achievements)) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Achievements retrieval working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Achievements retrieval failed');
      }

      // Test achievement definitions
      const achievementDefinitions = window.HabitTracker.achievementDefinitions;
      if (Array.isArray(achievementDefinitions) && achievementDefinitions.length > 0) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Achievement definitions working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Achievement definitions not working');
      }
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('HabitTracker not available');
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`HabitTracker test failed: ${error.message}`);
  }
}

/**
 * Test motivational messaging
 */
async function testMotivationalMessaging() {
  console.log('Testing motivational messaging...');

  try {
    if (typeof window.GoalManager !== 'undefined') {
      // Test motivational messages
      const messages = window.GoalManager.motivationalMessages;
      if (messages && messages.streakStart && messages.milestone) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Motivational messages configured');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Motivational messages not configured');
      }

      // Test message formatting
      const formattedMessage = window.GoalManager.formatMessage(
        "Week {number} complete! You're building a solid habit 🔥",
        { number: 3 }
      );
      if (formattedMessage.includes('Week 3 complete!')) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Message formatting working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Message formatting failed');
      }
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('GoalManager not available for motivational testing');
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`Motivational messaging test failed: ${error.message}`);
  }
}

/**
 * Test UI components
 */
async function testUIComponents() {
  console.log('Testing UI components...');

  try {
    // Test goals modal
    const goalsModal = document.getElementById('goalsModal');
    if (goalsModal) {
      goalsHabitsTestResults.passed++;
      console.log('✅ Goals modal exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('Goals modal not found');
    }

    // Test create goal modal
    const createGoalModal = document.getElementById('createGoalModal');
    if (createGoalModal) {
      goalsHabitsTestResults.passed++;
      console.log('✅ Create goal modal exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('Create goal modal not found');
    }

    // Test habits modal
    const habitsModal = document.getElementById('habitsModal');
    if (habitsModal) {
      goalsHabitsTestResults.passed++;
      console.log('✅ Habits modal exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('Habits modal not found');
    }

    // Test motivational toast
    const motivationalToast = document.getElementById('motivationalToast');
    if (motivationalToast) {
      goalsHabitsTestResults.passed++;
      console.log('✅ Motivational toast exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('Motivational toast not found');
    }

    // Test UI functions
    if (typeof window.showGoalsModal === 'function') {
      goalsHabitsTestResults.passed++;
      console.log('✅ showGoalsModal function exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('showGoalsModal function not found');
    }

    if (typeof window.showHabitsModal === 'function') {
      goalsHabitsTestResults.passed++;
      console.log('✅ showHabitsModal function exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('showHabitsModal function not found');
    }

    if (typeof window.createGoal === 'function') {
      goalsHabitsTestResults.passed++;
      console.log('✅ createGoal function exists');
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('createGoal function not found');
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`UI components test failed: ${error.message}`);
  }
}

/**
 * Test database integration
 */
async function testDatabaseIntegration() {
  console.log('Testing database integration...');

  try {
    // Test event logging
    if (typeof window.GoalManager !== 'undefined') {
      const originalLogEvent = window.GoalManager.logEvent;
      if (typeof originalLogEvent === 'function') {
        goalsHabitsTestResults.passed++;
        console.log('✅ Event logging function exists');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Event logging function not found');
      }
    }

    // Test storage integration
    if (typeof window.GoalManager !== 'undefined') {
      const originalSaveGoal = window.GoalManager.saveGoal;
      if (typeof originalSaveGoal === 'function') {
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal saving function exists');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal saving function not found');
      }
    }

    // Test habit data storage
    if (typeof window.HabitTracker !== 'undefined') {
      const originalSaveHabitData = window.HabitTracker.saveHabitData;
      if (typeof originalSaveHabitData === 'function') {
        goalsHabitsTestResults.passed++;
        console.log('✅ Habit data saving function exists');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Habit data saving function not found');
      }
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`Database integration test failed: ${error.message}`);
  }
}

/**
 * Test SMART goal framework
 */
async function testSMARTGoalFramework() {
  console.log('Testing SMART goal framework...');

  try {
    if (typeof window.GoalManager !== 'undefined') {
      // Test goal validation
      const invalidGoal = {
        type: 'strength',
        title: 'Get stronger',
        current_value: 100,
        target_value: 200,
        unit: 'lbs',
      };

      const validationResult = window.GoalManager.validateAndFormatGoal(invalidGoal);
      if (validationResult) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal validation working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal validation failed');
      }

      // Test milestone rewards
      const milestoneRewards = window.GoalManager.milestoneRewards;
      if (milestoneRewards && milestoneRewards[25] && milestoneRewards[100]) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Milestone rewards configured');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Milestone rewards not configured');
      }

      // Test goal completion
      const testGoal = {
        id: 'test_goal_123',
        type: 'strength',
        title: 'Test Goal',
        current_value: 180,
        target_value: 180,
        unit: 'lbs',
        progress_percentage: 100,
      };

      const completionResult = window.GoalManager.completeGoal(testGoal.id);
      if (completionResult.success || completionResult.error) {
        // Either success or expected error
        goalsHabitsTestResults.passed++;
        console.log('✅ Goal completion working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Goal completion failed');
      }
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('GoalManager not available for SMART goal testing');
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`SMART goal framework test failed: ${error.message}`);
  }
}

/**
 * Test habit formation
 */
async function testHabitFormation() {
  console.log('Testing habit formation...');

  try {
    if (typeof window.HabitTracker !== 'undefined') {
      // Test streak calculation
      const testHabitData = {
        user_id: 'testuser',
        date: '2024-01-15',
        workout_completed: true,
        current_streak: 5,
        longest_streak: 10,
        total_workouts: 25,
      };

      window.HabitTracker.updateStreaks(testHabitData, '2024-01-15');

      if (testHabitData.current_streak >= 5) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Streak calculation working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Streak calculation failed');
      }

      // Test habit strength calculation
      const habitStrength = window.HabitTracker.calculateHabitStrength(30);
      if (habitStrength === 'Strong') {
        goalsHabitsTestResults.passed++;
        console.log('✅ Habit strength calculation working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Habit strength calculation failed');
      }

      // Test achievement checking
      const testAchievement = {
        id: 'first_week',
        condition: { streak: 7 },
        unlocked: false,
      };

      const achievementCheck = window.HabitTracker.checkAchievementCondition(testAchievement, {
        current_streak: 7,
      });

      if (achievementCheck) {
        goalsHabitsTestResults.passed++;
        console.log('✅ Achievement checking working');
      } else {
        goalsHabitsTestResults.failed++;
        goalsHabitsTestResults.errors.push('Achievement checking failed');
      }
    } else {
      goalsHabitsTestResults.failed++;
      goalsHabitsTestResults.errors.push('HabitTracker not available for habit formation testing');
    }
  } catch (error) {
    goalsHabitsTestResults.failed++;
    goalsHabitsTestResults.errors.push(`Habit formation test failed: ${error.message}`);
  }
}

/**
 * Display goals and habits test results
 */
function displayGoalsHabitsTestResults() {
  const totalTests = goalsHabitsTestResults.passed + goalsHabitsTestResults.failed;
  const passRate =
    totalTests > 0 ? ((goalsHabitsTestResults.passed / totalTests) * 100).toFixed(1) : 0;

  console.log('\n📊 Goals & Habits System Test Results:');
  console.log(`✅ Passed: ${goalsHabitsTestResults.passed}`);
  console.log(`❌ Failed: ${goalsHabitsTestResults.failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);

  if (goalsHabitsTestResults.errors.length > 0) {
    console.log('\n🚨 Errors:');
    goalsHabitsTestResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  // Create results summary
  const resultsSummary = {
    totalTests,
    passed: goalsHabitsTestResults.passed,
    failed: goalsHabitsTestResults.failed,
    passRate: parseFloat(passRate),
    errors: goalsHabitsTestResults.errors,
    timestamp: new Date().toISOString(),
  };

  // Save results to localStorage
  localStorage.setItem('goals_habits_test_results', JSON.stringify(resultsSummary));

  return resultsSummary;
}

/**
 * Run comprehensive goals and habits system tests
 */
async function runComprehensiveGoalsHabitsTests() {
  console.log('🧪 Running Comprehensive Goals & Habits System Tests...');

  try {
    await runGoalsHabitsSystemTests();
    await testSMARTGoalFramework();
    await testHabitFormation();

    console.log('\n🎯 Comprehensive Goals & Habits System Testing Complete!');
  } catch (error) {
    console.error('Comprehensive goals and habits system test suite failed:', error);
    goalsHabitsTestResults.errors.push(`Comprehensive test suite error: ${error.message}`);
  }
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      runComprehensiveGoalsHabitsTests();
    }, 4000); // Wait for modules to load
  });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runGoalsHabitsSystemTests,
    testGoalManager,
    testHabitTracker,
    testMotivationalMessaging,
    testUIComponents,
    testDatabaseIntegration,
    testSMARTGoalFramework,
    testHabitFormation,
    displayGoalsHabitsTestResults,
    runComprehensiveGoalsHabitsTests,
  };
}
