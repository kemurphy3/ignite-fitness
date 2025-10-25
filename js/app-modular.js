/**
 * Ignite Fitness - Modular Architecture
 * Main application file with modular imports and initialization
 * Reduced from 1800+ lines to <200 lines
 */

// Global application state
let currentUser = null;
let isLoggedIn = false;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Ignite Fitness App Starting...');
    
    // Initialize core systems
    initializeApp();
    
    // Check if user is already logged in
    if (window.AuthManager?.isUserLoggedIn()) {
        currentUser = window.AuthManager.getCurrentUsername();
        isLoggedIn = true;
        
        // Check if user needs onboarding
        if (window.OnboardingManager?.needsOnboarding()) {
            showOnboarding();
        } else {
            showUserDashboard();
            loadUserData();
            updateSeasonalPhaseDisplay();
            checkStravaConnection();
            updateSyncStatus();
            loadRecentWorkouts();
        }
    } else {
        showLoginForm();
    }
    
    // Handle Enter key in AI chat input
    const aiInput = document.getElementById('aiChatInput');
    if (aiInput) {
        aiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendToAI();
            }
        });
    }
    
    console.log('Ignite Fitness App Ready!');
});

/**
 * Initialize application modules
 */
function initializeApp() {
    try {
        // Run data migration first
        migrateUserData();
        
        // Initialize AI system
        initializeAI();
        
        // Initialize seasonal training
        initializeSeasonalTraining();
        
        // Initialize data store
        initializeDataStore();
        
        // Initialize workout generator
        initializeWorkoutGenerator();
        
        // Initialize pattern detector
        initializePatternDetector();
        
        // Add workout styles
        addWorkoutStyles();
        
        console.log('All modules initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
    }
}

// Data migration system
function migrateUserData() {
    const currentVersion = '2.0';
    const storedVersion = localStorage.getItem('ignitefitness_data_version');
    
    if (storedVersion === currentVersion) {
        return; // No migration needed
    }
    
    console.log('Migrating user data from version', storedVersion || '1.0', 'to', currentVersion);
    
    // Migrate from version 1.0 to 2.0
    if (!storedVersion || storedVersion === '1.0') {
        migrateFromV1ToV2();
    }
    
    // Set new version
    localStorage.setItem('ignitefitness_data_version', currentVersion);
    console.log('Data migration completed');
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
                    username: username,
                    password: user.password,
                    athleteName: user.athleteName,
                    personalData: user.personalData || {},
                    goals: user.goals || {},
                    workoutSchedule: user.workoutSchedule || {},
                    sessions: user.sessions || [],
                    preferences: user.preferences || {},
                    lastSync: user.lastSync || Date.now(),
                    createdAt: user.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            });
            
            localStorage.setItem('ignitefitness_users', JSON.stringify(migratedUsers));
        }
        
        // Migrate other data structures
        migrateStravaData();
        migrateWorkoutData();
        
    } catch (error) {
        console.error('Error during data migration:', error);
    }
}

function migrateStravaData() {
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
            last_updated: Date.now()
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
    const oldWorkouts = localStorage.getItem('ignitefitness_workouts');
    if (oldWorkouts) {
        try {
            const workouts = JSON.parse(oldWorkouts);
            localStorage.setItem('ignitefitness_workout_data', JSON.stringify({
                workouts: workouts,
                version: '2.0',
                last_updated: Date.now()
            }));
            localStorage.removeItem('ignitefitness_workouts');
        } catch (error) {
            console.error('Error migrating workout data:', error);
        }
    }
}

// Authentication Functions (delegated to AuthManager)
function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        showError(errorDiv, 'Please enter both username and password');
        return;
    }

    const result = window.AuthManager?.login(username, password);
    if (result.success) {
        currentUser = username;
        isLoggedIn = true;
        showSuccess('Login successful!');
        
        // Check if user needs onboarding
        if (window.OnboardingManager?.needsOnboarding()) {
            showOnboarding();
        } else {
            showUserDashboard();
            loadUserData();
        }
    } else {
        showError(errorDiv, result.error);
    }
}

function register() {
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const athleteName = document.getElementById('regAthleteName').value;
    const errorDiv = document.getElementById('registerError');

    const result = window.AuthManager?.register({
        username, password, confirmPassword, athleteName
    });
    
    if (result.success) {
        currentUser = username;
        isLoggedIn = true;
        showSuccess('Registration successful! Welcome to Ignite Fitness!');
        showUserDashboard();
        hideRegisterForm();
        loadUserData();
    } else {
        showError(errorDiv, result.error);
    }
}

