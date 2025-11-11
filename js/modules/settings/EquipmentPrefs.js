/**
 * EquipmentPrefs - Equipment availability and preferences
 * Manages user equipment settings and availability preferences
 */

class EquipmentPrefs {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.preferences = {
      weightUnit: 'us', // 'us' or 'metric'
      availablePlates: {
        us: [45, 35, 25, 10, 5, 2.5],
        metric: [20, 15, 10, 5, 2.5, 1.25],
      },
      has2_5lbPlates: true,
      has1_25kgPlates: true,
      equipmentType: 'commercial', // 'commercial', 'home', 'limited'
      dumbbellIncrements: 5, // US: 5lb, Metric: 2.5kg
      substitutions: {
        'safety bar': false,
        'trap bar': false,
        'ez bar': true,
      },
    };

    this.loadPreferences();
  }

  /**
   * Load user equipment preferences
   */
  async loadPreferences() {
    try {
      const authManager = window.AuthManager;
      const userId = authManager?.getCurrentUsername();

      if (userId) {
        const prefs = await this.storageManager.getPreferences(userId);
        if (prefs && prefs.equipment) {
          this.preferences = { ...this.preferences, ...prefs.equipment };
        }
      }
    } catch (error) {
      this.logger.error('Failed to load equipment preferences', error);
    }
  }

  /**
   * Save equipment preferences
   * @param {string} userId - User ID
   * @param {Object} equipmentPrefs - Equipment preferences
   */
  async savePreferences(userId, equipmentPrefs) {
    try {
      this.preferences = { ...this.preferences, ...equipmentPrefs };

      const prefs = await this.storageManager.getPreferences(userId);
      await this.storageManager.savePreferences(userId, {
        ...prefs,
        equipment: this.preferences,
      });

      this.logger.debug('Equipment preferences saved', { userId });
    } catch (error) {
      this.logger.error('Failed to save equipment preferences', error);
      throw error;
    }
  }

  /**
   * Get available plates for current mode
   * @returns {Array} Available plates
   */
  getAvailablePlates() {
    const unit = this.preferences.weightUnit;
    const plates = this.preferences.availablePlates[unit] || [];

    // Filter out unavailable plates
    if (unit === 'us' && !this.preferences.has2_5lbPlates) {
      return plates.filter(p => p !== 2.5);
    }

    if (unit === 'metric' && !this.preferences.has1_25kgPlates) {
      return plates.filter(p => p !== 1.25);
    }

    return plates;
  }

  /**
   * Check if equipment is available
   * @param {string} equipmentName - Equipment name
   * @returns {boolean} Available status
   */
  isAvailable(equipmentName) {
    const substitution = this.preferences.substitutions[equipmentName.toLowerCase()];
    return substitution !== false;
  }

  /**
   * Get equipment substitution
   * @param {string} equipmentName - Original equipment
   * @returns {string|null} Substitution or null
   */
  getSubstitution(equipmentName) {
    const subs = {
      'safety bar': 'regular bar',
      'trap bar': 'regular bar',
      'smith machine': 'free weights',
    };

    return subs[equipmentName.toLowerCase()] || null;
  }

  /**
   * Get dumbbell loading
   * @param {number} targetWeight - Target weight (total for pair or single)
   * @param {boolean} isPair - Whether it's a pair
   * @returns {Object} Loading instructions
   */
  getDumbbellLoading(targetWeight, isPair = true) {
    const unit = this.preferences.weightUnit;
    const increment = unit === 'us' ? 5 : 2.5; // 5lb or 2.5kg
    const weightPerDumbbell = isPair ? targetWeight / 2 : targetWeight;

    // Round to nearest available increment
    const adjustedWeight = Math.round(weightPerDumbbell / increment) * increment;

    return {
      weightPerDumbbell: adjustedWeight,
      totalWeight: isPair ? adjustedWeight * 2 : adjustedWeight,
      instruction: isPair
        ? `Use ${adjustedWeight}${unit === 'us' ? 'lb' : 'kg'} dumbbells (pair)`
        : `Use one ${adjustedWeight}${unit === 'us' ? 'lb' : 'kg'} dumbbell`,
      adjustment: Math.abs(weightPerDumbbell - adjustedWeight),
    };
  }

  /**
   * Get fallback suggestion for missing equipment
   * @param {number} targetWeight - Target weight
   * @param {string} equipment - Missing equipment
   * @returns {Object} Fallback suggestion
   */
  getFallbackSuggestion(targetWeight, equipment) {
    const suggestions = {
      '2.5lb plates': {
        suggestion: 'lower weight + extra reps',
        newWeight: targetWeight - 5,
        reps: '+2-3 reps',
      },
      '1.25kg plates': {
        suggestion: 'lower weight + extra reps',
        newWeight: targetWeight - 2.5,
        reps: '+2-3 reps',
      },
      dumbbells: {
        suggestion: 'use barbell',
        alternative: 'barbell',
      },
    };

    return suggestions[equipment] || { suggestion: 'Use alternative equipment' };
  }

  /**
   * Get equipment recommendations for gym type
   * @param {string} gymType - Gym type (commercial, home, limited)
   * @returns {Object} Recommendations
   */
  getGymRecommendations(gymType) {
    const recommendations = {
      commercial: {
        hasSmallPlates: true,
        hasVariety: true,
        suggestions: ['Full plate selection available', 'Use any exercise variation'],
      },
      home: {
        hasSmallPlates: false,
        hasVariety: false,
        suggestions: [
          'Limited equipment - use progressive overload',
          'Consider bodyweight alternatives',
        ],
      },
      limited: {
        hasSmallPlates: false,
        hasVariety: false,
        suggestions: ['Choose most essential exercises', 'Prioritize compound movements'],
      },
    };

    return recommendations[gymType] || recommendations.commercial;
  }
}

// Initialize global instance
window.EquipmentPrefs = new EquipmentPrefs();
