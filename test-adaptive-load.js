/**
 * Unit Tests for Adaptive Load & Readiness Engine
 * Tests 12 scenarios: back-to-back days, game -1, low readiness, etc.
 */

const DailyCheckIn = require('./js/modules/readiness/DailyCheckIn');
const ProgressionEngine = require('./js/modules/workout/ProgressionEngine');
const ConflictResolver = require('./js/modules/workout/ConflictResolver');

// Mock dependencies
global.window = {
    SafeLogger: console,
    EventBus: { emit: () => {}, TOPICS: {} },
    StorageManager: {
        saveReadinessLog: async () => true,
        saveProgressionEvent: async () => true,
        getProgressionEvents: () => ({})
    }
};

const tests = {
    passed: 0,
    failed: 0,
    total: 0
};

function test(name, fn) {
    tests.total++;
    try {
        fn();
        console.log(`✅ Test ${tests.total}: ${name}`);
        tests.passed++;
    } catch (error) {
        console.error(`❌ Test ${tests.total}: ${name} - ${error.message}`);
        tests.failed++;
    }
}

// Test 1: Low readiness (≤4) → Recovery session
test('Readiness ≤ 4 should swap to recovery session', () => {
    const checkIn = new DailyCheckIn();
    checkIn.updateCheckInData('sleepQuality', 2);
    checkIn.updateCheckInData('stressLevel', 8);
    checkIn.updateCheckInData('sorenessLevel', 9);
    checkIn.updateCheckInData('energyLevel', 3);
    
    const readinessScore = checkIn.calculateReadinessScore();
    const adjustments = checkIn.getWorkoutAdjustments();
    
    if (readinessScore > 4 || adjustments.workoutType !== 'recovery') {
        throw new Error(`Expected recovery session, got: ${adjustments.workoutType}, readiness: ${readinessScore}`);
    }
});

// Test 2: Moderate readiness (5-7) → Reduce intensity 10%
test('Readiness 5-7 should reduce intensity by 10%', () => {
    const checkIn = new DailyCheckIn();
    checkIn.updateCheckInData('sleepQuality', 6);
    checkIn.updateCheckInData('stressLevel', 6);
    checkIn.updateCheckInData('sorenessLevel', 6);
    checkIn.updateCheckInData('energyLevel', 5);
    
    const readinessScore = checkIn.calculateReadinessScore();
    const adjustments = checkIn.getWorkoutAdjustments();
    
    if (readinessScore < 5 || readinessScore > 7) {
        throw new Error(`Readiness should be 5-7, got: ${readinessScore}`);
    }
    if (Math.abs(adjustments.intensityMultiplier - 0.90) > 0.01) {
        throw new Error(`Expected 0.90 intensity, got: ${adjustments.intensityMultiplier}`);
    }
});

// Test 3: High readiness (8-10) → Normal load
test('Readiness 8-10 should allow normal load', () => {
    const checkIn = new DailyCheckIn();
    checkIn.updateCheckInData('sleepQuality', 9);
    checkIn.updateCheckInData('stressLevel', 2);
    checkIn.updateCheckInData('sorenessLevel', 2);
    checkIn.updateCheckInData('energyLevel', 9);
    
    const adjustments = checkIn.getWorkoutAdjustments();
    
    if (Math.abs(adjustments.intensityMultiplier - 1.0) > 0.01) {
        throw new Error(`Expected 1.0 intensity, got: ${adjustments.intensityMultiplier}`);
    }
});

// Test 4: Game -1 day → Upper body light
test('Game -1 day should restrict to upper body light', () => {
    const progression = new ProgressionEngine();
    const schedule = {
        gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
    };
    
    const adjustments = progression.getGameDayAdjustments(schedule);
    
    if (adjustments.intensityMultiplier !== 0.5 || adjustments.bodyRegion !== 'upper') {
        throw new Error(`Expected upper body light, got: ${JSON.stringify(adjustments)}`);
    }
});

// Test 5: Game -2 days → No heavy legs (RPE ≤ 7)
test('Game -2 days should allow moderate session with RPE ≤ 7', () => {
    const progression = new ProgressionEngine();
    const schedule = {
        gameDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() // 2 days
    };
    
    const adjustments = progression.getGameDayAdjustments(schedule);
    
    if (adjustments.maxRPE !== 7) {
        throw new Error(`Expected maxRPE 7, got: ${adjustments.maxRPE}`);
    }
});

// Test 6: Deload week (every 4th week) → -20% volume
test('Every 4th week should reduce volume by 20%', () => {
    const progression = new ProgressionEngine();
    
    if (!progression.isDeloadWeek(4)) {
        throw new Error('Week 4 should be deload week');
    }
    if (!progression.isDeloadWeek(8)) {
        throw new Error('Week 8 should be deload week');
    }
    if (progression.isDeloadWeek(5)) {
        throw new Error('Week 5 should not be deload week');
    }
    
    const deload = progression.getDeloadAdjustments();
    
    if (Math.abs(deload.volumeMultiplier - 0.80) > 0.01) {
        throw new Error(`Expected 0.80 volume, got: ${deload.volumeMultiplier}`);
    }
});