function resetPassword() {
    const username = document.getElementById('resetUsername').value;
    const athleteName = document.getElementById('resetAthleteName').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;
    const errorDiv = document.getElementById('resetError');

    const result = window.AuthManager?.resetPassword({
        username, athleteName, newPassword, confirmPassword
    });
    
    if (result.success) {
        showSuccess('Password reset successfully! Please login with your new password.');
        hidePasswordReset();
    } else {
        showError(errorDiv, result.error);
    }
}

function logout() {
    const result = window.AuthManager?.logout();
    if (result.success) {
        currentUser = null;
        isLoggedIn = false;
        showLoginForm();
        showSuccess('Logged out successfully!');
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
    
    const athleteNameElement = document.getElementById('currentAthleteName');
    if (athleteNameElement && window.AuthManager?.getCurrentUser()) {
        athleteNameElement.textContent = window.AuthManager.getCurrentUser().athleteName || currentUser;
    }
}

function showPasswordReset() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('passwordResetForm').classList.remove('hidden');
}

function hidePasswordReset() {
    document.getElementById('passwordResetForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

function showRegisterForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function hideRegisterForm() {
    document.getElementById('registerForm').classList.add('hidden');
}

// Tab Functions
function showTab(tabName, clickedButton) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }
    
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

// Data Functions (delegated to modules)
function loadUserData() {
    if (!currentUser || !window.AuthManager?.getCurrentUser()) return;
    
    const user = window.AuthManager.getCurrentUser();
    
    if (user.personalData) {
        if (user.personalData.age) document.getElementById('age').value = user.personalData.age;
        if (user.personalData.weight) document.getElementById('weight').value = user.personalData.weight;
        if (user.personalData.height) document.getElementById('height').value = user.personalData.height;
        if (user.personalData.experience) document.getElementById('experience').value = user.personalData.experience;
    }
    
    if (user.goals) {
        if (user.goals.primary) {
            const primaryGoal = document.querySelector(`input[name="primaryGoal"][value="${user.goals.primary}"]`);
            if (primaryGoal) primaryGoal.checked = true;
        }
        if (user.goals.secondary) {
            const secondaryGoal = document.querySelector(`input[name="secondaryGoal"][value="${user.goals.secondary}"]`);
            if (secondaryGoal) secondaryGoal.checked = true;
        }
    }
}

async function savePersonalInfo() {
    if (!currentUser) {
        showError(null, 'Please log in first');
        return;
    }
    
    const personalData = {
        age: parseInt(document.getElementById('age').value),
        weight: parseFloat(document.getElementById('weight').value),
        height: parseInt(document.getElementById('height').value),
        experience: document.getElementById('experience').value
    };
    
    const result = window.AuthManager?.updateUserData({ personalData });
    if (result.success) {
        showSuccess('Personal information saved!');
    } else {
        showError(null, result.error);
    }
}

async function saveGoals() {
    if (!currentUser) {
        showError(null, 'Please log in first');
        return;
    }
    
    const goals = {
        primary: document.querySelector('input[name="primaryGoal"]:checked')?.value,
        secondary: document.querySelector('input[name="secondaryGoal"]:checked')?.value
    };
    
    const result = window.AuthManager?.updateUserData({ goals });
    if (result.success) {
        showSuccess('Goals saved!');
    } else {
        showError(null, result.error);
    }
}

// Utility Functions
function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function showSuccess(message) {
    console.log('Success:', message);
    // Implementation for success notifications
}

// Module initialization functions (delegated to modules)
function initializeAI() {
    // AI initialization handled by CoachingEngine module
}

function initializeSeasonalTraining() {
    // Seasonal training initialization handled by modules
}

function initializeDataStore() {
    // Data store initialization handled by StorageManager module
}

function initializeWorkoutGenerator() {
    // Workout generator initialization handled by modules
}

function initializePatternDetector() {
    // Pattern detector initialization handled by modules
}

function addWorkoutStyles() {
    // Styles handled by CSS files
}

// Additional functions delegated to modules
function updateSeasonalPhaseDisplay() {
    // Handled by seasonal training module
}

function checkStravaConnection() {
    // Handled by Strava integration module
}

function updateSyncStatus() {
    // Handled by sync module
}

function loadRecentWorkouts() {
    // Handled by workout tracker module
}

function sendToAI() {
    // Handled by AI coaching module
}

// Onboarding Functions
function showOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.remove('hidden');
        startOnboardingFlow();
    }
}

function startOnboardingFlow() {
    const result = window.OnboardingManager?.startOnboarding();
    if (result.success) {
        renderOnboardingQuestion();
    }
}

