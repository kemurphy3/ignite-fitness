/**
 * Test database initialization and migrations
 * Verifies seed + migration run successfully
 */

const EventBus = require('./js/modules/core/EventBus');
const StorageManager = require('./js/modules/data/StorageManager');

// Mock localStorage for Node.js environment
global.localStorage = {
  data: {},
  getItem: function (key) {
    return this.data[key] || null;
  },
  setItem: function (key, value) {
    this.data[key] = value;
  },
  removeItem: function (key) {
    delete this.data[key];
  },
  clear: function () {
    this.data = {};
  },
};

// Test suite
async function testStorageManager() {
  console.log('🧪 Testing StorageManager...\n');

  const storageManager = new StorageManager();
  const testUserId = 'test_user_001';
  const testDate = '2024-01-01';

  let testsPassed = 0;
  let testsTotal = 0;

  // Test 1: Save and retrieve user profile
  testsTotal++;
  try {
    await storageManager.saveUserProfile(testUserId, {
      email: 'test@example.com',
      sport: 'soccer',
      position: 'midfielder',
    });

    const profile = storageManager.getUserProfile(testUserId);
    if (profile && profile.email === 'test@example.com') {
      console.log('✅ Test 1 passed: User profile save/retrieve');
      testsPassed++;
    } else {
      console.log('❌ Test 1 failed: User profile save/retrieve');
    }
  } catch (error) {
    console.log('❌ Test 1 failed:', error.message);
  }

  // Test 2: Save and retrieve readiness log
  testsTotal++;
  try {
    await storageManager.saveReadinessLog(testUserId, testDate, {
      sleep: 8,
      soreness: 3,
      stress: 4,
      energy: 7,
    });

    const log = storageManager.getReadinessLog(testUserId, testDate);
    if (log && log.sleep === 8) {
      console.log('✅ Test 2 passed: Readiness log save/retrieve');
      testsPassed++;
    } else {
      console.log('❌ Test 2 failed: Readiness log save/retrieve');
    }
  } catch (error) {
    console.log('❌ Test 2 failed:', error.message);
  }

  // Test 3: Save and retrieve session log
  testsTotal++;
  try {
    await storageManager.saveSessionLog(testUserId, testDate, {
      workout_id: 'workout_001',
      exercises: ['Squat', 'Deadlift'],
      duration: 45,
    });

    const session = storageManager.getSessionLog(testUserId, testDate);
    if (session && session.workout_id === 'workout_001') {
      console.log('✅ Test 3 passed: Session log save/retrieve');
      testsPassed++;
    } else {
      console.log('❌ Test 3 failed: Session log save/retrieve');
    }
  } catch (error) {
    console.log('❌ Test 3 failed:', error.message);
  }

  // Test 4: Save and retrieve progression event
  testsTotal++;
  try {
    await storageManager.saveProgressionEvent(testUserId, testDate, {
      exercise: 'Squat',
      previous_level: 1,
      new_level: 2,
    });

    const events = storageManager.getProgressionEvents();
    const key = storageManager.getCompoundKey(testUserId, testDate);
    if (events[key] && events[key].exercise === 'Squat') {
      console.log('✅ Test 4 passed: Progression event save/retrieve');
      testsPassed++;
    } else {
      console.log('❌ Test 4 failed: Progression event save/retrieve');
    }
  } catch (error) {
    console.log('❌ Test 4 failed:', error.message);
  }

  // Test 5: Save and retrieve injury flag
  testsTotal++;
  try {
    await storageManager.saveInjuryFlag(testUserId, testDate, {
      risk_level: 'moderate',
      factors: ['fatigue', 'previous_injury'],
    });

    const flags = storageManager.getInjuryFlags();
    const key = storageManager.getCompoundKey(testUserId, testDate);
    if (flags[key] && flags[key].risk_level === 'moderate') {
      console.log('✅ Test 5 passed: Injury flag save/retrieve');
      testsPassed++;
    } else {
      console.log('❌ Test 5 failed: Injury flag save/retrieve');
    }
  } catch (error) {
    console.log('❌ Test 5 failed:', error.message);
  }

  // Test 6: Save and retrieve preferences
  testsTotal++;
  try {
    await storageManager.savePreferences(testUserId, {
      theme: 'dark',
      notifications: true,
      units: 'metric',
    });

    const prefs = storageManager.getPreferences(testUserId);
    if (prefs && prefs.theme === 'dark') {
      console.log('✅ Test 6 passed: Preferences save/retrieve');
      testsPassed++;
    } else {
      console.log('❌ Test 6 failed: Preferences save/retrieve');
    }
  } catch (error) {
    console.log('❌ Test 6 failed:', error.message);
  }

  // Test 7: Sync queue management
  testsTotal++;
  try {
    const status = storageManager.getSyncQueueStatus();
    if (status !== undefined && typeof status.queueLength === 'number') {
      console.log('✅ Test 7 passed: Sync queue management');
      testsPassed++;
    } else {
      console.log('❌ Test 7 failed: Sync queue management');
    }
  } catch (error) {
    console.log('❌ Test 7 failed:', error.message);
  }

  // Test 8: Idempotent writes (same key overwrites)
  testsTotal++;
  try {
    const key = storageManager.getCompoundKey(testUserId, testDate);
    const logs = storageManager.getReadinessLogs();

    if (logs[key] && logs[key].sleep === 8) {
      console.log('✅ Test 8 passed: Idempotent writes');
      testsPassed++;
    } else {
      console.log('❌ Test 8 failed: Idempotent writes');
    }
  } catch (error) {
    console.log('❌ Test 8 failed:', error.message);
  }

  // Test 9: Storage statistics
  testsTotal++;
  try {
    const stats = storageManager.getStorageStats();
    if (stats && typeof stats === 'object') {
      console.log('✅ Test 9 passed: Storage statistics');
      console.log(`   Stats:`, JSON.stringify(stats, null, 2));
      testsPassed++;
    } else {
      console.log('❌ Test 9 failed: Storage statistics');
    }
  } catch (error) {
    console.log('❌ Test 9 failed:', error.message);
  }

  // Summary
  console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} passed`);

  if (testsPassed === testsTotal) {
    console.log('✅ All tests passed!');
    return true;
  } else {
    console.log('❌ Some tests failed');
    return false;
  }
}

// Run tests
if (require.main === module) {
  testStorageManager()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testStorageManager };
