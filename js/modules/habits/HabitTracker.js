/**
 * HabitTracker - Habit formation and streak tracking
 * Handles workout streaks, achievements, and habit formation
 */
class HabitTracker {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;
    this.goalManager = window.GoalManager;

    this.achievementDefinitions = this.initializeAchievements();
    this.motivationalMessages = this.initializeMotivationalMessages();
    this.currentStreaks = {};
    this.achievements = [];
    this.habitData = {};
  }

  /**
   * Initialize achievement definitions
   * @returns {Array} Achievement definitions
   */
  initializeAchievements() {
    return [
      {
        id: 'first_workout',
        name: 'First Workout',
        description: 'Complete your first workout',
        condition: { workouts: 1 },
        reward: '🎉 Welcome to your fitness journey!',
        unlocked: false,
      },
      {
        id: 'first_week',
        name: 'First Week Complete',
        description: 'Complete your first week of workouts',
        condition: { streak: 7 },
        reward: "🔥 You're building a solid habit!",
        unlocked: false,
      },
      {
        id: 'month_strong',
        name: 'Month Strong',
        description: 'Maintain a 30-day workout streak',
        condition: { streak: 30 },
        reward: "💪 A month of consistency - you're unstoppable!",
        unlocked: false,
      },
      {
        id: 'consistency_king',
        name: 'Consistency King',
        description: 'Complete 50 workouts',
        condition: { totalWorkouts: 50 },
        reward: "👑 You're the king of consistency!",
        unlocked: false,
      },
      {
        id: 'comeback_kid',
        name: 'Comeback Kid',
        description: 'Return after a 7+ day break',
        condition: { comeback: true },
        reward: '⭐ Welcome back! The best time to restart is now!',
        unlocked: false,
      },
      {
        id: 'weekend_warrior',
        name: 'Weekend Warrior',
        description: 'Complete workouts on 5 consecutive weekends',
        condition: { weekendStreak: 5 },
        reward: "⚔️ You're a true weekend warrior!",
        unlocked: false,
      },
      {
        id: 'early_bird',
        name: 'Early Bird',
        description: 'Complete 10 morning workouts before 8 AM',
        condition: { morningWorkouts: 10 },
        reward: '🌅 Early bird gets the gains!',
        unlocked: false,
      },
      {
        id: 'streak_master',
        name: 'Streak Master',
        description: 'Maintain a 100-day workout streak',
        condition: { streak: 100 },
        reward: "🏆 You're a streak master! Incredible dedication!",
        unlocked: false,
      },
    ];
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
      streakMilestone: "Day {day} of your streak! You're on fire! 🔥",
      achievement: 'Achievement unlocked: {name}! {reward}',
      habitFormed: "You've completed {days} days in a row - this is becoming a habit! 🌟",
    };
  }

  /**
   * Record a workout completion
   * @param {Object} workoutData - Workout data
   * @returns {Object} Recording result
   */
  recordWorkout(workoutData = {}) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const userId = this.authManager?.getCurrentUsername() || 'anonymous';

      // Get current habit data
      const habitData = this.getHabitData(userId, today);

      // Update workout completion
      habitData.workout_completed = true;
      habitData.workout_count = (habitData.workout_count || 0) + 1;
      habitData.last_workout_date = today;

      // Update streaks
      this.updateStreaks(habitData, today);

      // Check for achievements
      const newAchievements = this.checkAchievements(habitData);

      // Save updated data
      this.saveHabitData(userId, today, habitData);

      // Log event
      this.logEvent('workout_completed', {
        userId,
        date: today,
        workoutData,
        streak: habitData.current_streak,
        totalWorkouts: habitData.total_workouts,
      });

      // Show motivational message
      this.showMotivationalMessage('streakMilestone', {
        day: habitData.current_streak,
      });

      // Show achievement messages
      newAchievements.forEach(achievement => {
        this.showMotivationalMessage('achievement', {
          name: achievement.name,
          reward: achievement.reward,
        });
      });

      this.logger.audit('WORKOUT_RECORDED', {
        userId,
        date: today,
        streak: habitData.current_streak,
      });

      return { success: true, habitData, achievements: newAchievements };
    } catch (error) {
      this.logger.error('Failed to record workout', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update workout streaks
   * @param {Object} habitData - Habit data
   * @param {string} today - Today's date
   */
  updateStreaks(habitData, today) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get yesterday's data
    const yesterdayData = this.getHabitData(habitData.user_id, yesterdayStr);

    if (yesterdayData.workout_completed) {
      // Continue streak
      habitData.current_streak = (habitData.current_streak || 0) + 1;
    } else {
      // Start new streak
      habitData.current_streak = 1;
    }

    // Update longest streak
    habitData.longest_streak = Math.max(habitData.longest_streak || 0, habitData.current_streak);

    // Update total workouts
    habitData.total_workouts = (habitData.total_workouts || 0) + 1;

    // Update weekly count
    const weekStart = this.getWeekStart(today);
    if (habitData.week_start !== weekStart) {
      habitData.week_start = weekStart;
      habitData.weekly_count = 1;
    } else {
      habitData.weekly_count = (habitData.weekly_count || 0) + 1;
    }
  }

  /**
   * Check for new achievements
   * @param {Object} habitData - Habit data
   * @returns {Array} New achievements
   */
  checkAchievements(habitData) {
    const newAchievements = [];

    this.achievementDefinitions.forEach(achievement => {
      if (achievement.unlocked) {
        return;
      } // Already unlocked

      if (this.checkAchievementCondition(achievement, habitData)) {
        achievement.unlocked = true;
        achievement.unlocked_at = new Date().toISOString();
        newAchievements.push(achievement);
      }
    });

    return newAchievements;
  }

  /**
   * Check if achievement condition is met
   * @param {Object} achievement - Achievement definition
   * @param {Object} habitData - Habit data
   * @returns {boolean} Condition met
   */
  checkAchievementCondition(achievement, habitData) {
    const { condition: _condition } = achievement;

    switch (achievement.id) {
      case 'first_workout':
        return habitData.total_workouts >= 1;
      case 'first_week':
        return habitData.current_streak >= 7;
      case 'month_strong':
        return habitData.current_streak >= 30;
      case 'consistency_king':
        return habitData.total_workouts >= 50;
      case 'comeback_kid':
        return habitData.comeback === true;
      case 'weekend_warrior':
        return habitData.weekend_streak >= 5;
      case 'early_bird':
        return habitData.morning_workouts >= 10;
      case 'streak_master':
        return habitData.current_streak >= 100;
      default:
        return false;
    }
  }

  /**
   * Get habit data for user and date
   * @param {string} userId - User ID
   * @param {string} date - Date string
   * @returns {Object} Habit data
   */
  getHabitData(userId, date) {
    const key = `habit_${userId}_${date}`;
    return this.storageManager?.get(key, {
      user_id: userId,
      date,
      workout_completed: false,
      workout_count: 0,
      current_streak: 0,
      longest_streak: 0,
      total_workouts: 0,
      weekly_count: 0,
      week_start: null,
      achievements_earned: [],
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Save habit data
   * @param {string} userId - User ID
   * @param {string} date - Date string
   * @param {Object} habitData - Habit data
   */
  saveHabitData(userId, date, habitData) {
    const key = `habit_${userId}_${date}`;
    this.storageManager?.set(key, habitData);
  }

  /**
   * Get user's streak data
   * @param {string} userId - User ID
   * @returns {Object} Streak data
   */
  getStreakData(userId) {
    const today = new Date().toISOString().split('T')[0];
    const habitData = this.getHabitData(userId, today);

    return {
      current: habitData.current_streak || 0,
      longest: habitData.longest_streak || 0,
      weeklyGoal: 3, // Default weekly goal
      thisWeek: habitData.weekly_count || 0,
      totalWorkouts: habitData.total_workouts || 0,
      lastWorkout: habitData.last_workout_date,
    };
  }

  /**
   * Get user's achievements
   * @param {string} userId - User ID
   * @returns {Array} User achievements
   */
  getUserAchievements(_userId) {
    return this.achievementDefinitions.filter(achievement => achievement.unlocked);
  }

  /**
   * Get habit formation progress
   * @param {string} userId - User ID
   * @returns {Object} Habit progress
   */
  getHabitProgress(userId) {
    const streakData = this.getStreakData(userId);
    const achievements = this.getUserAchievements(userId);

    return {
      currentStreak: streakData.current,
      longestStreak: streakData.longest,
      totalWorkouts: streakData.totalWorkouts,
      weeklyProgress: {
        goal: streakData.weeklyGoal,
        current: streakData.thisWeek,
        percentage: Math.round((streakData.thisWeek / streakData.weeklyGoal) * 100),
      },
      achievements: {
        total: this.achievementDefinitions.length,
        unlocked: achievements.length,
        percentage: Math.round((achievements.length / this.achievementDefinitions.length) * 100),
      },
      habitStrength: this.calculateHabitStrength(streakData.current),
    };
  }

  /**
   * Calculate habit strength based on streak
   * @param {number} streak - Current streak
   * @returns {string} Habit strength
   */
  calculateHabitStrength(streak) {
    if (streak >= 100) {
      return 'Unstoppable';
    }
    if (streak >= 30) {
      return 'Strong';
    }
    if (streak >= 7) {
      return 'Forming';
    }
    if (streak >= 3) {
      return 'Building';
    }
    return 'Starting';
  }

  /**
   * Get week start date
   * @param {string} date - Date string
   * @returns {string} Week start date
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
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

      this.logger.audit('HABIT_EVENT', { eventType, data });
    } catch (error) {
      this.logger.error('Failed to log event', error);
    }
  }

  /**
   * Initialize habit tracker
   */
  initialize() {
    this.logger.info('HabitTracker initialized');
  }
}

// Create global instance
window.HabitTracker = new HabitTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HabitTracker;
}
