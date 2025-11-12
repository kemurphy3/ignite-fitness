/**
 * WeightMath - Practical gym math for loading plates
 * Converts target weights into achievable plate combinations
 */
class WeightMath {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;

    // Default equipment configurations
    this.configs = {
      us: {
        barWeight: 45,
        plates: [45, 35, 25, 10, 5, 2.5],
        unit: 'lb',
        name: 'US',
      },
      metric: {
        barWeight: 20,
        plates: [20, 15, 10, 5, 2.5, 1.25],
        unit: 'kg',
        name: 'Metric',
      },
    };

    this.equipment = {
      availablePlates: this.configs.us.plates,
      mode: 'us',
      barWeight: this.configs.us.barWeight,
      unit: this.configs.us.unit,
    };

    // Exercise-specific progression minimums (lbs per side)
    this.progressionMins = {
      // Lower body - require larger jumps
      squat: 5,
      'back squat': 5,
      'front squat': 5,
      deadlift: 10,
      'romanian deadlift': 10,
      rdl: 10,
      'leg press': 10,
      'bulgarian split squat': 5,

      // Upper body - can use smaller increments
      'bench press': 2.5,
      bench: 2.5,
      'overhead press': 2.5,
      ohp: 2.5,
      'shoulder press': 2.5,
      'incline bench': 2.5,
      'dumbbell press': 2.5,

      // Accessory work - even smaller
      curl: 2.5,
      'bicep curl': 2.5,
      'tricep extension': 2.5,
      'lateral raise': 2.5,
      'rear delt': 2.5,

      // Default if not specified
      default: 5,
    };
  }

  /**
   * Calculate gym load plan for target weight
   * @param {Object} config - Equipment configuration
   * @param {number} targetWeight - Target total weight
   * @param {string} exerciseName - Optional exercise name for progression constraints
   * @returns {Object} Load plan with plates and display text
   */
  gymLoadPlan(config, targetWeight, _exerciseName = null) {
    try {
      const equipment = { ...this.equipment, ...config };
      const plateSet = equipment.availablePlates || this.configs[equipment.mode || 'us'].plates;

      const barWeight = equipment.barWeight || this.configs[equipment.mode || 'us'].barWeight;
      const unit = equipment.unit || this.configs[equipment.mode || 'us'].unit;

      // Calculate weight per side
      const weightPerSide = (targetWeight - barWeight) / 2;

      if (weightPerSide <= 0) {
        return {
          target: barWeight,
          totalWeight: barWeight,
          sides: [],
          text: `${barWeight} ${unit} bar only`,
          exact: true,
          note: null,
        };
      }

      // Find exact plate combination
      const exactCombination = this.findPlateCombination(weightPerSide, plateSet);

      // If exact match found
      if (Math.abs(exactCombination.total - weightPerSide) < 0.1) {
        const totalWeight = barWeight + exactCombination.total * 2;

        return {
          target: targetWeight,
          totalWeight,
          sides: exactCombination.plates,
          text: this.generateInstruction(totalWeight, barWeight, exactCombination.plates, unit),
          exact: true,
          note: null,
        };
      }

      // No exact match - round to nearest achievable
      const roundedWeight = this.roundToNearestAchievable(weightPerSide, plateSet);
      const roundedCombination = this.findPlateCombination(roundedWeight, plateSet);
      const roundedTotal = barWeight + roundedCombination.total * 2;

      return {
        target: targetWeight,
        totalWeight: roundedTotal,
        sides: roundedCombination.plates,
        text: this.generateInstruction(roundedTotal, barWeight, roundedCombination.plates, unit),
        exact: false,
        note: `Rounded from ${targetWeight} ${unit} to ${roundedTotal} ${unit}`,
        exactTarget: targetWeight,
        actualWeight: roundedTotal,
      };
    } catch (error) {
      this.logger.error('Failed to calculate load plan', error);
      return {
        target: targetWeight,
        totalWeight: targetWeight,
        sides: [],
        text: `Unable to calculate loading for ${targetWeight}`,
        exact: false,
        note: 'Calculation error',
      };
    }
  }

  /**
   * Find plate combination for target weight per side
   * @param {number} target - Target weight per side
   * @param {Array} plates - Available plates
   * @returns {Object} Combination with plates and total
   */
  findPlateCombination(target, plates) {
    const sortedPlates = [...plates].sort((a, b) => b - a);
    const combination = [];
    let total = 0;

    for (const plate of sortedPlates) {
      while (total + plate <= target + 0.1) {
        combination.push(plate);
        total += plate;
      }
    }

    return {
      plates,
      total,
      actualTotal: total,
    };
  }

  /**
   * Round to nearest achievable weight
   * @param {number} target - Target weight
   * @param {Array} plates - Available plates
   * @returns {number} Rounded weight
   */
  roundToNearestAchievable(target, plates) {
    const minPlate = Math.min(...plates);
    const rounded = Math.round(target / minPlate) * minPlate;
    return rounded;
  }

  /**
   * Generate loading instruction text
   * @param {number} totalWeight - Total weight
   * @param {number} barWeight - Bar weight
   * @param {Array} plates - Plates per side
   * @param {string} unit - Unit (lb or kg)
   * @returns {string} Instruction text
   */
  generateInstruction(totalWeight, barWeight, plates, unit) {
    if (plates.length === 0) {
      return `Load ${barWeight} ${unit} bar only`;
    }

    // Group plates and count
    const plateGroups = this.groupPlates(plates);

    // Format: "Load 45 lb bar + 35 + 10 + 2.5 per side → 135 lb total"
    const barText = `${barWeight} ${unit} bar`;

    if (plateGroups.length === 0) {
      return `Load ${barText} only`;
    }

    // Build plate text
    const plateText = plateGroups
      .map(p => {
        if (p.count === 1) {
          return `${p.weight}`;
        }
        return `${p.weight} × ${p.count}`;
      })
      .join(' + ');

    return `Load ${barText} + ${plateText} per side → ${totalWeight} ${unit} total`;
  }

  /**
   * Group and count plates
   * @param {Array} plates - Plate array
   * @returns {Array} Grouped plates
   */
  groupPlates(plates) {
    const groups = {};

    plates.forEach(plate => {
      groups[plate] = (groups[plate] || 0) + 1;
    });

    return Object.entries(groups)
      .map(([weight, count]) => ({
        weight: parseFloat(weight),
        count,
      }))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Update equipment availability
   * @param {Object} equipment - Equipment config
   */
  updateEquipment(equipment) {
    this.equipment = { ...this.equipment, ...equipment };

    this.logger.debug('Equipment updated', this.equipment);
  }

  /**
   * Get default equipment for mode
   * @param {string} mode - 'us' or 'metric'
   * @returns {Object} Equipment config
   */
  getDefaultEquipment(mode = 'us') {
    const config = this.configs[mode] || this.configs.us;

    return {
      mode,
      barWeight: config.barWeight,
      availablePlates: config.plates,
      unit: config.unit,
    };
  }

  /**
   * Handle missing plates by suggesting alternatives
   * @param {Object} targetLoad - Target load plan
   * @returns {Object} Alternative load plan
   */
  suggestAlternatives(targetLoad) {
    const neededPlates = targetLoad.sides;
    const { availablePlates } = this.equipment;

    const missingPlates = neededPlates.filter(plate => !availablePlates.includes(plate));

    if (missingPlates.length === 0) {
      return null; // No missing plates
    }

    // Suggest closest achievable weight without missing plates
    const filteredPlates = availablePlates.filter(p => !missingPlates.includes(p));
    const altWeightPerSide = this.estimateWeight(neededPlates) * 0.9; // 90% of target
    const altCombination = this.findPlateCombination(altWeightPerSide, filteredPlates);

    return {
      target: targetLoad.target,
      totalWeight: this.equipment.barWeight + altCombination.total * 2,
      sides: altCombination.plates,
      text: this.generateInstruction(
        this.equipment.barWeight + altCombination.total * 2,
        this.equipment.barWeight,
        altCombination.plates,
        this.equipment.unit
      ),
      exact: false,
      note: `Alternative due to missing plates: ${missingPlates.join(', ')}`,
    };
  }

  /**
   * Estimate weight from plate combination
   * @param {Array} plates - Plates
   * @returns {number} Estimated weight
   */
  estimateWeight(plates) {
    return plates.reduce((sum, p) => sum + p, 0);
  }

  /**
   * Get minimum progression for exercise (per side)
   * @param {string} exerciseName - Exercise name
   * @returns {number} Minimum progression in lbs/kg
   */
  getProgressionMin(exerciseName) {
    if (!exerciseName) {
      return 5;
    }

    const normalized = exerciseName.toLowerCase().trim();

    // Check exact match
    if (this.progressionMins[normalized]) {
      return this.progressionMins[normalized];
    }

    // Check for partial match
    for (const [key, value] of Object.entries(this.progressionMins)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }

    // Default
    return this.progressionMins.default || 5;
  }

  /**
   * Round to next realistic progression
   * @param {number} currentWeight - Current weight
   * @param {string} exerciseName - Exercise name
   * @param {Array} availablePlates - Available plates
   * @returns {number} Next realistic weight
   */
  suggestNextWeight(currentWeight, exerciseName, availablePlates) {
    const minProgression = this.getProgressionMin(exerciseName);
    const barWeight = this.equipment.barWeight || 45;
    const currentWeightPerSide = (currentWeight - barWeight) / 2;
    const nextWeightPerSide = currentWeightPerSide + minProgression;
    const targetWeight = barWeight + nextWeightPerSide * 2;

    // Round to nearest achievable
    const rounded = this.roundToNearestAchievable(targetWeight - barWeight, availablePlates);
    return barWeight + rounded * 2;
  }

  /**
   * Check if weight progression is realistic for exercise
   * @param {number} oldWeight - Previous weight
   * @param {number} newWeight - New weight
   * @param {string} exerciseName - Exercise name
   * @returns {Object} Validation result
   */
  validateProgression(oldWeight, newWeight, exerciseName) {
    const change = newWeight - oldWeight;
    const changePerSide = change / 2;
    const minProgression = this.getProgressionMin(exerciseName);

    const isValid = changePerSide >= minProgression;
    const suggestion = isValid ? null : oldWeight + minProgression * 2;

    return {
      isValid,
      change: changePerSide,
      minimum: minProgression,
      suggestion,
      message: isValid
        ? `Valid progression: ${changePerSide} per side`
        : `Progression too small. Minimum ${minProgression} per side. Suggest ${suggestion} lbs`,
    };
  }
}

window.WeightMath = WeightMath;
