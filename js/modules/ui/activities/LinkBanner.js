/**
 * LinkBanner - Shows linking options for merged activities
 * Displays banner when manual session is merged with external activity
 */

class LinkBanner {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
  }

  /**
   * Render link banner for merged activity
   * @param {Object} activity - Activity with source_set showing multiple sources
   * @param {string} containerId - Container ID to render banner into
   * @returns {HTMLElement} Banner element
   */
  render(activity, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      this.logger.error('Container not found:', containerId);
      return null;
    }

    // Check if activity has multiple sources
    const sources = activity.source_set || {};
    const sourceCount = Object.keys(sources).length;

    if (sourceCount < 2) {
      // No linking needed
      return null;
    }

    // Determine primary and secondary sources
    const sourcesList = Object.entries(sources).sort(
      (a, b) => (b[1].richness || 0) - (a[1].richness || 0)
    );

    const primarySource = sourcesList[0];
    const secondarySource = sourcesList.length > 1 ? sourcesList[1] : null;

    if (!secondarySource) {
      return null;
    }

    // Create banner element
    const banner = document.createElement('div');
    banner.className = 'link-banner';
    banner.dataset.activityId = activity.id;

    banner.innerHTML = `
            <div class="link-banner-content">
                <div class="link-banner-icon">🔗</div>
                <div class="link-banner-message">
                    <strong>Linked activity detected</strong>
                    <div class="link-banner-sources">
                        ${this.formatSource(secondarySource[0])} activity linked with ${this.formatSource(primarySource[0])}
                    </div>
                </div>
                <div class="link-banner-actions">
                    <button class="btn btn-link-keep" data-action="keep-both">
                        Keep both
                    </button>
                    <button class="btn btn-link-primary" data-action="use-primary">
                        Use ${this.formatSource(primarySource[0])} only
                    </button>
                    <button class="btn btn-link-secondary" data-action="use-secondary">
                        Use ${this.formatSource(secondarySource[0])} only
                    </button>
                </div>
            </div>
        `;

    // Add event listeners
    this.attachEventListeners(banner, activity, primarySource, secondarySource);

    // Insert banner at the top of container
    container.insertBefore(banner, container.firstChild);

    this.logger.info('Link banner rendered', {
      activityId: activity.id,
      sources: Object.keys(sources),
    });

    return banner;
  }

  /**
   * Format source name for display
   * @param {string} source - Source name
   * @returns {string} Formatted name
   */
  formatSource(source) {
    const sourceNames = {
      manual: 'Manual',
      strava: 'Strava',
      garmin: 'Garmin',
      polar: 'Polar',
      fitbit: 'Fitbit',
      apple_health: 'Apple Health',
    };
    return sourceNames[source] || source.charAt(0).toUpperCase() + source.slice(1);
  }

  /**
   * Attach event listeners to banner buttons
   * @param {HTMLElement} banner - Banner element
   * @param {Object} activity - Activity data
   * @param {Array} primarySource - Primary source [name, data]
   * @param {Array} secondarySource - Secondary source [name, data]
   */
  attachEventListeners(banner, activity, primarySource, secondarySource) {
    const buttons = banner.querySelectorAll('button[data-action]');

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const { action } = button.dataset;
        this.handleLinkAction(action, activity, primarySource, secondarySource, banner);
      });
    });
  }

  /**
   * Handle link action button click
   * @param {string} action - Action type (keep-both, use-primary, use-secondary)
   * @param {Object} activity - Activity data
   * @param {Array} primarySource - Primary source
   * @param {Array} secondarySource - Secondary source
   * @param {HTMLElement} banner - Banner element
   */
  async handleLinkAction(action, activity, primarySource, secondarySource, banner) {
    try {
      this.logger.info('Link action triggered', { action, activityId: activity.id });

      // Import linking actions if available
      if (window.LinkingActions) {
        const result = await window.LinkingActions.handleLinkDecision(
          activity,
          action,
          primarySource,
          secondarySource
        );

        if (result.success) {
          // Update banner to show current state
          this.updateBannerState(banner, action);

          // Show feedback
          this.showFeedback(banner, result.message);

          // Hide banner after delay if action is "keep-both"
          if (action === 'keep-both') {
            setTimeout(() => {
              banner.style.opacity = '0';
              setTimeout(() => banner.remove(), 300);
            }, 2000);
          }
        } else {
          this.showError(banner, result.error);
        }
      } else {
        console.warn('LinkingActions not available');
        this.showError(banner, 'Linking actions not available');
      }
    } catch (error) {
      this.logger.error('Error handling link action:', error);
      this.showError(banner, error.message);
    }
  }

  /**
   * Update banner to show current state
   * @param {HTMLElement} banner - Banner element
   * @param {string} action - Selected action
   */
  updateBannerState(banner, action) {
    const actionText = {
      'keep-both': 'Keeping both sources active',
      'use-primary': 'Using primary source only',
      'use-secondary': 'Using secondary source only',
    };

    const messageDiv = banner.querySelector('.link-banner-message');
    if (messageDiv) {
      messageDiv.innerHTML = `
                <strong>✓ ${actionText[action]}</strong>
                <div class="link-banner-status">This preference will be saved</div>
            `;
    }

    // Hide actions
    const actionsDiv = banner.querySelector('.link-banner-actions');
    if (actionsDiv) {
      actionsDiv.style.display = 'none';
    }
  }

  /**
   * Show success feedback
   * @param {HTMLElement} banner - Banner element
   * @param {string} message - Feedback message
   */
  showFeedback(banner, message) {
    const feedback = document.createElement('div');
    feedback.className = 'link-banner-feedback link-banner-feedback-success';
    feedback.textContent = message;

    banner.appendChild(feedback);

    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }

  /**
   * Show error feedback
   * @param {HTMLElement} banner - Banner element
   * @param {string} error - Error message
   */
  showError(banner, error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'link-banner-feedback link-banner-feedback-error';
    errorDiv.textContent = `Error: ${error}`;

    banner.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.style.opacity = '0';
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }

  /**
   * Remove banner
   * @param {string} activityId - Activity ID
   */
  remove(activityId) {
    const banner = document.querySelector(`.link-banner[data-activity-id="${activityId}"]`);
    if (banner) {
      banner.remove();
    }
  }

  /**
   * Check if activity has multiple sources
   * @param {Object} activity - Activity data
   * @returns {boolean} True if has multiple sources
   */
  hasMultipleSources(activity) {
    const sources = activity.source_set || {};
    return Object.keys(sources).length >= 2;
  }

  /**
   * Get preferred source for activity
   * @param {number} activityId - Activity ID
   * @returns {Promise<string|null>} Preferred source or null
   */
  async getPreferredSource(activityId) {
    try {
      if (this.storageManager) {
        const preference = await this.storageManager.getItem(
          `activity_${activityId}_preferred_source`
        );
        return preference;
      }
    } catch (error) {
      this.logger.error('Error getting preferred source:', error);
    }
    return null;
  }

  /**
   * Set preferred source for activity
   * @param {number} activityId - Activity ID
   * @param {string} source - Preferred source
   */
  async setPreferredSource(activityId, source) {
    try {
      if (this.storageManager) {
        await this.storageManager.setItem(`activity_${activityId}_preferred_source`, source);
        this.logger.info('Preferred source set', { activityId, source });
      }
    } catch (error) {
      this.logger.error('Error setting preferred source:', error);
    }
  }
}

// Export for browser
if (typeof window !== 'undefined') {
  window.LinkBanner = LinkBanner;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkBanner;
}
