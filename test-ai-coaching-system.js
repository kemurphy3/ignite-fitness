/**
 * Test AI Coaching System - Comprehensive AI coaching personality testing
 * Verifies context-aware responses, personality traits, and coaching scenarios
 */

// Test configuration
const AI_COACHING_TEST_CONFIG = {
  testUser: {
    username: 'coachingtest',
    password: 'testpass123',
    athleteName: 'AI Coaching Test User',
    preferences: {
      primary_goal: 'strength',
      primary_sport: 'basketball',
      training_frequency: 4,
    },
  },
  testScenarios: {
    missedWorkouts: {
      context: { missedWorkouts: 3, workoutStreak: 0 },
      message: "I've been away for a few days, what should I do?",
      expectedScenario: 'return',
    },
    highStress: {
      context: { stressLevel: 8, energyLevel: 3, readinessScore: 4 },
      message: "I'm feeling really stressed and tired",
      expectedScenario: 'recovery',
    },
    plateau: {
      context: { progressionRate: 0.02, workoutStreak: 8, averageRPE: 7.5 },
      message: "I feel like I'm not getting stronger anymore",
      expectedScenario: 'plateau',
    },
    injury: {
      context: { stressLevel: 5, energyLevel: 6 },
      message: 'My knee hurts when I squat',
      expectedScenario: 'injury',
    },
    motivation: {
      context: { workoutStreak: 10, consistencyScore: 0.9 },
      message: 'I need some motivation to keep going',
      expectedScenario: 'motivation',
    },
    seasonal: {
      context: { sport: 'basketball', seasonPhase: 'preseason' },
      message: 'Basketball season starts in 6 weeks',
      expectedScenario: 'seasonal',
    },
  },
  personalityTests: {
    casualTone: "Hey there! How's your training going?",
    competentTechnical: "Let's talk about your squat form",
    encouraging: "You're doing great! Keep it up!",
    supportive: "I understand you're struggling with this",
    knowledgeable: 'Based on your training history',
  },
};

// Test results
let aiCoachingTestResults = {
  passed: 0,
  failed: 0,
  errors: [],
};

/**
 * Run all AI coaching system tests
 */
async function runAICoachingSystemTests() {
  console.log('🧪 Starting AI Coaching System Tests...');

  try {
    // PersonalizedCoaching module tests
    await testPersonalizedCoaching();

    // CoachingEngine integration tests
    await testCoachingEngineIntegration();

    // Personality and tone tests
    await testPersonalityTraits();

    // Context awareness tests
    await testContextAwareness();

    // Safety guardrails tests
    await testSafetyGuardrails();

    // Response quality tests
    await testResponseQuality();

    // Display results
    displayAICoachingTestResults();
  } catch (error) {
    console.error('AI coaching system test suite failed:', error);
    aiCoachingTestResults.errors.push(`Test suite error: ${error.message}`);
  }
}

/**
 * Test PersonalizedCoaching module functionality
 */
async function testPersonalizedCoaching() {
  console.log('Testing PersonalizedCoaching module...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      // Test basic response generation
      const basicResponse = window.PersonalizedCoaching.generateResponse('Hello');
      if (basicResponse.success && basicResponse.response) {
        aiCoachingTestResults.passed++;
        console.log('✅ Basic response generation working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Basic response generation failed');
      }

      // Test context analysis
      const contextAnalysis = window.PersonalizedCoaching.analyzeUserMessage(
        "I'm feeling stressed and tired"
      );
      if (contextAnalysis.intent && contextAnalysis.sentiment) {
        aiCoachingTestResults.passed++;
        console.log('✅ Context analysis working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Context analysis failed');
      }

      // Test scenario determination
      const testContext = { missedWorkouts: 3, stressLevel: 8 };
      const scenario = window.PersonalizedCoaching.determineCoachingScenario(testContext, {
        intent: 'help',
      });
      if (scenario && typeof scenario === 'string') {
        aiCoachingTestResults.passed++;
        console.log('✅ Scenario determination working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Scenario determination failed');
      }

      // Test coaching templates
      const templates = window.PersonalizedCoaching.coachingTemplates;
      if (templates && templates.progression && templates.motivation) {
        aiCoachingTestResults.passed++;
        console.log('✅ Coaching templates configured');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Coaching templates not configured');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching module not available');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`PersonalizedCoaching test failed: ${error.message}`);
  }
}

/**
 * Test CoachingEngine integration
 */
