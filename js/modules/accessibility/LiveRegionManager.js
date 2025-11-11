/**
 * LiveRegionManager - centralized ARIA live announcements (WCAG 2.1 AA)
 * Provides polite/assertive regions with de-duplication and throttling
 */
(function () {
  class LiveRegionManager {
    constructor() {
      this.lastMessage = '';
      this.lastTs = 0;
      this.throttleMs = 500; // prevent chatty updates
      this.polite = this.createRegion('polite');
      this.assertive = this.createRegion('assertive');
    }

    createRegion(politenness) {
      const region = document.createElement('div');
      region.className = `if-live-region if-live-${politenness}`;
      region.setAttribute('aria-live', politenness);
      region.setAttribute('aria-atomic', 'true');
      region.style.position = 'absolute';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.overflow = 'hidden';
      region.style.clip = 'rect(1px, 1px, 1px, 1px)';
      region.style.clipPath = 'inset(50%)';
      region.style.whiteSpace = 'nowrap';
      document.body.appendChild(region);
      return region;
    }

    announce(message, politeness = 'polite') {
      if (!message) {
        return;
      }
      const now = Date.now();
      if (message === this.lastMessage && now - this.lastTs < this.throttleMs) {
        return;
      }
      this.lastMessage = message;
      this.lastTs = now;

      const region = politeness === 'assertive' ? this.assertive : this.polite;
      // Clear then set to ensure announcement
      region.textContent = '';
      // Delay a tick to force SR update in some browsers
      setTimeout(() => {
        region.textContent = String(message);
      }, 50);
    }
  }

  window.LiveRegionManager = new LiveRegionManager();
})();

/**
 * LiveRegionManager - Manages ARIA live regions for dynamic content announcements
 * Provides accessible announcements for timer updates, status changes, and notifications
 */
class LiveRegionManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.liveRegions = new Map();
    this.announcementQueue = [];
    this.isProcessingQueue = false;
    this.userPreferences = {
      announcementsEnabled: true,
      announcementDelay: 1000,
      maxAnnouncements: 3,
    };

    this.init();
  }

  /**
   * Initialize live region manager
   */
  init() {
    this.createLiveRegions();
    this.loadUserPreferences();
    this.setupEventListeners();
    this.logger.debug('LiveRegionManager initialized');
  }

  /**
   * Create ARIA live regions for different types of announcements
   */
  createLiveRegions() {
    const regions = [
      { id: 'timer-announcements', politeness: 'polite', priority: 'normal' },
      { id: 'status-announcements', politeness: 'polite', priority: 'normal' },
      { id: 'workout-announcements', politeness: 'assertive', priority: 'high' },
      { id: 'error-announcements', politeness: 'assertive', priority: 'high' },
      { id: 'success-announcements', politeness: 'polite', priority: 'normal' },
    ];

    regions.forEach(region => {
      const element = document.createElement('div');
      element.id = region.id;
      element.setAttribute('aria-live', region.politeness);
      element.setAttribute('aria-atomic', 'true');
      element.className = 'sr-only';
      element.setAttribute('data-priority', region.priority);

      document.body.appendChild(element);
      this.liveRegions.set(region.id, {
        element,
        politeness: region.politeness,
        priority: region.priority,
        lastAnnouncement: null,
      });
    });
  }

  /**
   * Load user preferences for announcements
   */
  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('accessibility-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.userPreferences = { ...this.userPreferences, ...preferences };
      }
    } catch (error) {
      this.logger.debug('Could not load accessibility preferences:', error);
    }
  }

  /**
   * Save user preferences
   */
  saveUserPreferences() {
    try {
      localStorage.setItem('accessibility-preferences', JSON.stringify(this.userPreferences));
    } catch (error) {
      this.logger.debug('Could not save accessibility preferences:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for announcement requests
    EventBus.subscribe('announce:timer', this.handleTimerAnnouncement.bind(this));
    EventBus.subscribe('announce:status', this.handleStatusAnnouncement.bind(this));
    EventBus.subscribe('announce:workout', this.handleWorkoutAnnouncement.bind(this));
    EventBus.subscribe('announce:error', this.handleErrorAnnouncement.bind(this));
    EventBus.subscribe('announce:success', this.handleSuccessAnnouncement.bind(this));

    // Listen for preference changes
    EventBus.subscribe(
      'accessibility:preferencesChanged',
      this.handlePreferencesChanged.bind(this)
    );
  }

  /**
   * Announce timer-related information
   * @param {Object} data - Timer announcement data
   */
  handleTimerAnnouncement(data) {
    const { type, message, duration, exercise } = data;

    let announcement = '';
    switch (type) {
      case 'timer-start':
        announcement = `Timer started for ${exercise || 'exercise'}`;
        break;
      case 'timer-pause':
        announcement = 'Timer paused';
        break;
      case 'timer-resume':
        announcement = 'Timer resumed';
        break;
      case 'timer-complete':
        announcement = `Timer completed. ${duration ? `Duration: ${duration}` : ''}`;
        break;
      case 'rest-start':
        announcement = `Rest period started. Recommended duration: ${duration || '60 seconds'}`;
        break;
      case 'rest-complete':
        announcement = 'Rest period completed. Ready for next exercise';
        break;
      default:
        announcement = message || 'Timer update';
    }

    this.announce('timer-announcements', announcement, 'normal');
  }

  /**
   * Announce status changes
   * @param {Object} data - Status announcement data
   */
  handleStatusAnnouncement(data) {
    const { status, message, details } = data;

    let announcement = '';
    switch (status) {
      case 'workout-started':
        announcement = 'Workout session started';
        break;
      case 'workout-paused':
        announcement = 'Workout session paused';
        break;
      case 'workout-resumed':
        announcement = 'Workout session resumed';
        break;
      case 'workout-completed':
        announcement = 'Workout session completed';
        break;
      case 'exercise-started':
        announcement = `Starting ${details?.exercise || 'exercise'}`;
        break;
      case 'exercise-completed':
        announcement = `${details?.exercise || 'Exercise'} completed`;
        break;
      case 'set-completed':
        announcement = `Set ${details?.setNumber || ''} completed`;
        break;
      default:
        announcement = message || 'Status update';
    }

    this.announce('status-announcements', announcement, 'normal');
  }

  /**
   * Announce workout-related information
   * @param {Object} data - Workout announcement data
   */
  handleWorkoutAnnouncement(data) {
    const { type, message, details } = data;

    let announcement = '';
    switch (type) {
      case 'pr-achieved':
        announcement = `Personal record achieved! ${details?.exercise}: ${details?.weight} pounds`;
        break;
      case 'volume-milestone':
        announcement = `Volume milestone reached: ${details?.volume} pounds`;
        break;
      case 'consistency-streak':
        announcement = `Consistency streak: ${details?.days} days`;
        break;
      case 'recovery-ready':
        announcement = 'Recovery complete. Ready for next workout';
        break;
      case 'fatigue-detected':
        announcement = 'High fatigue detected. Consider reducing intensity';
        break;
      default:
        announcement = message || 'Workout update';
    }

    this.announce('workout-announcements', announcement, 'high');
  }

  /**
   * Announce error messages
   * @param {Object} data - Error announcement data
   */
  handleErrorAnnouncement(data) {
    const { error, message, context } = data;

    let announcement = '';
    if (error) {
      switch (error.type) {
        case 'network':
          announcement = 'Network error. Please check your connection';
          break;
        case 'validation':
          announcement = `Validation error: ${error.message}`;
          break;
        case 'permission':
          announcement = 'Permission denied. Please check your settings';
          break;
        case 'timeout':
          announcement = 'Request timed out. Please try again';
          break;
        default:
          announcement = `Error: ${error.message || 'An error occurred'}`;
      }
    } else {
      announcement = message || 'An error occurred';
    }

    this.announce('error-announcements', announcement, 'high');
  }

  /**
   * Announce success messages
   * @param {Object} data - Success announcement data
   */
  handleSuccessAnnouncement(data) {
    const { type, message, details } = data;

    let announcement = '';
    switch (type) {
      case 'data-saved':
        announcement = 'Data saved successfully';
        break;
      case 'workout-logged':
        announcement = 'Workout logged successfully';
        break;
      case 'settings-updated':
        announcement = 'Settings updated successfully';
        break;
      case 'sync-complete':
        announcement = 'Data synchronization complete';
        break;
      default:
        announcement = message || 'Success';
    }

    this.announce('success-announcements', announcement, 'normal');
  }

  /**
   * Handle preferences changes
   * @param {Object} preferences - New preferences
   */
  handlePreferencesChanged(preferences) {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.saveUserPreferences();
  }

  /**
   * Announce text to a specific live region
   * @param {string} regionId - Live region ID
   * @param {string} text - Text to announce
   * @param {string} priority - Announcement priority
   */
  announce(regionId, text, priority = 'normal') {
    if (!this.userPreferences.announcementsEnabled) {
      return;
    }

    const region = this.liveRegions.get(regionId);
    if (!region) {
      this.logger.warn('Live region not found:', regionId);
      return;
    }

    // Add to queue for processing
    this.announcementQueue.push({
      regionId,
      text,
      priority,
      timestamp: Date.now(),
    });

    this.processAnnouncementQueue();
  }

  /**
   * Process announcement queue
   */
  processAnnouncementQueue() {
    if (this.isProcessingQueue || this.announcementQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    // Sort by priority and timestamp
    this.announcementQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      return a.timestamp - b.timestamp;
    });

    // Process announcements
    const announcements = this.announcementQueue.splice(0, this.userPreferences.maxAnnouncements);

    announcements.forEach((announcement, index) => {
      setTimeout(() => {
        this.executeAnnouncement(announcement);
      }, index * this.userPreferences.announcementDelay);
    });

    // Continue processing if queue has more items
    setTimeout(() => {
      this.isProcessingQueue = false;
      if (this.announcementQueue.length > 0) {
        this.processAnnouncementQueue();
      }
    }, announcements.length * this.userPreferences.announcementDelay);
  }

  /**
   * Execute announcement
   * @param {Object} announcement - Announcement object
   */
  executeAnnouncement(announcement) {
    const region = this.liveRegions.get(announcement.regionId);
    if (!region) {
      return;
    }

    // Clear previous content
    region.element.textContent = '';

    // Add new content
    setTimeout(() => {
      region.element.textContent = announcement.text;
      region.lastAnnouncement = announcement;

      this.logger.debug('Announced:', announcement.text);
    }, 100);
  }

  /**
   * Clear all live regions
   */
  clearAllRegions() {
    this.liveRegions.forEach(region => {
      region.element.textContent = '';
      region.lastAnnouncement = null;
    });
    this.announcementQueue = [];
  }

  /**
   * Clear specific live region
   * @param {string} regionId - Live region ID
   */
  clearRegion(regionId) {
    const region = this.liveRegions.get(regionId);
    if (region) {
      region.element.textContent = '';
      region.lastAnnouncement = null;
    }
  }

  /**
   * Get user preferences
   * @returns {Object} User preferences
   */
  getPreferences() {
    return { ...this.userPreferences };
  }

  /**
   * Update user preferences
   * @param {Object} preferences - New preferences
   */
  updatePreferences(preferences) {
    this.userPreferences = { ...this.userPreferences, ...preferences };
    this.saveUserPreferences();
    EventBus.publish('accessibility:preferencesChanged', preferences);
  }

  /**
   * Enable/disable announcements
   * @param {boolean} enabled - Whether to enable announcements
   */
  setAnnouncementsEnabled(enabled) {
    this.updatePreferences({ announcementsEnabled: enabled });
  }

  /**
   * Set announcement delay
   * @param {number} delay - Delay in milliseconds
   */
  setAnnouncementDelay(delay) {
    this.updatePreferences({ announcementDelay: Math.max(500, Math.min(3000, delay)) });
  }

  /**
   * Set maximum announcements
   * @param {number} max - Maximum number of announcements
   */
  setMaxAnnouncements(max) {
    this.updatePreferences({ maxAnnouncements: Math.max(1, Math.min(10, max)) });
  }

  /**
   * Get announcement statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const stats = {
      totalRegions: this.liveRegions.size,
      queueLength: this.announcementQueue.length,
      preferences: this.userPreferences,
      recentAnnouncements: [],
    };

    this.liveRegions.forEach((region, regionId) => {
      if (region.lastAnnouncement) {
        stats.recentAnnouncements.push({
          region: regionId,
          text: region.lastAnnouncement.text,
          timestamp: region.lastAnnouncement.timestamp,
        });
      }
    });

    return stats;
  }
}

// Create global instance
window.LiveRegionManager = new LiveRegionManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LiveRegionManager;
}
