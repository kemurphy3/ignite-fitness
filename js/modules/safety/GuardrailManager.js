/**
 * GuardrailManager - Comprehensive safety guardrails and load management
 * Prevents overtraining, injury, and excessive progression
 * Validates workouts against training capacity, recovery, and readiness
 */

class GuardrailManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.loadCalculator = window.LoadCalculator;

    this.limits = {
      // Weekly caps by training level
      weeklyLoadCaps: {
        beginner: { total: 250, hard: 50 }, // Z4-Z5 minutes
        intermediate: { total: 400, hard: 80 },
        advanced: { total: 600, hard: 120 },
        elite: { total: 800, hard: 160 },
      },

      // Ramp rate limits (weekly increase)
      rampRates: {
        load: 0.1, // Max 10% weekly load increase
        volume: 0.1, // Max 10% weekly volume increase
        intensity: 0.05, // Max 5% weekly intensity increase
      },

      // Recovery requirements
      recovery: {
        minRestBetweenHard: 24, // Hours between Z4/Z5 sessions
        maxConsecutiveHard: 2, // Max consecutive hard days
        requiredEasyDays: 1, // Easy days per week minimum
        deloadFrequency: 4, // Deload every 4th week
      },

      // Injury prevention
      injury: {
        maxDailyLoad: 120, // Daily load cap
        soreness: {
          levelThreshold: 7, // 1-10 scale
          loadReduction: 0.3, // 30% load reduction
        },
        painThreshold: 4, // Any pain level 4+ = stop
        missedDaysAutoDeload: 3, // Auto-deload after 3+ missed days
      },
    };
  }

  /**
   * Validate proposed workout against all safety guardrails
   * @param {Object} workout - Proposed workout
   * @param {Object} userProfile - User profile with training level
   * @param {Array} recentSessions - Recent training history
   * @param {Object} readinessData - Current readiness metrics
   * @returns {Object} Validation result with modifications or blocks
   */
  async validateWorkout(workout, userProfile, recentSessions = [], readinessData = {}) {
    const result = {
      isAllowed: true,
      modifications: [],
      warnings: [],
      autoAdjustments: [],
      blocks: [],
    };

    try {
      // 1. Check weekly load cap
      const weeklyCheck = this.checkWeeklyLoadCap(workout, userProfile, recentSessions);
      if (!weeklyCheck.passed) {
        result.isAllowed = false;
        result.blocks.push(weeklyCheck.message);
        if (weeklyCheck.suggestedReduction) {
          result.autoAdjustments.push({
            type: 'load_reduction',
            factor: weeklyCheck.suggestedReduction,
            reason: 'Weekly load cap exceeded',
          });
        }
      } else if (weeklyCheck.warning) {
        result.warnings.push(weeklyCheck.warning);
      }

      // 2. Check ramp rate compliance
      const rampCheck = this.checkRampRate(workout, userProfile, recentSessions);
      if (!rampCheck.passed) {
        result.warnings.push(rampCheck.message);
        if (rampCheck.suggestedAdjustment) {
          result.autoAdjustments.push({
            type: 'ramp_adjustment',
            newLoad: rampCheck.suggestedAdjustment,
            reason: 'Excessive weekly progression',
          });
        }
        if (rampCheck.hiitReduction) {
          result.autoAdjustments.push({
            type: 'hiit_reduction',
            reduction: rampCheck.hiitReduction,
            reason: 'Weekly ramp rate exceeded',
          });
        }
      }

      // 3. Check recovery requirements
      const recoveryCheck = this.checkRecoveryRequirements(workout, recentSessions);
      if (!recoveryCheck.passed) {
        if (recoveryCheck.severity === 'block') {
          result.isAllowed = false;
          result.blocks.push(recoveryCheck.message);
        } else {
          result.warnings.push(recoveryCheck.message);
        }
        if (recoveryCheck.alternative) {
          result.autoAdjustments.push({
            type: 'intensity_reduction',
            newIntensity: recoveryCheck.alternative,
            reason: 'Insufficient recovery time',
          });
        }
      }

      // 4. Check readiness and injury flags
      const readinessCheck = this.checkReadinessCompatibility(workout, readinessData);
      if (!readinessCheck.passed) {
        if (readinessCheck.severity === 'block') {
          result.isAllowed = false;
          result.blocks.push(readinessCheck.message);
        } else {
          result.warnings.push(readinessCheck.message);
        }
        if (readinessCheck.loadReduction) {
          result.autoAdjustments.push({
            type: 'readiness_adjustment',
            factor: readinessCheck.loadReduction,
            reason: readinessCheck.reason,
          });
        }
      }

      // 5. Check for deload requirements
      const deloadCheck = this.checkDeloadRequirement(userProfile, recentSessions);
      if (deloadCheck.required) {
        result.warnings.push(deloadCheck.message);
        result.autoAdjustments.push({
          type: 'deload_week',
          loadReduction: 0.4, // 40% load reduction
          reason: 'Scheduled deload week',
        });
      }

      // 6. Check daily load cap
      const dailyLoadCheck = this.checkDailyLoadCap(workout, recentSessions);
      if (!dailyLoadCheck.passed) {
        result.warnings.push(dailyLoadCheck.message);
        if (dailyLoadCheck.suggestedReduction) {
          result.autoAdjustments.push({
            type: 'load_reduction',
            factor: dailyLoadCheck.suggestedReduction,
            reason: 'Daily load cap exceeded',
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Guardrail validation failed:', error);
      return {
        isAllowed: false,
        warnings: ['Safety validation failed. Please try again.'],
        modifications: [],
        autoAdjustments: [],
        blocks: ['Validation system error'],
      };
    }
  }

  /**
   * Check weekly training load against user's capacity
   * @param {Object} workout - Proposed workout
   * @param {Object} userProfile - User profile
   * @param {Array} recentSessions - Recent sessions
   * @returns {Object} Validation result
   */
  checkWeeklyLoadCap(workout, userProfile, recentSessions) {
    const trainingLevel = userProfile?.trainingLevel || 'intermediate';
    const limits =
      this.limits.weeklyLoadCaps[trainingLevel] || this.limits.weeklyLoadCaps.intermediate;

    // Initialize result object
    const result = {
      passed: true,
      warnings: [],
      autoAdjustments: [],
    };

    // Calculate current weekly load (last 7 days)
    const weekStartDate = new Date();
    weekStartDate.setDate(weekStartDate.getDate() - 7);

    const weekSessions = recentSessions.filter(session => {
      const sessionDate = new Date(session.date || session.startTime || session.start_at || 0);
      return sessionDate >= weekStartDate && sessionDate <= new Date();
    });

    const currentWeeklyLoad = weekSessions.reduce((total, session) => {
      return total + (session.calculatedLoad || session.load || session.estimatedLoad || 0);
    }, 0);

    const currentHardMinutes = this.calculateWeeklyHardMinutes(weekSessions);

    // Calculate workout load
    const workoutLoad = this.calculateWorkoutLoad(workout);
    const workoutHardMinutes = this.calculateHardMinutes(workout);

    // Check total load
    const projectedLoad = currentWeeklyLoad + workoutLoad;
    if (projectedLoad > limits.total) {
      const excessLoad = projectedLoad - limits.total;
      const suggestedReduction = Math.min(0.5, excessLoad / workoutLoad); // Cap at 50% reduction

      return {
        passed: false,
        message: `Weekly load cap exceeded. Current: ${Math.round(currentWeeklyLoad)}, limit: ${limits.total}`,
        suggestedReduction,
      };
    }

    // Missed days guardrail
    const missedDays = this.calculateMissedTrainingDays(recentSessions);
    if (missedDays >= this.limits.injury.missedDaysAutoDeload) {
      const reductionPercent = Math.min(missedDays * 15, 40);
      const reductionFactor = Math.max(0, Math.min(1, reductionPercent / 100));
      result.warnings.push(
        `Detected ${missedDays} missed training days. Applying ${reductionPercent}% load reduction for safe return.`
      );
      result.autoAdjustments.push({
        type: 'load_reduction',
        factor: reductionFactor,
        reason: 'missed_days',
      });
    }

    // Check hard minutes
    const projectedHardMinutes = currentHardMinutes + workoutHardMinutes;
    if (projectedHardMinutes >= limits.hard) {
      return {
        passed: false,
        message: `Weekly hard minutes exceeded. Current: ${Math.round(currentHardMinutes)}, limit: ${limits.hard}`,
        suggestedReduction: 0.5, // Suggest reducing intensity to Z2-Z3
      };
    }

    // Warning if approaching limit
    if (projectedLoad > limits.total * 0.9) {
      result.warnings.push(
        `Approaching weekly load cap (${Math.round((projectedLoad / limits.total) * 100)}%)`
      );
    }

    // Return result with any warnings or adjustments
    if (result.warnings.length > 0 || result.autoAdjustments.length > 0) {
      return result;
    }

    return { passed: true };
  }

  /**
   * Check workout progression against safe ramp rates
   * @param {Object} workout - Proposed workout
   * @param {Object} userProfile - User profile
   * @param {Array} recentSessions - Recent sessions
   * @returns {Object} Validation result
   */
  checkRampRate(workout, userProfile, recentSessions) {
    if (recentSessions.length < 2) {
      return { passed: true }; // Not enough data
    }

    // Compare this week vs last week
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekSessions = recentSessions.filter(session => {
      const sessionDate = new Date(session.date || session.startTime || session.start_at || 0);
      return sessionDate >= thisWeekStart && sessionDate <= now;
    });

    const lastWeekSessions = recentSessions.filter(session => {
      const sessionDate = new Date(session.date || session.startTime || session.start_at || 0);
      return sessionDate >= lastWeekStart && sessionDate < thisWeekStart;
    });

    if (lastWeekSessions.length === 0) {
      return { passed: true }; // No baseline to compare
    }

    const lastWeekLoad = lastWeekSessions.reduce((total, session) => {
      return total + (session.calculatedLoad || session.load || session.estimatedLoad || 0);
    }, 0);

    const currentWeekLoad = thisWeekSessions.reduce((total, session) => {
      return total + (session.calculatedLoad || session.load || session.estimatedLoad || 0);
    }, 0);

    const workoutLoad = this.calculateWorkoutLoad(workout);
    const projectedWeekLoad = currentWeekLoad + workoutLoad;

    if (lastWeekLoad === 0) {
      return { passed: true }; // No baseline load
    }

    const weeklyIncrease = (projectedWeekLoad - lastWeekLoad) / lastWeekLoad;

    if (weeklyIncrease > this.limits.rampRates.load) {
      const safeIncrease = lastWeekLoad * (1 + this.limits.rampRates.load);
      const suggestedAdjustment = Math.max(0, safeIncrease - currentWeekLoad);
      return {
        passed: false,
        message: `Weekly increase too high: ${Math.round(weeklyIncrease * 100)}%. Max: ${this.limits.rampRates.load * 100}%`,
        suggestedAdjustment,
        hiitReduction: 0.25,
        actions: ['reduce_hiits'],
      };
    }

    return { passed: true };
  }

  /**
   * Check recovery requirements between sessions
   * @param {Object} workout - Proposed workout
   * @param {Array} recentSessions - Recent sessions
   * @returns {Object} Validation result
   */
  checkRecoveryRequirements(workout, recentSessions) {
    const workoutIntensity = this.getMaxIntensity(workout);
    const isHardWorkout = ['Z4', 'Z5'].includes(workoutIntensity);

    if (!isHardWorkout) {
      return { passed: true }; // Easy sessions don't need recovery checks
    }

    // Check consecutive hard days first to provide softer warning before hard block
    const last3Days = recentSessions
      .filter(session => {
        const sessionDate = new Date(session.date || session.startTime || session.start_at || 0);
        const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 3;
      })
      .filter(session => this.isHardSession(session));

    if (last3Days.length >= this.limits.recovery.maxConsecutiveHard) {
      return {
        passed: false,
        severity: 'warn',
        message: `Too many consecutive hard days (${last3Days.length}). Consider an easy session.`,
        alternative: 'Z1',
      };
    }

    // Check time since last hard session
    const lastHardSession = recentSessions
      .filter(session => this.isHardSession(session))
      .sort((a, b) => {
        const dateA = new Date(a.date || a.startTime || a.start_at || 0);
        const dateB = new Date(b.date || b.startTime || b.start_at || 0);
        return dateB - dateA;
      })[0];

    if (lastHardSession) {
      const lastHardDate = new Date(
        lastHardSession.date || lastHardSession.startTime || lastHardSession.start_at || 0
      );
      const hoursSinceHard = (Date.now() - lastHardDate.getTime()) / (1000 * 60 * 60);
      const restThresholdHours = this.limits.recovery.minRestBetweenHard + 12; // add buffer for safety

      if (hoursSinceHard <= restThresholdHours) {
        return {
          passed: false,
          severity: 'block',
          message: `Insufficient recovery: ${Math.round(hoursSinceHard)}h since last hard session. Need at least ${restThresholdHours}h rest.`,
          alternative: 'Z2', // Suggest easy alternative
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check workout compatibility with current readiness
   * @param {Object} workout - Proposed workout
   * @param {Object} readinessData - Current readiness metrics
   * @returns {Object} Validation result
   */
  checkReadinessCompatibility(workout, readinessData) {
    if (!readinessData || Object.keys(readinessData).length === 0) {
      return { passed: true }; // No readiness data available
    }

    // Check for pain flags
    const painLevel = readinessData.painLevel || readinessData.pain || 0;
    if (painLevel >= this.limits.injury.painThreshold) {
      const intensityReductionPercent = 30 + Math.max(0, (painLevel - 5) * 5);
      const reductionFactor = Math.min(1, Math.max(0, intensityReductionPercent / 100));
      return {
        passed: false,
        severity: 'block',
        message: `Pain level too high (${painLevel}/10). Rest recommended.`,
        reason: 'Pain threshold exceeded',
        loadReduction: reductionFactor,
        recoveryDays: 14,
      };
    }

    // Check soreness levels
    const sorenessLevel =
      readinessData.sorenessLevel || readinessData.soreness || readinessData.muscleSoreness || 0;
    if (sorenessLevel >= this.limits.injury.soreness.levelThreshold) {
      const { loadReduction } = this.limits.injury.soreness;
      return {
        passed: false,
        severity: 'warn',
        message: `High soreness detected (${sorenessLevel}/10). Reducing workout intensity.`,
        loadReduction,
        reason: 'High muscle soreness',
      };
    }

    // Check overall readiness score
    const readinessScore =
      readinessData.readinessScore || readinessData.readiness || readinessData.score || null;
    if (readinessScore !== null && readinessScore < 6) {
      const loadReduction = Math.max(0.2, Math.min(0.5, (10 - readinessScore) * 0.1));
      return {
        passed: false,
        severity: 'warn',
        message: `Low readiness score (${readinessScore}/10). Adjusting workout load.`,
        loadReduction,
        reason: 'Low readiness score',
      };
    }

    return { passed: true };
  }

  /**
   * Check if deload week is required
   * @param {Object} userProfile - User profile
   * @param {Array} recentSessions - Recent sessions
   * @returns {Object} Deload requirement result
   */
  checkDeloadRequirement(userProfile, recentSessions) {
    const weeksOfTraining = this.calculateConsecutiveTrainingWeeks(recentSessions);
    const deloadFreq = this.limits.recovery.deloadFrequency;

    if (weeksOfTraining >= deloadFreq && weeksOfTraining % deloadFreq === 0) {
      return {
        required: true,
        message: `Deload week recommended after ${weeksOfTraining} weeks of training.`,
      };
    }

    // Check for accumulated fatigue indicators
    const last4Weeks = recentSessions.filter(session => {
      const sessionDate = new Date(session.date || session.startTime || session.start_at || 0);
      const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 28;
    });

    const avgReadiness = this.calculateAverageReadiness(last4Weeks);
    if (avgReadiness !== null && avgReadiness < 6.5) {
      return {
        required: true,
        message: `Accumulated fatigue detected (avg readiness: ${avgReadiness.toFixed(1)}). Deload week recommended.`,
      };
    }

    return { required: false };
  }

  /**
   * Check daily load cap
   * @param {Object} workout - Proposed workout
   * @param {Array} recentSessions - Recent sessions
   * @returns {Object} Validation result
   */
  checkDailyLoadCap(workout, recentSessions) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = recentSessions.filter(session => {
      const sessionDate = new Date(session.date || session.startTime || session.start_at || 0);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime();
    });

    const todayLoad = todaySessions.reduce((total, session) => {
      return total + (session.calculatedLoad || session.load || session.estimatedLoad || 0);
    }, 0);

    const workoutLoad = this.calculateWorkoutLoad(workout);
    const projectedLoad = todayLoad + workoutLoad;

    if (projectedLoad > this.limits.injury.maxDailyLoad) {
      const excessLoad = projectedLoad - this.limits.injury.maxDailyLoad;
      const suggestedReduction = Math.min(0.5, excessLoad / workoutLoad);

      return {
        passed: false,
        message: `Daily load cap exceeded. Current: ${Math.round(todayLoad)}, limit: ${this.limits.injury.maxDailyLoad}`,
        suggestedReduction,
      };
    }

    return { passed: true };
  }

  /**
   * Apply automatic adjustments to workout
   * @param {Object} workout - Original workout
   * @param {Array} adjustments - List of adjustments to apply
   * @returns {Object} Modified workout
   */
  applyAutoAdjustments(workout, adjustments) {
    if (!adjustments || adjustments.length === 0) {
      return workout;
    }

    let modifiedWorkout = JSON.parse(JSON.stringify(workout)); // Deep clone
    const appliedModifications = [];

    for (const adjustment of adjustments) {
      switch (adjustment.type) {
        case 'load_reduction':
          modifiedWorkout = this.reduceWorkoutLoad(modifiedWorkout, adjustment.factor);
          appliedModifications.push(`Load reduced by ${Math.round(adjustment.factor * 100)}%`);
          break;
        case 'intensity_reduction':
          modifiedWorkout = this.reduceWorkoutIntensity(modifiedWorkout, adjustment.newIntensity);
          appliedModifications.push(`Intensity reduced to ${adjustment.newIntensity}`);
          break;
        case 'deload_week':
          modifiedWorkout = this.applyDeloadReduction(modifiedWorkout, adjustment.loadReduction);
          appliedModifications.push(
            `Deload: ${Math.round(adjustment.loadReduction * 100)}% reduction`
          );
          break;
        case 'readiness_adjustment':
          modifiedWorkout = this.reduceWorkoutLoad(modifiedWorkout, adjustment.factor);
          appliedModifications.push(
            `Adjusted for readiness (${Math.round(adjustment.factor * 100)}% reduction)`
          );
          break;
        case 'ramp_adjustment':
          modifiedWorkout = this.adjustWorkoutLoad(modifiedWorkout, adjustment.newLoad);
          appliedModifications.push('Ramp rate adjusted');
          break;
        case 'hiit_reduction':
          modifiedWorkout = this.applyHIITReduction(modifiedWorkout, adjustment.reduction || 0.25);
          appliedModifications.push(
            `HIIT volume reduced by ${Math.round((adjustment.reduction || 0.25) * 100)}%`
          );
          break;
      }
    }

    modifiedWorkout.isModified = true;
    modifiedWorkout.modifications = appliedModifications;
    modifiedWorkout.originalWorkout = workout;

    return modifiedWorkout;
  }

  /**
   * Reduce workout load by factor
   * @param {Object} workout - Workout to modify
   * @param {number} factor - Reduction factor (0-1)
   * @returns {Object} Modified workout
   */
  reduceWorkoutLoad(workout, factor) {
    const modified = JSON.parse(JSON.stringify(workout));

    if (modified.structure) {
      modified.structure = modified.structure.map(block => {
        if (block.type === 'main') {
          if (block.sets) {
            return {
              ...block,
              sets: Math.max(1, Math.round(block.sets * (1 - factor))),
            };
          } else if (block.duration) {
            return {
              ...block,
              duration: Math.max(10 * 60, Math.round(block.duration * (1 - factor))), // Min 10 minutes
            };
          }
        }
        return block;
      });
    } else if (modified.blocks) {
      // Handle plan format
      modified.blocks = modified.blocks.map(block => {
        if (block.items) {
          block.items = block.items.map(item => {
            return {
              ...item,
              sets: Math.max(1, Math.round((item.sets || 3) * (1 - factor))),
            };
          });
        }
        return block;
      });
    }

    return modified;
  }

  /**
   * Reduce workout intensity
   * @param {Object} workout - Workout to modify
   * @param {string} newIntensity - Target intensity zone
   * @returns {Object} Modified workout
   */
  reduceWorkoutIntensity(workout, newIntensity) {
    const modified = JSON.parse(JSON.stringify(workout));

    if (modified.structure) {
      modified.structure = modified.structure.map(block => {
        if (block.type === 'main' && block.intensity && ['Z4', 'Z5'].includes(block.intensity)) {
          return {
            ...block,
            intensity: newIntensity,
            work: block.work ? { ...block.work, intensity: newIntensity } : undefined,
          };
        }
        return block;
      });
    }

    return modified;
  }

  /**
   * Apply reduction to high-intensity intervals
   * @param {Object} workout - Workout to modify
   * @param {number} reduction - Reduction factor (0-1)
   * @returns {Object} Modified workout
   */
  applyHIITReduction(workout, reduction = 0.25) {
    const modified = JSON.parse(JSON.stringify(workout));
    const multiplier = Math.max(0, 1 - reduction);

    if (modified.structure) {
      modified.structure = modified.structure.map(block => {
        const intensity = block.intensity || block.work?.intensity;
        if (block.type === 'main' && intensity && ['Z4', 'Z5'].includes(intensity)) {
          const updatedBlock = { ...block };
          if (block.sets) {
            updatedBlock.sets = Math.max(1, Math.round(block.sets * multiplier));
          }
          if (block.duration) {
            updatedBlock.duration = Math.max(60, Math.round(block.duration * multiplier));
          }
          if (block.work?.duration) {
            updatedBlock.work = {
              ...block.work,
              duration: Math.max(30, Math.round(block.work.duration * multiplier)),
            };
          }
          return updatedBlock;
        }
        return block;
      });
    } else if (modified.blocks) {
      modified.blocks = modified.blocks.map(block => {
        if (block.items) {
          block.items = block.items.map(item => {
            const targetRPE = item.targetRPE || 7;
            if (targetRPE >= 8) {
              const updatedItem = { ...item };
              if (item.sets) {
                updatedItem.sets = Math.max(1, Math.round(item.sets * multiplier));
              }
              if (item.reps && typeof item.reps === 'number') {
                updatedItem.reps = Math.max(1, Math.round(item.reps * multiplier));
              }
              return updatedItem;
            }
            return item;
          });
        }
        return block;
      });
    }

    return modified;
  }

  /**
   * Apply deload reduction
   * @param {Object} workout - Workout to modify
   * @param {number} reduction - Reduction factor (0-1)
   * @returns {Object} Modified workout
   */
  applyDeloadReduction(workout, reduction) {
    return this.reduceWorkoutLoad(workout, reduction);
  }

  /**
   * Adjust workout load to specific target
   * @param {Object} workout - Workout to modify
   * @param {number} targetLoad - Target load
   * @returns {Object} Modified workout
   */
  adjustWorkoutLoad(workout, targetLoad) {
    const currentLoad = this.calculateWorkoutLoad(workout);
    if (currentLoad === 0) {
      return workout;
    }

    const factor = 1 - (currentLoad - targetLoad) / currentLoad;
    return this.reduceWorkoutLoad(workout, Math.max(0, Math.min(0.5, factor)));
  }

  // Helper methods for calculations

  /**
   * Calculate workout load
   * @param {Object} workout - Workout to analyze
   * @returns {number} Load score
   */
  calculateWorkoutLoad(workout) {
    if (!this.loadCalculator || typeof this.loadCalculator.calculateSessionLoad !== 'function') {
      // Fallback calculation
      return workout.estimatedLoad || workout.load || 50;
    }

    try {
      const loadResult = this.loadCalculator.calculateSessionLoad(workout);
      return loadResult?.total || loadResult || workout.estimatedLoad || 50;
    } catch (error) {
      this.logger.warn('Load calculation failed, using fallback', error);
      return workout.estimatedLoad || workout.load || 50;
    }
  }

  /**
   * Calculate weekly hard minutes
   * @param {Array} sessions - Training sessions
   * @returns {number} Hard minutes
   */
  calculateWeeklyHardMinutes(sessions) {
    return sessions
      .filter(session => this.isHardSession(session))
      .reduce(
        (total, session) =>
          total +
          (session.hardMinutes || this.calculateHardMinutes(session.workout || session) || 0),
        0
      );
  }

  /**
   * Calculate hard minutes in workout
   * @param {Object} workout - Workout to analyze
   * @returns {number} Hard minutes
   */
  calculateHardMinutes(workout) {
    if (!workout || (!workout.structure && !workout.blocks)) {
      return 0;
    }

    if (workout.structure) {
      return workout.structure
        .filter(block => {
          const intensity = block.intensity || block.work?.intensity || 'Z1';
          return ['Z4', 'Z5'].includes(intensity);
        })
        .reduce((total, block) => {
          if (block.sets && block.work) {
            return total + (block.work.duration * block.sets) / 60;
          } else if (block.duration) {
            return total + block.duration / 60;
          }
          return total;
        }, 0);
    }

    // Handle plan format
    if (workout.blocks) {
      return workout.blocks.reduce((total, block) => {
        if (block.items) {
          return (
            total +
            block.items.filter(item => {
              const rpe = item.targetRPE || 7;
              return rpe >= 8; // High RPE = hard session
            }).length *
              5
          ); // Rough estimate: 5 min per exercise
        }
        return total;
      }, 0);
    }

    return 0;
  }

  /**
   * Calculate missed training days based on recent sessions
   * @param {Array} recentSessions - Recent training sessions
   * @returns {number} Number of missed days since last session
   */
  calculateMissedTrainingDays(recentSessions) {
    if (!recentSessions || recentSessions.length === 0) {
      return 0;
    }

    const mostRecent = recentSessions
      .map(session => new Date(session.date || session.startTime || session.start_at || 0))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => b - a)[0];

    if (!mostRecent) {
      return 0;
    }

    const diffDays = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Check if session is hard
   * @param {Object} session - Training session
   * @returns {boolean} Whether session is hard
   */
  isHardSession(session) {
    if (session.averageIntensity && ['Z4', 'Z5'].includes(session.averageIntensity)) {
      return true;
    }
    if (session.hardMinutes && session.hardMinutes > 0) {
      return true;
    }
    if (session.workout) {
      return this.calculateHardMinutes(session.workout) > 0;
    }
    return false;
  }

  /**
   * Get max intensity from workout
   * @param {Object} workout - Workout to analyze
   * @returns {string} Max intensity zone
   */
  getMaxIntensity(workout) {
    if (!workout) {
      return 'Z1';
    }

    if (workout.structure) {
      const intensities = workout.structure
        .map(block => {
          const intensity = block.intensity || block.work?.intensity;
          if (intensity && intensity.startsWith('Z')) {
            return parseInt(intensity.replace('Z', ''));
          }
          return 0;
        })
        .filter(i => i > 0);

      if (intensities.length > 0) {
        return `Z${Math.max(...intensities)}`;
      }
    }

    if (workout.blocks) {
      const maxRPE = workout.blocks.reduce((max, block) => {
        if (block.items) {
          const blockMax = Math.max(...block.items.map(item => item.targetRPE || 7));
          return Math.max(max, blockMax);
        }
        return max;
      }, 7);

      // Map RPE to zone
      if (maxRPE >= 9) {
        return 'Z5';
      }
      if (maxRPE >= 7) {
        return 'Z4';
      }
      if (maxRPE >= 5) {
        return 'Z3';
      }
      if (maxRPE >= 3) {
        return 'Z2';
      }
      return 'Z1';
    }

    return 'Z1';
  }

  /**
   * Calculate consecutive training weeks
   * @param {Array} sessions - Training sessions
   * @returns {number} Consecutive weeks
   */
  calculateConsecutiveTrainingWeeks(sessions) {
    if (!sessions || sessions.length === 0) {
      return 0;
    }

    const WEEK_MS = 1000 * 60 * 60 * 24 * 7;
    const weekStarts = sessions
      .map(session => {
        const date = new Date(session.date || session.startTime || session.start_at || 0);
        if (Number.isNaN(date.getTime())) {
          return null;
        }
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return weekStart.getTime();
      })
      .filter(value => value !== null)
      .sort((a, b) => b - a);

    if (weekStarts.length === 0) {
      return 0;
    }

    const uniqueWeeks = [...new Set(weekStarts)];
    let streak = 0;
    let expectedWeek = null;

    for (const week of uniqueWeeks) {
      if (expectedWeek === null) {
        expectedWeek = week;
        streak = 1;
        continue;
      }

      const diff = Math.round((expectedWeek - week) / WEEK_MS);
      if (diff === 0) {
        continue;
      }
      if (diff === 1) {
        streak += 1;
        expectedWeek = week;
      } else if (diff > 1) {
        break;
      }
    }

    return streak;
  }

  /**
   * Calculate average readiness
   * @param {Array} sessions - Training sessions
   * @returns {number|null} Average readiness score
   */
  calculateAverageReadiness(sessions) {
    const readinessScores = sessions
      .map(session => session.readinessScore || session.readiness || session.readinessData?.score)
      .filter(score => score !== null && score !== undefined && !isNaN(score));

    if (readinessScores.length === 0) {
      return null;
    }

    const avg = readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length;
    return avg;
  }
}

// Create global instance
window.GuardrailManager = new GuardrailManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GuardrailManager;
}
