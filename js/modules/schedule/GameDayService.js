/**
 * GameDayService - Unified game day detection and scheduling service
 * Standardizes game detection across SportsCoach, SeasonalPrograms, ExpertCoordinator
 * Provides single data structure and API for game-day logic
 */
class GameDayService {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.eventBus = window.EventBus;

    // Standard game data structure
    this.GAME_TYPES = {
      REGULAR: 'regular',
      KEY_MATCH: 'key_match',
      TOURNAMENT: 'tournament',
      PLAYOFF: 'playoff',
      PRACTICE: 'practice',
    };

    this.PRIORITY_LEVELS = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical',
    };
  }

  /**
   * Get game proximity information for a given date
   * @param {string} userId - User ID
   * @param {Date} date - Date to check (defaults to today)
   * @returns {Object} Game proximity information
   */
  getGameProximity(userId, date = new Date()) {
    const upcomingGames = this.getUpcomingGames(userId, 10); // Next 10 games
    const proximityDate = new Date(date);
    proximityDate.setHours(0, 0, 0, 0);

    const result = {
      hasGame: false,
      isGameDay: false,
      daysUntil: null,
      daysUntilNext: null,
      daysSinceLast: null,
      nextGame: null,
      previousGame: null,
      isTomorrow: false,
      isWithin48h: false,
      isWithinWeek: false,
      suppressHeavyLower: false,
      adjustIntensity: false,
      adjustVolume: false,
      intensityMultiplier: 1.0,
      volumeMultiplier: 1.0,
      bodyRegion: null,
      maxRPE: null,
      coachMessage: null,
    };

    if (!upcomingGames || upcomingGames.length === 0) {
      return result;
    }

    // Find next game
    const nextGame = upcomingGames.find(game => {
      const gameDate = new Date(game.date);
      gameDate.setHours(0, 0, 0, 0);
      return gameDate >= proximityDate;
    });

    // Find previous game
    const previousGame = upcomingGames
      .filter(game => {
        const gameDate = new Date(game.date);
        gameDate.setHours(0, 0, 0, 0);
        return gameDate < proximityDate;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    if (nextGame) {
      const gameDate = new Date(nextGame.date);
      gameDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.floor((gameDate - proximityDate) / (1000 * 60 * 60 * 24));

      result.hasGame = true;
      result.nextGame = nextGame;
      result.daysUntil = daysUntil;
      result.daysUntilNext = daysUntil;
      result.isGameDay = daysUntil === 0;
      result.isTomorrow = daysUntil === 1;
      result.isWithin48h = daysUntil <= 1;
      result.isWithinWeek = daysUntil <= 7;

      // Calculate adjustments based on days until game
      const adjustments = this.calculateAdjustments(nextGame, daysUntil);
      Object.assign(result, adjustments);
    }

    if (previousGame) {
      const gameDate = new Date(previousGame.date);
      gameDate.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((proximityDate - gameDate) / (1000 * 60 * 60 * 24));
      result.previousGame = previousGame;
      result.daysSinceLast = daysSince;
    }

    return result;
  }

  /**
   * Calculate workout adjustments based on game proximity
   * @param {Object} game - Game object
   * @param {number} daysUntil - Days until game
   * @returns {Object} Adjustment object
   */
  calculateAdjustments(game, daysUntil) {
    const adjustments = {
      suppressHeavyLower: false,
      adjustIntensity: false,
      adjustVolume: false,
      intensityMultiplier: 1.0,
      volumeMultiplier: 1.0,
      bodyRegion: null,
      maxRPE: null,
      coachMessage: null,
    };

    if (daysUntil < 0) {
      return adjustments; // Game already passed
    }

    // Game day (0 days)
    if (daysUntil === 0) {
      adjustments.adjustIntensity = true;
      adjustments.adjustVolume = true;
      adjustments.intensityMultiplier = 0.2;
      adjustments.volumeMultiplier = 0.2;
      adjustments.coachMessage = 'Game day - Light movement only. Save energy for competition.';
      return adjustments;
    }

    // Game -1 day (tomorrow)
    if (daysUntil === 1) {
      adjustments.suppressHeavyLower = true;
      adjustments.adjustIntensity = true;
      adjustments.adjustVolume = true;
      adjustments.intensityMultiplier = 0.5;
      adjustments.volumeMultiplier = 0.5;
      adjustments.bodyRegion = 'upper';
      adjustments.maxRPE = 6;
      adjustments.coachMessage = 'Game tomorrow - Upper body light session only. Avoid heavy legs.';
      return adjustments;
    }

    // Game -2 days
    if (daysUntil === 2) {
      adjustments.suppressHeavyLower = true;
      adjustments.adjustIntensity = true;
      adjustments.adjustVolume = true;
      adjustments.intensityMultiplier = 0.7;
      adjustments.volumeMultiplier = 0.8;
      adjustments.maxRPE = 7;
      adjustments.coachMessage =
        'Game in 2 days - Moderate session. Keep leg work light (RPE ≤ 7).';
      return adjustments;
    }

    // Game -3 days
    if (daysUntil === 3) {
      adjustments.suppressHeavyLower = false; // Can do legs, but moderate
      adjustments.intensityMultiplier = 0.85;
      adjustments.volumeMultiplier = 0.9;
      adjustments.coachMessage = 'Game in 3 days - Normal training, slightly reduced volume.';
      return adjustments;
    }

    // Within week but >3 days - minimal adjustments for key matches only
    if ((daysUntil <= 7 && game.priority === 'high') || game.priority === 'critical') {
      adjustments.intensityMultiplier = 0.9;
      adjustments.volumeMultiplier = 0.95;
      adjustments.coachMessage =
        'Key match upcoming - Slightly reduced volume for optimal preparation.';
      return adjustments;
    }

    return adjustments;
  }

  /**
   * Get days until next game
   * @param {string} userId - User ID
   * @param {Date} date - Reference date (defaults to today)
   * @returns {number} Days until next game (or 99 if no upcoming game)
   */
  getDaysUntilGame(userId, date = new Date()) {
    const proximity = this.getGameProximity(userId, date);
    return proximity.daysUntilNext !== null ? proximity.daysUntilNext : 99;
  }

  /**
   * Check if a date is a game day
   * @param {string} userId - User ID
   * @param {Date} date - Date to check (defaults to today)
   * @returns {boolean} Is game day
   */
  isGameDay(userId, date = new Date()) {
    const proximity = this.getGameProximity(userId, date);
    return proximity.isGameDay;
  }

  /**
   * Get next game
   * @param {string} userId - User ID
   * @param {Date} date - Reference date (defaults to today)
   * @returns {Object|null} Next game object
   */
  getNextGame(userId, date = new Date()) {
    const proximity = this.getGameProximity(userId, date);
    return proximity.nextGame;
  }

  /**
   * Get upcoming games
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of games to return (default 10)
   * @returns {Array} Array of upcoming game objects
   */
  getUpcomingGames(userId, limit = 10) {
    try {
      // Get games from user profile or preferences
      const profile = this.storageManager.getUserProfile(userId);
      const preferences = this.storageManager.getPreferences(userId);

      // Check multiple sources for games
      let games = [];

      // Source 1: User profile game schedule
      if (profile?.gameSchedule) {
        games = games.concat(profile.gameSchedule);
      }

      // Source 2: Seasonal programs calendar
      if (profile?.seasonCalendar) {
        const calendar = profile.seasonCalendar;
        if (calendar.keyMatches) {
          games = games.concat(
            calendar.keyMatches.map(m => ({
              date: m.date,
              type: this.GAME_TYPES.KEY_MATCH,
              priority: m.priority || this.PRIORITY_LEVELS.HIGH,
              opponent: m.opponent || null,
              location: m.location || null,
            }))
          );
        }
        if (calendar.games) {
          games = games.concat(
            calendar.games.map(g => ({
              date: g.date,
              type: this.GAME_TYPES.REGULAR,
              priority: g.priority || this.PRIORITY_LEVELS.MEDIUM,
              opponent: g.opponent || null,
              location: g.location || null,
            }))
          );
        }
      }

      // Source 3: Preferences schedule
      if (preferences?.schedule?.upcomingGames) {
        games = games.concat(preferences.schedule.upcomingGames);
      }

      // Normalize game objects to standard structure
      const normalizedGames = games.map(game => this.normalizeGame(game));

      // Filter to future games and sort by date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = normalizedGames
        .filter(game => {
          const gameDate = new Date(game.date);
          gameDate.setHours(0, 0, 0, 0);
          return gameDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, limit);

      return upcoming;
    } catch (error) {
      this.logger.error('Failed to get upcoming games:', error);
      return [];
    }
  }

  /**
   * Normalize game object to standard structure
   * @param {Object} game - Game object (any format)
   * @returns {Object} Normalized game object
   */
  normalizeGame(game) {
    // Handle string dates
    const date = game.date ? new Date(game.date) : new Date();

    return {
      date: date.toISOString().split('T')[0], // YYYY-MM-DD format
      type: game.type || game.gameType || this.GAME_TYPES.REGULAR,
      priority: game.priority || game.priorityLevel || this.PRIORITY_LEVELS.MEDIUM,
      opponent: game.opponent || game.opponentName || null,
      location: game.location || game.venue || null,
      notes: game.notes || game.description || null,
      // Preserve original data
      _original: game,
    };
  }

  /**
   * Add a game to user's schedule
   * @param {string} userId - User ID
   * @param {Object} game - Game object
   * @returns {Promise<Object>} Added game
   */
  async addGame(userId, game) {
    try {
      const normalizedGame = this.normalizeGame(game);

      // Get current profile
      const profile = this.storageManager.getUserProfile(userId) || {};

      // Initialize game schedule if needed
      if (!profile.gameSchedule) {
        profile.gameSchedule = [];
      }

      // Check for duplicates (same date)
      const gameDate = new Date(normalizedGame.date);
      const existingIndex = profile.gameSchedule.findIndex(g => {
        const existingDate = new Date(g.date);
        return existingDate.getTime() === gameDate.getTime();
      });

      if (existingIndex >= 0) {
        // Update existing game
        profile.gameSchedule[existingIndex] = normalizedGame;
        this.logger.debug('Game updated:', normalizedGame);
      } else {
        // Add new game
        profile.gameSchedule.push(normalizedGame);
        this.logger.debug('Game added:', normalizedGame);
      }

      // Save updated profile
      await this.storageManager.saveUserProfile(userId, profile);

      // Emit event
      this.eventBus?.emit?.('game:added', { userId, game: normalizedGame });

      return normalizedGame;
    } catch (error) {
      this.logger.error('Failed to add game:', error);
      throw error;
    }
  }

  /**
   * Remove a game from user's schedule
   * @param {string} userId - User ID
   * @param {string|Date} gameDate - Game date (string YYYY-MM-DD or Date object)
   * @returns {Promise<boolean>} Success status
   */
  async removeGame(userId, gameDate) {
    try {
      const date = gameDate instanceof Date ? gameDate.toISOString().split('T')[0] : gameDate;

      // Get current profile
      const profile = this.storageManager.getUserProfile(userId);
      if (!profile || !profile.gameSchedule) {
        return false;
      }

      // Remove game
      const initialLength = profile.gameSchedule.length;
      profile.gameSchedule = profile.gameSchedule.filter(game => {
        const gameDateStr =
          game.date instanceof Date ? game.date.toISOString().split('T')[0] : game.date;
        return gameDateStr !== date;
      });

      if (profile.gameSchedule.length === initialLength) {
        return false; // Game not found
      }

      // Save updated profile
      await this.storageManager.saveUserProfile(userId, profile);

      // Emit event
      this.eventBus?.emit?.('game:removed', { userId, date });

      return true;
    } catch (error) {
      this.logger.error('Failed to remove game:', error);
      throw error;
    }
  }

  /**
   * Get game day adjustments for workout planning
   * Compatible with ProgressionEngine.getGameDayAdjustments() format
   * @param {string} userId - User ID
   * @param {Date} date - Workout date (defaults to today)
   * @returns {Object} Workout adjustments
   */
  getGameDayAdjustments(userId, date = new Date()) {
    const proximity = this.getGameProximity(userId, date);

    return {
      intensityMultiplier: proximity.intensityMultiplier,
      volumeMultiplier: proximity.volumeMultiplier,
      bodyRegion: proximity.bodyRegion,
      maxRPE: proximity.maxRPE,
      coachMessage: proximity.coachMessage,
    };
  }

  /**
   * Format game proximity for context object
   * Compatible with ExpertCoordinator context format
   * @param {string} userId - User ID
   * @param {Date} date - Reference date (defaults to today)
   * @returns {Object} Context-formatted schedule object
   */
  getScheduleContext(userId, date = new Date()) {
    const proximity = this.getGameProximity(userId, date);
    const { nextGame } = proximity;

    return {
      isGameDay: proximity.isGameDay,
      daysUntilGame: proximity.daysUntilNext,
      gameDate: nextGame ? nextGame.date : null,
      upcomingGames: this.getUpcomingGames(userId, 5),
      ...proximity,
    };
  }
}

// Create global instance
window.GameDayService = new GameDayService();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameDayService;
}
