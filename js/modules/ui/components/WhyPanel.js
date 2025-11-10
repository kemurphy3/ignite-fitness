/**
 * WhyPanel - Displays AI rationale for workout plan
 * Expandable panel showing "why" each decision was made
 */

class WhyPanel {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.isExpanded = false;
        this.sanitizer = window.HtmlSanitizer;
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

        const confidenceHtml = plan.confidence !== undefined
            ? this.renderConfidence(plan.confidence)
            : '';

        const disclaimerHtml = this.renderMedicalDisclaimer();

        // Create summary and detailed rationale
        const summaryHtml = this.renderSummary(plan.why);
        const detailedHtml = this.renderDetailedRationale(plan.why);

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
                    ${disclaimerHtml}
                    ${confidenceHtml}
                    ${warningsHtml}
                    
                    <!-- Summary View (always visible when expanded) -->
                    <div class="why-summary">
                        <h4>Key Points</h4>
                        ${summaryHtml}
                    </div>
                    
                    <!-- Detailed View (progressive disclosure) -->
                    <div class="why-details-section">
                        <button 
                            class="why-details-toggle"
                            id="why-details-toggle"
                            onclick="window.WhyPanel.toggleDetails()"
                            aria-expanded="false"
                            aria-controls="why-details-content"
                        >
                            <span class="details-icon">🔍</span>
                            <span class="details-label">Show technical details</span>
                            <span class="details-arrow">▼</span>
                        </button>
                        
                        <div 
                            class="why-details-content" 
                            id="why-details-content"
                            aria-hidden="true"
                        >
                            <h4>Technical Rationale</h4>
                            ${detailedHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render medical disclaimer
     * @returns {string} HTML for medical disclaimer
     */
    renderMedicalDisclaimer() {
        return `
            <div class="why-medical-disclaimer" role="alert" aria-label="Medical disclaimer">
                <strong>⚠️ Medical Disclaimer</strong>
                <p class="disclaimer-text">
                    This AI-generated workout plan is for informational purposes only and is not intended as medical advice. 
                    Consult with a healthcare professional before beginning any exercise program, especially if you have any 
                    medical conditions, injuries, or concerns. Listen to your body and stop if you experience pain or discomfort.
                </p>
            </div>
        `;
    }

    /**
     * Render confidence interval
     * @param {Object|number} confidence - Confidence data or percentage
     * @returns {string} HTML for confidence display
     */
    renderConfidence(confidence) {
        let confidenceValue = 0;
        let confidenceLevel = 'low';
        let confidenceColor = '#ef4444';
        let confidenceNote = 'Limited data available';

        // Handle different confidence formats
        if (typeof confidence === 'number') {
            confidenceValue = Math.round(confidence * 100);
        } else if (typeof confidence === 'object' && confidence !== null) {
            confidenceValue = Math.round((confidence.score || 0) * 100);
            confidenceNote = confidence.note || confidenceNote;
        }

        // Determine confidence level
        if (confidenceValue >= 80) {
            confidenceLevel = 'high';
            confidenceColor = '#10b981';
            confidenceNote = 'High confidence recommendation';
        } else if (confidenceValue >= 60) {
            confidenceLevel = 'medium';
            confidenceColor = '#f59e0b';
            confidenceNote = 'Moderate confidence recommendation';
        } else {
            confidenceLevel = 'low';
            confidenceColor = '#ef4444';
            confidenceNote = 'Low confidence - consider consulting a professional';
        }

        return `
            <div class="why-confidence" role="status" aria-label="AI confidence level">
                <div class="confidence-header">
                    <span class="confidence-label">💡 AI Confidence</span>
                    <span class="confidence-value" style="color: ${confidenceColor}">
                        ${confidenceValue}%
                    </span>
                </div>
                <div class="confidence-bar">
                    <div 
                        class="confidence-fill confidence-${confidenceLevel}" 
                        style="width: ${confidenceValue}%; background-color: ${confidenceColor};"
                        role="progressbar"
                        aria-valuenow="${confidenceValue}"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    ></div>
                </div>
                <p class="confidence-note">${this.escapeHtml(confidenceNote)}</p>
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
     * Render summary of rationale (1-2 key points)
     * @param {Array} rationale - Full rationale array
     * @returns {string} HTML for summary
     */
    renderSummary(rationale) {
        if (!rationale || rationale.length === 0) {return '';}

        // Take first 1-2 most important points
        const summaryPoints = rationale.slice(0, Math.min(2, rationale.length));

        return `
            <ul class="why-summary-list" role="list">
                ${summaryPoints.map((reason, index) => `
                    <li class="why-summary-item" role="listitem">
                        <span class="summary-marker">${index + 1}.</span>
                        <span class="summary-text">${this.escapeHtml(this.simplifyReason(reason))}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * Render detailed rationale (all points)
     * @param {Array} rationale - Full rationale array
     * @returns {string} HTML for detailed rationale
     */
    renderDetailedRationale(rationale) {
        if (!rationale || rationale.length === 0) {return '';}

        return `
            <ul class="why-list" role="list">
                ${rationale.map((reason, index) => `
                    <li class="why-item" role="listitem">
                        <span class="why-marker">${index + 1}.</span>
                        <span class="why-text">${this.escapeHtml(reason)}</span>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * Simplify reason text for summary view
     * @param {string} reason - Full reason text
     * @returns {string} Simplified reason
     */
    simplifyReason(reason) {
        if (!reason) {return '';}

        // Remove technical jargon and focus on user benefits
        const simplified = reason
            .replace(/based on (your|the) (recent|current) (training|activity|workout)/gi, 'considering your training')
            .replace(/to (optimize|maximize|improve) (your|the) (performance|results|progress)/gi, 'to help you improve')
            .replace(/this (exercise|movement|activity) (targets|focuses on|works)/gi, 'this works')
            .replace(/ensuring (proper|adequate|sufficient)/gi, 'for proper')
            .replace(/while (maintaining|keeping|preserving)/gi, 'and')
            .replace(/in order to/gi, 'to')
            .replace(/due to/gi, 'because of')
            .replace(/in accordance with/gi, 'following')
            .replace(/with respect to/gi, 'for');

        // Limit length for summary
        if (simplified.length > 120) {
            return `${simplified.substring(0, 117) }...`;
        }

        return simplified;
    }

    /**
     * Toggle details section
     */
    toggleDetails() {
        const button = document.getElementById('why-details-toggle');
        const content = document.getElementById('why-details-content');
        const arrow = button?.querySelector('.details-arrow');
        const label = button?.querySelector('.details-label');

        if (!button || !content) {return;}

        const isExpanded = content.getAttribute('aria-hidden') === 'false';
        const newExpanded = !isExpanded;

        button.setAttribute('aria-expanded', newExpanded);
        content.setAttribute('aria-hidden', !newExpanded);
        content.classList.toggle('expanded', newExpanded);

        if (arrow) {
            arrow.classList.toggle('expanded', newExpanded);
        }

        if (label) {
            label.textContent = newExpanded ? 'Hide technical details' : 'Show technical details';
        }

        this.logger.debug('Why panel details toggled', { expanded: newExpanded });
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
        if (!text) {return '';}
        if (typeof text !== 'string') {return String(text);}

        // Use HtmlSanitizer if available, otherwise fall back to basic escaping
        if (this.sanitizer) {
            return this.sanitizer.escapeHtml(text);
        }

        // Basic escape fallback
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.WhyPanel = new WhyPanel();

