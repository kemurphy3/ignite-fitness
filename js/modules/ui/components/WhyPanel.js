/**
 * WhyPanel - Displays AI rationale for workout plan
 * Expandable panel showing "why" each decision was made
 */
class WhyPanel {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.isExpanded = false;
    }

    /**
     * Render why panel
     * @param {Object} plan - Workout plan with rationale
     * @returns {string} HTML for why panel
     */
    render(plan) {
        if (!plan || !plan.why || plan.why.length === 0) {
            return '';
        }

        const warningsHtml = plan.warnings && plan.warnings.length > 0
            ? this.renderWarnings(plan.warnings)
            : '';

        return `
            <div class="why-panel" id="why-panel" role="region" aria-label="Workout rationale">
                <button 
                    class="why-panel-toggle" 
                    id="why-panel-toggle"
                    aria-expanded="${this.isExpanded}"
                    aria-controls="why-panel-content"
                    onclick="window.WhyPanel.toggle()"
                >
                    <span class="why-icon">💡</span>
                    <span class="why-label">Why this plan?</span>
                    <span class="why-arrow ${this.isExpanded ? 'expanded' : ''}">▼</span>
                </button>
                
                <div 
                    class="why-panel-content ${this.isExpanded ? 'expanded' : ''}" 
                    id="why-panel-content"
                    aria-hidden="${!this.isExpanded}"
                >
                    ${warningsHtml}
                    <ul class="why-list" role="list">
                        ${plan.why.map((reason, index) => `
                            <li class="why-item" role="listitem">
                                <span class="why-marker">${index + 1}.</span>
                                <span class="why-text">${this.escapeHtml(reason)}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Render warnings section
     * @param {Array} warnings - Warning messages
     * @returns {string} HTML for warnings
     */
    renderWarnings(warnings) {
        return `
            <div class="why-warnings" role="alert">
                <strong>⚠️ Important:</strong>
                <ul class="warning-list">
                    ${warnings.map(warning => `
                        <li>${this.escapeHtml(warning)}</li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Toggle panel expansion
     */
    toggle() {
        this.isExpanded = !this.isExpanded;
        const button = document.getElementById('why-panel-toggle');
        const content = document.getElementById('why-panel-content');
        const arrow = button?.querySelector('.why-arrow');

        if (button) {
            button.setAttribute('aria-expanded', this.isExpanded);
        }

        if (content) {
            content.setAttribute('aria-hidden', !this.isExpanded);
            content.classList.toggle('expanded', this.isExpanded);
        }

        if (arrow) {
            arrow.classList.toggle('expanded', this.isExpanded);
        }

        this.logger.debug('Why panel toggled', { expanded: this.isExpanded });
    }

    /**
     * Render exercise override button
     * @param {string} exerciseName - Exercise name
     * @param {number} index - Exercise index
     * @returns {string} HTML for override button
     */
    renderOverrideButton(exerciseName, index) {
        return `
            <button 
                class="override-exercise-btn"
                data-exercise="${this.escapeHtml(exerciseName)}"
                data-index="${index}"
                aria-label="Override ${exerciseName}"
                onclick="window.WhyPanel.showOverrideModal(this)"
            >
                🔄 Override
            </button>
        `;
    }

    /**
     * Show override modal for an exercise
     * @param {HTMLElement} button - Clicked button
     */
    async showOverrideModal(button) {
        const exerciseName = button.dataset.exercise;
        const exerciseIndex = parseInt(button.dataset.index, 10);

        // Get alternates from ExerciseAdapter
        const exerciseAdapter = new ExerciseAdapter();
        const alternates = exerciseAdapter.getAlternates(exerciseName);

        // Create modal
        const modal = this.createOverrideModal(exerciseName, exerciseIndex, alternates);
        document.body.appendChild(modal);

        // Focus first focusable element
        const firstInput = modal.querySelector('button, input');
        if (firstInput) {
            firstInput.focus();
        }

        this.logger.debug('Override modal shown', { exercise: exerciseName });
    }

    /**
     * Create override modal HTML
     * @param {string} exerciseName - Exercise name
     * @param {number} index - Exercise index
     * @param {Array} alternates - Alternative exercises
     * @returns {HTMLElement} Modal element
     */
    createOverrideModal(exerciseName, index, alternates) {
        const modal = document.createElement('div');
        modal.className = 'override-modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', 'override-modal-title');
        modal.setAttribute('aria-modal', 'true');

        modal.innerHTML = `
            <div class="override-modal">
                <div class="modal-header">
                    <h3 id="override-modal-title">Override: ${this.escapeHtml(exerciseName)}</h3>
                    <button 
                        class="modal-close" 
                        aria-label="Close modal"
                        onclick="this.closest('.override-modal-overlay').remove()"
                    >
                        ×
                    </button>
                </div>

                <div class="modal-content">
                    <h4>Suggested Alternatives</h4>
                    <div class="alternate-list">
                        ${alternates.length > 0 ? alternates.map((alt, i) => `
                            <button 
                                class="alternate-option" 
                                data-alternate="${this.escapeHtml(alt.name)}"
                                onclick="window.WhyPanel.selectAlternate('${this.escapeHtml(alt.name)}', '${exerciseName}', ${index})"
                            >
                                <div class="alternate-name">${this.escapeHtml(alt.name)}</div>
                                <div class="alternate-rationale">${this.escapeHtml(alt.rationale)}</div>
                            </button>
                        `).join('') : `
                            <p class="no-alternates">No alternatives available for this exercise.</p>
                        `}
                    </div>

                    <h4>Quick Actions</h4>
                    <div class="quick-actions">
                        <button 
                            class="quick-action regression"
                            onclick="window.WhyPanel.applyRegression('${exerciseName}', ${index})"
                        >
                            <span class="action-icon">📉</span>
                            <span class="action-label">Regression</span>
                            <span class="action-desc">Reduce difficulty</span>
                        </button>
                        <button 
                            class="quick-action progression"
                            onclick="window.WhyPanel.applyProgression('${exerciseName}', ${index})"
                        >
                            <span class="action-icon">📈</span>
                            <span class="action-label">Progression</span>
                            <span class="action-desc">Increase difficulty</span>
                        </button>
                        <button 
                            class="quick-action pattern"
                            onclick="window.WhyPanel.applyDifferentPattern('${exerciseName}', ${index})"
                        >
                            <span class="action-icon">🔄</span>
                            <span class="action-label">Different pattern</span>
                            <span class="action-desc">Change movement</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close on Escape key
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.remove();
            }
        });

        return modal;
    }

    /**
     * Select alternate exercise
     * @param {string} alternateName - Alternate exercise name
     * @param {string} originalName - Original exercise name
     * @param {number} index - Exercise index in plan
     */
    selectAlternate(alternateName, originalName, index) {
        const plan = window.WorkoutTracker?.currentPlan;
        
        if (!plan || !plan.blocks) {
            this.logger.error('No plan available for override');
            return;
        }

        // Find and replace exercise
        let replaced = false;
        for (const block of plan.blocks) {
            if (block.items && block.items[index]) {
                const oldExercise = block.items[index].name;
                block.items[index].name = alternateName;
                block.items[index].notes = `${block.items[index].notes || ''} (Overridden from ${oldExercise})`;
                replaced = true;
                break;
            }
        }

        if (replaced) {
            // Re-render workout
            if (window.WorkoutTracker) {
                window.WorkoutTracker.render();
            }

            // Log override event
            this.logOverride({
                original: originalName,
                alternate: alternateName,
                type: 'alternate',
                timestamp: new Date().toISOString()
            });

            // Close modal
            document.querySelectorAll('.override-modal-overlay').forEach(el => el.remove());

            this.logger.debug('Exercise overridden', { original: originalName, alternate: alternateName });
        }
    }

    /**
     * Apply regression (reduce difficulty)
     * @param {string} exerciseName - Exercise name
     * @param {number} index - Exercise index
     */
    applyRegression(exerciseName, index) {
        const plan = window.WorkoutTracker?.currentPlan;
        
        if (!plan || !plan.blocks) {
            this.logger.error('No plan available for regression');
            return;
        }

        // Find exercise and adjust sets/reps
        for (const block of plan.blocks) {
            if (block.items && block.items[index]) {
                const item = block.items[index];
                
                // Reduce sets
                if (typeof item.sets === 'number') {
                    item.sets = Math.max(1, item.sets - 1);
                }

                // Reduce intensity in notes
                item.notes = `${item.notes || ''} (Regression applied)`;
                
                break;
            }
        }

        // Re-render
        if (window.WorkoutTracker) {
            window.WorkoutTracker.render();
        }

        // Log event
        this.logOverride({
            exercise: exerciseName,
            type: 'regression',
            timestamp: new Date().toISOString()
        });

        // Close modal
        document.querySelectorAll('.override-modal-overlay').forEach(el => el.remove());
    }

    /**
     * Apply progression (increase difficulty)
     * @param {string} exerciseName - Exercise name
     * @param {number} index - Exercise index
     */
    applyProgression(exerciseName, index) {
        const plan = window.WorkoutTracker?.currentPlan;
        
        if (!plan || !plan.blocks) {
            this.logger.error('No plan available for progression');
            return;
        }

        // Find exercise and adjust sets
        for (const block of plan.blocks) {
            if (block.items && block.items[index]) {
                const item = block.items[index];
                
                // Increase sets
                if (typeof item.sets === 'number') {
                    item.sets += 1;
                }

                item.notes = `${item.notes || ''} (Progression applied)`;
                
                break;
            }
        }

        // Re-render
        if (window.WorkoutTracker) {
            window.WorkoutTracker.render();
        }

        // Log event
        this.logOverride({
            exercise: exerciseName,
            type: 'progression',
            timestamp: new Date().toISOString()
        });

        // Close modal
        document.querySelectorAll('.override-modal-overlay').forEach(el => el.remove());
    }

    /**
     * Apply different movement pattern
     * @param {string} exerciseName - Exercise name
     * @param {number} index - Exercise index
     */
    applyDifferentPattern(exerciseName, index) {
        const plan = window.WorkoutTracker?.currentPlan;
        
        if (!plan || !plan.blocks) {
            this.logger.error('No plan available for pattern change');
            return;
        }

        // Get alternatives for different pattern
        const exerciseAdapter = new ExerciseAdapter();
        const alternates = exerciseAdapter.getAlternates(exerciseName);

        if (alternates.length > 0) {
            // Use first alternate as different pattern
            this.selectAlternate(alternates[0].name, exerciseName, index);
        }
    }

    /**
     * Log override event
     * @param {Object} overrideData - Override data
     */
    logOverride(overrideData) {
        this.eventBus.emit('EXERCISE_OVERRIDE', overrideData);
        
        this.logger.info('Exercise override applied', overrideData);

        // Store for persistence
        if (window.StorageManager) {
            const userId = window.AuthManager?.getCurrentUsername() || 'anonymous';
            window.StorageManager.saveSessionLog(userId, new Date().toISOString().split('T')[0], {
                overrides: [overrideData]
            });
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.WhyPanel = new WhyPanel();

