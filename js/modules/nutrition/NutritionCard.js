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
    this.todayLogged = { protein: 0, carbs: 0, fat: 0, calories: 0 }; // Tracked intake for today
    this.mealEntries = []; // List of meals/foods logged today

    this.loadTodayMacros();
    this.loadTodayTracking();
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
                    ${this.todayLogged.calories > 0 ? `<span class="logged-value">Logged: ${this.todayLogged.calories} cal</span>` : ''}
                </div>
                ${this.renderMacroBar('protein', macros.protein, macros.proteinPct, this.todayLogged.protein)}
                ${this.renderMacroBar('carbs', macros.carbs, macros.carbsPct, this.todayLogged.carbs)}
                ${this.renderMacroBar('fat', macros.fat, macros.fatPct, this.todayLogged.fat)}
            </div>
            
            ${this.renderTrackingSection()}
            
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
  generateDefaultRationale(dayType, _macros) {
    const dayText = {
      game: 'Higher carbs fuel explosive game performance',
      training: 'Balanced macros support training adaptation',
      rest: 'Lower carbs aid recovery',
    };

    return dayText[dayType] || 'Nutrition supports your training goals';
  }

  /**
   * Render macro progress bar with tracking
   * @param {string} type - Macro type
   * @param {number} targetGrams - Target grams
   * @param {string} pct - Percentage of calories
   * @param {number} loggedGrams - Logged grams (optional)
   * @returns {string} Macro bar HTML
   */
  renderMacroBar(type, targetGrams, pct, loggedGrams = 0) {
    const icons = {
      protein: '🥩',
      carbs: '🍞',
      fat: '🥑',
    };

    const labels = {
      protein: 'Protein',
      carbs: 'Carbs',
      fat: 'Fat',
    };

    // Calculate progress percentage
    const progressPercent = loggedGrams > 0 ? Math.min(100, (loggedGrams / targetGrams) * 100) : 0;
    const isOverTarget = loggedGrams > targetGrams;

    return `
            <div class="macro-item">
                <div class="macro-header">
                    <span class="macro-icon">${icons[type]}</span>
                    <span class="macro-label">${labels[type]}</span>
                    <span class="macro-grams">${targetGrams}g</span>
                    <span class="macro-pct">${pct}%</span>
                    ${loggedGrams > 0 ? `<span class="logged-grams ${isOverTarget ? 'over-target' : ''}">${loggedGrams}g</span>` : ''}
                </div>
                ${
                  loggedGrams > 0
                    ? `
                <div class="macro-progress-bar">
                    <div class="macro-progress-fill ${type}" style="width: ${progressPercent}%"></div>
                    <div class="macro-progress-label">${Math.round(progressPercent)}% of target</div>
                </div>
                `
                    : `
                <div class="macro-bar">
                    <div class="macro-bar-fill ${type}" style="width: ${pct}%"></div>
                </div>
                `
                }
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
                    ${Object.entries(timing)
                      .map(
                        ([time, note]) => `
                        <div class="timing-item">
                            <span class="timing-time">${time}:</span>
                            <span class="timing-note">${note}</span>
                        </div>
                    `
                      )
                      .join('')}
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
      ...macros,
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
    const base = 10 * weight + 6.25 * height - 5 * age;
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
      very_active: 1.9,
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
      rest: 0.9,
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
      game: { protein: 0.2, carbs: 0.55, fat: 0.25 },
      training: { protein: 0.25, carbs: 0.45, fat: 0.3 },
      rest: { protein: 0.3, carbs: 0.35, fat: 0.35 },
    };

    const dayRatios = ratios[dayType] || ratios.training;

    return {
      protein: Math.round((calories * dayRatios.protein) / 4),
      carbs: Math.round((calories * dayRatios.carbs) / 4),
      fat: Math.round((calories * dayRatios.fat) / 9),
      proteinPct: (dayRatios.protein * 100).toFixed(0),
      carbsPct: (dayRatios.carbs * 100).toFixed(0),
      fatPct: (dayRatios.fat * 100).toFixed(0),
    };
  }

  /**
   * Get meal examples
   * @param {string} dayType - Day type
   * @returns {Array} Meal examples
   */
  getMealExamples(dayType) {
    const _sport = this.getUserSport();

    const examples = {
      training: [
        'Banana + peanut butter (pre)',
        'Protein shake + banana (post)',
        'Rice + chicken + vegetables',
        'Oatmeal + berries + protein',
      ],
      game: [
        'Simple carbs 2-3 hours before',
        'Banana + sports drink',
        'Rapid recovery meal after',
        'Hydration + electrolyte balance',
      ],
      rest: [
        'Lower carb intake',
        'Focus on protein + healthy fats',
        'Vegetable-heavy meals',
        'Stay hydrated',
      ],
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
        'Post-game': 'Rapid carbs + protein',
      };
    } else if (dayType === 'training') {
      return {
        'Pre-workout': 'Carbs for energy',
        'Post-workout': 'Carbs for recovery',
        'Meal timing': 'Around training sessions',
      };
    } else {
      return {
        Focus: 'Lower carb intake',
        'Meal timing': 'Spread evenly',
        Note: 'Maintain protein',
      };
    }
  }

  /**
   * Get day type
   * @returns {string} Day type
   */
  getDayType() {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        return 'training';
      }

      // Check if there's a game today using GameDayService
      if (window.GameDayService) {
        const today = new Date();
        const isGameDay = window.GameDayService.isGameDay(userId, today);

        if (isGameDay) {
          return 'game';
        }
      }

      // Check for scheduled workout today
      // If no workout scheduled, it's a rest day
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Check user schedule for today
      const schedule = this.storageManager?.getUserSchedule?.(userId);
      if (schedule) {
        // Check if today has a workout scheduled
        const hasWorkout = this.checkTodayWorkout(schedule, todayStr);
        if (hasWorkout) {
          return 'training';
        }
      }

      // Default to rest if no game and no workout
      return 'rest';
    } catch (error) {
      this.logger.error('Failed to determine day type:', error);
      return 'training'; // Safe default
    }
  }

  /**
   * Check if today has a workout scheduled
   * @param {Object} schedule - User schedule
   * @param {string} todayStr - Today's date string
   * @returns {boolean} True if workout scheduled
   */
  checkTodayWorkout(schedule, todayStr) {
    if (!schedule) {
      return false;
    }

    // Check workout days
    const dayOfWeek = new Date(todayStr).getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[dayOfWeek];

    if (schedule.workoutDays?.includes(todayName)) {
      return true;
    }

    // Check specific dates
    if (schedule.scheduledWorkouts) {
      return schedule.scheduledWorkouts.some(workout => {
        const workoutDate = new Date(workout.date);
        const workoutDateStr = workoutDate.toISOString().split('T')[0];
        return workoutDateStr === todayStr;
      });
    }

    return false;
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
      fatPct: '30',
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
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        this.todayMacros = this.getDefaultMacros();
        return;
      }

      // Try to load cached macros from storage
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `ignitefitness_macros_${userId}_${today}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        try {
          const cached = JSON.parse(stored);
          // Only use cached if it's from today
          if (cached.date === today) {
            this.todayMacros = cached.macros;
            return;
          }
        } catch (e) {
          // Invalid cache, recalculate
          this.logger.debug('Invalid cached macros, recalculating:', e);
        }
      }

      // Calculate macros from user profile
      const profile = this.storageManager?.getUserProfile?.(userId);
      if (profile) {
        const calculated = this.calculateMacros(profile);
        this.todayMacros = calculated;

        // Cache for today
        try {
          const cacheData = {
            date: today,
            macros: calculated,
          };
          localStorage.setItem(storageKey, JSON.stringify(cacheData));
        } catch (e) {
          this.logger.debug('Failed to cache macros:', e);
        }

        return;
      }

      // Default fallback
      this.todayMacros = this.getDefaultMacros();
    } catch (error) {
      this.logger.error('Failed to load today macros:', error);
      this.todayMacros = this.getDefaultMacros();
    }
  }

  /**
   * Render macro tracking section
   * @returns {string} Tracking section HTML
   */
  renderTrackingSection() {
    return `
            <div class="macro-tracking-section">
                <div class="tracking-header">
                    <h4>📊 Log Your Macros</h4>
                    <button class="btn-small btn-outline" onclick="window.NutritionCard.showLogModal()">
                        + Log Meal
                    </button>
                </div>
                
                ${
                  this.mealEntries.length > 0
                    ? `
                <div class="meal-entries">
                    <h5>Today's Entries (${this.mealEntries.length})</h5>
                    <div class="entries-list">
                        ${this.mealEntries
                          .map(
                            (entry, index) => `
                            <div class="entry-item">
                                <div class="entry-info">
                                    <span class="entry-name">${entry.name || 'Meal'}</span>
                                    <span class="entry-time">${this.formatTime(entry.timestamp)}</span>
                                </div>
                                <div class="entry-macros">
                                    <span class="macro-value">P: ${entry.protein}g</span>
                                    <span class="macro-value">C: ${entry.carbs}g</span>
                                    <span class="macro-value">F: ${entry.fat}g</span>
                                    <span class="macro-value">${entry.calories} cal</span>
                                </div>
                                <button class="btn-icon" onclick="window.NutritionCard.removeEntry(${index})" 
                                        aria-label="Remove entry">×</button>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                </div>
                `
                    : `
                <div class="tracking-prompt">
                    <p>Start tracking your nutrition! Log your meals to see how you're doing compared to your targets.</p>
                </div>
                `
                }
                
                <div class="tracking-summary">
                    <div class="summary-item">
                        <span class="summary-label">Total Logged:</span>
                        <span class="summary-value">${this.todayLogged.calories} cal</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Remaining:</span>
                        <span class="summary-value">${Math.max(0, this.getTodayMacros().calories - this.todayLogged.calories)} cal</span>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Show log meal modal
   */
  showLogModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'macro-log-modal';
    modal.innerHTML = `
            <div class="modal-content macro-log-modal">
                <div class="modal-header">
                    <h3>Log Meal / Food</h3>
                    <button class="modal-close" onclick="window.NutritionCard.closeLogModal()" aria-label="Close">&times;</button>
                </div>
                
                <div class="modal-body">
                    <form id="macro-log-form" onsubmit="window.NutritionCard.handleLogSubmit(event)">
                        <div class="form-group">
                            <label for="meal-name">Meal / Food Name</label>
                            <input type="text" id="meal-name" name="name" placeholder="e.g., Chicken Breast, Protein Shake" required>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="meal-protein">Protein (g)</label>
                                <input type="number" id="meal-protein" name="protein" min="0" step="0.1" value="0" required>
                            </div>
                            <div class="form-group">
                                <label for="meal-carbs">Carbs (g)</label>
                                <input type="number" id="meal-carbs" name="carbs" min="0" step="0.1" value="0" required>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="meal-fat">Fat (g)</label>
                                <input type="number" id="meal-fat" name="fat" min="0" step="0.1" value="0" required>
                            </div>
                            <div class="form-group">
                                <label for="meal-calories">Calories (optional)</label>
                                <input type="number" id="meal-calories" name="calories" min="0" step="1" 
                                       placeholder="Auto-calculated">
                            </div>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="window.NutritionCard.closeLogModal()">
                                Cancel
                            </button>
                            <button type="submit" class="btn-primary">
                                Log Meal
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    // Focus first input
    setTimeout(() => {
      const firstInput = modal.querySelector('#meal-name');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);

    // Close on overlay click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        this.closeLogModal();
      }
    });
  }

  /**
   * Close log modal
   */
  closeLogModal() {
    const modal = document.getElementById('macro-log-modal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Handle log form submission
   * @param {Event} event - Form submit event
   */
  handleLogSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const entry = {
      name: formData.get('name'),
      protein: parseFloat(formData.get('protein')) || 0,
      carbs: parseFloat(formData.get('carbs')) || 0,
      fat: parseFloat(formData.get('fat')) || 0,
      calories:
        parseFloat(formData.get('calories')) ||
        this.calculateCalories(
          parseFloat(formData.get('protein')) || 0,
          parseFloat(formData.get('carbs')) || 0,
          parseFloat(formData.get('fat')) || 0
        ),
      timestamp: new Date().toISOString(),
    };

    // Add to today's entries
    this.mealEntries.push(entry);

    // Update today's totals
    this.todayLogged.protein += entry.protein;
    this.todayLogged.carbs += entry.carbs;
    this.todayLogged.fat += entry.fat;
    this.todayLogged.calories += entry.calories;

    // Save to storage
    this.saveTodayTracking();

    // Close modal
    this.closeLogModal();

    // Re-render card if it's in the DOM
    this.refreshCard();

    // Show success message
    this.showSuccessMessage('Meal logged successfully!');

    this.logger.audit('MACRO_LOGGED', entry);
  }

  /**
   * Calculate calories from macros
   * @param {number} protein - Protein grams
   * @param {number} carbs - Carbs grams
   * @param {number} fat - Fat grams
   * @returns {number} Total calories (4 cal/g protein & carbs, 9 cal/g fat)
   */
  calculateCalories(protein, carbs, fat) {
    return Math.round(protein * 4 + carbs * 4 + fat * 9);
  }

  /**
   * Remove entry from tracking
   * @param {number} index - Entry index
   */
  removeEntry(index) {
    if (index < 0 || index >= this.mealEntries.length) {
      return;
    }

    const entry = this.mealEntries[index];

    // Subtract from totals
    this.todayLogged.protein -= entry.protein;
    this.todayLogged.carbs -= entry.carbs;
    this.todayLogged.fat -= entry.fat;
    this.todayLogged.calories -= entry.calories;

    // Remove entry
    this.mealEntries.splice(index, 1);

    // Ensure totals don't go negative
    this.todayLogged.protein = Math.max(0, this.todayLogged.protein);
    this.todayLogged.carbs = Math.max(0, this.todayLogged.carbs);
    this.todayLogged.fat = Math.max(0, this.todayLogged.fat);
    this.todayLogged.calories = Math.max(0, this.todayLogged.calories);

    // Save to storage
    this.saveTodayTracking();

    // Re-render card
    this.refreshCard();

    this.logger.audit('MACRO_ENTRY_REMOVED', { index, entry });
  }

  /**
   * Load today's tracking data
   */
  loadTodayTracking() {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const storageKey = `ignitefitness_macro_tracking_${userId}_${today}`;
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const data = JSON.parse(stored);
        this.todayLogged = data.logged || { protein: 0, carbs: 0, fat: 0, calories: 0 };
        this.mealEntries = data.entries || [];

        // Recalculate totals from entries if needed
        if (this.mealEntries.length > 0) {
          this.recalculateTotals();
        }
      }
    } catch (error) {
      this.logger.error('Failed to load macro tracking:', error);
      this.todayLogged = { protein: 0, carbs: 0, fat: 0, calories: 0 };
      this.mealEntries = [];
    }
  }

  /**
   * Save today's tracking data
   */
  saveTodayTracking() {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const storageKey = `ignitefitness_macro_tracking_${userId}_${today}`;

      const data = {
        date: today,
        logged: this.todayLogged,
        entries: this.mealEntries,
      };

      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      this.logger.error('Failed to save macro tracking:', error);
    }
  }

  /**
   * Recalculate totals from entries
   */
  recalculateTotals() {
    this.todayLogged = { protein: 0, carbs: 0, fat: 0, calories: 0 };

    this.mealEntries.forEach(entry => {
      this.todayLogged.protein += entry.protein || 0;
      this.todayLogged.carbs += entry.carbs || 0;
      this.todayLogged.fat += entry.fat || 0;
      this.todayLogged.calories += entry.calories || 0;
    });
  }

  /**
   * Refresh card display
   */
  refreshCard() {
    // If card is rendered in DOM, update it
    const card = document.querySelector('.nutrition-card');
    if (card) {
      const newCard = this.render();
      card.replaceWith(newCard);
    }
  }

  /**
   * Show success message
   * @param {string} message - Message text
   */
  showSuccessMessage(message) {
    const notification = document.createElement('div');
    notification.className = 'nutrition-notification success';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Format timestamp to time string
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted time
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  /**
   * Get weekly macro summary
   * @param {number} days - Number of days to summarize
   * @returns {Object} Weekly summary
   */
  async getWeeklySummary(days = 7) {
    try {
      const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
      if (!userId) {
        return null;
      }

      const summaries = [];
      const today = new Date();

      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const storageKey = `ignitefitness_macro_tracking_${userId}_${dateStr}`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          const data = JSON.parse(stored);
          summaries.push({
            date: dateStr,
            logged: data.logged,
            entriesCount: data.entries?.length || 0,
          });
        }
      }

      // Calculate averages
      if (summaries.length > 0) {
        const totals = summaries.reduce(
          (acc, day) => {
            acc.protein += day.logged.protein;
            acc.carbs += day.logged.carbs;
            acc.fat += day.logged.fat;
            acc.calories += day.logged.calories;
            return acc;
          },
          { protein: 0, carbs: 0, fat: 0, calories: 0 }
        );

        return {
          days: summaries.length,
          average: {
            protein: Math.round(totals.protein / summaries.length),
            carbs: Math.round(totals.carbs / summaries.length),
            fat: Math.round(totals.fat / summaries.length),
            calories: Math.round(totals.calories / summaries.length),
          },
          totals,
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get weekly summary:', error);
      return null;
    }
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
