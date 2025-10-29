/**
 * AdaptiveDashboard - Dashboard that adapts to Simple Mode
 * Provides different experiences for beginners vs advanced users
 */

class AdaptiveDashboard extends AdaptiveComponent {
    constructor(element, options = {}) {
        super(element, options);
        this.authManager = window.AuthManager;
        this.storageManager = window.StorageManager;
    }

    /**
     * Render simple mode dashboard
     */
    renderSimple() {
        if (!this.element) return;
        
        const username = this.authManager?.getCurrentUsername() || 'Athlete';
        const workoutCount = this.getWorkoutCount();
        const currentStreak = this.getCurrentStreak();
        
        this.element.innerHTML = `
            <div class="dashboard-simple">
                <div class="welcome-card">
                    <h2>Welcome back, ${username}!</h2>
                    <p>Ready for your next workout?</p>
                </div>
                
                <div class="quick-actions">
                    <button class="action-card primary" onclick="window.Router?.navigate('#/workouts')" aria-label="Start your next workout">
                        <div class="action-icon">🏋️</div>
                        <div class="action-text">
                            <h3>Start Workout</h3>
                            <p>Your next session is ready</p>
                        </div>
                    </button>
                    
                    <button class="action-card" onclick="window.Router?.navigate('#/progress')" aria-label="View your progress">
                        <div class="action-icon">📈</div>
                        <div class="action-text">
                            <h3>View Progress</h3>
                            <p>See how you're doing</p>
                        </div>
                    </button>
                    
                    <button class="action-card" onclick="if(window.CoachChat){window.CoachChat.openChat();}" aria-label="Ask the AI coach">
                        <div class="action-icon">💬</div>
                        <div class="action-text">
                            <h3>Ask Coach</h3>
                            <p>Get workout advice</p>
                        </div>
                    </button>
                </div>
                
                <div class="simple-stats">
                    <div class="stat-card">
                        <div class="stat-number">${workoutCount}</div>
                        <div class="stat-label">Workouts Completed</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${currentStreak}</div>
                        <div class="stat-label">Day Streak</div>
                    </div>
                </div>
                
                <div class="upgrade-prompt" style="margin-top: 2rem; padding: 1rem; background: #edf2f7; border-radius: 8px; text-align: center;">
                    <p style="margin: 0; color: #4a5568;">Want more features?</p>
                    <button onclick="window.upgradeToAdvanced()" style="margin-top: 0.5rem; background: #4299e1; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600;">
                        Try Advanced Mode
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render advanced mode dashboard
     */
    renderAdvanced() {
        if (!this.element) return;
        
        // Use existing dashboard with all features
        if (window.DashboardHero) {
            const hero = window.DashboardHero.render();
            
            this.element.innerHTML = `
                <div class="dashboard-advanced">
                    ${hero.outerHTML}
                    <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
                        <div class="stats-panel" style="background: white; border-radius: 8px; padding: 1.5rem;">
                            <h3 style="margin-top: 0;">Detailed Statistics</h3>
                            ${this.renderDetailedStats()}
                        </div>
                        <div class="charts-panel" style="background: white; border-radius: 8px; padding: 1.5rem;">
                            <h3 style="margin-top: 0;">Progress Charts</h3>
                            <div id="charts-section"></div>
                        </div>
                        <div class="ai-insights-panel" style="background: white; border-radius: 8px; padding: 1.5rem;">
                            <h3 style="margin-top: 0;">AI Coaching Insights</h3>
                            ${this.renderAIInsights()}
                        </div>
                        ${this.renderStravaPanel()}
                    </div>
                </div>
            `;
            
            // Load charts if available
            if (window.Trends) {
                setTimeout(() => {
                    const chartsSection = this.element.querySelector('#charts-section');
                    if (chartsSection && window.Trends.render) {
                        chartsSection.innerHTML = window.Trends.render();
                    }
                }, 100);
            }
        } else {
            this.renderSimple(); // Fallback
        }
    }

    /**
     * Get workout count from storage
     * @returns {number} Workout count
     */
    getWorkoutCount() {
        try {
            const userId = this.authManager?.getCurrentUsername();
            if (!userId) return 0;
            
            const userData = this.storageManager?.getUserData?.(userId) || {};
            const workouts = userData.data?.workouts || [];
            return workouts.length;
        } catch (error) {
            this.logger.error('Failed to get workout count', error);
            return 0;
        }
    }

    /**
     * Get current streak
     * @returns {number} Current streak
     */
    getCurrentStreak() {
        try {
            // Simple streak calculation - can be enhanced
            const workoutCount = this.getWorkoutCount();
            return Math.min(workoutCount, 7); // Placeholder
        } catch (error) {
            this.logger.error('Failed to get streak', error);
            return 0;
        }
    }

    /**
     * Render detailed statistics (advanced mode)
     * @returns {string} Stats HTML
     */
    renderDetailedStats() {
        return `
            <div class="detailed-stats">
                <div class="stat-row">
                    <span class="stat-label">Total Volume:</span>
                    <span class="stat-value">${this.calculateTotalVolume()} kg</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Weekly Load:</span>
                    <span class="stat-value">${this.calculateWeeklyLoad()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Avg RPE:</span>
                    <span class="stat-value">${this.calculateAvgRPE()}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render AI insights (advanced mode)
     * @returns {string} Insights HTML
     */
    renderAIInsights() {
        return `
            <div class="ai-insights">
                <p style="color: #718096;">AI insights will appear here based on your training data.</p>
                <button onclick="if(window.CoachChat){window.CoachChat.openChat();}" class="btn-secondary" style="margin-top: 0.5rem;">
                    Chat with AI Coach
                </button>
            </div>
        `;
    }

    /**
     * Render Strava panel (advanced mode)
     * @returns {string} Strava panel HTML
     */
    renderStravaPanel() {
        return `
            <div class="strava-panel" style="background: white; border-radius: 8px; padding: 1.5rem;">
                <h3 style="margin-top: 0;">Strava Integration</h3>
                <p style="color: #718096; font-size: 0.875rem;">Connect your Strava account to automatically track activities.</p>
                <button onclick="window.Router?.navigate('#/integrations')" class="btn-secondary" style="margin-top: 0.5rem;">
                    Connect Strava
                </button>
            </div>
        `;
    }

    /**
     * Calculate total volume (placeholder)
     * @returns {number} Total volume
     */
    calculateTotalVolume() {
        // Placeholder - would calculate from actual workout data
        return 0;
    }

    /**
     * Calculate weekly load (placeholder)
     * @returns {string} Load value
     */
    calculateWeeklyLoad() {
        // Placeholder - would calculate from actual load data
        return 'N/A';
    }

    /**
     * Calculate average RPE (placeholder)
     * @returns {string} Average RPE
     */
    calculateAvgRPE() {
        // Placeholder - would calculate from actual RPE data
        return 'N/A';
    }
}

// Create global instance
window.AdaptiveDashboard = AdaptiveDashboard;

// Global helper
window.upgradeToAdvanced = function() {
    if (window.SimpleModeManager) {
        window.SimpleModeManager.setEnabled(false);
        // Refresh dashboard
        if (window.Router) {
            window.Router.navigate('#/dashboard', { replace: true });
        }
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdaptiveDashboard;
}

