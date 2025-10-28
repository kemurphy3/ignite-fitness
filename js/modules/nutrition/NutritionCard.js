/**
 * NutritionCard - Macro guidance card component
 * Displays daily fuel targets and progress bars
 */
class NutritionCard {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.authManager = window.AuthManager;
        
        this.todayMacros = null;
        this.loadTodayMacros();
    }

    /**
     * Render nutrition card
     * @returns {HTMLElement} Nutrition card
     */
    render() {
        const card = document.createElement('div');
        card.className = 'nutrition-card';
        
        const macros = this.getTodayMacros();
        const dayType = this.getDayType();
        const rationale = macros.rationale || this.generateDefaultRationale(dayType, macros);
        const hydration = macros.hydration || { daily: 2000, unit: 'ml' };
        
        card.innerHTML = `
            <div class="card-header">
                <h3>💪 Daily Fuel</h3>
                <span class="day-type-badge ${dayType}">${this.capitalize(dayType)} Day</span>
            </div>
            
            <div class="macros-summary">
                <div class="macro-item target">
                    <span class="macro-label">Target</span>
                    <span class="macro-value">${macros.calories} cal</span>
                </div>
                ${this.renderMacroBar('protein', macros.protein, macros.proteinPct)}
                ${this.renderMacroBar('carbs', macros.carbs, macros.carbsPct)}
                ${this.renderMacroBar('fat', macros.fat, macros.fatPct)}
            </div>
            
            <div class="hydration-section">
                <div class="hydration-target">
                    <span class="hydration-icon">💧</span>
                    <span class="hydration-label">Hydration</span>
                    <span class="hydration-value">${hydration.daily}${hydration.unit || 'ml'}</span>
                </div>
                <div class="hydration-tip">${hydration.duringWorkout || 'Drink 150ml every 20min during training'}</div>
            </div>
            
            ${this.renderMealExamples(dayType)}
            ${this.renderCarbTiming(dayType)}
            
            <div class="card-footer">
                <div class="rationale-text">💡 Why: ${rationale}</div>
            </div>
        `;
        
        return card;
    }
    
    /**
     * Generate default rationale
     * @param {string} dayType - Day type
     * @param {Object} macros - Macros breakdown
     * @returns {string} Rationale text
     */
    generateDefaultRationale(dayType, macros) {
        const dayText = {
            game: 'Higher carbs fuel explosive game performance',
            training: 'Balanced macros support training adaptation',
            rest: 'Lower carbs aid recovery'
        };
        
        return dayText[dayType] || 'Nutrition supports your training goals';
    }

    /**
     * Render macro progress bar
     * @param {string} type - Macro type
     * @param {number} grams - Grams
     * @param {string} pct - Percentage
     * @returns {string} Macro bar HTML
     */
    renderMacroBar(type, grams, pct) {
        const icons = {
            protein: '🥩',
            carbs: '🍞',
            fat: '🥑'
        };
        
        const labels = {
            protein: 'Protein',
            carbs: 'Carbs',
            fat: 'Fat'
        };
        
        return `
            <div class="macro-item">
                <div class="macro-header">
                    <span class="macro-icon">${icons[type]}</span>
                    <span class="macro-label">${labels[type]}</span>
                    <span class="macro-grams">${grams}g</span>
                    <span class="macro-pct">${pct}%</span>
                </div>
                <div class="macro-bar">
                    <div class="macro-bar-fill ${type}" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Render meal examples
     * @param {string} dayType - Day type
     * @returns {string} Meal examples HTML
     */
    renderMealExamples(dayType) {
        const examples = this.getMealExamples(dayType);
        
        if (!examples || examples.length === 0) {
            return '';
        }
        
        return `
            <div class="meal-examples">
                <h4>💡 Meal Ideas for ${this.capitalize(dayType)} Days</h4>
                <ul class="examples-list">
                    ${examples.map(ex => `<li>${ex}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * Render carb timing info
     * @param {string} dayType - Day type
     * @returns {string} Carb timing HTML
     */
    renderCarbTiming(dayType) {
        const timing = this.getCarbTiming(dayType);
        
        if (!timing) {
            return '';
        }
        
        return `
            <div class="carb-timing">
                <h4>⏰ Carb Timing</h4>
                <div class="timing-list">
                    ${Object.entries(timing).map(([time, note]) => `
                        <div class="timing-item">
                            <span class="timing-time">${time}:</span>
                            <span class="timing-note">${note}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Get today's macros
     * @returns {Object} Today's macros
     */
    getTodayMacros() {
        if (this.todayMacros) {
            return this.todayMacros;
        }
        
        // Calculate based on user profile
        const userId = this.authManager?.getCurrentUsername();
        if (!userId) {
            return this.getDefaultMacros();
        }
        
        const profile = this.storageManager.getUserProfile(userId);
        if (profile) {
            this.todayMacros = this.calculateMacros(profile);
            return this.todayMacros;
        }
        
        return this.getDefaultMacros();
    }

    /**
     * Calculate macros from profile
     * @param {Object} profile - User profile
     * @returns {Object} Macros
     */
    calculateMacros(profile) {
        const { gender, age, weight, height, activityLevel, sport } = profile;
        
        // BMR using Mifflin-St Jeor
        const bmr = this.calculateBMR(gender, age, weight, height);
        
        // Activity multiplier
        const activityMult = this.getActivityMultiplier(activityLevel || 'moderate');
        const maintenance = bmr * activityMult;
        
        // Day type adjustment
        const dayType = this.getDayType();
        const adjustment = this.getDayTypeAdjustment(dayType);
        const targetCalories = Math.round(maintenance * adjustment);
        
        // Calculate macros
        const macros = this.calculateMacroBreakdown(targetCalories, sport || 'soccer', dayType);
        
        return {
            calories: targetCalories,
            ...macros
        };
    }

    /**
     * Calculate BMR
     * @param {string} gender - Gender
     * @param {number} age - Age
     * @param {number} weight - Weight in kg
     * @param {number} height - Height in cm
     * @returns {number} BMR
     */
    calculateBMR(gender, age, weight, height) {
        const base = (10 * weight) + (6.25 * height) - (5 * age);
        return base + (gender === 'male' ? 5 : -161);
    }

    /**
     * Get activity multiplier
     * @param {string} activityLevel - Activity level
     * @returns {number} Multiplier
     */
    getActivityMultiplier(activityLevel) {
        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9
        };
        return multipliers[activityLevel] || multipliers.moderate;
    }

    /**
     * Get day type adjustment
     * @param {string} dayType - Day type
     * @returns {number} Adjustment
     */
    getDayTypeAdjustment(dayType) {
        const adjustments = {
            game: 1.2,
            training: 1.1,
            rest: 0.9
        };
        return adjustments[dayType] || adjustments.training;
    }

    /**
     * Calculate macro breakdown
     * @param {number} calories - Target calories
     * @param {string} sport - Sport
     * @param {string} dayType - Day type
     * @returns {Object} Macros
     */
    calculateMacroBreakdown(calories, sport, dayType) {
        const ratios = {
            game: { protein: 0.20, carbs: 0.55, fat: 0.25 },
            training: { protein: 0.25, carbs: 0.45, fat: 0.30 },
            rest: { protein: 0.30, carbs: 0.35, fat: 0.35 }
        };
        
        const dayRatios = ratios[dayType] || ratios.training;
        
        return {
            protein: Math.round((calories * dayRatios.protein) / 4),
            carbs: Math.round((calories * dayRatios.carbs) / 4),
            fat: Math.round((calories * dayRatios.fat) / 9),
            proteinPct: (dayRatios.protein * 100).toFixed(0),
            carbsPct: (dayRatios.carbs * 100).toFixed(0),
            fatPct: (dayRatios.fat * 100).toFixed(0)
        };
    }

    /**
     * Get meal examples
     * @param {string} dayType - Day type
     * @returns {Array} Meal examples
     */
    getMealExamples(dayType) {
        const sport = this.getUserSport();
        
        const examples = {
            training: [
                'Banana + peanut butter (pre)',
                'Protein shake + banana (post)',
                'Rice + chicken + vegetables',
                'Oatmeal + berries + protein'
            ],
            game: [
                'Simple carbs 2-3 hours before',
                'Banana + sports drink',
                'Rapid recovery meal after',
                'Hydration + electrolyte balance'
            ],
            rest: [
                'Lower carb intake',
                'Focus on protein + healthy fats',
                'Vegetable-heavy meals',
                'Stay hydrated'
            ]
        };
        
        return examples[dayType] || examples.training;
    }

    /**
     * Get carb timing
     * @param {string} dayType - Day type
     * @returns {Object} Carb timing
     */
    getCarbTiming(dayType) {
        if (dayType === 'game') {
            return {
                '2-3 hours before': 'Largest meal with carbs',
                '30-60 min before': 'Small snack if needed',
                'Halftime/breaks': 'Quick carbs',
                'Post-game': 'Rapid carbs + protein'
            };
        } else if (dayType === 'training') {
            return {
                'Pre-workout': 'Carbs for energy',
                'Post-workout': 'Carbs for recovery',
                'Meal timing': 'Around training sessions'
            };
        } else {
            return {
                'Focus': 'Lower carb intake',
                'Meal timing': 'Spread evenly',
                'Note': 'Maintain protein'
            };
        }
    }

    /**
     * Get day type
     * @returns {string} Day type
     */
    getDayType() {
        // Check if there's a game today
        const today = new Date().toISOString().split('T')[0];
        // TODO: Check game schedule
        // For now, default to training
        return 'training';
    }

    /**
     * Get default macros
     * @returns {Object} Default macros
     */
    getDefaultMacros() {
        return {
            calories: 2200,
            protein: 165,
            carbs: 275,
            fat: 73,
            proteinPct: '30',
            carbsPct: '50',
            fatPct: '30'
        };
    }

    /**
     * Get user sport
     * @returns {string} Sport
     */
    getUserSport() {
        const profile = this.storageManager?.getUserProfile?.(this.authManager?.getCurrentUsername());
        return profile?.sport || 'soccer';
    }

    /**
     * Load today's macros
     */
    loadTodayMacros() {
        // TODO: Load from storage or calculate
    }

    /**
     * Capitalize string
     * @param {string} str - String
     * @returns {string} Capitalized
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Create global instance
window.NutritionCard = new NutritionCard();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutritionCard;
}
