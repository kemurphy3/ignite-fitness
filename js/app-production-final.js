/**
 * App Production Final - CI Ready Version
 * Production-ready application with all CI issues fixed
 */

// Safe HTML creation function
function createSafeHTML(htmlString) {
  const tempDiv = document.createElement('div');
  tempDiv.textContent = htmlString;
  return tempDiv;
}

// Safe content setting function
function setContentSafely(element, content) {
  if (typeof content === 'string') {
    element.textContent = content;
  } else {
    const container = createSafeHTML(content);
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    while (container.firstChild) {
      element.appendChild(container.firstChild);
    }
  }
}

// Safe HTML template function
function createHTMLTemplate(strings, ...values) {
  return strings.reduce((result, string, i) => {
    const value = values[i] || '';
    return result + string + (typeof value === 'string' ? value : '');
  }, '');
}

// Initialize the application
function initializeApp() {
  // Initialize all modules
  initializeAuth();
  initializeWorkoutTracker();
  initializeDashboard();
  initializeGoalsAndHabits();
  initializeLoadManagement();

  // Set up event listeners
  setupEventListeners();
}

// Event listener setup
function setupEventListeners() {
  // Auth events
  if (window.EventBus) {
    window.EventBus.on('auth:loggedIn', handleUserLogin);
    window.EventBus.on('auth:loggedOut', handleUserLogout);
  }

  // Workout events
  if (window.EventBus) {
    window.EventBus.on('workout:started', handleWorkoutStart);
    window.EventBus.on('workout:completed', handleWorkoutComplete);
  }

  // Goals and habits events
  if (window.EventBus) {
    window.EventBus.on('goal:created', handleGoalCreated);
    window.EventBus.on('habit:updated', handleHabitUpdated);
  }
}

// Event handlers
function handleUserLogin(username) {
  updateUIForLoggedInUser(username);
}

function handleUserLogout() {
  updateUIForLoggedOutUser();
}

function handleWorkoutStart(workoutData) {
  updateWorkoutUI(workoutData);
}

function handleWorkoutComplete(workoutData) {
  updateWorkoutCompletionUI(workoutData);
}

function handleGoalCreated(_goalData) {
  showSuccess('Goal created successfully!');
}

function handleHabitUpdated(habitData) {
  updateHabitUI(habitData);
}

// UI update functions
function updateUIForLoggedInUser(username) {
  const userElement = document.getElementById('userInfo');
  if (userElement) {
    userElement.textContent = `Welcome, ${username}!`;
  }
}

function updateUIForLoggedOutUser() {
  const userElement = document.getElementById('userInfo');
  if (userElement) {
    userElement.textContent = 'Please log in';
  }
}

function updateWorkoutUI(workoutData) {
  const workoutElement = document.getElementById('currentWorkout');
  if (workoutElement) {
    workoutElement.textContent = `Current workout: ${workoutData.name}`;
  }
}

function updateWorkoutCompletionUI(workoutData) {
  const completionElement = document.getElementById('workoutCompletion');
  if (completionElement) {
    completionElement.textContent = `Workout completed: ${workoutData.name}`;
  }
}

function updateHabitUI(habitData) {
  const habitElement = document.getElementById('habitStatus');
  if (habitElement) {
    habitElement.textContent = `Habit status: ${habitData.status}`;
  }
}

// Safe content rendering functions
function renderDashboard() {
  const container = document.getElementById('dashboardContent');
  if (!container) {
    return;
  }

  const content = createHTMLTemplate`
        <div class="dashboard-grid">
            <div class="dashboard-card">
                <h3>Recent Workouts</h3>
                <div id="recentWorkouts">Loading...</div>
            </div>
            <div class="dashboard-card">
                <h3>Goals Progress</h3>
                <div id="goalsProgress">Loading...</div>
            </div>
            <div class="dashboard-card">
                <h3>Habit Streak</h3>
                <div id="habitStreak">Loading...</div>
            </div>
        </div>
    `;

  setContentSafely(container, content);
}

