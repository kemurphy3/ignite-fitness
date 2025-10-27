/**
 * PeriodizationView - UI component for periodization planning
 * Displays phase pill, progress bar, and calendar with game dates
 */
class PeriodizationView {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.seasonalPrograms = window.SeasonalPrograms;
        this.eventBus = window.EventBus;
        
        this.currentPhase = null;
        this.periodizationData = null;
    }

    /**
     * Render periodization view
     * @returns {HTMLElement} Periodization view
     */
    render() {
        const view = document.createElement('div');
        view.className = 'periodization-view';
        
        this.loadPeriodizationData();
        
        view.innerHTML = `
            <div class="periodization-header">
                <h1>Training Plan</h1>
                <button class="btn-secondary" onclick="window.PeriodizationView.toggleCalendar()">
                    📅 Manage Games
                </button>
            </div>
            
            <!-- Phase Display -->
            <div class="phase-display">
                ${this.renderPhasePill()}
                ${this.renderProgressBar()}
            </div>
            
            <!-- Training Blocks -->
            <div class="training-blocks">
                ${this.renderTrainingBlocks()}
            </div>
            
            <!-- Recommendations -->
            <div class="periodization-recommendations">
                ${this.renderRecommendations()}
            </div>
        `;
        
        return view;
    }

    /**
     * Render phase pill
     * @returns {string} Phase pill HTML
     */
    renderPhasePill() {
        const phase = this.currentPhase || { name: 'Unknown', color: '#6c757d' };
        
        return `
            <div class="phase-pill" style="--phase-color: ${phase.color}">
                <span class="phase-emoji">${phase.emoji || '⚙️'}</span>
                <span class="phase-label">${phase.name}</span>
                <span class="phase-subtitle">${phase.duration || ''}</span>
            </div>
        `;
    }

    /**
     * Render progress bar
     * @returns {string} Progress bar HTML
     */
    renderProgressBar() {
        if (!this.periodizationData) {
            return '<div class="progress-placeholder">No periodization data</div>';
        }
        
        const progress = this.periodizationData.summary?.phaseProgress || {
            percentage: 0,
            currentWeek: 0,
            totalWeeks: 0
        };
        
        return `
            <div class="progress-section">
                <div class="progress-header">
                    <span class="progress-label">Phase Progress</span>
                    <span class="progress-percentage">${progress.percentage.toFixed(0)}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress.percentage}%"></div>
                </div>
                <div class="progress-text">
                    Week ${progress.currentWeek} of ${progress.totalWeeks}
                </div>
            </div>
        `;
    }

    /**
     * Render training blocks
     * @returns {string} Training blocks HTML
     */
    renderTrainingBlocks() {
        if (!this.periodizationData || !this.periodizationData.blocks) {
            return '<div class="blocks-placeholder">Generating training blocks...</div>';
        }
        
        return `
            <div class="blocks-container">
                ${this.periodizationData.blocks.map((block, index) => `
                    <div class="training-block" data-block="${index + 1}">
                        <div class="block-header">
                            <h3>Block ${block.blockNumber}</h3>
                            <span class="block-phase">${block.phase}</span>
                        </div>
                        <div class="weeks-container">
                            ${block.weeks.map((week, wIndex) => this.renderWeek(week, wIndex + 1)).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render week
     * @param {Object} week - Week data
     * @param {number} weekNumber - Week number
     * @returns {string} Week HTML
     */
    renderWeek(week, weekNumber) {
        const isDeload = week.isDeload;
        const hasTaper = week.taper;
        const hasGame = week.gameConflict;
        
        let className = 'week';
        if (isDeload) className += ' deload';
        if (hasTaper) className += ' taper';
        if (hasGame) className += ' game';
        
        return `
            <div class="${className}">
                <div class="week-number">W${weekNumber}</div>
                <div class="week-load">
                    ${isDeload ? '🔄 Deload' : hasTaper ? '📉 Taper' : '💪 Normal'}
                </div>
                <div class="week-volume">Vol: ${(week.volumeMultiplier * 100).toFixed(0)}%</div>
                <div class="week-intensity">Int: ${(week.intensityMultiplier * 100).toFixed(0)}%</div>
                ${hasTaper && week.reason ? `<div class="week-reason">${week.reason}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render recommendations
     * @returns {string} Recommendations HTML
     */
    renderRecommendations() {
        if (!this.periodizationData || !this.periodizationData.summary?.recommendations) {
            return '';
        }
        
        return `
            <div class="recommendations-header">
                <h3>💡 Recommendations</h3>
            </div>
            <ul class="recommendations-list">
                ${this.periodizationData.summary.recommendations.map(rec => `
                    <li>${rec}</li>
                `).join('')}
            </ul>
        `;
    }

    /**
     * Load periodization data
     */
    loadPeriodizationData() {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();
            
            if (!userId) return;
            
            // Get current season phase
            const seasonPhase = window.SeasonPhase?.getCurrentPhase();
            if (seasonPhase) {
                this.currentPhase = {
                    name: seasonPhase.config.label,
                    emoji: seasonPhase.config.emoji,
                    color: seasonPhase.config.color,
                    duration: seasonPhase.currentPhase?.expectedDuration
                };
            }
            
            // Generate periodization plan
            const sport = this.getUserSport();
            const season = seasonPhase?.name || 'off-season';
            
            const periodization = this.generatePeriodization(sport, season);
            this.periodizationData = periodization;
            
        } catch (error) {
            this.logger.error('Failed to load periodization data', error);
        }
    }

    /**
     * Generate periodization plan
     * @param {string} sport - Sport type
     * @param {string} season - Season phase
     * @returns {Object} Periodization plan
     */
    generatePeriodization(sport, season) {
        // Use seasonal programs if available
        if (this.seasonalPrograms) {
            const phase = this.seasonalPrograms.getSeasonalPhase(sport, season);
            if (phase) {
                return this.generateBlocksFromPhase(phase);
            }
        }
        
        // Fallback generation
        return this.generateBasicPeriodization(sport, season);
    }

    /**
     * Generate blocks from phase
     * @param {Object} phase - Phase configuration
     * @returns {Object} Periodization plan
     */
    generateBlocksFromPhase(phase) {
        const blocks = [];
        const totalBlocks = this.calculateTotalBlocks(phase.duration);
        
        for (let i = 1; i <= totalBlocks; i++) {
            const block = this.seasonalPrograms.generateMicrocycle(phase, i);
            blocks.push(block);
        }
        
        return {
            sport: 'soccer',
            season: phase.name,
            blocks,
            summary: {
                totalWeeks: totalBlocks * 4,
                phaseProgress: {
                    percentage: 0,
                    currentWeek: 1,
                    totalWeeks: totalBlocks * 4
                }
            }
        };
    }

    /**
     * Calculate total blocks from duration
     * @param {string} duration - Duration string
     * @returns {number} Total blocks
     */
    calculateTotalBlocks(duration) {
        const match = duration.match(/(\d+)-(\d+)\s*weeks/);
        if (match) {
            const weeks = parseInt(match[2] || match[1]);
            return Math.ceil(weeks / 4);
        }
        return 3; // Default 3 blocks
    }

    /**
     * Generate basic periodization
     * @param {string} sport - Sport type
     * @param {string} season - Season phase
     * @returns {Object} Basic periodization
     */
    generateBasicPeriodization(sport, season) {
        return {
            sport,
            season,
            blocks: [],
            summary: {
                totalWeeks: 12,
                phaseProgress: { percentage: 0, currentWeek: 1, totalWeeks: 12 }
            }
        };
    }

    /**
     * Get user sport
     * @returns {string} Sport ID
     */
    getUserSport() {
        try {
            const username = this.authManager?.getCurrentUsername();
            if (!username) return 'soccer';

            const users = JSON.parse(localStorage.getItem('ignitefitness_users') || '{}');
            const user = users[username];
            if (!user) return 'soccer';

            return user.onboardingData?.sport?.id || 'soccer';
        } catch (error) {
            return 'soccer';
        }
    }

    /**
     * Toggle calendar view
     */
    toggleCalendar() {
        this.logger.debug('Toggle calendar view');
        // TODO: Implement calendar modal
    }

    /**
     * Sync with load management and readiness
     */
    syncWithLoadManagement() {
        // Listen for readiness updates
        this.eventBus.on(this.eventBus.TOPICS.READINESS_UPDATED, (data) => {
            this.updateBasedOnReadiness(data);
        });
        
        // Listen for load changes
        this.eventBus.on('load:management_updated', (data) => {
            this.updateBasedOnLoad(data);
        });
    }

    /**
     * Update based on readiness
     * @param {Object} data - Readiness data
     */
    updateBasedOnReadiness(data) {
        // Adjust periodization based on readiness scores
        // Reduce volume/intensity if readiness consistently low
    }

    /**
     * Update based on load
     * @param {Object} data - Load data
     */
    updateBasedOnLoad(data) {
        // Adjust periodization based on load trends
    }
}

// Create global instance
window.PeriodizationView = new PeriodizationView();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PeriodizationView;
}
