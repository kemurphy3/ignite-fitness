// Performance-Optimized App.js with Code Splitting
// Heavy modules are loaded dynamically to improve initial load time

// Initialize logger
const logger = window.SafeLogger || console;

// Global variables
let currentUser = null;
let isLoggedIn = false;
let users = {};
let contextAwareAI = null;
let seasonalTraining = null;
let dataStore = null;
let workoutGenerator = null;
let patternDetector = null;

// Module loading cache
const moduleCache = new Map();
const loadingStates = new Map();

/**
 * Dynamic module loader with caching and loading states
 * @param {string} modulePath - Path to the module
 * @param {string} className - Class name to instantiate
 * @param {Object} options - Loading options
 * @returns {Promise} Promise resolving to module instance
 */
async function loadModule(modulePath, className, options = {}) {
  const cacheKey = `${modulePath}:${className}`;

  // Return cached instance if available
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey);
  }

  // Check if already loading
  if (loadingStates.has(cacheKey)) {
    return loadingStates.get(cacheKey);
  }

  // Show loading state if specified
  if (options.showLoading) {
    showLoading(options.loadingMessage || `Loading ${className}...`);
  }

  try {
    // Create loading promise
    const loadingPromise = (async () => {
      const module = await import(modulePath);
      const instance = new module[className]();

      // Cache the instance
      moduleCache.set(cacheKey, instance);

      return instance;
    })();

    // Store loading promise
    loadingStates.set(cacheKey, loadingPromise);

    const instance = await loadingPromise;

    // Clean up loading state
    loadingStates.delete(cacheKey);

    if (options.showLoading) {
      hideLoading();
    }

    return instance;
  } catch (error) {
    logger.error('Failed to load module', { modulePath, className, error: error.message, stack: error.stack });
    loadingStates.delete(cacheKey);

    if (options.showLoading) {
      hideLoading();
    }

    throw error;
  }
}

/**
 * Load heavy modules on demand
 */
async function _loadHeavyModules() {
  try {
    // Load soccer exercises only when needed
    const soccerExercises = await loadModule(
      './modules/sports/SoccerExercises.js',
      'SoccerExercises',
      { showLoading: true, loadingMessage: 'Loading soccer exercises...' }
    );

    // Load seasonal programs only when needed
    const seasonalPrograms = await loadModule(
      './modules/sports/SeasonalPrograms.js',
      'SeasonalPrograms',
      { showLoading: true, loadingMessage: 'Loading seasonal programs...' }
    );

    return { soccerExercises, seasonalPrograms };
  } catch (error) {
    logger.error('Failed to load heavy modules', { error: error.message, stack: error.stack });
    showError(null, 'Failed to load some features. Please refresh the page.');
    return null;
  }
}

/**
 * Preload critical modules in background
 */
function preloadCriticalModules() {
  // Preload modules that are likely to be needed soon
  const criticalModules = [
    { path: './modules/ai/ExpertCoordinator.js', className: 'ExpertCoordinator' },
    { path: './modules/ui/DashboardRenderer.js', className: 'DashboardRenderer' },
    { path: './modules/workout/WorkoutGenerator.js', className: 'WorkoutGenerator' },
  ];

  criticalModules.forEach(({ path, className }) => {
    loadModule(path, className, { showLoading: false }).catch(error =>
      logger.warn('Preload failed', { className, error: error.message, stack: error.stack })
    );
  });
}

// Data migration system
function migrateUserData() {
  const currentVersion = '2.0';
  const storedVersion = localStorage.getItem('ignitefitness_data_version');

  if (storedVersion === currentVersion) {
    return; // No migration needed
  }

  logger.info('Migrating user data', { fromVersion: storedVersion || '1.0', toVersion: currentVersion });

  // Migrate from version 1.0 to 2.0
  if (!storedVersion || storedVersion === '1.0') {
    migrateFromV1ToV2();
  }

  // Set new version
  localStorage.setItem('ignitefitness_data_version', currentVersion);
  logger.info('Data migration completed');
}

