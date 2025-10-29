/**
 * DashboardHero - Dashboard hero section component
 * Displays user greeting, current training phase, and quick actions
 */
class DashboardHero {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.authManager = window.AuthManager;
        this.seasonPhase = window.SeasonPhase;
    }

    /**
     * Render dashboard hero section
     * @returns {HTMLElement} Hero section
     */
    render() {
        const username = this.authManager?.getCurrentUsername() || 'Athlete';
        const currentPhase = this.seasonPhase?.getCurrentPhase() || null;
        const userSport = this.getUserSport();
        
        const hero = document.createElement('section');
        hero.className = 'dashboard-hero';
        
        // Get readiness data (may be null if no check-in)
        const recoverySummary = window.RecoverySummary;
        const readinessData = recoverySummary?.getTodayReadiness();
        
        // Handle null readiness - don't show circle if no data
        const readinessCircleHTML = readinessData 
            ? `<div class="readiness-circle" 
                     style="--readiness-color: ${readinessData.color}"
                     role="status"
                     aria-label="Readiness score ${readinessData.score} out of 10: ${this.getReadinessDescription(readinessData.score)}"
                     title="${this.getReadinessDescription(readinessData.score)}">
                    <div class="readiness-value">${readinessData.score}</div>
                    <div class="readiness-label">Readiness</div>
                </div>`
            : '<div class="readiness-placeholder" style="padding: 1rem; text-align: center; color: #6c757d; font-size: 0.875rem;">Complete daily check-in to see readiness</div>';
        
        hero.innerHTML = `
            <div class="hero-content">
                <div class="hero-greeting">
                    <h1 class="hero-title">Welcome back!</h1>
                    <p class="hero-username">${username}</p>
                </div>
                
                <!-- Readiness Circle -->
                ${readinessCircleHTML}
                
                ${currentPhase ? this.renderSeasonPhase(currentPhase) : ''}
            </div>
            
            <div class="hero-quick-actions">
                <button class="action-card" data-route="#/workouts">
                    <div class="action-icon">💪</div>
                    <div class="action-label">Start Workout</div>
                </button>
                
                <button class="action-card" data-route="#/progress">
                    <div class="action-icon">📊</div>
                    <div class="action-label">View Progress</div>
                </button>
                
                <button class="action-card" data-route="#/sport">
                    <div class="action-icon">⚽</div>
                    <div class="action-label">Training</div>
                </button>
            </div>
        `;
        
        // Add click handlers
        hero.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => {
                const route = card.dataset.route;
                if (window.Router) {
                    window.Router.navigate(route);
                }
            });
        });
        
        return hero;
    }

    /**
     * Render season phase badge
     * @param {Object} phase - Season phase data
     * @returns {string} Season phase HTML
     */
    renderSeasonPhase(phase) {
        const phaseConfig = {
            'off-season': { label: 'Off-Season', color: '#3b82f6', icon: '🏔️' },
            'pre-season': { label: 'Pre-Season', color: '#f59e0b', icon: '🔥' },
            'in-season': { label: 'In-Season', color: '#10b981', icon: '⚡' },
            'post-season': { label: 'Recovery', color: '#8b5cf6', icon: '😌' }
        };
        
        const config = phaseConfig[phase.name] || phaseConfig['off-season'];
        
        return `
            <div class="season-phase-badge" style="--phase-color: ${config.color}">
                <span class="phase-icon">${config.icon}</span>
                <span class="phase-label">${config.label}</span>
            </div>
        `;
    }

    /**
     * Get human-readable description of readiness score
     * @param {number} score - Readiness score (1-10)
     * @returns {string} Description
     */
    getReadinessDescription(score) {
        if (!score || score === null || score === undefined) {
            return 'No data - Complete daily check-in for accurate readiness';
        }
        
        if (score >= 8 && score <= 10) {
            return `Excellent (${score}/10) - Ready for full intensity training`;
        } else if (score >= 5 && score <= 7) {
            return `Moderate (${score}/10) - Reduce intensity by 10%. Take it easy.`;
        } else if (score >= 1 && score <= 4) {
            return `Low (${score}/10) - Recovery session recommended. Rest day or light movement only.`;
        } else {
            return `Score ${score}/10`;
        }
    }

    /**
     * Get user's sport
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
     * Update hero content
     * @param {Object} updates - Updates to apply
     */
    update(updates) {
        const hero = document.querySelector('.dashboard-hero');
        if (!hero) return;

        if (updates.username) {
            const usernameEl = hero.querySelector('.hero-username');
            if (usernameEl) {
                usernameEl.textContent = updates.username;
            }
        }

        if (updates.phase) {
            const phaseContainer = hero.querySelector('.season-phase-badge');
            if (phaseContainer) {
                phaseContainer.outerHTML = this.renderSeasonPhase(updates.phase);
            }
        }
    }
}

// Create global instance
window.DashboardHero = new DashboardHero();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardHero;
}