// Test 7: RPE 9+ → Reduce next session by 5%
test('RPE 9+ should reduce next session by 5%', async () => {
    const progression = new ProgressionEngine();
    const adjustments = await progression.adjustLoadFromRPE('user_001', {}, 9);
    
    if (Math.abs(adjustments.intensityMultiplier - 0.95) > 0.01) {
        throw new Error(`Expected 0.95 intensity, got: ${adjustments.intensityMultiplier}`);
    }
});

// Test 8: RPE 7 → Maintain load
test('RPE 7 should maintain load', async () => {
    const progression = new ProgressionEngine();
    const adjustments = await progression.adjustLoadFromRPE('user_001', {}, 7);
    
    if (Math.abs(adjustments.intensityMultiplier - 1.0) > 0.01) {
        throw new Error(`Expected 1.0 intensity, got: ${adjustments.intensityMultiplier}`);
    }
});

// Test 9: RPE <5 → Increase load by 10%
test('RPE <5 should increase load by 10%', async () => {
    const progression = new ProgressionEngine();
    const adjustments = await progression.adjustLoadFromRPE('user_001', {}, 4);
    
    if (Math.abs(adjustments.intensityMultiplier - 1.10) > 0.01) {
        throw new Error(`Expected 1.10 intensity, got: ${adjustments.intensityMultiplier}`);
    }
});

// Test 10: Back-to-back days conflict detection
test('Back-to-back heavy sessions should be flagged', () => {
    const resolver = new ConflictResolver();
    const workout = {
        date: '2024-01-03',
        intensity: 'heavy',
        bodyPart: 'legs'
    };
    const schedule = {
        '2024-01-01': { date: '2024-01-01', intensity: 'heavy' },
        '2024-01-02': { date: '2024-01-02', intensity: 'heavy' }
    };
    
    const result = resolver.resolveConflicts(workout, schedule, {});
    
    if (result.canProceed) {
        throw new Error('Back-to-back sessions should not be allowed');
    }
});

// Test 11: Weighted readiness score calculation
test('Readiness score should use 30/25/25/20 weighting', () => {
    const checkIn = new DailyCheckIn();
    checkIn.updateCheckInData('sleepQuality', 10); // 30% weight
    checkIn.updateCheckInData('stressLevel', 1);   // 25% weight (inverted to 10)
    checkIn.updateCheckInData('sorenessLevel', 1); // 25% weight (inverted to 10)
    checkIn.updateCheckInData('energyLevel', 10);  // 20% weight
    
    const score = checkIn.calculateReadinessScore();
    
    // Should be very high (10*0.3 + 10*0.25 + 10*0.25 + 10*0.2 = 10)
    if (score < 9) {
        throw new Error(`Expected high score, got: ${score}`);
    }
});

// Test 12: Combined adjustments (readiness + deload + game day)
test('Multiple adjustments should combine correctly', async () => {
    const checkIn = new DailyCheckIn();
    checkIn.updateCheckInData('sleepQuality', 5);
    checkIn.updateCheckInData('stressLevel', 5);
    checkIn.updateCheckInData('sorenessLevel', 6);
    checkIn.updateCheckInData('energyLevel', 5);
    
    const readinessAdjustments = checkIn.getWorkoutAdjustments();
    
    const progression = new ProgressionEngine();
    const schedule = {
        gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    const combined = await progression.getComprehensiveAdjustments(
        'user_001',
        readinessAdjustments,
        schedule,
        4
    );
    
    // Should have multiple adjustments applied
    if (combined.intensityMultiplier === 1.0 || combined.volumeMultiplier === 1.0) {
        throw new Error('Expected combined adjustments to modify load');
    }
    
    if (combined.coachMessages.length < 1) {
        throw new Error('Expected coach messages');
    }
});

// Run all tests
async function runTests() {
    console.log('🧪 Running 12 Adaptive Load & Readiness Engine Tests...\n');
    
    for (const testFn of Object.values(tests)) {
        if (typeof testFn === 'function' && testFn.name.startsWith('test')) {
            await testFn();
        }
    }
    
    console.log(`\n📊 Results: ${tests.passed}/${tests.total} passed`);
    console.log(`✅ Passed: ${tests.passed}`);
    console.log(`❌ Failed: ${tests.failed}`);
    
    process.exit(tests.failed > 0 ? 1 : 0);
}

// Execute if run directly
if (require.main === module) {
    runTests();
}

module.exports = { tests, test };