async function testCoachingEngineIntegration() {
  console.log('Testing CoachingEngine integration...');

  try {
    if (typeof window.CoachingEngine !== 'undefined') {
      // Test processUserInput method
      const response = await window.CoachingEngine.processUserInput(
        'Hello, I need help with my workout'
      );
      if (response && response.success) {
        aiCoachingTestResults.passed++;
        console.log('✅ CoachingEngine processUserInput working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('CoachingEngine processUserInput failed');
      }

      // Test response types
      if (response.type === 'personalized_ai' || response.type === 'ai') {
        aiCoachingTestResults.passed++;
        console.log('✅ Response type classification working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Response type classification failed');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('CoachingEngine not available');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`CoachingEngine integration test failed: ${error.message}`);
  }
}

/**
 * Test personality traits
 */
async function testPersonalityTraits() {
  console.log('Testing personality traits...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      const personality = window.PersonalizedCoaching.personalityTraits;

      // Test personality configuration
      if (
        personality.tone === 'casual_competent' &&
        personality.style === 'encouraging_supportive'
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Personality traits configured correctly');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Personality traits not configured correctly');
      }

      // Test casual tone
      const casualResponse = window.PersonalizedCoaching.generateResponse("Hey, how's it going?");
      if (casualResponse.success && casualResponse.response.includes('Hey there!')) {
        aiCoachingTestResults.passed++;
        console.log('✅ Casual tone working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Casual tone not working');
      }

      // Test encouraging style
      const encouragingResponse = window.PersonalizedCoaching.generateResponse(
        "I'm struggling with motivation"
      );
      if (
        encouragingResponse.success &&
        (encouragingResponse.response.includes('awesome') ||
          encouragingResponse.response.includes('great'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Encouraging style working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Encouraging style not working');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching not available for personality tests');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`Personality traits test failed: ${error.message}`);
  }
}

/**
 * Test context awareness
 */
async function testContextAwareness() {
  console.log('Testing context awareness...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      // Test missed workouts scenario
      const missedWorkoutsResponse = window.PersonalizedCoaching.generateResponse(
        "I've been away for a few days",
        { missedWorkouts: 3, workoutStreak: 0 }
      );

      if (
        missedWorkoutsResponse.success &&
        (missedWorkoutsResponse.response.includes('Welcome back') ||
          missedWorkoutsResponse.response.includes('ease back'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Missed workouts context awareness working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Missed workouts context awareness failed');
      }

      // Test high stress scenario
      const highStressResponse = window.PersonalizedCoaching.generateResponse(
        "I'm feeling really stressed",
        { stressLevel: 8, energyLevel: 3 }
      );

      if (
        highStressResponse.success &&
        (highStressResponse.response.includes('stress') ||
          highStressResponse.response.includes('recovery'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ High stress context awareness working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('High stress context awareness failed');
      }

      // Test plateau scenario
      const plateauResponse = window.PersonalizedCoaching.generateResponse(
        "I feel like I'm not getting stronger",
        { progressionRate: 0.02, workoutStreak: 8 }
      );

      if (
        plateauResponse.success &&
        (plateauResponse.response.includes('plateau') ||
          plateauResponse.response.includes('deload'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Plateau context awareness working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Plateau context awareness failed');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching not available for context tests');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`Context awareness test failed: ${error.message}`);
  }
}

/**
 * Test safety guardrails
 */
async function testSafetyGuardrails() {
  console.log('Testing safety guardrails...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      // Test injury response
      const injuryResponse = window.PersonalizedCoaching.generateResponse(
        'My knee hurts when I squat'
      );

      if (
        injuryResponse.success &&
        (injuryResponse.response.includes('not a doctor') ||
          injuryResponse.response.includes('healthcare professional'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Injury safety guardrails working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Injury safety guardrails failed');
      }

      // Test medical advice prevention
      const medicalResponse = window.PersonalizedCoaching.generateResponse(
        'I have a medical condition'
      );

      if (
        medicalResponse.success &&
        (medicalResponse.response.includes('not qualified') ||
          medicalResponse.response.includes('medical advice'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Medical advice prevention working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Medical advice prevention failed');
      }

      // Test guardrails configuration
      const guardrails = window.PersonalizedCoaching.guardrails;
      if (guardrails.medical_advice === false && guardrails.injury_diagnosis === false) {
        aiCoachingTestResults.passed++;
        console.log('✅ Guardrails configuration correct');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Guardrails configuration incorrect');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching not available for guardrails tests');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`Safety guardrails test failed: ${error.message}`);
  }
}

/**
 * Test response quality
 */
async function testResponseQuality() {
  console.log('Testing response quality...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      // Test response length
      const response = window.PersonalizedCoaching.generateResponse('I need help with my workout');
      if (response.success && response.response.length > 20) {
        aiCoachingTestResults.passed++;
        console.log('✅ Response length appropriate');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Response length too short');
      }

      // Test response personalization
      const personalizedResponse = window.PersonalizedCoaching.generateResponse(
        "I'm training for basketball season",
        { sport: 'basketball', seasonPhase: 'preseason' }
      );

      if (
        personalizedResponse.success &&
        (personalizedResponse.response.includes('basketball') ||
          personalizedResponse.response.includes('season'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Response personalization working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Response personalization failed');
      }

      // Test technical explanations
      const technicalResponse =
        window.PersonalizedCoaching.generateResponse('What is a deload week?');
      if (
        technicalResponse.success &&
        (technicalResponse.response.includes('deload') ||
          technicalResponse.response.includes('recovery'))
      ) {
        aiCoachingTestResults.passed++;
        console.log('✅ Technical explanations working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Technical explanations failed');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching not available for quality tests');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`Response quality test failed: ${error.message}`);
  }
}

/**
 * Test coaching scenarios
 */
async function testCoachingScenarios() {
  console.log('Testing coaching scenarios...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      const scenarios = AI_COACHING_TEST_CONFIG.testScenarios;

      // Test each scenario
      for (const [scenarioName, scenarioData] of Object.entries(scenarios)) {
        const response = window.PersonalizedCoaching.generateResponse(
          scenarioData.message,
          scenarioData.context
        );

        if (response.success && response.scenario === scenarioData.expectedScenario) {
          aiCoachingTestResults.passed++;
          console.log(`✅ ${scenarioName} scenario working`);
        } else {
          aiCoachingTestResults.failed++;
          aiCoachingTestResults.errors.push(`${scenarioName} scenario failed`);
        }
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching not available for scenario tests');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`Coaching scenarios test failed: ${error.message}`);
  }
}

/**
 * Test message analysis
 */
async function testMessageAnalysis() {
  console.log('Testing message analysis...');

  try {
    if (typeof window.PersonalizedCoaching !== 'undefined') {
      // Test intent detection
      const helpIntent = window.PersonalizedCoaching.detectIntent('I need help with my workout');
      if (helpIntent === 'help') {
        aiCoachingTestResults.passed++;
        console.log('✅ Intent detection working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Intent detection failed');
      }

      // Test sentiment detection
      const positiveSentiment = window.PersonalizedCoaching.detectSentiment('I love my workouts!');
      if (positiveSentiment === 'positive') {
        aiCoachingTestResults.passed++;
        console.log('✅ Sentiment detection working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Sentiment detection failed');
      }

      // Test keyword extraction
      const keywords = window.PersonalizedCoaching.extractKeywords(
        'I need help with my workout and nutrition'
      );
      if (keywords.includes('workout') && keywords.includes('nutrition')) {
        aiCoachingTestResults.passed++;
        console.log('✅ Keyword extraction working');
      } else {
        aiCoachingTestResults.failed++;
        aiCoachingTestResults.errors.push('Keyword extraction failed');
      }
    } else {
      aiCoachingTestResults.failed++;
      aiCoachingTestResults.errors.push('PersonalizedCoaching not available for analysis tests');
    }
  } catch (error) {
    aiCoachingTestResults.failed++;
    aiCoachingTestResults.errors.push(`Message analysis test failed: ${error.message}`);
  }
}

/**
 * Display AI coaching test results
 */
function displayAICoachingTestResults() {
  const totalTests = aiCoachingTestResults.passed + aiCoachingTestResults.failed;
  const passRate =
    totalTests > 0 ? ((aiCoachingTestResults.passed / totalTests) * 100).toFixed(1) : 0;

  console.log('\n📊 AI Coaching System Test Results:');
  console.log(`✅ Passed: ${aiCoachingTestResults.passed}`);
  console.log(`❌ Failed: ${aiCoachingTestResults.failed}`);
  console.log(`📈 Pass Rate: ${passRate}%`);

  if (aiCoachingTestResults.errors.length > 0) {
    console.log('\n🚨 Errors:');
    aiCoachingTestResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  // Create results summary
  const resultsSummary = {
    totalTests,
    passed: aiCoachingTestResults.passed,
    failed: aiCoachingTestResults.failed,
    passRate: parseFloat(passRate),
    errors: aiCoachingTestResults.errors,
    timestamp: new Date().toISOString(),
  };

  // Save results to localStorage
  localStorage.setItem('ai_coaching_test_results', JSON.stringify(resultsSummary));

  return resultsSummary;
}

/**
 * Run comprehensive AI coaching system tests
 */
async function runComprehensiveAICoachingTests() {
  console.log('🧪 Running Comprehensive AI Coaching System Tests...');

  try {
    await runAICoachingSystemTests();
    await testCoachingScenarios();
    await testMessageAnalysis();

    console.log('\n🎯 Comprehensive AI Coaching System Testing Complete!');
  } catch (error) {
    console.error('Comprehensive AI coaching system test suite failed:', error);
    aiCoachingTestResults.errors.push(`Comprehensive test suite error: ${error.message}`);
  }
}

/**
 * Run tests when page loads
 */
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(() => {
      runComprehensiveAICoachingTests();
    }, 3000); // Wait for modules to load
  });
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAICoachingSystemTests,
    testPersonalizedCoaching,
    testCoachingEngineIntegration,
    testPersonalityTraits,
    testContextAwareness,
    testSafetyGuardrails,
    testResponseQuality,
    testCoachingScenarios,
    testMessageAnalysis,
    displayAICoachingTestResults,
    runComprehensiveAICoachingTests,
  };
}