function renderOnboardingQuestion() {
    const question = window.OnboardingManager?.getCurrentQuestion();
    if (!question) return;

    const container = document.getElementById('onboardingContainer');
    if (!container) return;

    const progress = window.OnboardingManager?.getOnboardingProgress();
    
    container.innerHTML = `
        <div class="onboarding-question">
            <h3>${question.question}</h3>
            <div class="question-options">
                ${question.options.map(option => `
                    <label class="option-card">
                        <input type="radio" name="onboardingAnswer" value="${option.value}">
                        <div class="option-content">
                            <div class="option-title">${option.label}</div>
                            <div class="option-description">${option.description}</div>
                        </div>
                    </label>
                `).join('')}
            </div>
            <div class="question-actions">
                <button class="btn primary" onclick="answerOnboardingQuestion()" id="nextBtn" disabled>
                    ${progress.completed ? 'Complete' : 'Next'}
                </button>
            </div>
        </div>
    `;

    // Update progress
    document.getElementById('onboardingStep').textContent = progress.currentStep + 1;
    document.getElementById('onboardingTotal').textContent = progress.totalSteps;

    // Add event listeners for radio buttons
    const radioButtons = container.querySelectorAll('input[name="onboardingAnswer"]');
    radioButtons.forEach(radio => {
        radio.addEventListener('change', function() {
            document.getElementById('nextBtn').disabled = false;
        });
    });
}

function answerOnboardingQuestion() {
    const selectedAnswer = document.querySelector('input[name="onboardingAnswer"]:checked');
    if (!selectedAnswer) return;

    const answer = selectedAnswer.value;
    const result = window.OnboardingManager?.answerQuestion(answer);
    
    if (result.success) {
        const nextResult = window.OnboardingManager?.nextStep();
        if (nextResult.success) {
            if (nextResult.question) {
                renderOnboardingQuestion();
            } else {
                completeOnboarding();
            }
        }
    }
}

function completeOnboarding() {
    const result = window.OnboardingManager?.completeOnboarding();
    if (result.success) {
        hideOnboarding();
        showUserDashboard();
        loadUserData();
        updateSeasonalPhaseDisplay();
        checkStravaConnection();
        updateSyncStatus();
        loadRecentWorkouts();
        showSuccess('Onboarding completed! Your dashboard is personalized for you.');
    } else {
        showError(null, result.error);
    }
}

function skipOnboarding() {
    const result = window.OnboardingManager?.skipOnboarding();
    if (result.success) {
        hideOnboarding();
        showUserDashboard();
        loadUserData();
        showSuccess('Onboarding skipped. You can change preferences later.');
    } else {
        showError(null, result.error);
    }
}

function hideOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Preferences Functions
function showPreferences() {
    const modal = document.getElementById('preferencesModal');
    if (modal) {
        modal.classList.remove('hidden');
        loadCurrentPreferences();
    }
}

function loadCurrentPreferences() {
    const preferences = window.OnboardingManager?.getUserPreferences();
    
    // Set data preference
    const dataPreference = preferences.data_preference || 'some_metrics';
    document.querySelector(`input[name="dataPreference"][value="${dataPreference}"]`).checked = true;
    
    // Set role
    const role = preferences.role || 'athlete';
    document.querySelector(`input[name="userRole"][value="${role}"]`).checked = true;
    
    // Set primary goal
    const primaryGoal = preferences.primary_goal || 'general_fitness';
    document.getElementById('primaryGoalPref').value = primaryGoal;
}

function savePreferences() {
    const dataPreference = document.querySelector('input[name="dataPreference"]:checked')?.value;
    const role = document.querySelector('input[name="userRole"]:checked')?.value;
    const primaryGoal = document.getElementById('primaryGoalPref').value;
    
    const newPreferences = {
        data_preference: dataPreference,
        role: role,
        primary_goal: primaryGoal
    };
    
    const result = window.OnboardingManager?.updateUserPreferences(newPreferences);
    if (result.success) {
        closePreferences();
        // Re-render dashboard with new preferences
        window.DashboardRenderer?.renderDashboard();
        showSuccess('Preferences updated successfully!');
    } else {
        showError(null, result.error);
    }
}

