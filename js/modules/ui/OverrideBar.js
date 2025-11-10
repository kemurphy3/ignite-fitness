/**
 * OverrideBar - Instant overrides available on every screen
 * Provides quick modifications without leaving workout flow
 */
class OverrideBar {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;

        this.currentPlan = null;
        this.overrideHistory = [];

        this.createOverrideBar();
    }

    /**
     * Create override bar UI
     */
    createOverrideBar() {
        const overrideBar = document.createElement('div');
        overrideBar.id = 'override-bar';
        overrideBar.className = 'override-bar';
        overrideBar.innerHTML = `
            <div class="override-bar-content">
                <h4 class="override-bar-title">Quick Adjustments</h4>
                <div class="override-actions">
                    <button class="override-btn" data-action="change-exercise">
                        <span class="override-icon">🔄</span>
                        <span class="override-label">Change Exercise</span>
                    </button>
                    
                    <button class="override-btn" data-action="less-time">
                        <span class="override-icon">⏱️</span>
                        <span class="override-label">Less Time</span>
                    </button>
                    
                    <button class="override-btn" data-action="swap-equipment">
                        <span class="override-icon">🎯</span>
                        <span class="override-label">Swap Equipment</span>
                    </button>
                    
                    <button class="override-btn" data-action="reduce-intensity">
                        <span class="override-icon">📉</span>
                        <span class="override-label">Reduce Intensity</span>
                    </button>
                    
                    <button class="override-btn" data-action="coach-chat">
                        <span class="override-icon">💬</span>
                        <span class="override-label">Ask Coach</span>
                    </button>
                </div>
            </div>
        `;

        // Add event listeners
        overrideBar.querySelectorAll('.override-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleOverride(e.currentTarget.dataset.action);
            });
        });

        // Insert into body
        document.body.appendChild(overrideBar);
    }

    /**
     * Handle override action
     * @param {string} action - Override action
     */
    async handleOverride(action) {
        try {
            this.logger.debug('Override triggered', { action });

            switch (action) {
                case 'change-exercise':
                    await this.showExerciseSwapper();
                    break;

                case 'less-time':
                    await this.showTimeReducer();
                    break;

                case 'swap-equipment':
                    await this.showEquipmentSwapper();
                    break;

                case 'reduce-intensity':
                    await this.reduceCurrentIntensity();
                    break;

                case 'coach-chat':
                    await this.openCoachChat();
                    break;
            }

            // Log override
            this.overrideHistory.push({
                action,
                timestamp: new Date().toISOString(),
                planBefore: this.currentPlan
            });

            // Emit event
            this.eventBus.emit('OVERRIDE_APPLIED', {
                action,
                result: 'success'
            });

        } catch (error) {
            this.logger.error('Failed to handle override', error);
        }
    }

    /**
     * Show exercise swapper
     */
    async showExerciseSwapper() {
        const modal = document.createElement('div');
        modal.className = 'override-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Swap Exercise</h3>
                <p>Choose a similar exercise:</p>
                <div class="exercise-options">
                    ${this.getSimilarExercises().map(ex => `
                        <button class="exercise-option" data-exercise="${ex.name}">
                            ${ex.name}
                        </button>
                    `).join('')}
                </div>
                <button class="btn-secondary" onclick="this.closest('.override-modal').remove()">
                    Cancel
                </button>
            </div>
        `;

        modal.querySelectorAll('.exercise-option').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                await this.swapExercise(e.target.dataset.exercise);
                modal.remove();
            });
        });

        document.body.appendChild(modal);
    }

    /**
     * Show time reducer
     */
    async showTimeReducer() {
        // Quickly modify plan to reduce time
        const quickOptions = [
            { label: 'Skip finisher', reduction: '20%' },
            { label: 'Reduce sets', reduction: '25%' },
            { label: 'Super set pairs', reduction: '30%' }
        ];

        const modal = document.createElement('div');
        modal.className = 'override-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Reduce Time</h3>
                <p>Choose how to save time:</p>
                <div class="time-options">
                    ${quickOptions.map(opt => `
                        <button class="time-option">
                            <span>${opt.label}</span>
                            <span class="reduction">Save ${opt.reduction}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        modal.querySelectorAll('.time-option').forEach((btn, i) => {
            btn.addEventListener('click', () => {
                this.applyTimeReduction(quickOptions[i].reduction);
                modal.remove();
            });
        });

        document.body.appendChild(modal);
    }

    /**
     * Show equipment swapper
     */
    async showEquipmentSwapper() {
        // Show alternative equipment options
        const alternatives = [
            'Use machines instead',
            'Use cables instead',
            'Use dumbbells instead',
            'Use resistance bands'
        ];

        const modal = document.createElement('div');
        modal.className = 'override-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Alternative Equipment</h3>
                <div class="equipment-options">
                    ${alternatives.map(alt => `
                        <button class="equipment-option">${alt}</button>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Reduce current intensity
     */
    async reduceCurrentIntensity() {
        // Apply intensity reduction to current workout
        const newPlan = {
            ...this.currentPlan,
            intensityMultiplier: (this.currentPlan.intensityMultiplier || 1.0) * 0.85,
            modification: 'Reduced intensity by 15% upon request'
        };

        this.updatePlan(newPlan);

        this.showNotification('Intensity reduced by 15%. Better safe than sorry.');
    }

    /**
     * Open coach chat
     */
    async openCoachChat() {
        if (window.CoachChat) {
            window.CoachChat.openChat();
        }
    }

    /**
     * Apply time reduction
     * @param {string} reduction - Reduction percentage
     */
    applyTimeReduction(reduction) {
        const reductionValue = parseFloat(reduction.replace('%', '')) / 100;

        const newPlan = {
            ...this.currentPlan,
            volumeMultiplier: (this.currentPlan.volumeMultiplier || 1.0) * (1 - reductionValue),
            modification: `Time reduced by ${reduction}`
        };

        this.updatePlan(newPlan);

        this.showNotification(`Time reduced by ${reduction}. Workout shortened.`);
    }

    /**
     * Swap exercise
     * @param {string} newExercise - New exercise name
     */
    async swapExercise(newExercise) {
        this.currentPlan.exercises = this.currentPlan.exercises.map(ex => {
            if (ex === this.getCurrentExercise()) {
                return { ...ex, name: newExercise, swappedFrom: ex.name };
            }
            return ex;
        });

        this.showNotification(`Swapped to ${newExercise}`);
    }

    /**
     * Update current plan
     * @param {Object} newPlan - New plan
     */
    updatePlan(newPlan) {
        this.currentPlan = newPlan;

        // Emit event
        this.eventBus.emit('PLAN_UPDATED', {
            oldPlan: this.overrideHistory[this.overrideHistory.length - 1]?.planBefore,
            newPlan,
            changes: this.getChanges()
        });

        // Update UI without reload
        this.refreshUI();
    }

    /**
     * Refresh UI
     */
    refreshUI() {
        // Trigger UI update if workout tracker exists
        if (window.WorkoutTracker) {
            window.WorkoutTracker.updatePlan(this.currentPlan);
        }
    }

    /**
     * Get similar exercises
     * @returns {Array} Similar exercises
     */
    getSimilarExercises() {
        // Would query ExerciseDatabase for alternatives
        return [
            { name: 'Goblet Squat', category: 'squat' },
            { name: 'Bulgarian Split Squat', category: 'squat' },
            { name: 'Leg Press', category: 'squat' }
        ];
    }

    /**
     * Show notification
     * @param {string} message - Message
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'override-notification';
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Get current exercise
     * @returns {Object} Current exercise
     */
    getCurrentExercise() {
        // Would get from WorkoutTracker
        return this.currentPlan?.exercises?.[0] || { name: 'Unknown' };
    }

    /**
     * Get changes
     * @returns {Object} Changes
     */
    getChanges() {
        return {
            modifications: this.currentPlan.modifications || [],
            overrides: this.overrideHistory.length
        };
    }

    /**
     * Set current plan
     * @param {Object} plan - Current plan
     */
    setCurrentPlan(plan) {
        this.currentPlan = plan;
    }
}

window.OverrideBar = new OverrideBar();