function migrateFromV1ToV2() {
  try {
    // Migrate users data structure
    const oldUsers = localStorage.getItem('ignitefitness_users');
    if (oldUsers) {
      const usersData = JSON.parse(oldUsers);
      const migratedUsers = {};

      Object.keys(usersData).forEach(username => {
        const user = usersData[username];
        migratedUsers[username] = {
          version: '2.0',
          username,
          password: user.password,
          athleteName: user.athleteName,
          personalData: user.personalData || {},
          goals: user.goals || {},
          workoutSchedule: user.workoutSchedule || {},
          sessions: user.sessions || [],
          preferences: user.preferences || {},
          lastSync: user.lastSync || Date.now(),
          createdAt: user.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      localStorage.setItem('ignitefitness_users', JSON.stringify(migratedUsers));
    }

    // Migrate other data structures
    migrateStravaData();
    migrateWorkoutData();
  } catch (error) {
    logger.error('Error during data migration', { error: error.message, stack: error.stack });
    // Continue with app initialization even if migration fails
  }
}

function migrateStravaData() {
  // Migrate Strava tokens to new format
  const accessToken = localStorage.getItem('strava_access_token');
  const refreshToken = localStorage.getItem('strava_refresh_token');
  const expiresAt = localStorage.getItem('strava_token_expires');
  const athleteId = localStorage.getItem('strava_athlete_id');

  if (accessToken && refreshToken) {
    const stravaData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: parseInt(expiresAt) || 0,
      athlete_id: athleteId,
      last_updated: Date.now(),
    };

    localStorage.setItem('ignitefitness_strava_data', JSON.stringify(stravaData));

    // Clean up old keys
    localStorage.removeItem('strava_access_token');
    localStorage.removeItem('strava_refresh_token');
    localStorage.removeItem('strava_token_expires');
    localStorage.removeItem('strava_athlete_id');
  }
}

function migrateWorkoutData() {
  // Migrate any old workout data to new format
  const oldWorkouts = localStorage.getItem('ignitefitness_workouts');
  if (oldWorkouts) {
    try {
      const workouts = JSON.parse(oldWorkouts);
      // Convert to new format if needed
      localStorage.setItem(
        'ignitefitness_workout_data',
        JSON.stringify({
          workouts,
          version: '2.0',
          last_updated: Date.now(),
        })
      );
      localStorage.removeItem('ignitefitness_workouts');
    } catch (error) {
      logger.error('Error migrating workout data', { error: error.message, stack: error.stack });
    }
  }
}

// Standardized data storage functions
function saveUserDataToStorage(userId, data) {
  if (!users[userId]) {
    users[userId] = {
      version: '2.0',
      username: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Merge new data with existing user data
  users[userId] = {
    ...users[userId],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem('ignitefitness_users', JSON.stringify(users));
}

function _getUserDataFromStorage(userId) {
  return users[userId] || null;
}

function _saveAppData(key, data) {
  const appData = {
    version: '2.0',
    data,
    last_updated: Date.now(),
  };
  localStorage.setItem(`ignitefitness_${key}`, JSON.stringify(appData));
}

function _getAppData(key) {
  const stored = localStorage.getItem(`ignitefitness_${key}`);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed.data;
    } catch (error) {
      logger.error('Error parsing app data', { key, error: error.message, stack: error.stack });
      return null;
    }
  }
  return null;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  logger.info('Ignite Fitness App Starting');

  // Run data migration first
  migrateUserData();

  // Check if user is already logged in
  const savedUser = localStorage.getItem('ignitefitness_current_user');
  if (savedUser) {
    currentUser = savedUser;
    isLoggedIn = true;
  }

  // Load users from localStorage
  const savedUsers = localStorage.getItem('ignitefitness_users');
  if (savedUsers) {
    try {
      users = JSON.parse(savedUsers);
    } catch (error) {
      logger.error('Error parsing saved users', { error: error.message, stack: error.stack });
      users = {};
    }
  }

  // Initialize core systems with dynamic loading
  initializeCoreSystems();

  // Preload critical modules in background
  preloadCriticalModules();

  // Add workout styles
  addWorkoutStyles();

  // Show appropriate UI
  if (isLoggedIn && currentUser) {
    showUserDashboard();
    loadUserData();
    updateSeasonalPhaseDisplay();
    checkStravaConnection();
    updateSyncStatus();
    loadRecentWorkouts();
  } else {
    showLoginForm();
  }

  // Handle Enter key in AI chat input
  const aiInput = document.getElementById('aiChatInput');
  if (aiInput) {
    aiInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        sendToAI();
      }
    });
  }

  logger.info('Ignite Fitness App Ready');
});

// Simple hash function for password hashing
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// Authentication Functions
function _login() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');

  if (!username || !password) {
    showError(errorDiv, 'Please enter both username and password');
    return;
  }

  // Check if user exists and verify password hash
  if (users[username] && users[username].passwordHash) {
    const passwordHash = simpleHash(password);
    if (users[username].passwordHash === passwordHash) {
      currentUser = username;
      isLoggedIn = true;
      localStorage.setItem('ignitefitness_current_user', username);
      localStorage.setItem('ignitefitness_login_time', Date.now().toString());
      showSuccess('Login successful!');
      showUserDashboard();
      loadUserData();
    } else {
      showError(errorDiv, 'Invalid username or password');
    }
  } else {
    showError(errorDiv, 'User not found. Please register first.');
  }
}

function _register() {
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const athleteName = document.getElementById('regAthleteName').value;
  const errorDiv = document.getElementById('registerError');

  if (!username || !password || !athleteName) {
    showError(errorDiv, 'Please fill in all fields');
    return;
  }

  if (password !== confirmPassword) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  if (users[username]) {
    showError(errorDiv, 'Username already exists');
    return;
  }

  if (password.length < 6) {
    showError(errorDiv, 'Password must be at least 6 characters long');
    return;
  }

  // Create new user with hashed password
  users[username] = {
    passwordHash: simpleHash(password),
    athleteName,
    personalData: {},
    goals: {},
    wearableSettings: {},
    workoutPlan: null,
    data: {
      workouts: [],
      soccerSessions: [],
      recoveryData: [],
      stravaData: [],
      sleepData: [],
    },
    createdAt: Date.now(),
    lastLogin: null,
  };

  // Save users
  localStorage.setItem('ignitefitness_users', JSON.stringify(users));

  // Auto-login after registration
  currentUser = username;
  isLoggedIn = true;
  localStorage.setItem('ignitefitness_current_user', username);
  showSuccess('Registration successful! Welcome to Ignite Fitness!');
  showUserDashboard();
  hideRegisterForm();
  loadUserData();
}

function _resetPassword() {
  const username = document.getElementById('resetUsername').value;
  const athleteName = document.getElementById('resetAthleteName').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  const errorDiv = document.getElementById('resetError');

  if (!username || !athleteName || !newPassword || !confirmPassword) {
    showError(errorDiv, 'Please fill in all fields');
    return;
  }

  if (newPassword !== confirmPassword) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  if (newPassword.length < 6) {
    showError(errorDiv, 'Password must be at least 6 characters long');
    return;
  }

  // Verify user exists and athlete name matches
  if (users[username] && users[username].athleteName === athleteName) {
    // Update password hash
    users[username].passwordHash = simpleHash(newPassword);
    users[username].lastPasswordReset = Date.now();

    // Save updated users
    localStorage.setItem('ignitefitness_users', JSON.stringify(users));

    showSuccess('Password reset successfully! Please login with your new password.');
    hidePasswordReset();
  } else {
    showError(errorDiv, 'Invalid username or athlete name');
  }
}

// UI Functions
function showLoginForm() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('userDashboard').classList.add('hidden');
}

function showUserDashboard() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('userDashboard').classList.remove('hidden');

  // Update athlete name display
  const athleteNameElement = document.getElementById('currentAthleteName');
  if (athleteNameElement && users[currentUser]) {
    athleteNameElement.textContent = users[currentUser].athleteName || currentUser;
  }
}

