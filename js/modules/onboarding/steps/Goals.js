/**
 * Goals Step - Multi-select goal selection
 * Users can select multiple training goals without decision fatigue
 */
class GoalsStep {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Render goals selection step
     * @param {Object} existingData - Existing onboarding data
     * @returns {string} HTML for goals step
     */
    render(existingData = {}) {
        const selectedGoals = existingData.goals || [];
        
        return `
            <div class="onboarding-step goals-step">
                <h2>What are your training goals?</h2>
                <p class="step-description">Select all that apply - you can focus on multiple areas.</p>
                
                <div class="goals-grid">
                    <label class="goal-option">
                        <input type="checkbox" value="athletic_performance" 
                               ${selectedGoals.includes('athletic_performance') ? 'checked' : ''}
                               data-goal="athletic_performance">
                        <div class="goal-card">
                            <span class="goal-icon">⚡</span>
                            <div class="goal-content">
                                <div class="goal-label">Athletic Performance</div>
                                <div class="goal-description">Get faster, stronger, more explosive</div>
                            </div>
                        </div>
                    </label>
                    
                    <label class="goal-option">
                        <input type="checkbox" value="v_taper" 
                               ${selectedGoals.includes('v_taper') ? 'checked' : ''}
                               data-goal="v_taper">
                        <div class="goal-card">
                            <span class="goal-icon">💪</span>
                            <div class="goal-content">
                                <div class="goal-label">V-Taper Physique</div>
                                <div class="goal-description">Wide shoulders, strong back</div>
                            </div>
                        </div>
                    </label>
                    
                    <label class="goal-option">
                        <input type="checkbox" value="glutes" 
                               ${selectedGoals.includes('glutes') ? 'checked' : ''}
                               data-goal="glutes">
                        <div class="goal-card">
                            <span class="goal-icon">🍑</span>
                            <div class="goal-content">
                                <div class="goal-label">Glutes & Legs</div>
                                <div class="goal-description">Build strong, shapely lower body</div>
                            </div>
                        </div>
                    </label>
                    
                    <label class="goal-option">
                        <input type="checkbox" value="toned" 
                               ${selectedGoals.includes('toned') ? 'checked' : ''}
                               data-goal="toned">
                        <div class="goal-card">
                            <span class="goal-icon">🔥</span>
                            <div class="goal-content">
                                <div class="goal-label">Lean & Toned</div>
                                <div class="goal-description">Stay lean and athletic</div>
                            </div>
                        </div>
                    </label>
                    
                    <label class="goal-option">
                        <input type="checkbox" value="weight_management" 
                               ${selectedGoals.includes('weight_management') ? 'checked' : ''}
                               data-goal="weight_management">
                        <div class="goal-card">
                            <span class="goal-icon">⚖️</span>
                            <div class="goal-content">
                                <div class="goal-label">Weight Management</div>
                                <div class="goal-description">Build muscle, manage weight</div>
                            </div>
                        </div>
                    </label>
                    
                    <label class="goal-option">
                        <input type="checkbox" value="general_fitness" 
                               ${selectedGoals.includes('general_fitness') ? 'checked' : ''}
                               data-goal="general_fitness">
                        <div class="goal-card">
                            <span class="goal-icon">💚</span>
                            <div class="goal-content">
                                <div class="goal-label">General Fitness</div>
                                <div class="goal-description">Stay active and healthy</div>
                            </div>
                        </div>
                    </label>
                </div>
                
                <div class="step-actions">
                    <button class="btn-secondary" onclick="window.OnboardingManager.skipStep()">
                        Skip for now
                    </button>
                    <button class="btn-primary" onclick="window.OnboardingManager.nextStep()">
                        Continue →
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get selected goals
     * @returns {Array} Selected goal IDs
     */
    getSelectedGoals() {
        const checkboxes = document.querySelectorAll('.goal-option input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * Validate step
     * @returns {boolean} Is valid
     */
    validate() {
        // At least one goal selected OR skipped
        return true; // Goals are optional
    }
}

window.GoalsStep = GoalsStep;
