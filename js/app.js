// Simplified App.js - All functionality in one file for reliability
// This ensures everything works without complex module dependencies

// Global variables
let currentUser = null;
let isLoggedIn = false;
let users = {};
let contextAwareAI = null;
let seasonalTraining = null;
let dataStore = null;
let workoutGenerator = null;
let patternDetector = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Ignite Fitness App Starting...');
    
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
            console.error('Error parsing saved users:', error);
            users = {};
        }
    }
    
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
        aiInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendToAI();
            }
        });
    }
    
    console.log('Ignite Fitness App Ready!');
});

// Simple hash function for password hashing
function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// Authentication Functions
function login() {
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

function register() {
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
        athleteName: athleteName,
        personalData: {},
        goals: {},
        wearableSettings: {},
        workoutPlan: null,
        data: {
            workouts: [],
            soccerSessions: [],
            recoveryData: [],
            stravaData: [],
            sleepData: []
        },
        createdAt: Date.now(),
        lastLogin: null
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

function resetPassword() {
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

function hideLoginForm() {
    document.getElementById('loginForm').classList.add('hidden');
}

// Tab Functions
function showTab(tabName, clickedButton) {
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
    if (!currentUser || !users[currentUser]) return;
    
    const user = users[currentUser];
    
    // Load personal data
    if (user.personalData) {
        if (user.personalData.age) document.getElementById('age').value = user.personalData.age;
        if (user.personalData.weight) document.getElementById('weight').value = user.personalData.weight;
        if (user.personalData.height) document.getElementById('height').value = user.personalData.height;
        if (user.personalData.experience) document.getElementById('experience').value = user.personalData.experience;
    }
    
    // Load goals
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

function saveUserData() {
    if (!currentUser) return;
    localStorage.setItem('ignitefitness_users', JSON.stringify(users));
}

async function savePersonalInfo() {
    if (!currentUser) return;
    
    const personalData = {
        age: document.getElementById('age').value,
        weight: document.getElementById('weight').value,
        height: document.getElementById('height').value,
        experience: document.getElementById('experience').value
    };
    
    if (!users[currentUser]) {
        users[currentUser] = {};
    }
    
    users[currentUser].personalData = personalData;
    saveUserData();
    
    // Sync to database
    await saveUserDataToDatabase();
    
    showSuccess('Personal information saved!');
}

async function saveGoals() {
    if (!currentUser) return;
    
    const primaryGoal = document.querySelector('input[name="primaryGoal"]:checked')?.value;
    const secondaryGoal = document.querySelector('input[name="secondaryGoal"]:checked')?.value;
    
    const goals = {
        primary: primaryGoal,
        secondary: secondaryGoal
    };
    
    if (!users[currentUser]) {
        users[currentUser] = {};
    }
    
    users[currentUser].goals = goals;
    saveUserData();
    
    // Sync to database
    await saveUserDataToDatabase();
    
    showSuccess('Goals saved!');
}

// Workout Generator Functions
function initializeWorkoutGenerator() {
    if (typeof WorkoutGenerator !== 'undefined') {
        workoutGenerator = new WorkoutGenerator();
        console.log('Workout generator initialized');
    } else {
        console.warn('WorkoutGenerator not available');
    }
}

function generateWorkoutPlan() {
    if (!currentUser || !workoutGenerator) {
        showError(null, 'Workout generator not available');
        return;
    }
    
    const userProfile = buildUserProfile();
    const sessionType = 'Upper Body'; // Default session type
    const availableTime = 60; // Default 60 minutes
    
    try {
        const workout = workoutGenerator.generateWorkout(userProfile, sessionType, availableTime);
        displayGeneratedWorkout(workout);
        showSuccess('Workout plan generated successfully!');
    } catch (error) {
        console.error('Workout generation failed:', error);
        showError(null, 'Failed to generate workout plan');
    }
}

function buildUserProfile() {
    const user = users[currentUser];
    if (!user) return {};
    
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
            restDayPattern: {}
        }
    };
}

function displayGeneratedWorkout(workout) {
    const workoutPlanDiv = document.getElementById('workoutPlan');
    if (!workoutPlanDiv) return;
    
    let html = `
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
                    ${workout.warmup.exercises.map(ex => `
                        <li><strong>${ex.name}:</strong> ${ex.duration} minutes - ${ex.description}</li>
                    `).join('')}
                </ul>
            </div>
            
            <div class="workout-section">
                <h4>Main Exercises</h4>
                <div class="exercises-list">
                    ${workout.exercises.map((ex, index) => `
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
                    `).join('')}
                </div>
            </div>
            
            <div class="workout-section">
                <h4>Cooldown (${workout.cooldown.duration} minutes)</h4>
                <ul>
                    ${workout.cooldown.exercises.map(ex => `
                        <li><strong>${ex.name}:</strong> ${ex.duration} minutes - ${ex.description}</li>
                    `).join('')}
                </ul>
            </div>
            
            ${workout.notes ? `
                <div class="workout-notes">
                    <h4>Notes</h4>
                    <p>${workout.notes}</p>
                </div>
            ` : ''}
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

// Pattern Detector Functions
function initializePatternDetector() {
    if (typeof PatternDetector !== 'undefined') {
        patternDetector = new PatternDetector();
        console.log('Pattern detector initialized');
    } else {
        console.warn('PatternDetector not available');
    }
}

function analyzeUserPatterns() {
    if (!currentUser || !patternDetector) return;
    
    const user = users[currentUser];
    if (!user) return;
    
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
        
        console.log('Pattern analysis completed:', analysis);
        return analysis;
    } catch (error) {
        console.error('Pattern analysis failed:', error);
        return null;
    }
}

function displayPatternInsights() {
    if (!currentUser || !patternDetector) return;
    
    const user = users[currentUser];
    if (!user?.analysis) return;
    
    const insights = user.analysis.insights || [];
    const recommendations = user.analysis.recommendations || [];
    
    // Create insights display
    const insightsHtml = `
        <div class="pattern-insights">
            <h3>📊 Training Insights</h3>
            ${insights.length > 0 ? `
                <div class="insights-list">
                    ${insights.map(insight => `
                        <div class="insight-item ${insight.priority}">
                            <h4>${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}</h4>
                            <p>${insight.message}</p>
                        </div>
                    `).join('')}
                </div>
            ` : '<p>No insights available yet. Complete more workouts to see patterns.</p>'}
            
            ${recommendations.length > 0 ? `
                <h3>💡 Recommendations</h3>
                <div class="recommendations-list">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item">
                            <h4>${rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}</h4>
                            <p><strong>${rec.message}</strong></p>
                            <p class="action">Action: ${rec.action}</p>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
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
function onWorkoutCompleted(sessionData) {
    if (!currentUser) return;
    
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

function manualSync() {
    if (!currentUser) return;
    
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
            console.error('Sync failed:', error);
            showError(null, 'Sync failed. Please try again.');
            if (syncStatus) {
                syncStatus.textContent = '❌ Sync Failed';
            }
        });
}

function startWorkout() {
    showSuccess('Workout logging will be implemented in the full version!');
}

function logQuickWorkout() {
    showSuccess('Quick workout logging will be implemented in the full version!');
}

function viewProgress() {
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
            console.error('Workout generation failed:', error);
            showError(null, 'Failed to generate workout plan');
        }
    }
}

// Override the original generateWorkoutPlan function
function generateWorkoutPlan() {
    updateWorkoutPlanGeneration();
}

// Load recent workouts
function loadRecentWorkouts() {
    if (!currentUser) return;
    
    const user = users[currentUser];
    const recentWorkoutsList = document.getElementById('recentWorkoutsList');
    
    if (!recentWorkoutsList) return;
    
    const sessions = user?.data?.sessions || [];
    const recentSessions = sessions.slice(0, 5); // Last 5 sessions
    
    if (recentSessions.length === 0) {
        recentWorkoutsList.innerHTML = '<p>No recent workouts found. Start your first workout!</p>';
        return;
    }
    
    const workoutsHtml = recentSessions.map(session => {
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
    }).join('');
    
    recentWorkoutsList.innerHTML = workoutsHtml;
}

function logout() {
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

// AI System Functions
function initializeAI() {
    if (typeof ContextAwareAI !== 'undefined') {
        contextAwareAI = new ContextAwareAI();
        console.log('AI system initialized');
    } else {
        console.warn('ContextAwareAI not available');
    }
}

// Seasonal Training Functions
function initializeSeasonalTraining() {
    if (typeof SeasonalTrainingSystem !== 'undefined') {
        seasonalTraining = new SeasonalTrainingSystem();
        seasonalTraining.initialize();
        console.log('Seasonal training system initialized');
    } else {
        console.warn('SeasonalTrainingSystem not available');
    }
}

function updateSeasonalPhaseDisplay() {
    if (!seasonalTraining) return;
    
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

function showPhaseModal() {
    if (!seasonalTraining) return;
    
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
    const details = phaseInfo.details;
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
                ${recommendations.map(rec => `
                    <p><strong>${rec.category}:</strong> ${rec.message}</p>
                `).join('')}
            </div>
        `;
    }
    
    if (upcomingGames.length > 0) {
        html += `
            <div class="phase-detail-item">
                <h4>Upcoming Games</h4>
                <div class="game-schedule">
                    ${upcomingGames.map(game => `
                        <div class="game-item">
                            <div>
                                <div class="game-date">${game.date.toLocaleDateString()}</div>
                                <div class="game-opponent">vs ${game.opponent}</div>
                            </div>
                            <div class="game-type">${game.type}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function changePhase() {
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

function addGame() {
    const opponent = prompt('Enter opponent name:');
    if (!opponent) return;
    
    const dateStr = prompt('Enter game date (YYYY-MM-DD):');
    if (!dateStr) return;
    
    const gameDate = new Date(dateStr);
    if (isNaN(gameDate.getTime())) {
        showError(null, 'Invalid date format');
        return;
    }
    
    const type = prompt('Enter game type (regular/playoff/championship):') || 'regular';
    const location = prompt('Enter location (home/away):') || 'home';
    
    seasonalTraining.addGame({
        opponent,
        date: gameDate,
        type,
        location
    });
    
    showSuccess('Game added to schedule');
    closePhaseModal();
}

// Data Store Functions
function initializeDataStore() {
    if (typeof DataStore !== 'undefined') {
        dataStore = new DataStore();
        dataStore.setCurrentUser(currentUser);
        console.log('Data store initialized');
    } else {
        console.warn('DataStore not available');
    }
}

// Enhanced save functions with database sync
async function saveUserDataToDatabase() {
    if (!currentUser || !dataStore) return;
    
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
                workoutSchedule: users[currentUser]?.workoutSchedule
            },
            sessions: users[currentUser]?.data?.sessions || [],
            sleepSessions: users[currentUser]?.data?.sleepData || [],
            stravaActivities: users[currentUser]?.data?.stravaData || []
        };
        
        await dataStore.save('user_data', userData);
        console.log('User data synced to database');
    } catch (error) {
        console.error('Failed to sync user data to database:', error);
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

function connectToStrava() {
    const clientId = '168662'; // This should come from environment variables
    const redirectUri = encodeURIComponent(window.location.origin + '/callback.html');
    const scope = 'read,activity:read_all,profile:read_all';
    const state = 'ignite_fitness_' + Date.now();
    
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    
    window.location.href = stravaAuthUrl;
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'refresh_token',
                refreshToken: refreshToken
            })
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
        console.error('Token refresh failed:', error);
        // Clear invalid tokens
        disconnectFromStrava();
    }
}

async function syncStravaData() {
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
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token expired, try to refresh
                await refreshStravaToken();
                return syncStravaData();
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
            payload: activity
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
        console.error('Strava sync failed:', error);
        statusDiv.className = 'device-status disconnected';
        statusDiv.innerHTML = `<p>❌ Sync failed: ${error.message}</p>`;
        showError(null, `Strava sync failed: ${error.message}`);
    } finally {
        syncBtn.disabled = false;
    }
}

function toggleAIChat() {
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
    
    if (!message) return;
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    input.value = '';
    
    // Show typing indicator
    showTypingIndicator();
    
    // Process with AI
    if (contextAwareAI) {
        contextAwareAI.processUserInput(message)
            .then(response => {
                hideTypingIndicator();
                addMessageToChat(response, 'ai');
            })
            .catch(error => {
                hideTypingIndicator();
                addMessageToChat('Sorry, I encountered an error. Please try again.', 'ai');
                console.error('AI Error:', error);
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

function quickAction(action) {
    const input = document.getElementById('aiChatInput');
    
    switch (action) {
        case 'injury':
            input.value = 'I have an injury and need help adjusting my workout';
            break;
        case 'fatigue':
            input.value = 'I\'m feeling fatigued and need recovery advice';
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
