/**
 * GoalManager - SMART goals and milestone tracking
 * Handles goal creation, progress tracking, and milestone management
 */
class GoalManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;
    this.progressionEngine = window.ProgressionEngine;

    this.goalTemplates = this.initializeGoalTemplates();
    this.milestoneRewards = this.initializeMilestoneRewards();
    this.motivationalMessages = this.initializeMotivationalMessages();
    this.currentGoals = [];
    this.goalProgress = {};
  }

  /**
   * Initialize goal templates for different types
   * @returns {Object} Goal templates
   */
  initializeGoalTemplates() {
    return {
      strength: {
        squat: {
          specific: 'Squat bodyweight for 5 reps',
          measurable: { unit: 'lbs', current: 135, target: 180 },
          achievable: true,
          relevant: 'Supports overall leg strength and athletic performance',
          timeBound: { weeks: 12, deadline: null },
        },
        deadlift: {
          specific: 'Deadlift 1.5x bodyweight for 3 reps',
          measurable: { unit: 'lbs', current: 185, target: 225 },
          achievable: true,
          relevant: 'Builds posterior chain strength for athletic performance',
          timeBound: { weeks: 16, deadline: null },
        },
        bench_press: {
          specific: 'Bench press bodyweight for 5 reps',
          measurable: { unit: 'lbs', current: 115, target: 150 },
          achievable: true,
          relevant: 'Develops upper body pushing strength',
          timeBound: { weeks: 14, deadline: null },
        },
      },
      endurance: {
        running: {
          specific: 'Run a 5K in under 25 minutes',
          measurable: { unit: 'minutes', current: 35, target: 25 },
          achievable: true,
          relevant: 'Improves cardiovascular fitness and endurance',
          timeBound: { weeks: 8, deadline: null },
        },
        cycling: {
          specific: 'Complete a 20-mile bike ride',
          measurable: { unit: 'miles', current: 10, target: 20 },
          achievable: true,
          relevant: 'Builds endurance and leg strength',
          timeBound: { weeks: 6, deadline: null },
        },
      },
      body_composition: {
        weight_loss: {
          specific: 'Lose 15 pounds of body fat',
          measurable: { unit: 'lbs', current: 0, target: 15 },
          achievable: true,
          relevant: 'Improves health markers and athletic performance',
          timeBound: { weeks: 16, deadline: null },
        },
        muscle_gain: {
          specific: 'Gain 5 pounds of lean muscle',
          measurable: { unit: 'lbs', current: 0, target: 5 },
          achievable: true,
          relevant: 'Increases strength potential and metabolism',
          timeBound: { weeks: 20, deadline: null },
        },
      },
    };
  }

  /**
   * Initialize milestone rewards
   * @returns {Object} Milestone rewards
   */
  initializeMilestoneRewards() {
    return {
      25: '25% complete! 🎉',
      50: 'Halfway there! 💪',
      75: 'Almost there! 🔥',
      100: 'Goal crushed! 🏆',
    };
  }

  /**
   * Initialize motivational messages
   * @returns {Object} Motivational messages
   */
  initializeMotivationalMessages() {
    return {
      streakStart: 'Every journey starts with a single step! 💪',
      weekComplete: "Week {number} complete! You're building a solid habit 🔥",
      comeback: 'Welcome back! The best time to restart is right now ⭐',
      milestone: 'New {exercise} PR! Your {muscle} strength is definitely improving 🏆',
      plateauSupport: "Progress isn't always linear. Trust the process - your body is adapting 🌱",
      goalCreated: "New goal set! You've got this! 🎯",
      progressUpdate: "Great progress on {goal}! You're {percentage}% of the way there! 📈",
      goalCompleted:
        "Incredible! You've achieved your {goal} goal! Time to set a new challenge! 🚀",
    };
  }

  /**
   * Create a new SMART goal
   * @param {Object} goalData - Goal data
   * @returns {Object} Created goal
   */
  createGoal(goalData) {
    try {
      const goal = this.validateAndFormatGoal(goalData);
      if (!goal) {
        return { success: false, error: 'Invalid goal data' };
      }

      // Add to current goals
      this.currentGoals.push(goal);

      // Save to storage
      this.saveGoal(goal);

      // Log event
      this.logEvent('goal_created', {
        goalId: goal.id,
        type: goal.type,
        title: goal.title,
        target: goal.target_value,
      });

      // Show motivational message
      this.showMotivationalMessage('goalCreated', { goal: goal.title });

      this.logger.audit('GOAL_CREATED', {
        goalId: goal.id,
        type: goal.type,
        title: goal.title,
      });

      return { success: true, goal };
    } catch (error) {
      this.logger.error('Failed to create goal', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate and format goal data
   * @param {Object} goalData - Raw goal data
   * @returns {Object|null} Formatted goal
   */
  validateAndFormatGoal(goalData) {
    const requiredFields = ['type', 'title', 'current_value', 'target_value', 'unit'];

    for (const field of requiredFields) {
      if (!goalData[field]) {
        this.logger.error(`Missing required field: ${field}`);
        return null;
      }
    }

    const goal = {
      id: this.generateGoalId(),
      user_id: this.authManager?.getCurrentUsername() || 'anonymous',
      type: goalData.type,
      title: goalData.title,
      description: goalData.description || '',
      current_value: parseFloat(goalData.current_value),
      target_value: parseFloat(goalData.target_value),
      unit: goalData.unit,
      deadline: goalData.deadline || this.calculateDeadline(goalData.timeBound),
      created_at: new Date().toISOString(),
      completed_at: null,
      is_active: true,
      milestones: this.calculateMilestones(goalData.current_value, goalData.target_value),
      progress_percentage: 0,
    };

    return goal;
  }

  /**
   * Calculate milestones for a goal
   * @param {number} current - Current value
   * @param {number} target - Target value
   * @returns {Array} Milestones
   */
  calculateMilestones(current, target) {
    const milestones = [];
    const progress = target - current;

    const milestonePercentages = [25, 50, 75, 100];

    milestonePercentages.forEach(percentage => {
      const milestoneValue = current + (progress * percentage) / 100;
      milestones.push({
        value: milestoneValue,
        percentage,
        reward: this.milestoneRewards[percentage],
        achieved: false,
        achieved_at: null,
      });
    });

    return milestones;
  }

  /**
   * Update goal progress
   * @param {string} goalId - Goal ID
   * @param {number} newValue - New current value
   * @returns {Object} Update result
   */
  updateGoalProgress(goalId, newValue) {
    try {
      const goal = this.currentGoals.find(g => g.id === goalId);
      if (!goal) {
        return { success: false, error: 'Goal not found' };
      }

      const oldValue = goal.current_value;
      goal.current_value = newValue;

      // Calculate new progress percentage
      const progress =
        ((newValue - (goal.target_value - (goal.target_value - goal.current_value))) /
          (goal.target_value - (goal.target_value - goal.current_value))) *
        100;
      goal.progress_percentage = Math.min(100, Math.max(0, progress));

      // Check for milestone achievements
      const newMilestones = this.checkMilestoneAchievements(goal);

      // Save updated goal
      this.saveGoal(goal);

      // Log event
      this.logEvent('goal_progress_updated', {
        goalId: goal.id,
        oldValue,
        newValue,
        progress: goal.progress_percentage,
        milestones: newMilestones,
      });

      // Show progress message
      this.showMotivationalMessage('progressUpdate', {
        goal: goal.title,
        percentage: Math.round(goal.progress_percentage),
      });

      // Check if goal is completed
      if (goal.progress_percentage >= 100) {
        this.completeGoal(goalId);
      }

      return { success: true, goal, milestones: newMilestones };
    } catch (error) {
      this.logger.error('Failed to update goal progress', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check for milestone achievements
   * @param {Object} goal - Goal object
   * @returns {Array} Newly achieved milestones
   */
  checkMilestoneAchievements(goal) {
    const newMilestones = [];

    goal.milestones.forEach(milestone => {
      if (!milestone.achieved && goal.current_value >= milestone.value) {
        milestone.achieved = true;
        milestone.achieved_at = new Date().toISOString();
        newMilestones.push(milestone);

        // Show milestone message
        this.showMotivationalMessage('milestone', {
          exercise: goal.title,
          muscle: this.getMuscleGroup(goal.type),
          reward: milestone.reward,
        });
      }
    });

    return newMilestones;
  }

  /**
   * Complete a goal
   * @param {string} goalId - Goal ID
   * @returns {Object} Completion result
   */
  completeGoal(goalId) {
    try {
      const goal = this.currentGoals.find(g => g.id === goalId);
      if (!goal) {
        return { success: false, error: 'Goal not found' };
      }

      goal.completed_at = new Date().toISOString();
      goal.is_active = false;

      // Save completed goal
      this.saveGoal(goal);

      // Log event
      this.logEvent('goal_completed', {
        goalId: goal.id,
        title: goal.title,
        completed_at: goal.completed_at,
      });

      // Show completion message
      this.showMotivationalMessage('goalCompleted', { goal: goal.title });

      this.logger.audit('GOAL_COMPLETED', {
        goalId: goal.id,
        title: goal.title,
      });

      return { success: true, goal };
    } catch (error) {
      this.logger.error('Failed to complete goal', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's active goals
   * @returns {Array} Active goals
   */
  getActiveGoals() {
    return this.currentGoals.filter(goal => goal.is_active);
  }

  /**
   * Get user's completed goals
   * @returns {Array} Completed goals
   */
  getCompletedGoals() {
    return this.currentGoals.filter(goal => !goal.is_active && goal.completed_at);
  }

  /**
   * Get goal progress summary
   * @returns {Object} Progress summary
   */
  getGoalProgressSummary() {
    const activeGoals = this.getActiveGoals();
    const completedGoals = this.getCompletedGoals();

    const totalGoals = activeGoals.length + completedGoals.length;
    const completionRate = totalGoals > 0 ? (completedGoals.length / totalGoals) * 100 : 0;

    const averageProgress =
      activeGoals.length > 0
        ? activeGoals.reduce((sum, goal) => sum + goal.progress_percentage, 0) / activeGoals.length
        : 0;

    return {
      totalGoals,
      activeGoals: activeGoals.length,
      completedGoals: completedGoals.length,
      completionRate: Math.round(completionRate),
      averageProgress: Math.round(averageProgress),
      goals: activeGoals,
    };
  }

  /**
   * Get goal template by type
   * @param {string} type - Goal type
   * @returns {Object} Goal template
   */
  getGoalTemplate(type) {
    return this.goalTemplates[type] || {};
  }

  /**
   * Calculate deadline based on time bound
   * @param {Object} timeBound - Time bound data
   * @returns {string} Deadline date
   */
  calculateDeadline(timeBound) {
    if (!timeBound || !timeBound.weeks) {
      return null;
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + timeBound.weeks * 7);
    return deadline.toISOString().split('T')[0];
  }

  /**
   * Get muscle group for goal type
   * @param {string} type - Goal type
   * @returns {string} Muscle group
   */
  getMuscleGroup(type) {
    const muscleGroups = {
      strength: 'strength',
      endurance: 'endurance',
      body_composition: 'fitness',
    };

    return muscleGroups[type] || 'fitness';
  }

  /**
   * Generate unique goal ID
   * @returns {string} Goal ID
   */
  generateGoalId() {
    return `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save goal to storage
   * @param {Object} goal - Goal to save
   */
  saveGoal(goal) {
    try {
      const goals = this.storageManager?.get('user_goals', []);
      const existingIndex = goals.findIndex(g => g.id === goal.id);

      if (existingIndex >= 0) {
        goals[existingIndex] = goal;
      } else {
        goals.push(goal);
      }

      this.storageManager?.set('user_goals', goals);
    } catch (error) {
      this.logger.error('Failed to save goal', error);
    }
  }

  /**
   * Load goals from storage
   */
  loadGoals() {
    try {
      const goals = this.storageManager?.get('user_goals', []);
      this.currentGoals = goals;
    } catch (error) {
      this.logger.error('Failed to load goals', error);
      this.currentGoals = [];
    }
  }

  /**
   * Show motivational message
   * @param {string} messageType - Message type
   * @param {Object} data - Message data
   */
  showMotivationalMessage(messageType, data) {
    const message = this.motivationalMessages[messageType];
    if (!message) {
      return;
    }

    const formattedMessage = this.formatMessage(message, data);

    // Emit event for UI to display
    this.eventBus?.emit('motivational:message', {
      type: messageType,
      message: formattedMessage,
      data,
    });

    this.logger.info('Motivational message:', formattedMessage);
  }

  /**
   * Format message with data
   * @param {string} message - Message template
   * @param {Object} data - Data to insert
   * @returns {string} Formatted message
   */
  formatMessage(message, data) {
    let formatted = message;

    for (const [key, value] of Object.entries(data)) {
      formatted = formatted.replace(`{${key}}`, value);
    }

    return formatted;
  }

  /**
   * Log event for analytics
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  logEvent(eventType, data) {
    try {
      const event = {
        user_id: this.authManager?.getCurrentUsername() || 'anonymous',
        occurred_at: new Date().toISOString(),
        kind: eventType,
        payload: data,
      };

      // Save to events table (would typically be database)
      const events = this.storageManager?.get('user_events', []);
      events.push(event);
      this.storageManager?.set('user_events', events);

      this.logger.audit('GOAL_EVENT', { eventType, data });
    } catch (error) {
      this.logger.error('Failed to log event', error);
    }
  }

  /**
   * Initialize goal manager
   */
  initialize() {
    this.loadGoals();
    this.logger.info('GoalManager initialized');
  }
}

// Create global instance
window.GoalManager = new GoalManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GoalManager;
}