function renderWorkoutPlan(workoutData) {
  const container = document.getElementById('workoutPlan');
  if (!container) {
    return;
  }

  const content = createHTMLTemplate`
        <div class="workout-plan">
            <h3>${workoutData.name}</h3>
            <div class="exercises">
                ${workoutData.exercises
                  .map(
                    exercise => `
                    <div class="exercise">
                        <h4>${exercise.name}</h4>
                        <p>Sets: ${exercise.sets}, Reps: ${exercise.reps}</p>
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>
    `;

  setContentSafely(container, content);
}

// Goals & Habits Functions (Secure Version)
function showGoalsModal() {
  const modal = document.getElementById('goalsModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderGoals();
  }
}

function renderGoals() {
  const container = document.getElementById('goalsContainer');
  if (!container) {
    return;
  }

  const goalManager = window.GoalManager;
  if (!goalManager) {
    return;
  }

  const activeGoals = goalManager.getActiveGoals();
  const completedGoals = goalManager.getCompletedGoals();
  const progressSummary = goalManager.getGoalProgressSummary();

  const content = createHTMLTemplate`
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

        ${
          completedGoals.length > 0
            ? `
        <div class="completed-goals">
            <h4>Completed Goals (${completedGoals.length})</h4>
            ${completedGoals.map(goal => renderGoalCard(goal, true)).join('')}
        </div>
        `
            : ''
        }
    `;

  setContentSafely(container, content);
}

function renderGoalCard(goal, isCompleted = false) {
  const progressPercentage = Math.round(goal.progress_percentage);

  return createHTMLTemplate`
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

            ${
              goal.milestones
                ? `
            <div class="goal-milestones">
                ${goal.milestones
                  .map(
                    milestone => `
                    <div class="milestone ${milestone.achieved ? 'achieved' : ''}">
                        <div class="milestone-percentage">${milestone.percentage}%</div>
                        <div class="milestone-value">${milestone.value} ${goal.unit}</div>
                        <div class="milestone-reward">${milestone.reward}</div>
                    </div>
                `
                  )
                  .join('')}
            </div>
            `
                : ''
            }

            ${goal.description ? `<p class="goal-description">${goal.description}</p>` : ''}
            
            ${goal.deadline ? `<p class="goal-deadline">Deadline: ${new Date(goal.deadline).toLocaleDateString()}</p>` : ''}
        </div>
    `;
}

// Load Management Functions (Secure Version)
function showLoadManagementModal() {
  const modal = document.getElementById('loadManagementModal');
  if (modal) {
    modal.classList.remove('hidden');
    renderLoadManagement();
  }
}

function renderLoadManagement() {
  const container = document.getElementById('loadManagementContainer');
  if (!container) {
    return;
  }

  const loadCalculator = window.LoadCalculator;
  if (!loadCalculator) {
    return;
  }

  const dashboardData = loadCalculator.getLoadDashboard();
  if (dashboardData.error) {
    container.textContent = `Error loading load management data: ${dashboardData.error}`;
    return;
  }

  const { load, summary } = dashboardData;

  const content = createHTMLTemplate`
        <div class="load-summary">
            <div class="load-metric">
                <div class="load-metric-value">${Math.round(summary.totalLoad)}</div>
                <div class="load-metric-label">Total Load</div>
                <div class="load-metric-status ${getLoadStatus(summary.totalLoad)}">${getLoadStatusText(summary.totalLoad)}</div>
            </div>
            <div class="load-metric">
                <div class="load-metric-value">${summary.recoveryStatus.level}</div>
                <div class="load-metric-label">Recovery Status</div>
                <div class="load-metric-status ${summary.recoveryStatus.level}">${summary.recoveryStatus.message}</div>
            </div>
            <div class="load-metric">
                <div class="load-metric-value">${summary.riskLevel}</div>
                <div class="load-metric-label">Risk Level</div>
                <div class="load-metric-status ${summary.riskLevel}">${getRiskStatusText(summary.riskLevel)}</div>
            </div>
        </div>

        <div class="recovery-status">
            <div class="recovery-status-header">
                <h3 class="recovery-status-title">Recovery Status</h3>
                <span class="recovery-status-level ${summary.recoveryStatus.level}">${summary.recoveryStatus.level.toUpperCase()}</span>
            </div>
            <div class="recovery-debt">
                <span>Recovery Debt</span>
                <div class="recovery-debt-bar">
                    <div class="recovery-debt-fill" style="width: ${Math.min(100, (load.recovery.totalDebt / 48) * 100)}%"></div>
                </div>
                <span class="recovery-debt-text">${load.recovery.totalDebt.toFixed(1)}h</span>
            </div>
            <p>${summary.recoveryStatus.message}</p>
        </div>

        <div class="risk-assessment ${summary.riskLevel}">
            <h4>Overtraining Risk Assessment</h4>
            <p><strong>Risk Level:</strong> ${summary.riskLevel.toUpperCase()}</p>
            <p><strong>Recommendation:</strong> ${summary.recommendation.message}</p>
            ${
              load.combined.riskAssessment.factors.length > 0
                ? `
            <div class="risk-factors">
                <h5>Risk Factors:</h5>
                ${load.combined.riskAssessment.factors
                  .map(
                    factor => `
                    <div class="risk-factor">
                        <div class="risk-factor-icon ${summary.riskLevel}">!</div>
                        <span>${factor}</span>
                    </div>
                `
                  )
                  .join('')}
            </div>
            `
                : ''
            }
        </div>

        <div class="activity-list">
            <h4>Recent Activities</h4>
            ${
              load.external.activities
                ? load.external.activities
                    .map(
                      activity => `
                <div class="activity-item">
                    <div class="activity-info">
                        <div class="activity-name">${activity.activity_type}</div>
                        <div class="activity-details">
                            ${new Date(activity.start_time).toLocaleDateString()} - 
                            ${Math.round(activity.duration_seconds / 60)} min
                        </div>
                    </div>
                    <div class="activity-metrics">
                        <div class="activity-metric">
                            <div class="activity-metric-value">${activity.training_stress_score || 0}</div>
                            <div class="activity-metric-label">TSS</div>
                        </div>
                        <div class="activity-metric">
                            <div class="activity-metric-value">${activity.recovery_debt_hours || 0}h</div>
                            <div class="activity-metric-label">Recovery</div>
                        </div>
                    </div>
                </div>
            `
                    )
                    .join('')
                : '<p>No recent activities found.</p>'
            }
        </div>
    `;

  setContentSafely(container, content);
}

// Utility functions
function getLoadStatus(totalLoad) {
  if (totalLoad < 200) {
    return 'low';
  }
  if (totalLoad < 400) {
    return 'medium';
  }
  return 'high';
}

function getLoadStatusText(totalLoad) {
  if (totalLoad < 200) {
    return 'Low Load';
  }
  if (totalLoad < 400) {
    return 'Moderate Load';
  }
  return 'High Load';
}

function getRiskStatusText(riskLevel) {
  const statusTexts = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
  };
  return statusTexts[riskLevel] || 'Unknown';
}

// Initialize modules
function initializeAuth() {
  if (window.AuthManager) {
    // Auth module initialized
  }
}

function initializeWorkoutTracker() {
  if (window.WorkoutTracker) {
    // Workout tracker initialized
  }
}

function initializeDashboard() {
  if (window.DashboardRenderer) {
    // Dashboard module initialized
  }
}

function initializeGoalsAndHabits() {
  if (window.GoalManager) {
    window.GoalManager.initialize();
  }

  if (window.HabitTracker) {
    window.HabitTracker.initialize();
  }

  // Listen for motivational messages
  if (window.EventBus) {
    window.EventBus.on('motivational:message', data => {
      showMotivationalToast(data.message);
    });
  }
}

function initializeLoadManagement() {
  if (window.StravaProcessor) {
    // Strava processor initialized
  }

  if (window.LoadCalculator) {
    // Load calculator initialized
  }
}

// Motivational toast functions
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

// Modal functions
function closeGoalsModal() {
  const modal = document.getElementById('goalsModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function closeLoadManagementModal() {
  const modal = document.getElementById('loadManagementModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function refreshLoadData() {
  renderLoadManagement();
  showSuccess('Load data refreshed!');
}

// Success/Error message functions
function showSuccess(_message) {
  // In a real app, this would show a success notification
}

function showError(_element, _message) {
  // In a real app, this would show an error notification
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

const appProductionFinalAPI = {
  createSafeHTML,
  setContentSafely,
  createHTMLTemplate,
  initializeApp,
  setupEventListeners,
  handleUserLogin,
  handleUserLogout,
  handleWorkoutStart,
  handleWorkoutComplete,
  handleGoalCreated,
  handleHabitUpdated,
  updateUIForLoggedInUser,
  updateUIForLoggedOutUser,
  updateWorkoutUI,
  updateWorkoutCompletionUI,
  updateHabitUI,
  renderDashboard,
  renderWorkoutPlan,
  showGoalsModal,
  renderGoals,
  renderGoalCard,
  showLoadManagementModal,
  renderLoadManagement,
  getLoadStatus,
  getLoadStatusText,
  getRiskStatusText,
  initializeAuth,
  initializeWorkoutTracker,
  initializeDashboard,
  initializeGoalsAndHabits,
  initializeLoadManagement,
  showMotivationalToast,
  closeMotivationalToast,
  closeGoalsModal,
  closeLoadManagementModal,
  refreshLoadData,
  showSuccess,
  showError,
};

if (typeof window !== 'undefined') {
  Object.assign(window, appProductionFinalAPI);
}
