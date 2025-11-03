/**
 * DashboardRenderer - Personalized dashboard based on user preferences
 * Renders different dashboard modes based on data preference and role
 */
class DashboardRenderer {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.onboardingManager = window.OnboardingManager;
        this.authManager = window.AuthManager;
        this.workoutTracker = window.WorkoutTracker;
        this.coachingEngine = window.CoachingEngine;
        
        this.dashboardModes = {
            basics: this.createBasicsMode(),
            some_metrics: this.createSomeMetricsMode(),
            all_data: this.createAllDataMode()
        };
    }

    /**
     * Create basics mode configuration
     * @returns {Object} Basics mode config
     */
    createBasicsMode() {
        return {
            name: 'Basics',
            description: 'Simple metrics and next workout',
            components: {
                nextWorkout: { show: true, simple: true },
                weeklyStreak: { show: true, simple: true },
                lastWorkoutSummary: { show: true, simple: true },
                progressCharts: { show: false },
                weeklyLoad: { show: false },
                strengthGains: { show: false },
                rpeInput: { show: false },
                loadCalculations: { show: false },
                detailedAnalytics: { show: false },
                periodization: { show: false }
            },
            inputs: {
                simple: true,
                advanced: false
            },
            language: 'simple'
        };
    }

    /**
     * Create some metrics mode configuration
     * @returns {Object} Some metrics mode config
     */
    createSomeMetricsMode() {
        return {
            name: 'Some Metrics',
            description: 'Progress charts and weekly load',
            components: {
                nextWorkout: { show: true, simple: false },
                weeklyStreak: { show: true, simple: false },
                lastWorkoutSummary: { show: true, simple: false },
                progressCharts: { show: true, simplified: true },
                weeklyLoad: { show: true, simplified: true },
                strengthGains: { show: true, simplified: true },
                rpeInput: { show: true, withTooltips: true },
                loadCalculations: { show: false },
                detailedAnalytics: { show: false },
                periodization: { show: false }
            },
            inputs: {
                simple: false,
                advanced: false
            },
            language: 'accessible'
        };
    }

    /**
     * Create all data mode configuration
     * @returns {Object} All data mode config
     */
    createAllDataMode() {
        return {
            name: 'All Data',
            description: 'Detailed analytics and load management',
            components: {
                nextWorkout: { show: true, simple: false },
                weeklyStreak: { show: true, simple: false },
                lastWorkoutSummary: { show: true, simple: false },
                progressCharts: { show: true, simplified: false },
                weeklyLoad: { show: true, simplified: false },
                strengthGains: { show: true, simplified: false },
                rpeInput: { show: true, withTooltips: true },
                loadCalculations: { show: true },
                detailedAnalytics: { show: true },
                periodization: { show: true }
            },
            inputs: {
                simple: false,
                advanced: true
            },
            language: 'technical'
        };
    }

    /**
     * Render personalized dashboard
     * @returns {Object} Render result
     */
    renderDashboard() {
        try {
            const dashboardMode = this.onboardingManager?.getDashboardMode() || 'some_metrics';
            const userRole = this.onboardingManager?.getUserRole() || 'athlete';
            
            const config = this.dashboardModes[dashboardMode];
            if (!config) {
                this.logger.error('Invalid dashboard mode', { mode: dashboardMode });
                return { success: false, error: 'Invalid dashboard mode' };
            }

            // Render dashboard based on mode and role
            const dashboardHTML = this.generateDashboardHTML(config, userRole);
            this.updateDashboardUI(dashboardHTML);
            
            this.logger.debug('Dashboard rendered', { 
                mode: dashboardMode, 
                role: userRole 
            });
            this.eventBus?.emit('dashboard:rendered', { mode: dashboardMode, role: userRole });
            
            return { success: true, mode: dashboardMode, role: userRole };
        } catch (error) {
            this.logger.error('Failed to render dashboard', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate dashboard HTML based on configuration
     * @param {Object} config - Dashboard configuration
     * @param {string} role - User role
     * @returns {string} Dashboard HTML
     */
    generateDashboardHTML(config, role) {
        const isCoach = role === 'coach';
        const user = this.authManager?.getCurrentUser();
        const recentWorkouts = this.workoutTracker?.getWorkoutHistory(5) || [];
        
        let html = `
            <div class="dashboard-container" data-mode="${config.name.toLowerCase()}">
                <div class="dashboard-header">
                    <h2>Welcome back, ${user?.athleteName || user?.username || 'Athlete'}!</h2>
                    <div class="dashboard-mode-indicator">
                        <span class="mode-badge">${config.name}</span>
                        ${isCoach ? '<span class="role-badge">Coach</span>' : ''}
                    </div>
                </div>
                
                <div class="dashboard-grid">
        `;

        // Next Workout Section
        if (config.components.nextWorkout.show) {
            html += this.generateNextWorkoutSection(config.components.nextWorkout, isCoach);
        }

        // Weekly Streak Section
        if (config.components.weeklyStreak.show) {
            html += this.generateWeeklyStreakSection(config.components.weeklyStreak);
        }

        // Last Workout Summary
        if (config.components.lastWorkoutSummary.show) {
            html += this.generateLastWorkoutSection(recentWorkouts[0], config.components.lastWorkoutSummary);
        }

        // Progress Charts
        if (config.components.progressCharts.show) {
            html += this.generateProgressChartsSection(config.components.progressCharts);
        }

        // Weekly Load
        if (config.components.weeklyLoad.show) {
            html += this.generateWeeklyLoadSection(config.components.weeklyLoad);
        }

        // Strength Gains
        if (config.components.strengthGains.show) {
            html += this.generateStrengthGainsSection(config.components.strengthGains);
        }

        // RPE Input
        if (config.components.rpeInput.show) {
            html += this.generateRPEInputSection(config.components.rpeInput);
        }

        // Load Calculations
        if (config.components.loadCalculations.show) {
            html += this.generateLoadCalculationsSection();
        }

        // Detailed Analytics
        if (config.components.detailedAnalytics.show) {
            html += this.generateDetailedAnalyticsSection();
        }

        // Periodization
        if (config.components.periodization.show) {
            html += this.generatePeriodizationSection();
        }

        // Coach-specific sections
        if (isCoach) {
            html += this.generateCoachSections();
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Generate next workout section
     * @param {Object} config - Component configuration
     * @param {boolean} isCoach - Is user a coach
     * @returns {string} HTML section
     */
    generateNextWorkoutSection(config, isCoach) {
        const simple = config.simple;
        
        // Get today's workout plan
        const todaysPlan = this.getTodaysWorkoutPlan();
        
        return `
            <div class="dashboard-card next-workout">
                <h3>${isCoach ? 'Next Training Session' : 'Next Workout'}</h3>
                ${simple ? 
                    '<p>Ready for your next session? Let\'s get started!</p>' :
                    '<p>Your next workout is scheduled. Review the plan and prepare for success.</p>'
                }
                
                ${todaysPlan ? this.generateWorkoutPreview(todaysPlan, simple) : ''}
                
                <div class="workout-actions">
                    <button class="btn primary" onclick="startWorkout()">Start Workout</button>
                    ${!simple ? '<button class="btn secondary" onclick="viewWorkoutPlan()">View Plan</button>' : ''}
                </div>
            </div>
        `;
    }

    /**
     * Generate workout preview card
     * @param {Object} plan - Workout plan
     * @param {boolean} simple - Simple mode
     * @returns {string} HTML preview
     */
    generateWorkoutPreview(plan, simple) {
        const duration = this.calculateWorkoutDuration(plan);
        const exerciseCount = this.countExercises(plan);
        const focus = this.getWorkoutFocus(plan);
        const equipment = this.getRequiredEquipment(plan);
        
        return `
            <div class="workout-preview">
                <div class="preview-header">
                    <h4>Today's Workout</h4>
                </div>
                <div class="preview-details">
                    <div class="preview-item">
                        <span class="preview-icon">⏱</span>
                        <span class="preview-label">Duration:</span>
                        <span class="preview-value">${duration} min</span>
                    </div>
                    <div class="preview-item">
                        <span class="preview-icon">💪</span>
                        <span class="preview-label">Exercises:</span>
                        <span class="preview-value">${exerciseCount}</span>
                    </div>
                    <div class="preview-item">
                        <span class="preview-icon">🎯</span>
                        <span class="preview-label">Focus:</span>
                        <span class="preview-value">${focus}</span>
                    </div>
                    ${equipment.length > 0 ? `
                        <div class="preview-item">
                            <span class="preview-icon">🏋️</span>
                            <span class="preview-label">Equipment:</span>
                            <span class="preview-value">${equipment.join(', ')}</span>
                        </div>
                    ` : ''}
                </div>
                ${!simple ? `
                    <div class="preview-summary">
                        <p>${this.getWorkoutSummary(plan)}</p>
                    </div>
                ` : ''}
                
                ${this.renderPlanNotes(plan, simple)}
            </div>
        `;
    }

    /**
     * Render plan notes including recovery day notifications
     * @param {Object} plan - Workout plan
     * @param {boolean} simple - Simple mode
     * @returns {string} HTML for plan notes
     */
    renderPlanNotes(plan, simple) {
        if (!plan.notes || !Array.isArray(plan.notes)) {
            return '';
        }

        let notesHTML = '';
        
        plan.notes.forEach(note => {
            // Check for recovery day override notification
            if (note.source === 'recovery_simple_mode' && note.overrideAvailable) {
                notesHTML += `
                    <div class="plan-notification recovery-day-notification" data-note-id="${note.source}">
                        <div class="notification-content">
                            <span class="notification-icon">🛌</span>
                            <div class="notification-text">
                                <strong>${note.text}</strong>
                                ${note.overrideMessage ? `<small>${note.overrideMessage}</small>` : ''}
                            </div>
                        </div>
                        <button class="btn btn-small btn-secondary" onclick="window.handleRecoveryDayOverride('${note.source}')" aria-label="Prefer normal workout">
                            Prefer Normal Workout
                        </button>
                    </div>
                `;
            } else {
                // Regular note
                notesHTML += `
                    <div class="plan-note plan-note-${note.source || 'default'}" data-note-id="${note.source || 'default'}">
                        <span class="note-icon">${this.getNoteIcon(note.source)}</span>
                        <span class="note-text">${note.text || note}</span>
                    </div>
                `;
            }
        });

        return notesHTML ? `<div class="plan-notes">${notesHTML}</div>` : '';
    }

    /**
     * Get icon for note source
     * @param {string} source - Note source
     * @returns {string} Icon emoji
     */
    getNoteIcon(source) {
        const icons = {
            'load': '⚖️',
            'recovery_simple_mode': '🛌',
            'mode': '🎯',
            'time': '⏱️',
            'readiness': '💪',
            'default': 'ℹ️'
        };
        return icons[source] || icons.default;
    }

    /**
     * Get today's workout plan
     * @returns {Object|null} Workout plan
     */
    getTodaysWorkoutPlan() {
        // This would integrate with the actual workout planning system
        // For now, return a sample plan
        return {
            blocks: [
                {
                    name: 'Warm-up',
                    items: [
                        { name: 'Dynamic Warm-up', sets: 1, reps: '5-10 min' }
                    ]
                },
                {
                    name: 'Main Work',
                    items: [
                        { name: 'Squats', sets: 3, reps: '8-12' },
                        { name: 'Bench Press', sets: 3, reps: '8-12' },
                        { name: 'Rows', sets: 3, reps: '8-12' }
                    ]
                },
                {
                    name: 'Accessories',
                    items: [
                        { name: 'Planks', sets: 3, reps: '30-60s' },
                        { name: 'Lunges', sets: 2, reps: '10 each' }
                    ]
                }
            ],
            focus: 'Upper body strength',
            equipment: ['Barbell', 'Bench', 'Plates']
        };
    }

    /**
     * Calculate workout duration
     * @param {Object} plan - Workout plan
     * @returns {number} Duration in minutes
     */
    calculateWorkoutDuration(plan) {
        if (!plan || !plan.blocks) return 35;
        
        let totalMinutes = 0;
        plan.blocks.forEach(block => {
            if (block.items) {
                totalMinutes += block.items.length * 8; // ~8 min per exercise
            }
        });
        
        return Math.max(30, totalMinutes);
    }

    /**
     * Count exercises in plan
     * @param {Object} plan - Workout plan
     * @returns {number} Exercise count
     */
    countExercises(plan) {
        if (!plan || !plan.blocks) return 6;
        
        let count = 0;
        plan.blocks.forEach(block => {
            if (block.items) {
                count += block.items.length;
            }
        });
        
        return count;
    }

    /**
     * Get workout focus
     * @param {Object} plan - Workout plan
     * @returns {string} Focus description
     */
    getWorkoutFocus(plan) {
        return plan?.focus || 'Full body strength';
    }

    /**
     * Get required equipment
     * @param {Object} plan - Workout plan
     * @returns {Array} Equipment list
     */
    getRequiredEquipment(plan) {
        return plan?.equipment || ['Barbell', 'Dumbbells'];
    }

    /**
     * Get workout summary
     * @param {Object} plan - Workout plan
     * @returns {string} Summary text
     */
    getWorkoutSummary(plan) {
        if (!plan || !plan.blocks) {
            return 'A balanced workout focusing on strength and conditioning.';
        }
        
        const hasStrength = plan.blocks.some(block => 
            block.items?.some(item => 
                ['squat', 'deadlift', 'press', 'row'].some(movement => 
                    item.name.toLowerCase().includes(movement)
                )
            )
        );
        
        if (hasStrength) {
            return 'Strength-focused session with compound movements and accessories.';
        }
        
        return 'Balanced workout combining strength, conditioning, and mobility.';
    }

    /**
     * Generate weekly streak section
     * @param {Object} config - Component configuration
     * @returns {string} HTML section
     */
    generateWeeklyStreakSection(config) {
        const streak = this.calculateWeeklyStreak();
        
        return `
            <div class="dashboard-card weekly-streak">
                <h3>Weekly Streak</h3>
                <div class="streak-display">
                    <span class="streak-number">${streak}</span>
                    <span class="streak-label">days</span>
                </div>
                ${config.simple ? 
                    '<p>Keep up the great work! <small>(Placeholder data - will update when workouts are logged)</small></p>' :
                    '<p>Your consistency is building momentum. Maintain this rhythm for optimal results.</p><p style="color: #718096; font-size: 12px; margin-top: 8px;">📝 Note: Streak data will populate as you log workouts</p>'
                }
            </div>
        `;
    }

    /**
     * Generate last workout section
     * @param {Object} lastWorkout - Last workout data
     * @param {Object} config - Component configuration
     * @returns {string} HTML section
     */
    generateLastWorkoutSection(lastWorkout, config) {
        if (!lastWorkout) {
            return `
                <div class="dashboard-card last-workout">
                    <h3>Last Workout</h3>
                    <p>No recent workouts. Start your fitness journey today!</p>
                </div>
            `;
        }

        const simple = config.simple;
        const date = new Date(lastWorkout.startTime).toLocaleDateString();
        
        return `
            <div class="dashboard-card last-workout">
                <h3>Last Workout</h3>
                <div class="workout-summary">
                    <div class="workout-date">${date}</div>
                    <div class="workout-duration">${lastWorkout.duration || 0} minutes</div>
                    ${!simple ? `
                        <div class="workout-exercises">${lastWorkout.exercises?.length || 0} exercises</div>
                        <div class="workout-type">${lastWorkout.type || 'General'}</div>
                    ` : ''}
                </div>
                ${simple ? 
                    '<p>Great job on your last session!</p>' :
                    '<p>Excellent work on your previous training. Ready for the next challenge?</p>'
                }
            </div>
        `;
    }

    /**
     * Generate progress charts section
     * @param {Object} config - Component configuration
     * @returns {string} HTML section
     */
    generateProgressChartsSection(config) {
        const simplified = config.simplified;
        
        return `
            <div class="dashboard-card progress-charts">
                <h3>Progress Charts</h3>
                ${simplified ? 
                    '<div class="chart-placeholder">📈 Your progress over time</div>' :
                    '<div class="chart-container"><canvas id="progressChart"></canvas></div>'
                }
                <p>Track your improvement and stay motivated!</p>
            </div>
        `;
    }

    /**
     * Generate weekly load section
     * @param {Object} config - Component configuration
     * @returns {string} HTML section
     */
    generateWeeklyLoadSection(config) {
        const simplified = config.simplified;
        const weeklyLoad = this.calculateWeeklyLoad();
        
        return `
            <div class="dashboard-card weekly-load">
                <h3>Weekly Training Load</h3>
                <div class="load-display">
                    <span class="load-number">${weeklyLoad}</span>
                    <span class="load-unit">${simplified ? 'units' : 'arbitrary units'}</span>
                </div>
                ${simplified ? 
                    '<p>Your training intensity this week</p>' :
                    '<p>Training load represents the total stress from your workouts. Monitor for optimal recovery.</p>'
                }
            </div>
        `;
    }

    /**
     * Generate strength gains section
     * @param {Object} config - Component configuration
     * @returns {string} HTML section
     */
    generateStrengthGainsSection(config) {
        const simplified = config.simplified;
        
        return `
            <div class="dashboard-card strength-gains">
                <h3>Strength Gains</h3>
                ${simplified ? 
                    '<div class="gains-summary">📈 Improving across all lifts</div>' :
                    '<div class="gains-detail">Detailed strength progression analysis</div>'
                }
                <p>Your strength is building consistently!</p>
            </div>
        `;
    }

    /**
     * Generate RPE input section
     * @param {Object} config - Component configuration
     * @returns {string} HTML section
     */
    generateRPEInputSection(config) {
        const withTooltips = config.withTooltips;
        
        return `
            <div class="dashboard-card rpe-input">
                <h3>Rate of Perceived Exertion</h3>
                ${withTooltips ? 
                    '<p>Rate how hard your workout felt (1-10 scale)</p>' :
                    '<p>How hard was your last workout?</p>'
                }
                <div class="rpe-scale">
                    ${Array.from({length: 10}, (_, i) => i + 1).map(rpe => `
                        <button class="rpe-button" data-rpe="${rpe}">${rpe}</button>
                    `).join('')}
                </div>
                ${withTooltips ? 
                    '<div class="rpe-tooltip">1 = Very Easy, 10 = Maximum Effort</div>' :
                    ''
                }
            </div>
        `;
    }

    /**
     * Generate load calculations section
     * @returns {string} HTML section
     */
    generateLoadCalculationsSection() {
        return `
            <div class="dashboard-card load-calculations">
                <h3>Load Calculations</h3>
                <div class="load-metrics">
                    <div class="metric">
                        <span class="metric-label">Acute Load</span>
                        <span class="metric-value">45</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Chronic Load</span>
                        <span class="metric-value">42</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">ACWR</span>
                        <span class="metric-value">1.07</span>
                    </div>
                </div>
                <p>Monitor training load to optimize performance and prevent overtraining.</p>
            </div>
        `;
    }

    /**
     * Generate detailed analytics section
     * @returns {string} HTML section
     */
    generateDetailedAnalyticsSection() {
        return `
            <div class="dashboard-card detailed-analytics">
                <h3>Detailed Analytics</h3>
                <div class="analytics-grid">
                    <div class="analytics-item">
                        <h4>Volume Progression</h4>
                        <div class="chart-placeholder">Volume trend chart</div>
                    </div>
                    <div class="analytics-item">
                        <h4>Intensity Distribution</h4>
                        <div class="chart-placeholder">Intensity pie chart</div>
                    </div>
                    <div class="analytics-item">
                        <h4>Recovery Metrics</h4>
                        <div class="chart-placeholder">Recovery indicators</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate periodization section
     * @returns {string} HTML section
     */
    generatePeriodizationSection() {
        return `
            <div class="dashboard-card periodization">
                <h3>Training Periodization</h3>
                <div class="periodization-info">
                    <div class="current-phase">
                        <h4>Current Phase</h4>
                        <span class="phase-name">Base Building</span>
                    </div>
                    <div class="phase-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: 65%"></div>
                        </div>
                        <span class="progress-text">65% Complete</span>
                    </div>
                </div>
                <p>Your training is structured for long-term development and peak performance.</p>
            </div>
        `;
    }

    /**
     * Generate coach-specific sections
     * @returns {string} HTML section
     */
    generateCoachSections() {
        return `
            <div class="dashboard-card coach-dashboard">
                <h3>Coach Dashboard</h3>
                <div class="coach-actions">
                    <button class="btn primary" onclick="manageAthletes()">Manage Athletes</button>
                    <button class="btn secondary" onclick="createWorkoutPlan()">Create Workout Plan</button>
                    <button class="btn secondary" onclick="viewAnalytics()">View Analytics</button>
                </div>
                <p>Manage your athletes and create effective training programs.</p>
            </div>
        `;
    }

    /**
     * Update dashboard UI
     * @param {string} html - Dashboard HTML
     */
    updateDashboardUI(html) {
        const dashboardContainer = document.getElementById('userDashboard');
        if (dashboardContainer) {
            // Find the dashboard content area
            const dashboardContent = dashboardContainer.querySelector('.dashboard-content') || 
                                   dashboardContainer.querySelector('.tab-content');
            
            if (dashboardContent) {
                dashboardContent.innerHTML = html;
            } else {
                // Create dashboard content area if it doesn't exist
                const newContent = document.createElement('div');
                newContent.className = 'dashboard-content';
                newContent.innerHTML = html;
                dashboardContainer.appendChild(newContent);
            }
        }
    }

    /**
     * Calculate weekly streak
     * @returns {number} Streak days
     */
    calculateWeeklyStreak() {
        // Implementation would calculate actual streak
        return 5; // Placeholder
    }

    /**
     * Calculate weekly load
     * @returns {number} Weekly load
     */
    calculateWeeklyLoad() {
        // Implementation would calculate actual load
        return 125; // Placeholder
    }

    /**
     * Update dashboard when preferences change
     * @param {Object} newPreferences - Updated preferences
     */
    updateDashboardOnPreferenceChange(newPreferences) {
        try {
            // Re-render dashboard with new preferences
            this.renderDashboard();
            
            this.logger.debug('Dashboard updated for preference change', { 
                preferences: newPreferences 
            });
            this.eventBus?.emit('dashboard:preferencesUpdated', newPreferences);
        } catch (error) {
            this.logger.error('Failed to update dashboard for preference change', error);
        }
    }

    /**
     * Get dashboard configuration
     * @returns {Object} Current dashboard configuration
     */
    getDashboardConfiguration() {
        const mode = this.onboardingManager?.getDashboardMode() || 'some_metrics';
        return this.dashboardModes[mode];
    }
}

// Global handler for recovery day override
window.handleRecoveryDayOverride = function(noteId) {
    try {
        const logger = window.SafeLogger || console;
        const storageManager = window.StorageManager;
        const authManager = window.AuthManager;
        const expertCoordinator = window.ExpertCoordinator;

        if (!expertCoordinator) {
            logger.error('ExpertCoordinator not available');
            window.showErrorNotification?.('Unable to override recovery day. Please try again.', 'error');
            return;
        }

        // Get user preference
        const userId = authManager?.getCurrentUsername();
        if (userId && storageManager) {
            // Store preference: user prefers normal workout over recovery day
            storageManager.savePreferences?.(userId, {
                recoveryDayPreference: 'override'
            }).catch(err => {
                logger.warn('Failed to save recovery day preference', err);
            });
        }

        // Regenerate workout plan without recovery day recommendation
        const context = expertCoordinator.getCurrentContext?.() || {};
        context.recoveryDayOverride = true;
        context.recommendRecoveryDay = false;

        // Regenerate plan
        expertCoordinator.planTodayFallback(context).then(newPlan => {
            // Update UI with new plan
            if (window.DashboardRenderer) {
                const dashboard = window.DashboardRenderer;
                const simple = context.preferences?.trainingMode === 'simple';
                const planPreview = dashboard.generateWorkoutPreview(newPlan, simple);
                
                // Update workout preview in DOM
                const previewElement = document.querySelector('.workout-preview');
                if (previewElement) {
                    previewElement.outerHTML = planPreview;
                }
            }

            // Show success message
            window.showSuccessNotification?.('Workout plan updated. Normal workout plan generated.', 'success');
            
            logger.info('RECOVERY_DAY_OVERRIDDEN', { userId, noteId });
        }).catch(error => {
            logger.error('Failed to regenerate workout plan', error);
            window.showErrorNotification?.('Failed to update workout plan. Please try again.', 'error');
        });
    } catch (error) {
        const logger = window.SafeLogger || console;
        logger.error('Recovery day override failed', error);
        window.showErrorNotification?.('An error occurred. Please try again.', 'error');
    }
};

// Create global instance
window.DashboardRenderer = new DashboardRenderer();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardRenderer;
}
