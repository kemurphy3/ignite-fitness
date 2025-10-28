/**
 * Preferences Step - Finalize onboarding
 * Stores complete user profile and preferences in single object
 */
class PreferencesStep {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Render preferences step
     * @param {Object} existingData - Existing onboarding data
     * @returns {string} HTML for preferences step
     */
    render(existingData = {}) {
        return `
            <div class="onboarding-step preferences-step">
                <h2>Finalize Your Profile</h2>
                <p class="step-description">Review your selections and let's get started!</p>
                
                <div class="summary-section">
                    <h3>Your Selections</h3>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <strong>Goals:</strong> 
                            <span>${this.formatGoals(existingData.goals)}</span>
                        </div>
                        <div class="summary-item">
                            <strong>Sport:</strong> 
                            <span>${existingData.sport || 'Soccer'}</span>
                        </div>
                        <div class="summary-item">
                            <strong>Position:</strong> 
                            <span>${existingData.position || 'Midfielder'}</span>
                        </div>
                        <div class="summary-item">
                            <strong>Season:</strong> 
                            <span>${this.formatSeason(existingData.season_phase)}</span>
                        </div>
                        <div class="summary-item">
                            <strong>Training Days:</strong> 
                            <span>${existingData.available_days?.length || 3} days/week</span>
                        </div>
                        <div class="summary-item">
                            <strong>Session Length:</strong> 
                            <span>${existingData.session_length || 45} minutes</span>
                        </div>
                    </div>
                </div>
                
                <div class="edit-section">
                    <button class="btn-secondary" onclick="window.OnboardingManager.previousStep()">
                        ← Edit Selections
                    </button>
                </div>
                
                <div class="step-actions">
                    <button class="btn-primary btn-large" onclick="window.OnboardingManager.completeOnboarding()">
                        Complete Setup ✓
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Format goals for display
     * @param {Array} goals - Goal array
     * @returns {string} Formatted goals
     */
    formatGoals(goals) {
        if (!goals || goals.length === 0) return 'General fitness';
        
        const goalLabels = {
            'athletic_performance': 'Performance',
            'v_taper': 'V-Taper',
            'glutes': 'Glutes',
            'toned': 'Lean & Toned',
            'weight_management': 'Weight',
            'general_fitness': 'General Fitness'
        };
        
        return goals.map(g => goalLabels[g] || g).join(', ');
    }

    /**
     * Format season for display
     * @param {string} season - Season phase
     * @returns {string} Formatted season
     */
    formatSeason(season) {
        const seasonMap = {
            'off-season': 'Off-Season',
            'pre-season': 'Pre-Season',
            'in-season': 'In-Season',
            'transition': 'Transition'
        };
        
        return seasonMap[season] || 'In-Season';
    }

    /**
     * Validate step
     * @returns {boolean} Is valid
     */
    validate() {
        return true; // Always valid for summary step
    }
}

window.PreferencesStep = PreferencesStep;
