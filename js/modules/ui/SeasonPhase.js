/**
 * SeasonPhase - Season phase tracking and display component
 * Manages and displays current training phase with persistent pill indicator
 */
class SeasonPhase {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.currentPhase = null;
        this.phaseStartDate = null;
        this.phaseEndDate = null;
        this.phaseHistory = [];
        
        this.initializePhase();
    }

    /**
     * Initialize season phase
     */
    initializePhase() {
        // Load from localStorage or set default
        const saved = this.loadFromStorage();
        
        if (saved && saved.currentPhase) {
            this.currentPhase = saved.currentPhase;
            this.phaseStartDate = saved.phaseStartDate;
            this.phaseEndDate = saved.phaseEndDate;
            this.phaseHistory = saved.phaseHistory || [];
        } else {
            // Default to off-season if no data
            this.setPhase('off-season');
        }

        // Update phase if expired
        this.checkPhaseExpiration();
    }

    /**
     * Set current phase
     * @param {string} phaseName - Phase name
     * @param {Object} options - Phase options
     */
    setPhase(phaseName, options = {}) {
        const phaseConfig = this.getPhaseConfig(phaseName);
        if (!phaseConfig) {
            this.logger.warn('Invalid phase:', phaseName);
            return;
        }

        const previousPhase = this.currentPhase ? { ...this.currentPhase } : null;

        this.currentPhase = {
            name: phaseName,
            config: phaseConfig,
            startDate: new Date().toISOString(),
            expectedDuration: phaseConfig.duration,
            trainingLoad: phaseConfig.trainingLoad,
            focus: phaseConfig.focus
        };

        this.phaseStartDate = new Date();
        this.phaseEndDate = this.calculatePhaseEndDate(phaseConfig.duration);

        // Save previous phase to history
        if (previousPhase) {
            this.phaseHistory.push({
                ...previousPhase,
                endDate: this.phaseStartDate
            });
        }

        this.saveToStorage();
        this.updateUIDisplay();
        this.emitPhaseChange();

        this.logger.audit('SEASON_PHASE_CHANGED', {
            phase: phaseName,
            startDate: this.phaseStartDate,
            endDate: this.phaseEndDate
        });
    }

    /**
     * Get phase configuration
     * @param {string} phaseName - Phase name
     * @returns {Object|null} Phase configuration
     */
    getPhaseConfig(phaseName) {
        const phases = {
            'off-season': {
                label: 'Off-Season',
                emoji: '🏔️',
                color: '#3b82f6',
                duration: '12-16 weeks',
                trainingLoad: 'high',
                focus: 'strength_power_development',
                description: 'Building strength and power'
            },
            'pre-season': {
                label: 'Pre-Season',
                emoji: '🔥',
                color: '#f59e0b',
                duration: '6-8 weeks',
                trainingLoad: 'very_high',
                focus: 'sport_specific_preparation',
                description: 'Preparing for competition'
            },
            'in-season': {
                label: 'In-Season',
                emoji: '⚡',
                color: '#10b981',
                duration: '24-36 weeks',
                trainingLoad: 'moderate',
                focus: 'performance_maintenance',
                description: 'Competition season'
            },
            'post-season': {
                label: 'Recovery',
                emoji: '😌',
                color: '#8b5cf6',
                duration: '2-4 weeks',
                trainingLoad: 'low',
                focus: 'recovery_regeneration',
                description: 'Rest and recovery'
            }
        };

        return phases[phaseName] || null;
    }

    /**
     * Calculate phase end date
     * @param {string} duration - Duration string
     * @returns {Date} End date
     */
    calculatePhaseEndDate(duration) {
        const match = duration.match(/(\d+)-(\d+) weeks/);
        if (!match) {
            return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // Default 2 weeks
        }

        const weeks = parseInt(match[2] || match[1]);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (weeks * 7));

        return endDate;
    }

    /**
     * Check if current phase has expired
     */
    checkPhaseExpiration() {
        if (!this.phaseEndDate) return;

        if (new Date() > this.phaseEndDate) {
            // Phase expired, suggest next phase
            this.suggestNextPhase();
        }
    }

    /**
     * Suggest next phase based on current phase
     */
    suggestNextPhase() {
        const phaseTransitions = {
            'off-season': 'pre-season',
            'pre-season': 'in-season',
            'in-season': 'post-season',
            'post-season': 'off-season'
        };

        const currentPhaseName = this.currentPhase?.name || 'off-season';
        const nextPhase = phaseTransitions[currentPhaseName] || 'off-season';

        this.logger.info('Phase expired, suggesting next phase:', nextPhase);

        // Show notification or prompt user to update phase
        if (window.DashboardHero) {
            // Could trigger a UI notification here
            this.logger.debug('Current phase expired, should update to:', nextPhase);
        }
    }

    /**
     * Get current phase
     * @returns {Object|null} Current phase
     */
    getCurrentPhase() {
        return this.currentPhase;
    }

    /**
     * Get phase badge HTML
     * @returns {string} Badge HTML
     */
    renderBadge() {
        if (!this.currentPhase) {
            return '';
        }

        const config = this.currentPhase.config;
        
        return `
            <div class="season-phase-pill" style="--phase-color: ${config.color}">
                <span class="phase-emoji">${config.emoji}</span>
                <span class="phase-label">${config.label}</span>
            </div>
        `;
    }

    /**
     * Update UI display
     */
    updateUIDisplay() {
        // Update header pill
        const headerPill = document.querySelector('.season-phase-pill');
        if (headerPill) {
            headerPill.outerHTML = this.renderBadge();
        }

        // Update any season phase indicators
        const indicators = document.querySelectorAll('.season-phase-indicator');
        indicators.forEach(indicator => {
            indicator.innerHTML = this.renderBadge();
        });

        // Update hero section if present
        const hero = document.querySelector('.dashboard-hero');
        if (hero && window.DashboardHero) {
            // Trigger hero update
            window.DashboardHero.update({ phase: this.currentPhase });
        }
    }

    /**
     * Emit phase change event
     */
    emitPhaseChange() {
        const event = new CustomEvent('phase:changed', {
            detail: {
                phase: this.currentPhase,
                startDate: this.phaseStartDate,
                endDate: this.phaseEndDate
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Load from localStorage
     * @returns {Object|null} Saved phase data
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('ignitefitness_season_phase');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            this.logger.error('Failed to load season phase', error);
            return null;
        }
    }

    /**
     * Save to localStorage
     */
    saveToStorage() {
        try {
            const data = {
                currentPhase: this.currentPhase,
                phaseStartDate: this.phaseStartDate,
                phaseEndDate: this.phaseEndDate,
                phaseHistory: this.phaseHistory
            };
            localStorage.setItem('ignitefitness_season_phase', JSON.stringify(data));
        } catch (error) {
            this.logger.error('Failed to save season phase', error);
        }
    }

    /**
     * Get phase progress percentage
     * @returns {number} Progress percentage
     */
    getProgressPercentage() {
        if (!this.phaseStartDate || !this.phaseEndDate) {
            return 0;
        }

        const total = this.phaseEndDate - this.phaseStartDate;
        const elapsed = Date.now() - this.phaseStartDate.getTime();
        
        return Math.min(100, Math.max(0, (elapsed / total) * 100));
    }

    /**
     * Get remaining days in phase
     * @returns {number} Remaining days
     */
    getRemainingDays() {
        if (!this.phaseEndDate) {
            return 0;
        }

        const remaining = this.phaseEndDate - new Date();
        return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
    }

    /**
     * Get phase history
     * @returns {Array} Phase history
     */
    getPhaseHistory() {
        return [...this.phaseHistory];
    }
}

// Create global instance
window.SeasonPhase = new SeasonPhase();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeasonPhase;
}
