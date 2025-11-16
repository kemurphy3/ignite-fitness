/**
 * StravaImportUI - Simple UI for Strava activity import
 * Provides import button and displays last import time
 */
class StravaImportUI {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.stravaProcessor = window.StravaProcessor; // This now points to StravaDataProcessor instance
    this.storageManager = window.StorageManager;
  }

  /**
   * Render Strava import section
   * @param {HTMLElement} container - Container element
   */
  render(container) {
    if (!container) {
      return;
    }

    const lastImportTime = this.stravaProcessor.getLastImportTime();
    const hasToken = this.hasStravaToken();

    const html = this.generateHTML(lastImportTime, hasToken);
    container.innerHTML = html;

    // Attach event listeners
    this.attachEventListeners(container);
  }

  /**
   * Generate HTML for Strava import section
   * @param {string|null} lastImportTime - Last import time
   * @param {boolean} hasToken - Whether user has Strava token
   * @returns {string} HTML markup
   */
  generateHTML(lastImportTime, hasToken) {
    const lastImportText = lastImportTime
      ? `Last import: ${this.formatImportTime(lastImportTime)}`
      : 'No imports yet';

    return `
            <div class="strava-import-section">
                <div class="strava-header">
                    <h3>🏃‍♂️ Strava Integration</h3>
                    <span class="import-status ${hasToken ? 'connected' : 'disconnected'}">
                        ${hasToken ? 'Connected' : 'Not Connected'}
                    </span>
                </div>
                
                <div class="strava-content">
                    <p class="strava-description">
                        Import your Strava activities to better understand your training load and recovery needs.
                    </p>
                    
                    <div class="import-options">
                        ${hasToken ? this.renderTokenImport() : this.renderFileImport()}
                    </div>
                    
                    <div class="import-info">
                        <div class="last-import">
                            <span class="info-label">Last Import:</span>
                            <span class="info-value">${lastImportText}</span>
                        </div>
                        
                        <div class="import-help">
                            <button type="button" class="help-btn" onclick="showStravaHelp()">
                                How to export from Strava
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="recent-activities" id="recentActivitiesContainer">
                    ${this.renderRecentActivities()}
                </div>
            </div>
        `;
  }

  /**
   * Render token-based import (future feature)
   * @returns {string} HTML for token import
   */
  renderTokenImport() {
    return `
            <div class="token-import">
                <button type="button" class="btn primary" onclick="importFromStrava()">
                    Import Recent Activities
                </button>
                <p class="import-note">Automatically sync your last 30 activities</p>
            </div>
        `;
  }

  /**
   * Render file-based import (MVP)
   * @returns {string} HTML for file import
   */
  renderFileImport() {
    return `
            <div class="file-import">
                <div class="file-upload-area" id="fileUploadArea">
                    <input type="file" id="stravaFileInput" accept=".json" style="display: none;">
                    <div class="upload-prompt" onclick="document.getElementById('stravaFileInput').click()">
                        <div class="upload-icon">📁</div>
                        <div class="upload-text">
                            <strong>Choose Strava Export File</strong>
                            <small>Select your exported activities.json file</small>
                        </div>
                    </div>
                </div>
                
                <div class="import-actions">
                    <button type="button" class="btn secondary" onclick="showStravaHelp()">
                        How to Export
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render recent activities list
   * @returns {string} HTML for recent activities
   */
  renderRecentActivities() {
    const activities = this.stravaProcessor.getRecentActivities();

    if (activities.length === 0) {
      return `
                <div class="no-activities">
                    <p>No recent activities imported yet.</p>
                </div>
            `;
    }

    const activitiesHTML = activities
      .slice(-5)
      .map(
        activity => `
            <div class="activity-item" data-activity-id="${activity.id}">
                <div class="activity-info">
                    <span class="activity-type">${this.getActivityIcon(activity.type)}</span>
                    <span class="activity-name">${activity.rawData?.name || `${activity.type} activity`}</span>
                    <span class="activity-time">${this.formatActivityTime(activity.startTime)}</span>
                </div>
                <div class="activity-stats">
                    <span class="activity-duration">${activity.duration}min</span>
                    <span class="activity-load">Load: ${activity.trainingLoad}</span>
                </div>
                <div class="activity-actions">
                    <button type="button" class="btn-remove" onclick="removeStravaActivity('${activity.id}')" title="Remove">
                        ×
                    </button>
                </div>
            </div>
        `
      )
      .join('');

    return `
            <div class="recent-activities-list">
                <h4>Recent Activities (${activities.length})</h4>
                <div class="activities-container">
                    ${activitiesHTML}
                </div>
            </div>
        `;
  }

  /**
   * Attach event listeners to container
   * @param {HTMLElement} container - Container element
   */
  attachEventListeners(container) {
    const fileInput = container.querySelector('#stravaFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        this.handleFileSelect(e.target.files[0]);
      });
    }
  }

  /**
   * Handle file selection
   * @param {File} file - Selected file
   */
  async handleFileSelect(file) {
    if (!file) {
      return;
    }

    try {
      // Show loading state
      this.showLoadingState();

      // Process file
      const result = await this.stravaProcessor.handleFileUpload(file);

      // Show success
      this.showSuccessState(result);

      // Refresh the UI
      this.refresh();
    } catch (error) {
      this.showErrorState(error);
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    const uploadArea = document.getElementById('fileUploadArea');
    if (uploadArea) {
      uploadArea.innerHTML = `
                <div class="upload-loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Processing activities...</div>
                </div>
            `;
    }
  }

  /**
   * Show success state
   * @param {Object} result - Processing result
   */
  showSuccessState(result) {
    const uploadArea = document.getElementById('fileUploadArea');
    if (uploadArea) {
      uploadArea.innerHTML = `
                <div class="upload-success">
                    <div class="success-icon">✅</div>
                    <div class="success-text">
                        <strong>Import Complete!</strong>
                        <small>${result.processed} activities imported</small>
                        ${result.duplicates > 0 ? `<small>${result.duplicates} duplicates skipped</small>` : ''}
                    </div>
                </div>
            `;
    }

    // Auto-refresh after 2 seconds
    setTimeout(() => {
      this.refresh();
    }, 2000);
  }

  /**
   * Show error state
   * @param {Error} error - Error object
   */
  showErrorState(error) {
    const uploadArea = document.getElementById('fileUploadArea');
    if (uploadArea) {
      uploadArea.innerHTML = `
                <div class="upload-error">
                    <div class="error-icon">❌</div>
                    <div class="error-text">
                        <strong>Import Failed</strong>
                        <small>${error.message}</small>
                    </div>
                </div>
            `;
    }
  }

  /**
   * Refresh the UI
   */
  refresh() {
    const container = document.querySelector('.strava-import-section');
    if (container) {
      this.render(container.parentElement);
    }
  }

  /**
   * Check if user has Strava token
   * @returns {boolean} Whether token exists
   */
  hasStravaToken() {
    // For MVP, always return false (no token support yet)
    return false;
  }

  /**
   * Format import time
   * @param {string} timeString - ISO time string
   * @returns {string} Formatted time
   */
  formatImportTime(timeString) {
    try {
      const date = new Date(timeString);
      return date.toLocaleString();
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Format activity time
   * @param {string} timeString - ISO time string
   * @returns {string} Formatted time
   */
  formatActivityTime(timeString) {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Get activity icon
   * @param {string} type - Activity type
   * @returns {string} Icon emoji
   */
  getActivityIcon(type) {
    const icons = {
      run: '🏃‍♂️',
      cycle: '🚴‍♂️',
      swim: '🏊‍♂️',
      strength: '💪',
      recovery: '🧘‍♂️',
      other: '🏃‍♂️',
    };
    return icons[type] || '🏃‍♂️';
  }
}

// Global functions for HTML onclick handlers
window.importFromStrava = async function () {
  // Future: implement token-based import
  const logger = window.SafeLogger || console;
  logger.info('Token-based import not implemented yet');
};

window.removeStravaActivity = async function (activityId) {
  const logger = window.SafeLogger || console;
  try {
    const success = await window.StravaProcessor.removeExternalActivity(activityId);
    if (success) {
      // Refresh the UI
      const ui = new StravaImportUI();
      ui.refresh();
    }
  } catch (error) {
    logger.error('Failed to remove activity', {
      error: error.message,
      stack: error.stack,
      activityId,
    });
  }
};

window.showStravaHelp = function () {
  const message = `How to export from Strava:

1. Go to strava.com and log in
2. Click your profile picture → Settings
3. Go to "My Account" tab
4. Scroll down to "Download or Delete Your Account"
5. Click "Request Your Archive"
6. Wait for email with download link
7. Download and extract the ZIP file
8. Find "activities.json" in the extracted folder
9. Upload that file here

Note: This is a manual process. Automatic sync coming soon!`;

  if (window.showInfoNotification) {
    window.showInfoNotification(message, 'info');
  } else if (window.LiveRegionManager) {
    window.LiveRegionManager.announce(message, 'assertive');
  } else {
    (window.SafeLogger || console).info(message);
  }
};

window.StravaImportUI = StravaImportUI;