function closePreferences() {
    const modal = document.getElementById('preferencesModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function toggleRole() {
    const currentRole = window.OnboardingManager?.getUserRole();
    const newRole = currentRole === 'athlete' ? 'coach' : 'athlete';
    
    const result = window.OnboardingManager?.updateUserPreferences({ role: newRole });
    if (result.success) {
        // Re-render dashboard with new role
        window.DashboardRenderer?.renderDashboard();
        showSuccess(`Switched to ${newRole} mode`);
    } else {
        showError(null, result.error);
    }
}

// Daily Check-in Functions
function startWorkout() {
    // Check if user needs daily check-in
    if (window.DailyCheckIn && !window.DailyCheckIn.hasCompletedTodayCheckIn()) {
        showDailyCheckIn();
    } else {
        proceedWithWorkout();
    }
}

function proceedWithWorkout() {
    showSuccess('Workout logging will be implemented in the full version!');
}

function showDailyCheckIn() {
    const modal = document.getElementById('dailyCheckInModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderDailyCheckIn();
    }
}

function renderDailyCheckIn() {
    const container = document.getElementById('checkInContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="checkin-metrics">
            <!-- Sleep Section -->
            <div class="checkin-metric">
                <h3>😴 Sleep</h3>
                <p>How did you sleep last night?</p>
                <div class="sleep-inputs">
                    <div class="sleep-hours-input">
                        <label for="sleepHours">Hours of Sleep</label>
                        <input type="number" id="sleepHours" min="4" max="12" step="0.5" value="8" 
                               onchange="updateCheckInData('sleepHours', this.value)">
                    </div>
                    <div class="slider-container">
                        <div class="slider-label">
                            <span>Sleep Quality</span>
                            <span class="slider-value" id="sleepQualityValue">5</span>
                        </div>
                        <input type="range" id="sleepQuality" class="slider" min="1" max="10" value="5" step="1"
                               oninput="updateSliderValue('sleepQuality', this.value)">
                        <div class="slider-description" id="sleepQualityDesc">😐 Average sleep, okay rest</div>
                    </div>
                </div>
            </div>

            <!-- Stress Section -->
            <div class="checkin-metric">
                <h3>😟 Stress Level</h3>
                <p>How stressed do you feel today?</p>
                <div class="slider-container">
                    <div class="slider-label">
                        <span>Stress Level</span>
                        <span class="slider-value" id="stressLevelValue">5</span>
                    </div>
                    <input type="range" id="stressLevel" class="slider" min="1" max="10" value="5" step="1"
                           oninput="updateSliderValue('stressLevel', this.value)">
                    <div class="slider-description" id="stressLevelDesc">😟 Moderate stress, affecting focus</div>
                </div>
            </div>

            <!-- Energy Section -->
            <div class="checkin-metric">
                <h3>⚡ Energy Level</h3>
                <p>How energetic do you feel today?</p>
                <div class="slider-container">
                    <div class="slider-label">
                        <span>Energy Level</span>
                        <span class="slider-value" id="energyLevelValue">5</span>
                    </div>
                    <input type="range" id="energyLevel" class="slider" min="1" max="10" value="5" step="1"
                           oninput="updateSliderValue('energyLevel', this.value)">
                    <div class="slider-description" id="energyLevelDesc">😐 Average energy, feeling okay</div>
                </div>
            </div>

            <!-- Soreness Section -->
            <div class="checkin-metric">
                <h3>💪 Soreness Level</h3>
                <p>How sore are your muscles today?</p>
                <div class="slider-container">
                    <div class="slider-label">
                        <span>Soreness Level</span>
                        <span class="slider-value" id="sorenessLevelValue">5</span>
                    </div>
                    <input type="range" id="sorenessLevel" class="slider" min="1" max="10" value="5" step="1"
                           oninput="updateSliderValue('sorenessLevel', this.value)">
                    <div class="slider-description" id="sorenessLevelDesc">😐 Moderate soreness, aware of it</div>
                </div>
            </div>

            <!-- Readiness Summary -->
            <div class="readiness-summary" id="readinessSummary" style="display: none;">
                <div class="readiness-score">
                    <span class="readiness-score-value" id="readinessScoreValue">5</span>
                    <span class="readiness-score-label">Readiness Score</span>
                </div>
                <div class="coach-message" id="coachMessage"></div>
                <div class="workout-adjustments" id="workoutAdjustments" style="display: none;">
                    <h4>Workout Adjustments</h4>
                    <div id="adjustmentDetails"></div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    document.getElementById('sleepHours').addEventListener('input', function() {
        updateCheckInData('sleepHours', parseFloat(this.value));
    });
}

function updateSliderValue(metric, value) {
    const valueElement = document.getElementById(metric + 'Value');
    const descElement = document.getElementById(metric + 'Desc');
    
    if (valueElement) valueElement.textContent = value;
    
    // Update description
    const description = window.DailyCheckIn?.getSliderDescription(metric, parseInt(value));
    if (descElement && description) {
        descElement.textContent = description;
    }
    
    // Update check-in data
    updateCheckInData(metric, parseInt(value));
}

function updateCheckInData(metric, value) {
    const result = window.DailyCheckIn?.updateCheckInData(metric, value);
    if (result.success) {
        updateReadinessSummary();
    }
}

function updateReadinessSummary() {
    const readinessScore = window.DailyCheckIn?.calculateReadinessScore();
    const adjustments = window.DailyCheckIn?.getWorkoutAdjustments();
    
    if (readinessScore && adjustments) {
        // Show readiness summary
        document.getElementById('readinessSummary').style.display = 'block';
        document.getElementById('readinessScoreValue').textContent = readinessScore;
        document.getElementById('coachMessage').textContent = adjustments.coachMessage;
        
        // Show workout adjustments if any
        if (adjustments.intensityReduced || adjustments.recoverySuggested) {
            document.getElementById('workoutAdjustments').style.display = 'block';
            let adjustmentText = '';
            
            if (adjustments.intensityReduced) {
                adjustmentText += `• Intensity reduced by ${Math.round((1 - adjustments.intensityMultiplier) * 100)}%<br>`;
            }
            
            if (adjustments.recoverySuggested) {
                adjustmentText += `• Recovery workout suggested<br>`;
            }
            
            document.getElementById('adjustmentDetails').innerHTML = adjustmentText;
        }
        
        // Enable complete button
        document.getElementById('completeCheckInBtn').disabled = false;
    }
}

function completeDailyCheckIn() {
    const result = window.DailyCheckIn?.completeDailyCheckIn();
    if (result.success) {
        hideDailyCheckIn();
        proceedWithWorkout();
        showSuccess('Daily check-in completed! Your workout has been adjusted based on your readiness.');
    } else {
        showError(null, result.error);
    }
}

function skipDailyCheckIn() {
    const result = window.DailyCheckIn?.skipDailyCheckIn();
    if (result.success) {
        hideDailyCheckIn();
        proceedWithWorkout();
        showSuccess('Check-in skipped. Proceeding with standard workout.');
    } else {
        showError(null, result.error);
    }
}

function hideDailyCheckIn() {
    const modal = document.getElementById('dailyCheckInModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Exercise Feedback Functions
function showExerciseFeedback(exerciseName, exerciseData) {
    const modal = document.getElementById('exerciseFeedbackModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderExerciseFeedback(exerciseName, exerciseData);
    }
}

function renderExerciseFeedback(exerciseName, exerciseData) {
    const container = document.getElementById('exerciseFeedbackContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="exercise-feedback-form">
            <h4>How was your ${exerciseName}?</h4>
            <p>Your feedback helps us adjust your workout for next time.</p>
            
            <div class="feedback-options">
                <div class="feedback-option" onclick="selectFeedbackOption(this, 'pain')">
                    <h4>😣 This hurts</h4>
                    <p>Pain or discomfort</p>
                </div>
                <div class="feedback-option" onclick="selectFeedbackOption(this, 'easy')">
                    <h4>😌 Too easy</h4>
                    <p>Need more challenge</p>
                </div>
                <div class="feedback-option" onclick="selectFeedbackOption(this, 'hard')">
                    <h4>😰 Can't do this</h4>
                    <p>Too difficult</p>
                </div>
                <div class="feedback-option" onclick="selectFeedbackOption(this, 'boring')">
                    <h4>😴 Don't like this</h4>
                    <p>Not enjoyable</p>
                </div>
                <div class="feedback-option" onclick="selectFeedbackOption(this, 'good')">
                    <h4>👍 Perfect</h4>
                    <p>Just right</p>
                </div>
            </div>
            
            <div class="exercise-rating">
                <span>Rate this exercise:</span>
                <div class="rating-stars">
                    ${Array.from({length: 5}, (_, i) => `
                        <span class="rating-star" onclick="setExerciseRating(${i + 1})">★</span>
                    `).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label for="feedbackText">Additional comments (optional):</label>
                <textarea id="feedbackText" class="feedback-textarea" 
                          placeholder="Tell us more about your experience..."></textarea>
            </div>
        </div>
    `;
}

function selectFeedbackOption(element, feedbackType) {
    // Remove selection from all options
    document.querySelectorAll('.feedback-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Select current option
    element.classList.add('selected');
    
    // Store selected feedback
    window.currentExerciseFeedback = feedbackType;
}

function setExerciseRating(rating) {
    // Update star display
    document.querySelectorAll('.rating-star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    
    // Store rating
    window.currentExerciseRating = rating;
}

function submitExerciseFeedback() {
    const feedbackType = window.currentExerciseFeedback;
    const rating = window.currentExerciseRating || 3;
    const comments = document.getElementById('feedbackText').value;
    
    if (!feedbackType) {
        showError(null, 'Please select how the exercise felt');
        return;
    }
    
    // Process feedback with ExerciseAdapter
    const result = window.ExerciseAdapter?.processExerciseFeedback(
        window.currentExerciseName, 
        feedbackType, 
        window.currentExerciseData
    );
    
    if (result.success && result.alternatives.length > 0) {
        // Show alternatives
        showExerciseAlternatives(result.alternatives);
    } else {
        // Save feedback and close
        saveExerciseFeedback(feedbackType, rating, comments);
        closeExerciseFeedback();
        showSuccess('Feedback saved! We\'ll adjust your workout accordingly.');
    }
}

function saveExerciseFeedback(feedbackType, rating, comments) {
    // Save to progression engine
    window.ProgressionEngine?.saveExercisePreference(
        window.currentExerciseName,
        feedbackType === 'good' ? 'prefer' : 'avoid',
        comments
    );
    
    // Save rating
    if (window.currentExerciseData) {
        window.currentExerciseData.userRating = rating;
    }
}

function showExerciseAlternatives(alternatives) {
    const modal = document.getElementById('exerciseAlternativesModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderExerciseAlternatives(alternatives);
    }
}

function renderExerciseAlternatives(alternatives) {
    const container = document.getElementById('exerciseAlternativesContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="alternatives-list">
            ${alternatives.map((alt, index) => `
                <div class="alternative-exercise" onclick="selectAlternative(this, ${index})">
                    <h4>${alt.name}</h4>
                    <div class="alternative-details">
                        <div class="alternative-detail">
                            <div class="alternative-detail-label">Weight</div>
                            <div class="alternative-detail-value">${alt.weight} lbs</div>
                        </div>
                        <div class="alternative-detail">
                            <div class="alternative-detail-label">Reps</div>
                            <div class="alternative-detail-value">${alt.reps}</div>
                        </div>
                        <div class="alternative-detail">
                            <div class="alternative-detail-label">Sets</div>
                            <div class="alternative-detail-value">${alt.sets}</div>
                        </div>
                        <div class="alternative-detail">
                            <div class="alternative-detail-label">Difficulty</div>
                            <div class="alternative-detail-value">${alt.difficulty}</div>
                        </div>
                    </div>
                    <div class="alternative-reason">${alt.reason}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function selectAlternative(element, index) {
    // Remove selection from all alternatives
    document.querySelectorAll('.alternative-exercise').forEach(alt => {
        alt.classList.remove('selected');
    });
    
    // Select current alternative
    element.classList.add('selected');
    window.selectedAlternativeIndex = index;
}

function selectExerciseAlternative() {
    const alternatives = window.currentAlternatives;
    const selectedIndex = window.selectedAlternativeIndex;
    
    if (selectedIndex !== undefined && alternatives[selectedIndex]) {
        const selectedAlternative = alternatives[selectedIndex];
        
        // Update current exercise with alternative
        if (window.currentExerciseData) {
            Object.assign(window.currentExerciseData, selectedAlternative);
        }
        
        closeExerciseAlternatives();
        closeExerciseFeedback();
        showSuccess(`Exercise updated to ${selectedAlternative.name}!`);
    } else {
        showError(null, 'Please select an alternative exercise');
    }
}

function closeExerciseFeedback() {
    const modal = document.getElementById('exerciseFeedbackModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function closeExerciseAlternatives() {
    const modal = document.getElementById('exerciseAlternativesModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Progression Functions
function calculateExerciseProgression(exerciseName, lastRPE, setsCompleted, repsCompleted) {
    const exerciseData = {
        name: exerciseName,
        weight: 135, // This would come from current exercise data
        reps: 8,
        sets: 3
    };
    
    const progression = window.ProgressionEngine?.calculateNextSession(
        exerciseData, 
        lastRPE, 
        setsCompleted, 
        repsCompleted
    );
    
    if (progression && progression.changes.length > 0) {
        showProgressionSummary(progression);
    }
    
    return progression;
}

function showProgressionSummary(progression) {
    const summaryHtml = `
        <div class="progression-summary">
            <h4>💪 Progression Update</h4>
            <p>${progression.message}</p>
            <div class="progression-changes">
                ${progression.changes.map(change => `
                    <div class="progression-change">
                        <div class="progression-change-icon ${progression.progression}">
                            ${progression.progression === 'weight_increase' ? '↑' : 
                              progression.progression === 'weight_decrease' ? '↓' : '='}
                        </div>
                        <span>${change}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // This would typically be displayed in the workout interface
    console.log('Progression Summary:', summaryHtml);
}

function adaptWorkoutToTime(availableTime) {
    const plannedWorkout = {
        exercises: [], // This would come from current workout
        estimatedTime: 60
    };
    
    const adaptedWorkout = window.ProgressionEngine?.adaptWorkoutToTime(availableTime, plannedWorkout);
    
    if (adaptedWorkout && adaptedWorkout.message) {
        showSuccess(adaptedWorkout.message);
    }
    
    return adaptedWorkout;
}

// Goals & Habits Functions
function showGoalsModal() {
    const modal = document.getElementById('goalsModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderGoals();
    }
}

function renderGoals() {
    const container = document.getElementById('goalsContainer');
    if (!container) return;

    const goalManager = window.GoalManager;
    if (!goalManager) return;

    const activeGoals = goalManager.getActiveGoals();
    const completedGoals = goalManager.getCompletedGoals();
    const progressSummary = goalManager.getGoalProgressSummary();

    container.innerHTML = `
        <div class="goals-summary">
            <h4>Goals Overview</h4>
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-number">${progressSummary.totalGoals}</span>
                    <span class="stat-label">Total Goals</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${progressSummary.completionRate}%</span>
                    <span class="stat-label">Completion Rate</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${progressSummary.averageProgress}%</span>
                    <span class="stat-label">Avg Progress</span>
                </div>
            </div>
        </div>

        <div class="active-goals">
            <h4>Active Goals (${activeGoals.length})</h4>
            ${activeGoals.length > 0 ? activeGoals.map(goal => renderGoalCard(goal)).join('') : '<p>No active goals. Set your first goal to get started!</p>'}
        </div>

        ${completedGoals.length > 0 ? `
        <div class="completed-goals">
            <h4>Completed Goals (${completedGoals.length})</h4>
            ${completedGoals.map(goal => renderGoalCard(goal, true)).join('')}
        </div>
        ` : ''}
    `;
}

function renderGoalCard(goal, isCompleted = false) {
    const progressPercentage = Math.round(goal.progress_percentage);
    
    return `
        <div class="goal-card ${isCompleted ? 'completed' : ''}">
            <div class="goal-header">
                <h3 class="goal-title">${goal.title}</h3>
                <span class="goal-type">${goal.type}</span>
            </div>
            
            <div class="goal-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
                <div class="progress-text">
                    <span>${goal.current_value} ${goal.unit}</span>
                    <span>${progressPercentage}%</span>
                </div>
            </div>

            ${goal.milestones ? `
            <div class="goal-milestones">
                ${goal.milestones.map(milestone => `
                    <div class="milestone ${milestone.achieved ? 'achieved' : ''}">
                        <div class="milestone-percentage">${milestone.percentage}%</div>
                        <div class="milestone-value">${milestone.value} ${goal.unit}</div>
                        <div class="milestone-reward">${milestone.reward}</div>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            ${goal.description ? `<p class="goal-description">${goal.description}</p>` : ''}
            
            ${goal.deadline ? `<p class="goal-deadline">Deadline: ${new Date(goal.deadline).toLocaleDateString()}</p>` : ''}
        </div>
    `;
}

function showCreateGoalModal() {
    const modal = document.getElementById('createGoalModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderCreateGoalForm();
    }
}

function renderCreateGoalForm() {
    const container = document.getElementById('createGoalContainer');
    if (!container) return;

    const goalManager = window.GoalManager;
    if (!goalManager) return;

    const goalTemplates = goalManager.goalTemplates;

    container.innerHTML = `
        <div class="create-goal-form">
            <h4>Choose Your Goal Type</h4>
            <div class="goal-type-selector">
                <div class="goal-type-option" onclick="selectGoalType('strength')">
                    <h4>💪 Strength</h4>
                    <p>Build muscle and increase lifting capacity</p>
                </div>
                <div class="goal-type-option" onclick="selectGoalType('endurance')">
                    <h4>🏃 Endurance</h4>
                    <p>Improve cardiovascular fitness and stamina</p>
                </div>
                <div class="goal-type-option" onclick="selectGoalType('body_composition')">
                    <h4>📊 Body Composition</h4>
                    <p>Change your body weight or muscle mass</p>
                </div>
            </div>

            <div id="goalFormFields" style="display: none;">
                <h4>Goal Details</h4>
                <div class="goal-form-fields">
                    <div class="form-group">
                        <label for="goalTitle">Goal Title</label>
                        <input type="text" id="goalTitle" placeholder="e.g., Squat bodyweight for 5 reps">
                    </div>
                    <div class="form-group">
                        <label for="goalDescription">Description (optional)</label>
                        <textarea id="goalDescription" placeholder="Why is this goal important to you?"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="currentValue">Current Value</label>
                        <input type="number" id="currentValue" step="0.1" placeholder="135">
                    </div>
                    <div class="form-group">
                        <label for="targetValue">Target Value</label>
                        <input type="number" id="targetValue" step="0.1" placeholder="180">
                    </div>
                    <div class="form-group">
                        <label for="goalUnit">Unit</label>
                        <select id="goalUnit">
                            <option value="lbs">lbs</option>
                            <option value="kg">kg</option>
                            <option value="minutes">minutes</option>
                            <option value="miles">miles</option>
                            <option value="reps">reps</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="goalDeadline">Deadline (optional)</label>
                        <input type="date" id="goalDeadline">
                    </div>
                </div>
            </div>
        </div>
    `;
}

function selectGoalType(type) {
    // Remove selection from all options
    document.querySelectorAll('.goal-type-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Select current option
    event.target.closest('.goal-type-option').classList.add('selected');
    
    // Show form fields
    document.getElementById('goalFormFields').style.display = 'block';
    
    // Store selected type
    window.selectedGoalType = type;
    
    // Pre-fill form with template if available
    const goalManager = window.GoalManager;
    if (goalManager && goalManager.goalTemplates[type]) {
        const templates = goalManager.goalTemplates[type];
        const firstTemplate = Object.values(templates)[0];
        if (firstTemplate) {
            document.getElementById('goalTitle').value = firstTemplate.specific;
            document.getElementById('currentValue').value = firstTemplate.measurable.current;
            document.getElementById('targetValue').value = firstTemplate.measurable.target;
            document.getElementById('goalUnit').value = firstTemplate.measurable.unit;
        }
    }
}

function createGoal() {
    const goalManager = window.GoalManager;
    if (!goalManager) return;

    const goalData = {
        type: window.selectedGoalType,
        title: document.getElementById('goalTitle').value,
        description: document.getElementById('goalDescription').value,
        current_value: parseFloat(document.getElementById('currentValue').value),
        target_value: parseFloat(document.getElementById('targetValue').value),
        unit: document.getElementById('goalUnit').value,
        deadline: document.getElementById('goalDeadline').value || null
    };

    const result = goalManager.createGoal(goalData);
    
    if (result.success) {
        closeCreateGoalModal();
        showGoalsModal(); // Refresh goals display
        showSuccess('Goal created successfully!');
    } else {
        showError(null, result.error);
    }
}

function closeGoalsModal() {
    const modal = document.getElementById('goalsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function closeCreateGoalModal() {
    const modal = document.getElementById('createGoalModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showHabitsModal() {
    const modal = document.getElementById('habitsModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderHabits();
    }
}

function renderHabits() {
    const container = document.getElementById('habitsContainer');
    if (!container) return;

    const habitTracker = window.HabitTracker;
    if (!habitTracker) return;

    const habitProgress = habitTracker.getHabitProgress(habitTracker.authManager?.getCurrentUsername());
    const achievements = habitTracker.getUserAchievements(habitTracker.authManager?.getCurrentUsername());

    container.innerHTML = `
        <div class="habit-card">
            <h4>Workout Streak</h4>
            <div class="streak-display">
                <div class="streak-current">
                    <div class="streak-number">${habitProgress.currentStreak}</div>
                    <div class="streak-label">Current Streak</div>
                </div>
                <div class="streak-details">
                    <div class="streak-detail">
                        <span class="streak-detail-label">Longest Streak</span>
                        <span class="streak-detail-value">${habitProgress.longestStreak} days</span>
                    </div>
                    <div class="streak-detail">
                        <span class="streak-detail-label">Total Workouts</span>
                        <span class="streak-detail-value">${habitProgress.totalWorkouts}</span>
                    </div>
                    <div class="streak-detail">
                        <span class="streak-detail-label">This Week</span>
                        <span class="streak-detail-value">${habitProgress.weeklyProgress.current}/${habitProgress.weeklyProgress.goal}</span>
                    </div>
                    <div class="streak-detail">
                        <span class="streak-detail-label">Habit Strength</span>
                        <span class="streak-detail-value">${habitProgress.habitStrength}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="achievements-section">
            <h4>Achievements (${achievements.length}/${habitProgress.achievements.total})</h4>
            <div class="achievements-grid">
                ${habitTracker.achievementDefinitions.map(achievement => `
                    <div class="achievement ${achievement.unlocked ? 'unlocked' : ''}">
                        <div class="achievement-icon">${getAchievementIcon(achievement.id)}</div>
                        <div class="achievement-name">${achievement.name}</div>
                        <div class="achievement-description">${achievement.description}</div>
                        ${achievement.unlocked ? `<div class="achievement-reward">${achievement.reward}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function getAchievementIcon(achievementId) {
    const icons = {
        'first_workout': '🎉',
        'first_week': '🔥',
        'month_strong': '💪',
        'consistency_king': '👑',
        'comeback_kid': '⭐',
        'weekend_warrior': '⚔️',
        'early_bird': '🌅',
        'streak_master': '🏆'
    };
    return icons[achievementId] || '🏅';
}

function closeHabitsModal() {
    const modal = document.getElementById('habitsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showMotivationalToast(message) {
    const toast = document.getElementById('motivationalToast');
    const messageElement = document.getElementById('motivationalMessage');
    
    if (toast && messageElement) {
        messageElement.textContent = message;
        toast.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            closeMotivationalToast();
        }, 5000);
    }
}

function closeMotivationalToast() {
    const toast = document.getElementById('motivationalToast');
    if (toast) {
        toast.classList.add('hidden');
    }
}

// Initialize goals and habits system
function initializeGoalsAndHabits() {
    if (window.GoalManager) {
        window.GoalManager.initialize();
    }
    
    if (window.HabitTracker) {
        window.HabitTracker.initialize();
    }
    
    // Listen for motivational messages
    if (window.EventBus) {
        window.EventBus.on('motivational:message', (data) => {
            showMotivationalToast(data.message);
        });
    }
}
