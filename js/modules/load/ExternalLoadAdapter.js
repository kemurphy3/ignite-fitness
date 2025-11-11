/**
 * ExternalLoadAdapter - Adapts workout load based on external activities
 * Reduces next-session load when external activities detected
 */
class ExternalLoadAdapter {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.stravaHook = null;
  }

  /**
   * Check for external activities and adapt workout
   * @param {Object} workout - Planned workout
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Adapted workout with explanation
   */
  async adaptForExternalLoad(workout, userId) {
    try {
      const externalActivities = await this.getRecentExternalActivities(userId);

      if (externalActivities.length === 0) {
        return { workout, adapted: false, reason: null };
      }

      // Check for conflicting activities
      const conflicts = this.detectConflicts(workout, externalActivities);

      if (conflicts.length > 0) {
        // Adapt workout based on external load
        const adaptedWorkout = this.applyAdaptations(workout, conflicts);
        const reason = this.generateAdaptationReason(conflicts);

        return {
          workout: adaptedWorkout,
          adapted: true,
          reason,
          conflicts,
        };
      }

      return { workout, adapted: false, reason: null };
    } catch (error) {
      this.logger.error('Failed to adapt for external load', error);
      return { workout, adapted: false, reason: null };
    }
  }

  /**
   * Get recent external activities
   * @param {string} userId - User ID
   * @returns {Promise<Array>} External activities
   */
  async getRecentExternalActivities(userId) {
    try {
      const activities = await this.storageManager.getData(userId, 'external_activities');
      if (!activities || activities.length === 0) {
        return [];
      }

      // Filter to last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      return activities.filter(activity => {
        const activityDate = new Date(activity.timestamp);
        return activityDate >= yesterday;
      });
    } catch (error) {
      this.logger.error('Failed to get external activities', error);
      return [];
    }
  }

  /**
   * Detect conflicts between workout and external activities
   * @param {Object} workout - Planned workout
   * @param {Array} externalActivities - External activities
   * @returns {Array} Conflicts
   */
  detectConflicts(workout, externalActivities) {
    const conflicts = [];

    for (const activity of externalActivities) {
      const conflict = this.checkConflicts(workout, activity);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Check for specific conflicts
   * @param {Object} workout - Planned workout
   * @param {Object} activity - External activity
   * @returns {Object|null} Conflict
   */
  checkConflicts(workout, activity) {
    // Conflict: External running the day before heavy legs
    if (activity.type === 'running' && this.hasLegWork(workout)) {
      return {
        type: 'leg_volume',
        activity,
        modification: 'reduce_leg_volume',
        percentage: 20, // Reduce leg volume by 20%
      };
    }

    // Conflict: Long endurance session before sprint work
    if (activity.duration > 3600 && this.hasSprintWork(workout)) {
      return {
        type: 'intensity',
        activity,
        modification: 'reduce_intensity',
        percentage: 15,
      };
    }

    // Conflict: High intensity external + planned high intensity
    if (activity.averageIntensity >= 7 && this.hasHighIntensityWork(workout)) {
      return {
        type: 'total_load',
        activity,
        modification: 'reduce_total_load',
        percentage: 10,
      };
    }

    return null;
  }

  /**
   * Check if workout has leg work
   * @param {Object} workout - Workout
   * @returns {boolean} Has leg work
   */
  hasLegWork(workout) {
    if (!workout.exercises) {
      return false;
    }

    const legKeywords = ['squat', 'lunge', 'deadlift', 'leg', 'calf', 'hamstring'];

    return workout.exercises.some(ex =>
      legKeywords.some(keyword => ex.name?.toLowerCase().includes(keyword))
    );
  }

  /**
   * Check if workout has sprint work
   * @param {Object} workout - Workout
   * @returns {boolean} Has sprint work
   */
  hasSprintWork(workout) {
    if (!workout.exercises) {
      return false;
    }

    return workout.exercises.some(
      ex => ex.name?.toLowerCase().includes('sprint') || ex.tags?.includes('sprint')
    );
  }

  /**
   * Check if workout has high intensity work
   * @param {Object} workout - Workout
   * @returns {boolean} Has high intensity work
   */
  hasHighIntensityWork(workout) {
    if (!workout.exercises) {
      return false;
    }

    return workout.exercises.some(ex => ex.rpe > 7 || ex.intensity === 'high');
  }

  /**
   * Apply adaptations to workout
   * @param {Object} workout - Original workout
   * @param {Array} conflicts - Conflicts detected
   * @returns {Object} Adapted workout
   */
  applyAdaptations(workout, conflicts) {
    const adaptedWorkout = { ...workout };

    for (const conflict of conflicts) {
      if (conflict.modification === 'reduce_leg_volume') {
        adaptedWorkout.exercises = adaptedWorkout.exercises.map(ex => {
          if (this.isLegExercise(ex)) {
            return {
              ...ex,
              sets: Math.round(ex.sets * (1 - conflict.percentage / 100)),
              weight: ex.weight * (1 - conflict.percentage / 100),
              volumeReduced: true,
              reductionReason: 'external_load',
            };
          }
          return ex;
        });
      } else if (conflict.modification === 'reduce_intensity') {
        adaptedWorkout.exercises = adaptedWorkout.exercises.map(ex => ({
          ...ex,
          rpe: ex.rpe - 1,
          intensityAdjusted: true,
        }));
      } else if (conflict.modification === 'reduce_total_load') {
        adaptedWorkout.intensityMultiplier =
          (adaptedWorkout.intensityMultiplier || 1.0) * (1 - conflict.percentage / 100);
      }
    }

    adaptedWorkout.externalLoadAdaptations = conflicts;

    return adaptedWorkout;
  }

  /**
   * Check if exercise is leg exercise
   * @param {Object} exercise - Exercise
   * @returns {boolean} Is leg exercise
   */
  isLegExercise(exercise) {
    const legKeywords = ['squat', 'lunge', 'deadlift', 'leg', 'calf'];
    return legKeywords.some(keyword => exercise.name?.toLowerCase().includes(keyword));
  }

  /**
   * Generate adaptation reason
   * @param {Array} conflicts - Conflicts
   * @returns {string} Reason
   */
  generateAdaptationReason(conflicts) {
    const reasons = [];

    for (const conflict of conflicts) {
      if (conflict.modification === 'reduce_leg_volume') {
        reasons.push(
          `External ${conflict.activity.type} (${Math.round(conflict.activity.duration / 60)}min) reduces today's leg volume by ${conflict.percentage}%`
        );
      } else if (conflict.modification === 'reduce_intensity') {
        reasons.push(`Long external activity reduces intensity by ${conflict.percentage}%`);
      }
    }

    return reasons.join('. ');
  }
}

window.ExternalLoadAdapter = ExternalLoadAdapter;