function _showPasswordReset() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('passwordResetForm').classList.remove('hidden');
}

function hidePasswordReset() {
  document.getElementById('passwordResetForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
}

function _showRegisterForm() {
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
}

function hideRegisterForm() {
  document.getElementById('registerForm').classList.add('hidden');
}

function _hideLoginForm() {
  document.getElementById('loginForm').classList.add('hidden');
}

// Tab Functions
function _showTab(tabName, clickedButton) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.add('hidden');
  });

  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab content
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) {
    selectedTab.classList.remove('hidden');
  }

  // Add active class to clicked button
  if (clickedButton) {
    clickedButton.classList.add('active');
  }
}

// Data Functions
function loadUserData() {
  if (!currentUser || !users[currentUser]) {
    return;
  }

  const user = users[currentUser];

  // Load personal data
  if (user.personalData) {
    if (user.personalData.age) {
      document.getElementById('age').value = user.personalData.age;
    }
    if (user.personalData.weight) {
      document.getElementById('weight').value = user.personalData.weight;
    }
    if (user.personalData.height) {
      document.getElementById('height').value = user.personalData.height;
    }
    if (user.personalData.experience) {
      document.getElementById('experience').value = user.personalData.experience;
    }
  }

  // Load goals
  if (user.goals) {
    if (user.goals.primary) {
      const primaryGoal = document.querySelector(
        `input[name="primaryGoal"][value="${user.goals.primary}"]`
      );
      if (primaryGoal) {
        primaryGoal.checked = true;
      }
    }
    if (user.goals.secondary) {
      const secondaryGoal = document.querySelector(
        `input[name="secondaryGoal"][value="${user.goals.secondary}"]`
      );
      if (secondaryGoal) {
        secondaryGoal.checked = true;
      }
    }
  }
}

function saveUserData() {
  if (!currentUser) {
    return;
  }
  saveUserDataToStorage(currentUser, users[currentUser] || {});
}

async function _savePersonalInfo() {
  const saveButton = document.querySelector('button[onclick="savePersonalInfo()"]');

  try {
    if (!currentUser) {
      showError(null, 'Please log in first');
      return;
    }

    const age = document.getElementById('age').value;
    const weight = document.getElementById('weight').value;
    const height = document.getElementById('height').value;
    const experience = document.getElementById('experience').value;

    // Validate input values
    if (!age || !weight || !height || !experience) {
      showError(null, 'Please fill in all fields');
      return;
    }

    if (isNaN(age) || age < 13 || age > 100) {
      showError(null, 'Please enter a valid age (13-100)');
      return;
    }

    if (isNaN(weight) || weight < 30 || weight > 300) {
      showError(null, 'Please enter a valid weight (30-300 kg)');
      return;
    }

    if (isNaN(height) || height < 100 || height > 250) {
      showError(null, 'Please enter a valid height (100-250 cm)');
      return;
    }

    // Show loading state
    setButtonLoading(saveButton, true, 'Saving...');

    const personalData = {
      age: parseInt(age),
      weight: parseFloat(weight),
      height: parseInt(height),
      experience,
    };

    if (!users[currentUser]) {
      users[currentUser] = {};
    }

    users[currentUser].personalData = personalData;
    saveUserData();

    // Sync to database
    await saveUserDataToDatabase();

    showSuccess('Personal information saved!');
  } catch (error) {
    handleError(error, 'savePersonalInfo');
  } finally {
    setButtonLoading(saveButton, false);
  }
}

async function _saveGoals() {
  const saveButton = document.querySelector('button[onclick="saveGoals()"]');

  try {
    if (!currentUser) {
      showError(null, 'Please log in first');
      return;
    }

    const primaryGoal = document.querySelector('input[name="primaryGoal"]:checked')?.value;
    const secondaryGoal = document.querySelector('input[name="secondaryGoal"]:checked')?.value;

    if (!primaryGoal) {
      showError(null, 'Please select a primary goal');
      return;
    }

    // Show loading state
    setButtonLoading(saveButton, true, 'Saving...');

    const goals = {
      primary: primaryGoal,
      secondary: secondaryGoal,
    };

    if (!users[currentUser]) {
      users[currentUser] = {};
    }

    users[currentUser].goals = goals;
    saveUserData();

    // Sync to database
    await saveUserDataToDatabase();

    showSuccess('Goals saved!');
  } catch (error) {
    handleError(error, 'saveGoals');
  } finally {
    setButtonLoading(saveButton, false);
  }
}

// Workout Generator Functions
async function initializeWorkoutGenerator() {
  try {
    const workoutModule = await loadModule(
      './modules/workout/WorkoutGenerator.js',
      'WorkoutGenerator'
    );
    workoutGenerator = workoutModule;
    logger.info('Workout generator initialized');
  } catch (error) {
    logger.warn('WorkoutGenerator not available', { error: error.message, stack: error.stack });
  }
}

function buildUserProfile() {
  const user = users[currentUser];
  if (!user) {
    return {};
  }

  return {
    goals: user.goals || {},
    experience: user.personalData?.experience || 'beginner',
    personalData: user.personalData || {},
    currentPhase: seasonalTraining?.getCurrentPhase()?.phase || 'off-season',
    recentWorkouts: user.data?.sessions || [],
    preferences: {
      preferredTimes: [],
      favoriteExercises: [],
      intensityPreference: 'moderate',
      sessionLength: 'medium',
      restDayPattern: {},
    },
  };
}

