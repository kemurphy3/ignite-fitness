/**
 * ErrorAlert Component
 * Displays specific warnings when expert systems fail with fallback recommendations
 */

class ErrorAlert {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.container = null;
    this.alerts = new Map(); // Track active alerts
  }

  /**
   * Initialize the error alert system
   * @param {string} containerId - ID of the container element
   */
  init(containerId = 'error-alerts-container') {
    if (typeof document === 'undefined') {
      this.logger.info('ErrorAlert system initialized (test mode)');
      return;
    }

    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = this.createContainer(containerId);
    }
    this.logger.info('ErrorAlert system initialized');
  }

  /**
   * Create the error alerts container if it doesn't exist
   * @param {string} containerId - ID for the container
   * @returns {HTMLElement} The container element
   */
  createContainer(containerId) {
    if (typeof document === 'undefined') {
      return null;
    }

    const container = document.createElement('div');
    container.id = containerId;
    container.className = 'error-alerts-container';
    container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 400px;
            pointer-events: none;
        `;
    document.body.appendChild(container);
    return container;
  }

  /**
   * Show an expert system failure alert
   * @param {Object} options - Alert options
   * @param {string} options.expertType - Type of expert that failed (strength, sports, physio, nutrition, aesthetics)
   * @param {string} options.errorMessage - Error message
   * @param {string} options.fallbackMessage - Fallback recommendation message
   * @param {string} options.severity - Alert severity (warning, error, info)
   * @param {number} options.duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
   * @returns {string} Alert ID
   */
  showExpertFailureAlert(options) {
    const {
      expertType = 'unknown',
      errorMessage = 'Expert system unavailable',
      fallbackMessage = 'Using fallback recommendations',
      severity = 'warning',
      duration = 10000,
    } = options;

    const alertId = `alert_${expertType}_${Date.now()}`;

    // In test mode or when container is not available, just track the alert
    if (!this.container) {
      this.alerts.set(alertId, {
        element: null,
        timestamp: Date.now(),
        expertType,
        severity,
      });

      this.logger.info('Expert failure alert shown (test mode)', {
        expertType,
        severity,
        alertId,
      });

      return alertId;
    }

    const alertElement = this.createAlertElement({
      id: alertId,
      expertType,
      errorMessage,
      fallbackMessage,
      severity,
    });

    this.container.appendChild(alertElement);
    this.alerts.set(alertId, {
      element: alertElement,
      timestamp: Date.now(),
      expertType,
      severity,
    });

    // Auto-dismiss if duration is specified
    if (duration > 0) {
      setTimeout(() => {
        this.dismissAlert(alertId);
      }, duration);
    }

    this.logger.info('Expert failure alert shown', {
      expertType,
      severity,
      alertId,
    });

    return alertId;
  }

  /**
   * Create an alert element
   * @param {Object} options - Alert options
   * @returns {HTMLElement} Alert element
   */
  createAlertElement(options) {
    const { id, expertType, errorMessage, fallbackMessage, severity } = options;

    const alert = document.createElement('div');
    alert.id = id;
    alert.className = `error-alert error-alert--${severity}`;
    alert.style.cssText = `
            background: ${this.getSeverityColor(severity)};
            color: white;
            padding: 16px;
            margin-bottom: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            pointer-events: auto;
            animation: slideInRight 0.3s ease-out;
            border-left: 4px solid ${this.getSeverityBorderColor(severity)};
        `;

    const expertIcon = this.getExpertIcon(expertType);
    const severityIcon = this.getSeverityIcon(severity);

    alert.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    ${expertIcon}
                    ${severityIcon}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">
                        ${this.getExpertDisplayName(expertType)} Expert Unavailable
                    </div>
                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">
                        ${errorMessage}
                    </div>
                    <div style="font-size: 13px; opacity: 0.8; font-style: italic;">
                        ${fallbackMessage}
                    </div>
                </div>
                <button onclick="window.ErrorAlert.dismissAlert('${id}')" 
                        style="background: none; border: none; color: white; cursor: pointer; padding: 4px; opacity: 0.7; hover:opacity: 1;">
                    ✕
                </button>
            </div>
        `;

    return alert;
  }

  /**
   * Get expert icon
   * @param {string} expertType - Type of expert
   * @returns {string} HTML for expert icon
   */
  getExpertIcon(expertType) {
    const icons = {
      strength: '💪',
      sports: '🏃',
      physio: '🏥',
      nutrition: '🥗',
      aesthetics: '💎',
      unknown: '❓',
    };
    return `<span style="font-size: 18px;">${icons[expertType] || icons.unknown}</span>`;
  }

  /**
   * Get severity icon
   * @param {string} severity - Alert severity
   * @returns {string} HTML for severity icon
   */
  getSeverityIcon(severity) {
    const icons = {
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️',
    };
    return `<span style="font-size: 16px;">${icons[severity] || icons.warning}</span>`;
  }

  /**
   * Get expert display name
   * @param {string} expertType - Type of expert
   * @returns {string} Display name
   */
  getExpertDisplayName(expertType) {
    const names = {
      strength: 'Strength',
      sports: 'Sports',
      physio: 'Physio',
      nutrition: 'Nutrition',
      aesthetics: 'Aesthetics',
      unknown: 'Unknown',
    };
    return names[expertType] || names.unknown;
  }

  /**
   * Get severity color
   * @param {string} severity - Alert severity
   * @returns {string} CSS color
   */
  getSeverityColor(severity) {
    const colors = {
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    };
    return colors[severity] || colors.warning;
  }

  /**
   * Get severity border color
   * @param {string} severity - Alert severity
   * @returns {string} CSS color
   */
  getSeverityBorderColor(severity) {
    const colors = {
      warning: '#d97706',
      error: '#dc2626',
      info: '#2563eb',
    };
    return colors[severity] || colors.warning;
  }

  /**
   * Dismiss an alert
   * @param {string} alertId - Alert ID to dismiss
   */
  dismissAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return;
    }

    const { element } = alert;
    if (element && element.parentNode) {
      element.style.animation = 'slideOutRight 0.3s ease-in';

      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 300);
    }

    this.alerts.delete(alertId);

    this.logger.info('Alert dismissed', { alertId });
  }

  /**
   * Dismiss all alerts
   */
  dismissAllAlerts() {
    for (const alertId of this.alerts.keys()) {
      this.dismissAlert(alertId);
    }
  }

  /**
   * Show a general error alert
   * @param {Object} options - Alert options
   * @returns {string} Alert ID
   */
  showErrorAlert(options) {
    return this.showExpertFailureAlert({
      expertType: 'unknown',
      severity: 'error',
      ...options,
    });
  }

  /**
   * Show a warning alert
   * @param {Object} options - Alert options
   * @returns {string} Alert ID
   */
  showWarningAlert(options) {
    return this.showExpertFailureAlert({
      expertType: 'unknown',
      severity: 'warning',
      ...options,
    });
  }

  /**
   * Show an info alert
   * @param {Object} options - Alert options
   * @returns {string} Alert ID
   */
  showInfoAlert(options) {
    return this.showExpertFailureAlert({
      expertType: 'unknown',
      severity: 'info',
      ...options,
    });
  }

  /**
   * Get active alerts count
   * @returns {number} Number of active alerts
   */
  getActiveAlertsCount() {
    return this.alerts.size;
  }

  /**
   * Get alerts by expert type
   * @param {string} expertType - Expert type to filter by
   * @returns {Array} Array of alert objects
   */
  getAlertsByExpertType(expertType) {
    return Array.from(this.alerts.values()).filter(alert => alert.expertType === expertType);
  }

  /**
   * Clean up old alerts
   * @param {number} maxAge - Maximum age in milliseconds
   */
  cleanupOldAlerts(maxAge = 300000) {
    // 5 minutes default
    const now = Date.now();
    for (const [alertId, alert] of this.alerts.entries()) {
      if (now - alert.timestamp > maxAge) {
        this.dismissAlert(alertId);
      }
    }
  }
}

// Add CSS animations
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .error-alert {
            transition: all 0.3s ease;
        }
        
        .error-alert:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
    `;
  document.head.appendChild(style);
}

// Export for browser
if (typeof window !== 'undefined') {
  window.ErrorAlert = new ErrorAlert();
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorAlert;
}
