/**
 * QuickStart - One-tap workout start for Simple Mode
 * Provides streamlined workout flow with minimal controls
 */
class QuickStart {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.modeManager = window.ModeManager;
        this.expertCoordinator = window.ExpertCoordinator;

        this.currentWorkout = null;
        this.isActive = false;

        this.initialize();
    }

    /**
     * Initialize quick start
     */
    initialize() {
        this.setupEventListeners();

        // Create UI
        this.createQuickStartButton();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for mode changes
        this.eventBus.on('MODE_CHANGED', async (data) => {
            if (data.mode === 'simple') {
                this.refreshUI();
            }
        });

        // Listen for workout completion
        this.eventBus.on('SESSION_COMPLETED', (data) => {
            this.isActive = false;
        });
    }

    /**
     * Create quick start button
     */
    createQuickStartButton() {
        // Only show in Simple Mode
        const quickStartButton = document.createElement('button');
        quickStartButton.id = 'quick-start-button';
        quickStartButton.className = 'quick-start-button';
        quickStartButton.innerHTML = `
            <div class="quick-start-icon">⚡</div>
            <div class="quick-start-text">
                <div class="quick-start-title">Start Workout</div>
                <div class="quick-start-subtitle">Warmup + Circuit + Finisher</div>
            </div>
        `;

        quickStartButton.addEventListener('click', () => this.startQuickWorkout());

        // Insert into dashboard
        const dashboard = document.querySelector('.dashboard-hero');
        if (dashboard) {
            dashboard.appendChild(quickStartButton);
        }
    }

    /**
     * Start quick workout
     */
    async startQuickWorkout() {
        try {
            this.isActive = true;

            // Get user context
            const context = await this.getUserContext();

            // Get simplified plan from ExpertCoordinator
            const plan = this.expertCoordinator.getSessionPlan(context);

            // Simplify for simple mode
            const simplifiedPlan = this.simplifyPlan(plan);

            this.currentWorkout = simplifiedPlan;

            // Display workout
            this.displayQuickWorkout(simplifiedPlan);

            // Navigate to workout view
            if (window.Router) {
                window.Router.navigate('#/workout');
            }

        } catch (error) {
            this.logger.error('Failed to start quick workout', error);
        }
    }

    /**
     * Simplify plan for Simple Mode
     * @param {Object} plan - Full plan
     * @returns {Object} Simplified plan
     */
    simplifyPlan(plan) {
        return {
            warmup: plan.warmup || [],
            circuit: this.createCircuit(plan),
            finisher: plan.finishers?.slice(0, 1) || [],
            duration: 30, // Quick 30-minute sessions
            exercises: this.getKeyExercises(plan)
        };
    }

    /**
     * Create simplified circuit
     * @param {Object} plan - Full plan
     * @returns {Array} Circuit exercises
     */
    createCircuit(plan) {
        // Take main exercises and combine into circuit
        const mainExercises = plan.mainSets || [];
        const accessories = plan.accessories || [];

        // Combine into 3-5 exercise circuit
        return [...mainExercises.slice(0, 2), ...accessories.slice(0, 2)]
            .map(ex => ({
                name: ex.exercise || ex.name,
                reps: ex.reps || '8-12',
                sets: 3
            }));
    }

    /**
     * Get key exercises from plan
     * @param {Object} plan - Full plan
     * @returns {Array} Key exercises
     */
    getKeyExercises(plan) {
        const exercises = [];

        // Warmup
        if (plan.warmup) {exercises.push(...plan.warmup);}

        // Main work
        if (plan.mainSets) {exercises.push(...plan.mainSets);}

        // Finisher
        if (plan.finishers) {exercises.push(...plan.finishers.slice(0, 1));}

        return exercises;
    }

    /**
     * Display quick workout
     * @param {Object} plan - Simplified plan
     */
    displayQuickWorkout(plan) {
        const workoutView = document.getElementById('workout-view');
        if (!workoutView) {return;}

        workoutView.innerHTML = `
            <div class="quick-workout-container">
                <div class="workout-header">
                    <h2>Your Workout</h2>
                    <div class="workout-duration">~${plan.duration} minutes</div>
                </div>
                
                <div class="workout-section">
                    <h3>Warmup</h3>
                    ${this.renderExercises(plan.warmup)}
                </div>
                
                <div class="workout-section">
                    <h3>Circuit (3 rounds)</h3>
                    ${this.renderExercises(plan.circuit)}
                </div>
                
                <div class="workout-section">
                    <h3>Finisher</h3>
                    ${this.renderExercises(plan.finisher)}
                </div>
                
                <button class="btn-primary btn-large" onclick="window.QuickStart.beginWorkout()">
                    Begin Workout
                </button>
            </div>
        `;
    }

    /**
     * Render exercises list
     * @param {Array} exercises - Exercises
     * @returns {string} HTML
     */
    renderExercises(exercises) {
        if (!exercises || exercises.length === 0) {
            return '<p class="no-exercises">None</p>';
        }

        return exercises.map((ex, i) => `
            <div class="exercise-item">
                <span class="exercise-number">${i + 1}</span>
                <div class="exercise-info">
                    <div class="exercise-name">${ex.name || ex.exercise}</div>
                    <div class="exercise-sets">${ex.sets || 3} sets × ${ex.reps || '8-12'} reps</div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Begin workout
     */
    beginWorkout() {
        this.eventBus.emit('WORKOUT_STARTED', {
            plan: this.currentWorkout,
            mode: 'simple'
        });

        // Start workout tracker
        if (window.WorkoutTracker) {
            window.WorkoutTracker.startWorkout(this.currentWorkout);
        }
    }

    /**
     * Refresh UI
     */
    refreshUI() {
        const button = document.getElementById('quick-start-button');
        if (button) {
            button.style.display = this.modeManager.isSimpleMode() ? 'flex' : 'none';
        }
    }

    /**
     * Get user context
     * @returns {Promise<Object>} User context
     */
    async getUserContext() {
        const userId = this.getUserId();
        const today = new Date().toISOString().split('T')[0];

        const readiness = await this.getReadiness();
        const preferences = await this.storageManager.getPreferences(userId);

        return {
            user: {
                sport: 'soccer',
                weight: 70,
                height: 175,
                age: 25
            },
            season: 'in-season',
            schedule: {},
            history: {},
            readiness: readiness?.readinessScore || 7,
            preferences
        };
    }

    /**
     * Get today's readiness
     * @returns {Promise<Object>} Readiness data
     */
    async getReadiness() {
        try {
            const userId = this.getUserId();
            const today = new Date().toISOString().split('T')[0];

            return await this.storageManager.getReadinessLog(userId, today);
        } catch (error) {
            this.logger.error('Failed to get readiness', error);
            return null;
        }
    }

    getUserId() {
        return window.AuthManager?.getCurrentUsername() || 'anonymous';
    }
}

window.QuickStart = new QuickStart();