function displayGeneratedWorkout(workout) {
  const workoutPlanDiv = document.getElementById('workoutPlan');
  if (!workoutPlanDiv) {
    return;
  }

  const html = `
        <div class="workout-plan">
            <h3>Generated Workout Plan</h3>
            <div class="workout-info">
                <p><strong>Type:</strong> ${workout.type}</p>
                <p><strong>Focus:</strong> ${workout.focus}</p>
                <p><strong>Duration:</strong> ${workout.duration} minutes</p>
            </div>
            
            <div class="workout-section">
                <h4>Warmup (${workout.warmup.duration} minutes)</h4>
                <ul>
                    ${workout.warmup.exercises
                      .map(
                        ex => `
                        <li><strong>${ex.name}:</strong> ${ex.duration} minutes - ${ex.description}</li>
                    `
                      )
                      .join('')}
                </ul>
            </div>
            
            <div class="workout-section">
                <h4>Main Exercises</h4>
                <div class="exercises-list">
                    ${workout.exercises
                      .map(
                        (ex, index) => `
                        <div class="exercise-item">
                            <h5>${index + 1}. ${ex.name}</h5>
                            <div class="exercise-details">
                                <span><strong>Sets:</strong> ${ex.sets}</span>
                                <span><strong>Reps:</strong> ${ex.reps}</span>
                                <span><strong>Weight:</strong> ${ex.weight} lbs</span>
                                <span><strong>RPE:</strong> ${ex.rpe}/10</span>
                                <span><strong>Rest:</strong> ${ex.rest}s</span>
                            </div>
                            ${ex.notes ? `<p class="exercise-notes">${ex.notes}</p>` : ''}
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            
            <div class="workout-section">
                <h4>Cooldown (${workout.cooldown.duration} minutes)</h4>
                <ul>
                    ${workout.cooldown.exercises
                      .map(
                        ex => `
                        <li><strong>${ex.name}:</strong> ${ex.duration} minutes - ${ex.description}</li>
                    `
                      )
                      .join('')}
                </ul>
            </div>
            
            ${
              workout.notes
                ? `
                <div class="workout-notes">
                    <h4>Notes</h4>
                    <p>${workout.notes}</p>
                </div>
            `
                : ''
            }
        </div>
    `;

  workoutPlanDiv.innerHTML = html;
}

// Add CSS for workout display
function addWorkoutStyles() {
  const style = document.createElement('style');
  style.textContent = `
        .workout-plan {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .workout-info {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
            border-left: 4px solid #4299e1;
        }
        
        .workout-section {
            margin: 20px 0;
        }
        
        .workout-section h4 {
            color: #2d3748;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .exercises-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .exercise-item {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 15px;
        }
        
        .exercise-item h5 {
            margin: 0 0 10px 0;
            color: #2d3748;
        }
        
        .exercise-details {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 10px 0;
        }
        
        .exercise-details span {
            background: #edf2f7;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .exercise-notes {
            margin: 10px 0 0 0;
            font-style: italic;
            color: #4a5568;
            font-size: 14px;
        }
        
        .workout-notes {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 6px;
            padding: 15px;
            margin: 15px 0;
        }
        
        .workout-notes h4 {
            color: #742a2a;
            margin: 0 0 10px 0;
        }
        
        .workout-notes p {
            margin: 0;
            color: #742a2a;
        }
    `;
  document.head.appendChild(style);
}

/**
 * Load soccer exercises when needed
 */
async function _loadSoccerExercises() {
  try {
    const soccerModule = await loadModule(
      './modules/sports/SoccerExercises.js',
      'SoccerExercises',
      { showLoading: true, loadingMessage: 'Loading soccer exercises...' }
    );
    return soccerModule;
  } catch (error) {
    logger.error('Failed to load soccer exercises', { error: error.message, stack: error.stack });
    showError(null, 'Soccer exercises not available. Please refresh the page.');
    return null;
  }
}

/**
 * Load seasonal programs when needed
 */
async function _loadSeasonalPrograms() {
  try {
    const seasonalModule = await loadModule(
      './modules/sports/SeasonalPrograms.js',
      'SeasonalPrograms',
      { showLoading: true, loadingMessage: 'Loading seasonal programs...' }
    );
    return seasonalModule;
  } catch (error) {
    logger.error('Failed to load seasonal programs', { error: error.message, stack: error.stack });
    showError(null, 'Seasonal programs not available. Please refresh the page.');
    return null;
  }
}

// Pattern Detector Functions
async function initializePatternDetector() {
  try {
    const patternModule = await loadModule('./modules/ai/PatternDetector.js', 'PatternDetector');
    patternDetector = patternModule;
    logger.info('Pattern detector initialized');
  } catch (error) {
    logger.warn('PatternDetector not available', { error: error.message, stack: error.stack });
  }
}

function analyzeUserPatterns() {
  if (!currentUser || !patternDetector) {
    return;
  }

  const user = users[currentUser];
  if (!user) {
    return;
  }

  try {
    const userProfile = buildUserProfile();
    const analysis = patternDetector.analyzePatterns(user.data || {}, userProfile);

    // Store analysis results
    if (!user.analysis) {
      user.analysis = {};
    }
    user.analysis.patterns = analysis.patterns;
    user.analysis.insights = analysis.insights;
    user.analysis.recommendations = analysis.recommendations;

    // Save updated user data
    saveUserData();

    logger.info('Pattern analysis completed', { analysis });
    return analysis;
  } catch (error) {
    logger.error('Pattern analysis failed', { error: error.message, stack: error.stack });
    return null;
  }
}

function displayPatternInsights() {
  if (!currentUser || !patternDetector) {
    return;
  }

  const user = users[currentUser];
  if (!user?.analysis) {
    return;
  }

  const insights = user.analysis.insights || [];
  const recommendations = user.analysis.recommendations || [];

  // Create insights display
  const insightsHtml = `
        <div class="pattern-insights">
            <h3>📊 Training Insights</h3>
            ${
              insights.length > 0
                ? `
                <div class="insights-list">
                    ${insights
                      .map(
                        insight => `
                        <div class="insight-item ${insight.priority}">
                            <h4>${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}</h4>
                            <p>${insight.message}</p>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            `
                : '<p>No insights available yet. Complete more workouts to see patterns.</p>'
            }
            
            ${
              recommendations.length > 0
                ? `
                <h3>💡 Recommendations</h3>
                <div class="recommendations-list">
                    ${recommendations
                      .map(
                        rec => `
                        <div class="recommendation-item">
                            <h4>${rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}</h4>
                            <p><strong>${rec.message}</strong></p>
                            <p class="action">Action: ${rec.action}</p>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            `
                : ''
            }
        </div>
    `;

  // Find a place to display insights (could be in a modal or dedicated section)
  const insightsContainer = document.getElementById('patternInsights');
  if (insightsContainer) {
    insightsContainer.innerHTML = insightsHtml;
  } else {
    // Create a temporary display
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = insightsHtml;
    tempDiv.className = 'pattern-insights-modal';
    document.body.appendChild(tempDiv);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (tempDiv.parentNode) {
        tempDiv.parentNode.removeChild(tempDiv);
      }
    }, 10000);
  }
}

// Add pattern analysis to workout completion
function _onWorkoutCompleted(sessionData) {
  if (!currentUser) {
    return;
  }

  // Add session to user data
  if (!users[currentUser].data) {
    users[currentUser].data = {};
  }
  if (!users[currentUser].data.sessions) {
    users[currentUser].data.sessions = [];
  }

  users[currentUser].data.sessions.push(sessionData);
  saveUserData();

  // Trigger pattern analysis
  setTimeout(() => {
    analyzeUserPatterns();
  }, 1000);
}

// UI Component Functions
function updateSyncStatus() {
  const syncStatus = document.getElementById('syncStatus');
  const lastSync = document.getElementById('lastSync');

  if (syncStatus && lastSync) {
    const lastSyncTime = localStorage.getItem('ignitefitness_last_sync');
    if (lastSyncTime) {
      const syncDate = new Date(parseInt(lastSyncTime));
      lastSync.textContent = `Last sync: ${syncDate.toLocaleString()}`;
      syncStatus.textContent = '✅ Synced';
    } else {
      lastSync.textContent = 'Last sync: Never';
      syncStatus.textContent = '🔄 Syncing...';
    }
  }
}

function _manualSync() {
  if (!currentUser) {
    return;
  }

  const syncStatus = document.getElementById('syncStatus');
  if (syncStatus) {
    syncStatus.textContent = '🔄 Syncing...';
  }

  saveUserDataToDatabase()
    .then(() => {
      updateSyncStatus();
      showSuccess('Data synced successfully!');
    })
    .catch(error => {
      logger.error('Sync failed', { error: error.message, stack: error.stack });
      showError(null, 'Sync failed. Please try again.');
      if (syncStatus) {
        syncStatus.textContent = '❌ Sync Failed';
      }
    });
}

function _startWorkout() {
  showSuccess('Workout logging will be implemented in the full version!');
}

function _logQuickWorkout() {
  showSuccess('Quick workout logging will be implemented in the full version!');
}

function _viewProgress() {
  // Show pattern insights
  displayPatternInsights();
  showSuccess('Progress analysis completed!');
}

function updateWorkoutPlanGeneration() {
  const sessionType = document.getElementById('sessionType')?.value || 'Upper Body';
  const duration = parseInt(document.getElementById('workoutDuration')?.value) || 60;

  // Update the generateWorkoutPlan function to use these values
  if (currentUser && workoutGenerator) {
    const userProfile = buildUserProfile();

    try {
      const workout = workoutGenerator.generateWorkout(userProfile, sessionType, duration);
      displayGeneratedWorkout(workout);
      showSuccess('Workout plan generated successfully!');
    } catch (error) {
      logger.error('Workout generation failed', { error: error.message, stack: error.stack });
      showError(null, 'Failed to generate workout plan');
    }
  }
}

// Override the original generateWorkoutPlan function
function _generateWorkoutPlan() {
  updateWorkoutPlanGeneration();
}

// Load recent workouts
function loadRecentWorkouts() {
  if (!currentUser) {
    return;
  }

  const user = users[currentUser];
  const recentWorkoutsList = document.getElementById('recentWorkoutsList');

  if (!recentWorkoutsList) {
    return;
  }

  const sessions = user?.data?.sessions || [];
  const recentSessions = sessions.slice(0, 5); // Last 5 sessions

  if (recentSessions.length === 0) {
    recentWorkoutsList.innerHTML = '<p>No recent workouts found. Start your first workout!</p>';
    return;
  }

  const workoutsHtml = recentSessions
    .map(session => {
      const date = new Date(session.start_at).toLocaleDateString();
      const duration = session.duration || 'Unknown';
      const exercises = session.exercises?.length || 0;

      return `
            <div class="workout-item">
                <div class="workout-info">
                    <h6>${session.type || 'Workout'}</h6>
                    <p>${date}</p>
                </div>
                <div class="workout-stats">
                    <span>${duration} min</span>
                    <span>${exercises} exercises</span>
                </div>
            </div>
        `;
    })
    .join('');

  recentWorkoutsList.innerHTML = workoutsHtml;
}

function _logout() {
  currentUser = null;
  isLoggedIn = false;
  localStorage.removeItem('ignitefitness_current_user');
  showLoginForm();
  showSuccess('Logged out successfully!');
}

// Utility Functions
function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
  }
}

// Enhanced error handling with user-friendly messages
function handleError(error, context = '') {
  logger.error(`Error in ${context}`, { error: error.message, stack: error.stack, context });

  let userMessage = 'An unexpected error occurred. Please try again.';

  // Provide more specific error messages based on error type
  if (error.name === 'TypeError') {
    userMessage = 'A data error occurred. Please refresh the page and try again.';
  } else if (error.name === 'ReferenceError') {
    userMessage = 'A system error occurred. Please refresh the page.';
  } else if (error.message.includes('fetch')) {
    userMessage = 'Network error. Please check your connection and try again.';
  } else if (error.message.includes('JSON')) {
    userMessage = 'Data format error. Please refresh the page.';
  } else if (error.message.includes('localStorage')) {
    userMessage = 'Storage error. Please clear your browser data and try again.';
  } else if (error.message.includes('permission')) {
    userMessage = 'Permission denied. Please check your browser settings.';
  } else if (error.message.includes('timeout')) {
    userMessage = 'Request timed out. Please try again.';
  } else if (error.message.includes('unauthorized')) {
    userMessage = 'Authentication required. Please log in again.';
  } else if (error.message.includes('not found')) {
    userMessage = 'Resource not found. Please refresh the page.';
  } else if (error.message.includes('server')) {
    userMessage = 'Server error. Please try again later.';
  }

  // Show error notification
  showErrorNotification(userMessage, 'error');

  return userMessage;
}

// Show error notification
function showErrorNotification(message, type = 'error') {
  // Remove existing notifications
  const existing = document.getElementById('error-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'error-notification';
  notification.className = `notification ${type}`;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#e53e3e' : '#68d391'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 400px;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;

  notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 20px;">${type === 'error' ? '❌' : '✅'}</span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                margin-left: auto;
            ">×</button>
        </div>
    `;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// Add CSS animation for notifications
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        .notification {
            animation: slideIn 0.3s ease;
        }
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .loading-content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
    `;
  document.head.appendChild(style);
}

// Loading state management
function showLoading(message = 'Loading...') {
  // Remove existing loading overlay
  hideLoading();

  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p style="margin: 15px 0 0 0; color: #2d3748; font-weight: 500;">${message}</p>
        </div>
    `;

  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Enhanced button loading state
function setButtonLoading(button, loading = true, text = 'Loading...') {
  if (!button) {
    return;
  }

  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<div class="loading-spinner" style="margin-right: 8px;"></div>${text}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Submit';
    delete button.dataset.originalText;
  }
}

function showSuccess(message) {
  // Create or update success notification
  let notification = document.getElementById('success-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'success-notification';
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #68d391;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            display: none;
        `;
    document.body.appendChild(notification);
  }

  notification.textContent = message;
  notification.style.display = 'block';

  // Hide after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

/**
 * Initialize core systems with dynamic loading
 */
async function initializeCoreSystems() {
  try {
    // Initialize AI system
    await initializeAI();

    // Initialize data store
    await initializeDataStore();

    // Initialize workout generator
    await initializeWorkoutGenerator();

    // Initialize pattern detector
    await initializePatternDetector();

    logger.info('Core systems initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize core systems', { error: error.message, stack: error.stack });
    showError(null, 'Some features may not be available. Please refresh the page.');
  }
}

// AI System Functions
async function initializeAI() {
  try {
    const aiModule = await loadModule('./modules/ai/ContextAwareAI.js', 'ContextAwareAI');
    contextAwareAI = aiModule;
    logger.info('AI system initialized');
  } catch (error) {
    logger.warn('ContextAwareAI not available', { error: error.message, stack: error.stack });
  }
}

// Seasonal Training Functions
async function _initializeSeasonalTraining() {
  try {
    const seasonalModule = await loadModule(
      './modules/sports/SeasonalTrainingSystem.js',
      'SeasonalTrainingSystem'
    );
    seasonalTraining = seasonalModule;
    seasonalTraining.initialize();
    logger.info('Seasonal training system initialized');
  } catch (error) {
    logger.warn('SeasonalTrainingSystem not available', { error: error.message, stack: error.stack });
  }
}

function updateSeasonalPhaseDisplay() {
  if (!seasonalTraining) {
    return;
  }

  const phaseInfo = seasonalTraining.getCurrentPhase();
  const phaseNameElement = document.getElementById('currentPhaseName');
  const phaseProgressElement = document.getElementById('phaseProgress');

  if (phaseNameElement) {
    phaseNameElement.textContent = phaseInfo.details.name;
  }

  if (phaseProgressElement) {
    const progress = Math.round(phaseInfo.phaseProgress * 100);
    phaseProgressElement.textContent = `${progress}% Complete`;
  }
}

function _showPhaseModal() {
  if (!seasonalTraining) {
    return;
  }

  const modal = document.getElementById('phaseModal');
  const phaseDetails = document.getElementById('phaseDetails');
  const phaseInfo = seasonalTraining.getCurrentPhase();

  if (modal && phaseDetails) {
    phaseDetails.innerHTML = generatePhaseDetailsHTML(phaseInfo);
    modal.classList.remove('hidden');
  }
}

function closePhaseModal() {
  const modal = document.getElementById('phaseModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function generatePhaseDetailsHTML(phaseInfo) {
  const { details } = phaseInfo;
  const recommendations = seasonalTraining.getPhaseRecommendations();
  const upcomingGames = seasonalTraining.getUpcomingGames(3);

  let html = `
        <div class="phase-detail-item">
            <h4>Current Phase: ${details.name}</h4>
            <p><strong>Duration:</strong> ${details.duration}</p>
            <p><strong>Focus:</strong> ${details.focus}</p>
            <p><strong>Volume:</strong> ${details.volume}</p>
            <p><strong>Intensity:</strong> ${details.intensity}</p>
            <p><strong>Frequency:</strong> ${details.frequency}</p>
        </div>
        
        <div class="phase-detail-item">
            <h4>Phase Priorities</h4>
            <ul class="phase-priorities">
                ${details.priorities.map(priority => `<li>${priority}</li>`).join('')}
            </ul>
        </div>
        
        <div class="phase-detail-item">
            <h4>Training Adjustments</h4>
            <p><strong>Volume Multiplier:</strong> ${details.adjustments.volumeMultiplier}x</p>
            <p><strong>Intensity Multiplier:</strong> ${details.adjustments.intensityMultiplier}x</p>
            <p><strong>Recovery Days:</strong> ${details.adjustments.recoveryDays} days</p>
            <p><strong>Max Session Duration:</strong> ${details.adjustments.maxSessionDuration} minutes</p>
        </div>
    `;

  if (recommendations.length > 0) {
    html += `
            <div class="phase-detail-item">
                <h4>Recommendations</h4>
                ${recommendations
                  .map(
                    rec => `
                    <p><strong>${rec.category}:</strong> ${rec.message}</p>
                `
                  )
                  .join('')}
            </div>
        `;
  }

  if (upcomingGames.length > 0) {
    html += `
            <div class="phase-detail-item">
                <h4>Upcoming Games</h4>
                <div class="game-schedule">
                    ${upcomingGames
                      .map(
                        game => `
                        <div class="game-item">
                            <div>
                                <div class="game-date">${game.date.toLocaleDateString()}</div>
                                <div class="game-opponent">vs ${game.opponent}</div>
                            </div>
                            <div class="game-type">${game.type}</div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
  }

  return html;
}

function _changePhase() {
  const phases = ['off-season', 'pre-season', 'in-season', 'playoffs'];
  const currentPhase = seasonalTraining.getCurrentPhase().phase;
  const currentIndex = phases.indexOf(currentPhase);
  const nextIndex = (currentIndex + 1) % phases.length;
  const nextPhase = phases[nextIndex];

  if (seasonalTraining.setPhase(nextPhase)) {
    updateSeasonalPhaseDisplay();
    showSuccess(`Phase changed to ${seasonalTraining.phases[nextPhase].name}`);
    closePhaseModal();
  }
}

function _addGame() {
  // eslint-disable-next-line no-alert
  const opponent = prompt('Enter opponent name:');
  if (!opponent) {
    return;
  }

  // eslint-disable-next-line no-alert
  const dateStr = prompt('Enter game date (YYYY-MM-DD):');
  if (!dateStr) {
    return;
  }

  const gameDate = new Date(dateStr);
  if (isNaN(gameDate.getTime())) {
    showError(null, 'Invalid date format');
    return;
  }

  // eslint-disable-next-line no-alert
  const type = prompt('Enter game type (regular/playoff/championship):') || 'regular';
  // eslint-disable-next-line no-alert
  const location = prompt('Enter location (home/away):') || 'home';

  seasonalTraining.addGame({
    opponent,
    date: gameDate,
    type,
    location,
  });

  showSuccess('Game added to schedule');
  closePhaseModal();
}

// Data Store Functions
async function initializeDataStore() {
  try {
    const dataStoreModule = await loadModule('./modules/data/DataStore.js', 'DataStore');
    dataStore = dataStoreModule;
    dataStore.setCurrentUser(currentUser);
    logger.info('Data store initialized');
  } catch (error) {
    logger.warn('DataStore not available', { error: error.message, stack: error.stack });
  }
}

// Enhanced save functions with database sync
async function saveUserDataToDatabase() {
  if (!currentUser || !dataStore) {
    return;
  }

  try {
    const userData = {
      username: currentUser,
      email: users[currentUser]?.email || null,
      preferences: {
        age: users[currentUser]?.personalData?.age,
        weight: users[currentUser]?.personalData?.weight,
        height: users[currentUser]?.personalData?.height,
        sex: users[currentUser]?.personalData?.sex,
        goals: users[currentUser]?.goals,
        baselineLifts: users[currentUser]?.baselineLifts,
        workoutSchedule: users[currentUser]?.workoutSchedule,
      },
      sessions: users[currentUser]?.data?.sessions || [],
      sleepSessions: users[currentUser]?.data?.sleepData || [],
      stravaActivities: users[currentUser]?.data?.stravaData || [],
    };

    await dataStore.save('user_data', userData);
    logger.info('User data synced to database');
  } catch (error) {
    logger.error('Failed to sync user data to database', { error: error.message, stack: error.stack });
    showError(null, 'Failed to sync data to database');
  }
}

// Strava Integration Functions
function checkStravaConnection() {
  const accessToken = localStorage.getItem('strava_access_token');
  const refreshToken = localStorage.getItem('strava_refresh_token');
  const expiresAt = localStorage.getItem('strava_token_expires');
  const athleteId = localStorage.getItem('strava_athlete_id');

  const statusDiv = document.getElementById('stravaStatus');
  const connectBtn = document.getElementById('stravaConnectBtn');
  const disconnectBtn = document.getElementById('stravaDisconnectBtn');
  const syncBtn = document.getElementById('stravaSyncBtn');

  if (!accessToken || !refreshToken || !expiresAt) {
    // Not connected
    statusDiv.className = 'device-status disconnected';
    statusDiv.innerHTML = '<p>❌ Not connected to Strava</p>';
    connectBtn.style.display = 'inline-block';
    disconnectBtn.style.display = 'none';
    syncBtn.style.display = 'none';
    return;
  }

  const now = Date.now() / 1000;
  const expires = parseInt(expiresAt);

  if (now >= expires) {
    // Token expired, try to refresh
    refreshStravaToken();
    return;
  }

  // Connected and token is valid
  statusDiv.className = 'device-status connected';
  statusDiv.innerHTML = `
        <p>✅ Connected to Strava</p>
        <div class="device-info">
            <h5>Athlete ID: ${athleteId || 'Unknown'}</h5>
            <p>Token expires: ${new Date(expires * 1000).toLocaleString()}</p>
        </div>
    `;
  connectBtn.style.display = 'none';
  disconnectBtn.style.display = 'inline-block';
  syncBtn.style.display = 'inline-block';
}

function resolveStravaConfig() {
  const integrations = window.configLoader?.get?.('integrations') || {};
  const strava = integrations.strava || {};
  const fallbackRedirect = `${window.location.origin}/auth/strava/callback`;
  return {
    clientId: strava.clientId || '',
    redirectUri: strava.redirectUri || fallbackRedirect,
    scope: strava.scope || 'read,activity:read',
  };
}

function ensureStravaConfig(config) {
  if (!config.clientId) {
    throw new Error('Strava integration requires configuration. Contact your administrator.');
  }
}

function _connectToStrava() {
  try {
    const config = resolveStravaConfig();
    ensureStravaConfig(config);
    const encodedRedirect = encodeURIComponent(config.redirectUri);
    const encodedScope = encodeURIComponent(config.scope);
    const state = `ignite_fitness_${Date.now()}`;
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodedRedirect}&response_type=code&scope=${encodedScope}&state=${state}`;
    window.location.href = stravaAuthUrl;
  } catch (error) {
    logger.error('Failed to start Strava OAuth flow', { error: error.message, stack: error.stack });
    showError(
      null,
      error.message || 'Strava integration requires configuration. Contact your administrator.'
    );
  }
}

function disconnectFromStrava() {
  // Clear all Strava tokens
  localStorage.removeItem('strava_access_token');
  localStorage.removeItem('strava_refresh_token');
  localStorage.removeItem('strava_token_expires');
  localStorage.removeItem('strava_athlete_id');

  // Update UI
  checkStravaConnection();
  showSuccess('Disconnected from Strava');
}

async function refreshStravaToken() {
  const refreshToken = localStorage.getItem('strava_refresh_token');
  if (!refreshToken) {
    checkStravaConnection();
    return;
  }

  try {
    const response = await fetch('/.netlify/functions/strava-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'refresh_token',
        refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();

    // Update tokens
    localStorage.setItem('strava_access_token', data.access_token);
    localStorage.setItem('strava_refresh_token', data.refresh_token);
    localStorage.setItem('strava_token_expires', data.expires_at);

    checkStravaConnection();
  } catch (error) {
    logger.error('Token refresh failed', { error: error.message, stack: error.stack });
    // Clear invalid tokens
    disconnectFromStrava();
  }
}

async function _syncStravaData() {
  const statusDiv = document.getElementById('stravaStatus');
  const syncBtn = document.getElementById('stravaSyncBtn');

  // Show loading state
  statusDiv.className = 'device-status loading';
  statusDiv.innerHTML = '<p>🔄 Syncing Strava activities...</p>';
  syncBtn.disabled = true;

  try {
    const accessToken = localStorage.getItem('strava_access_token');
    if (!accessToken) {
      throw new Error('No access token available');
    }

    // Fetch recent activities
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try to refresh
        await refreshStravaToken();
        // TODO: Implement syncStravaData function
        // return syncStravaData();
      }
      throw new Error(`Failed to fetch activities: ${response.status}`);
    }

    const activities = await response.json();

    // Process and store activities
    const processedActivities = activities.map(activity => ({
      stravaId: activity.id,
      name: activity.name,
      type: activity.type,
      distance: activity.distance,
      movingTime: activity.moving_time,
      elapsedTime: activity.elapsed_time,
      totalElevationGain: activity.total_elevation_gain,
      startDate: activity.start_date,
      timezone: activity.timezone,
      averageSpeed: activity.average_speed,
      maxSpeed: activity.max_speed,
      averageHeartrate: activity.average_heartrate,
      maxHeartrate: activity.max_heartrate,
      calories: activity.calories,
      payload: activity,
    }));

    // Save to user data
    if (!users[currentUser]) {
      users[currentUser] = {};
    }
    if (!users[currentUser].data) {
      users[currentUser].data = {};
    }
    users[currentUser].data.stravaData = processedActivities;
    saveUserData();

    // Sync to database
    await saveUserDataToDatabase();

    // Update UI
    statusDiv.className = 'device-status connected';
    statusDiv.innerHTML = `
            <p>✅ Synced ${activities.length} activities from Strava</p>
            <div class="device-info">
                <h5>Latest Activity: ${activities[0]?.name || 'None'}</h5>
                <p>Last sync: ${new Date().toLocaleString()}</p>
            </div>
        `;

    showSuccess(`Synced ${activities.length} activities from Strava`);
  } catch (error) {
    logger.error('Strava sync failed', { error: error.message, stack: error.stack });
    statusDiv.className = 'device-status disconnected';
    statusDiv.innerHTML = `<p>❌ Sync failed: ${error.message}</p>`;
    showError(null, `Strava sync failed: ${error.message}`);
  } finally {
    syncBtn.disabled = false;
  }
}

function _toggleAIChat() {
  const chatContainer = document.getElementById('aiChatContainer');
  const chatToggle = document.getElementById('aiChatToggle');

  if (chatContainer.classList.contains('hidden')) {
    chatContainer.classList.remove('hidden');
    chatToggle.textContent = 'Close AI Coach';
    chatToggle.style.background = '#e53e3e';
  } else {
    chatContainer.classList.add('hidden');
    chatToggle.textContent = '🤖 AI Coach';
    chatToggle.style.background = '#4299e1';
  }
}

function sendToAI() {
  const input = document.getElementById('aiChatInput');
  const message = input.value.trim();

  if (!message) {
    return;
  }

  // Add user message to chat
  addMessageToChat(message, 'user');
  input.value = '';

  // Show typing indicator
  showTypingIndicator();

  // Process with AI
  if (contextAwareAI) {
    contextAwareAI
      .processUserInput(message)
      .then(response => {
        hideTypingIndicator();
        addMessageToChat(response, 'ai');
      })
      .catch(error => {
        hideTypingIndicator();
        addMessageToChat('Sorry, I encountered an error. Please try again.', 'ai');
        logger.error('AI Error', { error: error.message, stack: error.stack });
      });
  } else {
    hideTypingIndicator();
    addMessageToChat('AI system is not available. Please try again later.', 'ai');
  }
}

function addMessageToChat(message, sender) {
  const messagesContainer = document.getElementById('aiChatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `ai-chat-message ${sender}`;
  messageDiv.textContent = message;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const messagesContainer = document.getElementById('aiChatMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'ai-chat-message ai';
  typingDiv.id = 'typing-indicator';
  typingDiv.textContent = 'AI Coach is thinking...';

  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
  const typingDiv = document.getElementById('typing-indicator');
  if (typingDiv) {
    typingDiv.remove();
  }
}

function _quickAction(action) {
  const input = document.getElementById('aiChatInput');

  switch (action) {
    case 'injury':
      input.value = 'I have an injury and need help adjusting my workout';
      break;
    case 'fatigue':
      input.value = "I'm feeling fatigued and need recovery advice";
      break;
    case 'goals':
      input.value = 'I want to change my fitness goals';
      break;
    case 'schedule':
      input.value = 'I need help with my workout schedule';
      break;
  }

  input.focus();
}

// Handle Enter key in AI chat input - moved to main DOMContentLoaded
