// Main Application Entry Point
// Loads and initializes all modules

// Initialize logger
const logger = window.SafeLogger || console;

// Global variables
let currentUser = null;
let isLoggedIn = false;
let users = {};
let dataStore = null;
let contextAwareAI = null;

function applyAuthState(state) {
  const isAuthenticated = !!state?.isAuthenticated;
  const user = state?.user;

  isLoggedIn = isAuthenticated;
  currentUser = isAuthenticated && user?.username ? user.username : null;

  if (isAuthenticated && user?.username) {
    users[user.username] = user;
  }

  checkLoginStatus();
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  logger.info('Ignite Fitness App Initializing');

  // Load modules
  loadModules();

  // Initialize authentication
  initializeAuth();

  // Initialize data store
  initializeDataStore();

  // Initialize AI systems
  initializeAI();

  // Load user data if logged in
  checkLoginStatus();

  logger.info('Ignite Fitness App Initialized Successfully');
});

// Load all JavaScript modules
function loadModules() {
  // Core modules
  loadScript('js/core/auth.js');
  loadScript('js/core/data-store.js');

  // AI modules
  loadScript('js/ai/context-aware-ai.js');

  // Additional modules will be loaded here as they are created
}

// Load a script dynamically
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Initialize authentication system
function initializeAuth() {
  const authManager = window.AuthManager;

  if (!authManager) {
    const savedUser = localStorage.getItem('ignitefitness_current_user');
    if (savedUser) {
      currentUser = savedUser;
      isLoggedIn = true;
    }
    return;
  }

  if (typeof authManager.onAuthStateChange === 'function') {
    authManager.onAuthStateChange(event => {
      if (event?.type === 'logout') {
        applyAuthState({ isAuthenticated: false });
      } else if (event?.user) {
        applyAuthState({ isAuthenticated: true, user: event.user });
      }
    });
  }

  const finalize = () => {
    if (typeof authManager.getAuthState === 'function') {
      applyAuthState(authManager.getAuthState());
    }
  };

  if (typeof authManager.readFromStorage === 'function') {
    authManager
      .readFromStorage()
      .then(finalize)
      .catch(error => {
        logger.error('Failed to initialize auth state', { error: error.message, stack: error.stack });
        const savedUser = localStorage.getItem('ignitefitness_current_user');
        if (savedUser) {
          currentUser = savedUser;
          isLoggedIn = true;
        } else {
          currentUser = null;
          isLoggedIn = false;
        }
        checkLoginStatus();
      });
  } else {
    finalize();
  }
}

// Initialize data store
function initializeDataStore() {
  const DataStoreClass = window.DataStore;
  if (typeof DataStoreClass === 'function') {
    dataStore = new DataStoreClass();
    window.appDataStore = dataStore;
    logger.info('Data store initialized');
  } else {
    logger.warn('DataStore class not available');
  }
}

// Initialize AI systems
function initializeAI() {
  const ContextAwareAIClass = window.ContextAwareAI;
  if (typeof ContextAwareAIClass === 'function') {
    contextAwareAI = new ContextAwareAIClass();
    window.appContextAwareAI = contextAwareAI;
    logger.info('AI systems initialized');
  } else {
    logger.warn('ContextAwareAI class not available');
  }
}

// Check login status and show appropriate UI
function checkLoginStatus() {
  if (isLoggedIn && currentUser) {
    showUserDashboard();
    loadUserData();
  } else {
    showLoginForm();
  }
}

// Show login form
function showLoginForm() {
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('userDashboard').classList.add('hidden');
}

// Show user dashboard
function showUserDashboard() {
  const loginForm = document.getElementById('loginForm');
  const userDashboard = document.getElementById('userDashboard');
  if (loginForm) {
    loginForm.classList.add('hidden');
  }
  if (userDashboard) {
    userDashboard.classList.remove('hidden');
  }

  // Update athlete name display
  const athleteNameElement = document.getElementById('currentAthleteName');
  const authUser = window.AuthManager?.getCurrentUser?.();
  const userRecord = currentUser ? users[currentUser] || authUser : authUser;

  if (athleteNameElement) {
    athleteNameElement.textContent =
      userRecord?.athleteName || userRecord?.username || currentUser || 'Athlete';
  }
}

// Load user data
async function loadUserData() {
  if (!currentUser) {
    return;
  }

  if (!dataStore || typeof dataStore.get !== 'function') {
    logger.warn('Data store not available while loading user data');
    return;
  }

  try {
    // Load from data store
    const userData = await dataStore.get('user_data');
    if (userData) {
      users[currentUser] = userData;
    } else {
      // Fallback to localStorage
      const savedUsers = localStorage.getItem('ignitefitness_users');
      if (savedUsers) {
        users = JSON.parse(savedUsers);
      }
    }

    // Load data into forms
    loadPersonalDataToForm();
    loadGoalsToForm();
    loadWearableSettingsToForm();
  } catch (error) {
    logger.error('Error loading user data', { error: error.message, stack: error.stack });
  }
}

