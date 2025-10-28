/**
 * MacroGuidance - Daily nutrition guidance without tracking
 * Provides macro targets and timing based on profile, goals, and training
 */
class MacroGuidance {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.currentGuidance = null;
    }

    /**
     * Fetch nutrition guidance from backend
     * @param {Object} input - User profile and training info
     * @returns {Promise<Object>} Nutrition guidance
     */
    async fetchGuidance(input) {
        try {
            const response = await fetch('/.netlify/functions/nutrition-calculator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    profile: input.profile,
                    training: input.training,
                    goals: input.goals
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch guidance: ${response.status}`);
            }

            const data = await response.json();
            this.currentGuidance = data;
            
            this.logger.debug('Nutrition guidance fetched', data);
            
            return data;
        } catch (error) {
            this.logger.error('Failed to fetch nutrition guidance', error);
            return this.getFallbackGuidance();
        }
    }

    /**
     * Get guidance for specific training context
     * @param {Object} context - Training context (game/training/rest, weekly load, etc.)
     * @returns {Promise<Object>} Nutrition guidance for today
     */
    async getGuidanceForToday(context = {}) {
        try {
            // Get user profile from storage
            const userId = window.AuthManager?.getCurrentUsername() || 'anonymous';
            const profile = await this.storageManager.getUserProfile(userId);
            
            if (!profile) {
                this.logger.warn('No profile found, using defaults');
                return this.getFallbackGuidance();
            }

            // Determine day type from context
            const dayType = this.determineDayType(context);
            
            // Build input for calculator
            const input = {
                profile: {
                    gender: profile.gender,
                    age: profile.age,
                    weight: profile.weight,
                    height: profile.height,
                    bodyFat: profile.bodyFat,
                    sport: profile.sport || 'soccer'
                },
                training: {
                    dayType,
                    weeklyLoad: context.weeklyLoad || 'moderate',
                    isGame: context.isGame || false,
                    isHeavy: context.isHeavy || false
                },
                goals: profile.goals || ['performance']
            };

            return await this.fetchGuidance(input);
        } catch (error) {
            this.logger.error('Failed to get guidance for today', error);
            return this.getFallbackGuidance();
        }
    }

    /**
     * Determine day type from context
     * @param {Object} context - Training context
     * @returns {string} Day type (game/training/rest)
     */
    determineDayType(context) {
        if (context.isGame) {
            return 'game';
        }
        
        if (context.isHeavy || context.hasTraining) {
            return 'training';
        }
        
        return 'rest';
    }

    /**
     * Update guidance based on training changes
     * @param {string} newDayType - New day type
     * @returns {Promise<Object>} Updated guidance
     */
    async updateForTraining(newDayType) {
        if (!this.currentGuidance) {
            return await this.getGuidanceForToday({ dayType: newDayType });
        }

        // Re-fetch with new day type
        const userId = window.AuthManager?.getCurrentUsername() || 'anonymous';
        const profile = await this.storageManager.getUserProfile(userId);
        
        const input = {
            profile: {
                gender: profile.gender,
                age: profile.age,
                weight: profile.weight,
                height: profile.height,
                bodyFat: profile.bodyFat,
                sport: profile.sport || 'soccer'
            },
            training: {
                dayType: newDayType,
                weeklyLoad: 'moderate'
            },
            goals: profile.goals || ['performance']
        };

        return await this.fetchGuidance(input);
    }

    /**
     * Render guidance to dashboard card
     * @param {HTMLElement} container - Container element
     * @param {Object} guidance - Nutrition guidance data
     */
    renderGuidance(container, guidance) {
        if (!container || !guidance) {
            return;
        }

        const html = this.generateGuidanceHTML(guidance);
        container.innerHTML = html;
    }

    /**
     * Generate HTML for nutrition card
     * @param {Object} guidance - Nutrition guidance
     * @returns {string} HTML markup
     */
    generateGuidanceHTML(guidance) {
        const { macros, timing, hydration, mealExamples } = guidance;
        
        return `
            <div class="nutrition-guidance-card">
                <div class="card-header">
                    <h3>💊 Today's Nutrition</h3>
                    <span class="day-type-badge">${guidance.dayType || 'training'}</span>
                </div>
                
                <div class="macros-summary">
                    <div class="macro-item">
                        <span class="macro-label">Calories</span>
                        <span class="macro-value">${guidance.targetCalories}</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Protein</span>
                        <span class="macro-value">${macros.protein}g</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Carbs</span>
                        <span class="macro-value">${macros.carbs}g</span>
                    </div>
                    <div class="macro-item">
                        <span class="macro-label">Fat</span>
                        <span class="macro-value">${macros.fat}g</span>
                    </div>
                </div>
                
                <div class="timing-section">
                    <h4>⏰ Timing</h4>
                    ${timing ? timing.map(t => `<div class="timing-item">${t}</div>`).join('') : ''}
                </div>
                
                ${this.renderTimingDetails(timing)}
                ${this.renderHydration(hydration)}
                ${this.renderMealExamples(mealExamples)}
                
                <div class="nutrition-footer">
                    <small>Based on ${guidance.dayType} day • No tracking required</small>
                </div>
            </div>
        `;
    }

    /**
     * Render timing details
     * @param {Object} timing - Timing recommendations
     * @returns {string} HTML
     */
    renderTimingDetails(timing) {
        if (!timing || !Array.isArray(timing)) return '';
        
        return `
            <div class="timing-details">
                <div class="timing-block">
                    <strong>Pre-Workout:</strong>
                    <div>${timing.find(t => t.includes('Pre') || t.includes('Before')) || '1-2 hours before training'}</div>
                </div>
                <div class="timing-block">
                    <strong>Post-Workout:</strong>
                    <div>${timing.find(t => t.includes('Post') || t.includes('After')) || 'Within 30-60 minutes'}</div>
                </div>
            </div>
        `;
    }

    /**
     * Render hydration targets
     * @param {Object} hydration - Hydration info
     * @returns {string} HTML
     */
    renderHydration(hydration) {
        if (!hydration) return '';
        
        return `
            <div class="hydration-section">
                <h4>💧 Hydration</h4>
                <div class="hydration-target">${hydration.daily || '2.5-3.5L'} per day</div>
                ${hydration.preWorkout ? `<div class="hydration-tip">Pre-workout: ${hydration.preWorkout}</div>` : ''}
            </div>
        `;
    }

    /**
     * Render meal examples
     * @param {Object} mealExamples - Meal examples
     * @returns {string} HTML
     */
    renderMealExamples(mealExamples) {
        if (!mealExamples) return '';
        
        const preMeal = mealExamples.pre || mealExamples.preWorkout;
        const postMeal = mealExamples.post || mealExamples.postWorkout;
        
        let html = '<div class="meal-examples-section">';
        
        if (preMeal) {
            html += `
                <div class="meal-example">
                    <strong>Pre-Workout:</strong> ${preMeal}
                </div>
            `;
        }
        
        if (postMeal) {
            html += `
                <div class="meal-example">
                    <strong>Post-Workout:</strong> ${postMeal}
                </div>
            `;
        }
        
        html += '</div>';
        
        return html;
    }

    /**
     * Get fallback guidance if fetch fails
     * @returns {Object} Fallback nutrition guidance
     */
    getFallbackGuidance() {
        return {
            targetCalories: 2500,
            macros: {
                protein: 150,
                carbs: 300,
                fat: 70
            },
            dayType: 'training',
            timing: [
                'Eat 1-2 hours before training',
                'Consume carbs and protein post-workout',
                'Stay hydrated throughout the day'
            ],
            hydration: {
                daily: '2.5-3.5L',
                preWorkout: '500ml 1-2 hours before'
            },
            mealExamples: {
                pre: 'Banana + Peanut Butter',
                post: 'Protein shake + Rice cakes'
            }
        };
    }

    /**
     * Format timing recommendations
     * @param {Array} timing - Timing array
     * @returns {string} Formatted timing
     */
    formatTiming(timing) {
        if (!Array.isArray(timing)) return '';
        
        return timing.map(t => `• ${t}`).join('<br>');
    }

    /**
     * Get rationale for current guidance
     * @param {Object} guidance - Nutrition guidance
     * @returns {string} Rationale text
     */
    getRationale(guidance) {
        const rationale = [];
        
        if (guidance.dayType) {
            rationale.push(`Today is a ${guidance.dayType} day`);
        }
        
        if (guidance.goalAdjustment) {
            rationale.push(`${guidance.goalAdjustment > 0 ? '+' : ''}${guidance.goalAdjustment}% for goals`);
        }
        
        if (guidance.dayTypeAdjustment) {
            rationale.push(`${guidance.dayTypeAdjustment > 0 ? '+' : ''}${guidance.dayTypeAdjustment}% for day type`);
        }
        
        return rationale.join(' • ');
    }
}

window.MacroGuidance = new MacroGuidance();

