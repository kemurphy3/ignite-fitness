/**
 * Today View Component
 * Shows today's planned workout with substitution capabilities
 */

import SessionLogger from './SessionLogger.js';

class TodayView {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.authManager = window.AuthManager;
    this.eventBus = window.EventBus;

    this.todayData = {
      planned_session: null,
      substitutions: [],
      completed_sessions: [],
      date: new Date().toISOString().split('T')[0],
    };

    this.isLoadingSubstitutions = false;
    this.sessionLogger = new SessionLogger();
  }

  /**
   * Initialize Today view
   */
  async initialize() {
    try {
      await this.loadTodayData();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      this.logger.error('Failed to initialize Today view:', error);
    }
  }

  /**
   * Load today's data (planned session, completed sessions)
   */
  async loadTodayData() {
    try {
      // Load planned session
      this.todayData.planned_session = await this.loadPlannedSession();

      // Load completed sessions for today
      this.todayData.completed_sessions = await this.loadCompletedSessions();

      this.logger.info('Today data loaded:', {
        hasPlanned: !!this.todayData.planned_session,
        completedCount: this.todayData.completed_sessions.length,
      });
    } catch (error) {
      this.logger.error('Failed to load today data:', error);
    }
  }

  /**
   * Render Today view
   */
  render() {
    const container = this.getContainer();

    container.innerHTML = `
            <div class="today-view">
                <div class="today-header">
                    <h1>Today's Training</h1>
                    <p class="today-date">${this.formatDate(this.todayData.date)}</p>
                </div>

                <div class="today-content">
                    ${this.renderPlannedSession()}
                    ${this.renderSubstitutions()}
                    ${this.renderCompletedSessions()}
                    ${this.renderQuickActions()}
                </div>
            </div>
        `;
  }

  /**
   * Render planned session card
   */
  renderPlannedSession() {
    const planned = this.todayData.planned_session;

    if (!planned) {
      return `
                <div class="planned-session-card empty">
                    <h2>No Planned Workout</h2>
                    <p>You have a rest day today, or no workout is scheduled.</p>
                    <div class="empty-actions">
                        <button class="btn-primary" onclick="window.todayView.logWorkout()">Log a workout</button>
                        <button class="btn-secondary" onclick="window.todayView.browsePlans()">Browse workouts</button>
                    </div>
                </div>
            `;
    }

    return `
            <div class="planned-session-card">
                <div class="session-header">
                    <h2>${planned.name || "Today's Workout"}</h2>
                    <div class="session-meta">
                        <span class="modality">${this.capitalizeFirst(planned.modality)}</span>
                        <span class="duration">⏱️ ${planned.time_required || planned.duration_minutes || 0}min</span>
                        <span class="load">Load: ${planned.estimated_load || 'TBD'}</span>
                    </div>
                </div>

                <div class="session-details">
                    <div class="adaptation">
                        <strong>Focus:</strong> ${planned.adaptation || 'General fitness'}
                    </div>

                    ${this.renderSessionStructure(planned)}

                    ${
                      planned.equipment_required && planned.equipment_required.length > 0
                        ? `
                        <div class="equipment-needed">
                            <strong>Equipment:</strong> ${planned.equipment_required.join(', ')}
                        </div>
                    `
                        : ''
                    }
                </div>

                <div class="session-actions">
                    <button class="btn-primary start-workout" onclick="window.todayView.startWorkout()">
                        Start Workout
                    </button>

                    <button class="btn-secondary substitute-btn" onclick="window.todayView.showSubstitutions()"
                            ${this.isLoadingSubstitutions ? 'disabled' : ''}>
                        ${this.isLoadingSubstitutions ? 'Loading...' : '🔄 Substitute'}
                    </button>

                    <button class="btn-secondary skip-btn" onclick="window.todayView.skipWorkout()">
                        Skip Today
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render session structure
   */
  renderSessionStructure(session) {
    if (!session.structure || session.structure.length === 0) {
      return `
                <div class="session-structure">
                    <div class="structure-block">
                        <span class="block-type">Duration:</span>
                        <span class="block-details">${session.duration_minutes || session.time_required}min at ${session.intensity || 'moderate'} intensity</span>
                    </div>
                </div>
            `;
    }

    return `
            <div class="session-structure">
                ${session.structure.map(block => this.renderStructureBlock(block)).join('')}
            </div>
        `;
  }

  /**
   * Render individual structure block
   */
  renderStructureBlock(block) {
    const blockClass = `structure-block ${block.block_type}`;

    if (block.sets) {
      // Interval block
      return `
                <div class="${blockClass}">
                    <span class="block-type">${this.capitalizeFirst(block.block_type)}:</span>
                    <span class="block-details">
                        ${block.sets}× ${this.formatDuration(block.work_duration)}
                        ${block.rest_duration ? `/ ${this.formatDuration(block.rest_duration)} rest` : ''}
                        at ${block.intensity}
                    </span>
                </div>
            `;
    } else {
      // Continuous block
      return `
                <div class="${blockClass}">
                    <span class="block-type">${this.capitalizeFirst(block.block_type)}:</span>
                    <span class="block-details">
                        ${this.formatDuration(block.duration)} at ${block.intensity || 'easy'}
                    </span>
                </div>
            `;
    }
  }

  /**
   * Render substitution options
   */
  renderSubstitutions() {
    if (this.todayData.substitutions.length === 0) {
      return '';
    }

    return `
            <div class="substitutions-section">
                <h3>Alternative Workouts</h3>
                <div class="substitution-cards">
                    ${this.todayData.substitutions.map((sub, index) => this.renderSubstitutionCard(sub, index)).join('')}
                </div>
            </div>
        `;
  }

  /**
   * Render substitution card
   */
  renderSubstitutionCard(substitution, index) {
    return `
            <div class="substitution-card">
                <div class="sub-header">
                    <h4>${substitution.name}</h4>
                    <div class="sub-meta">
                        <span class="sub-modality">${this.capitalizeFirst(substitution.modality)}</span>
                        <span class="sub-duration">⏱️ ${substitution.duration_minutes}min</span>
                        <span class="sub-load">Load: ${substitution.estimated_load}</span>
                    </div>
                </div>

                <div class="sub-details">
                    <div class="load-comparison">
                        <span class="variance ${this.getVarianceClass(substitution.load_variance_percent)}">
                            ${substitution.load_variance_percent}% load difference
                        </span>
                        <span class="confidence">
                            ${Math.round(substitution.confidence_score * 100)}% confidence
                        </span>
                    </div>

                    <div class="sub-reasoning">
                        ${substitution.reasoning}
                    </div>
                </div>

                <div class="sub-actions">
                    <button class="btn-primary use-substitution" onclick="window.todayView.useSubstitution(${index})">
                        Use This Instead
                    </button>
                    <button class="btn-secondary view-details" onclick="window.todayView.viewSubstitutionDetails(${index})">
                        View Details
                    </button>
                </div>
            </div>
        `;
  }

  /**
   * Render completed sessions
   */
  renderCompletedSessions() {
    if (this.todayData.completed_sessions.length === 0) {
      return '';
    }

    return `
            <div class="completed-sessions">
                <h3>Completed Today</h3>
                <div class="completed-list">
                    ${this.todayData.completed_sessions.map(session => this.renderCompletedSession(session)).join('')}
                </div>
            </div>
        `;
  }

  /**
   * Render completed session
   */
  renderCompletedSession(session) {
    return `
            <div class="completed-session">
                <div class="session-info">
                    <span class="session-name">${session.workout_name}</span>
                    <span class="session-meta">
                        ${session.duration}min • RPE ${session.rpe || 'N/A'} • Load ${session.calculated_load || 'N/A'}
                    </span>
                </div>
                <div class="session-time">
                    ${this.formatTime(session.logged_at)}
                </div>
            </div>
        `;
  }

  /**
   * Render quick actions
   */
  renderQuickActions() {
    return `
            <div class="quick-actions">
                <h3>Quick Actions</h3>
                <div class="action-buttons">
                    <button class="action-btn log-workout" onclick="window.todayView.logWorkout()">
                        <span class="action-icon">📝</span>
                        <span class="action-text">Log Workout</span>
                    </button>

                    <button class="action-btn view-week" onclick="window.todayView.viewWeek()">
                        <span class="action-icon">📅</span>
                        <span class="action-text">View Week</span>
                    </button>

                    <button class="action-btn browse-plans" onclick="window.todayView.browsePlans()">
                        <span class="action-icon">🔍</span>
                        <span class="action-text">Browse Plans</span>
                    </button>
                </div>
            </div>
        `;
  }

  // Event handlers

  /**
   * Start the planned workout
   */
  startWorkout() {
    if (!this.todayData.planned_session) {
      return;
    }

    // Emit event to start workout tracker
    if (this.eventBus) {
      this.eventBus.emit('workout:start', {
        session: this.todayData.planned_session,
      });
    }

    this.logger.info('Starting workout:', this.todayData.planned_session.name);
  }

  /**
   * Show substitution options
   */
  async showSubstitutions() {
    if (!this.todayData.planned_session) {
      return;
    }

    try {
      this.isLoadingSubstitutions = true;
      this.updateSubstituteButton();

      // Get user profile for constraints
      const userProfile = await this.getUserProfile();

      // Request substitutions for each modality
      const modalities = ['running', 'cycling', 'swimming'].filter(
        mod => mod !== this.todayData.planned_session.modality
      );

      let allSubstitutions = [];

      for (const modality of modalities) {
        try {
          const substitutions = await this.requestSubstitutions(
            this.todayData.planned_session,
            modality,
            userProfile
          );
          allSubstitutions = allSubstitutions.concat(substitutions);
        } catch (error) {
          this.logger.warn(`Failed to get ${modality} substitutions:`, error);
        }
      }

      // Sort by quality score and take top 3
      this.todayData.substitutions = allSubstitutions
        .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
        .slice(0, 3);

      // Re-render to show substitutions
      this.render();

      // Scroll to substitutions
      const subsSection = document.querySelector('.substitutions-section');
      if (subsSection) {
        subsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (error) {
      this.logger.error('Failed to load substitutions:', error);
      this.showError('Failed to load substitutions. Please try again.');
    } finally {
      this.isLoadingSubstitutions = false;
      this.updateSubstituteButton();
    }
  }

  /**
   * Request substitutions from API
   */
  async requestSubstitutions(plannedSession, targetModality, userProfile) {
    const payload = {
      planned_session: plannedSession,
      target_modality: targetModality,
      user_context: {
        equipment: userProfile.equipment_access || [],
        available_time: userProfile.time_windows?.typical_duration || 90,
        user_profile: {
          training_level: userProfile.training_level || 'intermediate',
        },
      },
    };

    const response = await fetch('/.netlify/functions/substitutions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.authManager?.getToken() || ''}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Substitution request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.substitutions || [];
  }

  /**
   * Use selected substitution
   */
  async useSubstitution(index) {
    const substitution = this.todayData.substitutions[index];
    if (!substitution) {
      return;
    }

    try {
      // Replace planned session with substitution
      this.todayData.planned_session = {
        ...substitution,
        is_substitution: true,
        original_session: this.todayData.planned_session,
      };

      // Clear substitutions
      this.todayData.substitutions = [];

      // Save the change
      await this.savePlannedSession(this.todayData.planned_session);

      // Re-render
      this.render();

      // Show success message
      this.showSuccess(`Switched to ${substitution.name}`);

      // Emit event
      if (this.eventBus) {
        this.eventBus.emit('session:substituted', {
          original: this.todayData.planned_session.original_session,
          substitution,
        });
      }
    } catch (error) {
      this.logger.error('Failed to use substitution:', error);
      this.showError('Failed to switch workout. Please try again.');
    }
  }

  /**
   * View substitution details
   */
  viewSubstitutionDetails(index) {
    const substitution = this.todayData.substitutions[index];
    if (!substitution) {
      return;
    }

    // Create detailed view modal
    const modal = document.createElement('div');
    modal.className = 'substitution-modal';
    modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${substitution.name}</h3>
                    <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="sub-structure">
                        ${this.renderSessionStructure(substitution)}
                    </div>
                    <div class="sub-reasoning-full">
                        <h4>Why this substitution?</h4>
                        <p>${substitution.reasoning}</p>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    // Close on outside click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Skip today's workout
   */
  async skipWorkout() {
    if (confirm("Skip today's workout? This will mark it as skipped.")) {
      try {
        // Log as skipped session
        const skippedRecord = {
          user_id:
            this.authManager?.getCurrentUserId() ||
            this.authManager?.getCurrentUsername() ||
            'anonymous',
          session_id: `skipped_${Date.now()}`,
          date: this.todayData.date,
          workout_name: this.todayData.planned_session?.name || 'Planned workout',
          status: 'skipped',
          logged_at: new Date().toISOString(),
        };

        await this.saveSkippedSession(skippedRecord);

        // Clear planned session
        this.todayData.planned_session = null;

        this.render();
        this.showSuccess('Workout marked as skipped');
      } catch (error) {
        this.logger.error('Failed to skip workout:', error);
        this.showError('Failed to skip workout');
      }
    }
  }

  /**
   * Show session logger
   */
  logWorkout() {
    this.sessionLogger.show();
  }

  /**
   * Browse workout plans
   */
  browsePlans() {
    // Navigate to workout browser
    if (this.eventBus) {
      this.eventBus.emit('navigate:workouts');
    }
  }

  /**
   * View week view
   */
  viewWeek() {
    if (this.eventBus) {
      this.eventBus.emit('navigate:week');
    }
  }

  // Data loading methods

  /**
   * Load planned session for today
   */
  async loadPlannedSession() {
    try {
      // Try local storage first
      const localPlans = (await this.storageManager?.getItem('planned_sessions')) || {};
      if (localPlans[this.todayData.date]) {
        return localPlans[this.todayData.date];
      }

      // Try API
      const response = await fetch(
        `/.netlify/functions/sessions-planned?date=${this.todayData.date}`,
        {
          headers: {
            Authorization: `Bearer ${this.authManager?.getToken() || ''}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.planned_session;
      }
    } catch (error) {
      this.logger.warn('Failed to load planned session:', error);
    }

    return null;
  }

  /**
   * Load completed sessions for today
   */
  async loadCompletedSessions() {
    try {
      // Try local storage first
      const localSessions = (await this.storageManager?.getItem('logged_sessions')) || [];
      const todaySessions = localSessions.filter(session => session.date === this.todayData.date);

      if (todaySessions.length > 0) {
        return todaySessions;
      }

      // Try API
      const response = await fetch(
        `/.netlify/functions/sessions-list?date=${this.todayData.date}`,
        {
          headers: {
            Authorization: `Bearer ${this.authManager?.getToken() || ''}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.sessions || [];
      }
    } catch (error) {
      this.logger.warn('Failed to load completed sessions:', error);
    }

    return [];
  }

  /**
   * Get user profile
   */
  async getUserProfile() {
    try {
      const profile = (await this.storageManager?.getItem('user_profile')) || {};
      return profile;
    } catch (error) {
      this.logger.warn('Failed to load user profile:', error);
      return {};
    }
  }

  /**
   * Save planned session
   */
  async savePlannedSession(session) {
    try {
      const localPlans = (await this.storageManager?.getItem('planned_sessions')) || {};
      localPlans[this.todayData.date] = session;
      await this.storageManager?.setItem('planned_sessions', localPlans);
    } catch (error) {
      this.logger.error('Failed to save planned session:', error);
    }
  }

  /**
   * Save skipped session record
   */
  async saveSkippedSession(record) {
    try {
      const skippedSessions = (await this.storageManager?.getItem('skipped_sessions')) || [];
      skippedSessions.push(record);
      await this.storageManager?.setItem('skipped_sessions', skippedSessions);
    } catch (error) {
      this.logger.error('Failed to save skipped session:', error);
    }
  }

  // Utility methods

  /**
   * Update substitute button state
   */
  updateSubstituteButton() {
    const btn = document.querySelector('.substitute-btn');
    if (btn) {
      btn.disabled = this.isLoadingSubstitutions;
      btn.textContent = this.isLoadingSubstitutions ? 'Loading...' : '🔄 Substitute';
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    return date.toLocaleDateString('en', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format time for display
   */
  formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString('en', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Format duration from seconds to human readable
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get variance class for styling
   */
  getVarianceClass(variance) {
    const absVariance = Math.abs(variance);
    if (absVariance <= 5) {
      return 'excellent';
    }
    if (absVariance <= 10) {
      return 'good';
    }
    if (absVariance <= 15) {
      return 'acceptable';
    }
    return 'high';
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showMessage(message, 'error');
  }

  /**
   * Show message
   */
  showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `today-message today-${type}`;
    messageDiv.textContent = message;

    const container = this.getContainer();
    container.insertBefore(messageDiv, container.firstChild);

    setTimeout(() => messageDiv.remove(), 5000);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Store reference for onclick handlers
    window.todayView = this;

    // Listen for session logging events
    if (this.eventBus) {
      this.eventBus.on('session:logged', () => {
        this.loadTodayData().then(() => this.render());
      });
    }
  }

  /**
   * Get container element
   */
  getContainer() {
    let container = document.getElementById('today-view-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'today-view-container';
      document.body.appendChild(container);
    }
    return container;
  }
}

export default TodayView;