// Save user data
async function saveUserData() {
  if (!currentUser) {
    return;
  }

  if (!dataStore || typeof dataStore.set !== 'function') {
    logger.warn('Data store not available while saving user data');
    return;
  }

  try {
    // Save to data store
    await dataStore.set('user_data', users[currentUser]);

    // Also save to localStorage as backup
    localStorage.setItem('ignitefitness_users', JSON.stringify(users));
  } catch (error) {
    logger.error('Error saving user data', { error: error.message, stack: error.stack });
  }
}

// Utility functions
function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.style.display = 'block';
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

// Load personal data into form
function loadPersonalDataToForm() {
  if (!currentUser || !users[currentUser]) {
    return;
  }

  const user = users[currentUser];
  const personalData = user.personalData || {};

  // Load basic info
  if (personalData.age) {
    document.getElementById('age').value = personalData.age;
  }
  if (personalData.weight) {
    document.getElementById('weight').value = personalData.weight;
  }
  if (personalData.height) {
    document.getElementById('height').value = personalData.height;
  }
  if (personalData.experience) {
    document.getElementById('experience').value = personalData.experience;
  }
}

// Load goals into form
function loadGoalsToForm() {
  if (!currentUser || !users[currentUser]) {
    return;
  }

  const user = users[currentUser];
  const goals = user.goals || {};

  // Load goal selections
  if (goals.primary) {
    const primaryGoal = document.querySelector(
      `input[name="primaryGoal"][value="${goals.primary}"]`
    );
    if (primaryGoal) {
      primaryGoal.checked = true;
    }
  }

  if (goals.secondary) {
    const secondaryGoal = document.querySelector(
      `input[name="secondaryGoal"][value="${goals.secondary}"]`
    );
    if (secondaryGoal) {
      secondaryGoal.checked = true;
    }
  }
}

// Load wearable settings into form
function loadWearableSettingsToForm() {
  if (!currentUser || !users[currentUser]) {
    return;
  }

  const user = users[currentUser];
  const wearableSettings = user.wearableSettings || {};

  // Load Strava settings
  if (wearableSettings.strava) {
    if (wearableSettings.strava.clientId) {
      document.getElementById('stravaClientId').value = wearableSettings.strava.clientId;
    }
    if (wearableSettings.strava.clientSecret) {
      document.getElementById('stravaClientSecret').value = wearableSettings.strava.clientSecret;
    }
    if (wearableSettings.strava.accessToken) {
      document.getElementById('stravaAccessToken').value = wearableSettings.strava.accessToken;
    }
    if (wearableSettings.strava.refreshToken) {
      document.getElementById('stravaRefreshToken').value = wearableSettings.strava.refreshToken;
    }
  }

  // Load other wearable settings as needed
}

// Additional functions referenced in HTML
function showTab(tabName) {
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
  const clickedButton = event.target;
  clickedButton.classList.add('active');
}

function savePersonalInfo() {
  if (!currentUser) {
    return;
  }

  const personalData = {
    age: document.getElementById('age').value,
    weight: document.getElementById('weight').value,
    height: document.getElementById('height').value,
    experience: document.getElementById('experience').value,
  };

  if (!users[currentUser]) {
    users[currentUser] = {};
  }

  users[currentUser].personalData = personalData;
  saveUserData();
  showSuccess('Personal information saved!');
}

function saveGoals() {
  if (!currentUser) {
    return;
  }

  const primaryGoal = document.querySelector('input[name="primaryGoal"]:checked')?.value;
  const secondaryGoal = document.querySelector('input[name="secondaryGoal"]:checked')?.value;

  const goals = {
    primary: primaryGoal,
    secondary: secondaryGoal,
  };

  if (!users[currentUser]) {
    users[currentUser] = {};
  }

  users[currentUser].goals = goals;
  saveUserData();
  showSuccess('Goals saved!');
}

function generateWorkoutPlan() {
  showSuccess('Workout plan generation will be implemented in the full version!');
}

function logout() {
  currentUser = null;
  isLoggedIn = false;
  localStorage.removeItem('ignitefitness_current_user');
  showLoginForm();
  showSuccess('Logged out successfully!');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    currentUser,
    isLoggedIn,
    users,
    showLoginForm,
    showUserDashboard,
    loadUserData,
    saveUserData,
    showError,
    showSuccess,
    showTab,
    savePersonalInfo,
    saveGoals,
    generateWorkoutPlan,
    logout,
  };
}
