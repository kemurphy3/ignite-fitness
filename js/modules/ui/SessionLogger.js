/**
 * Session Logger UI
 * Simple interface for logging workouts with load calculation
 */

import LoadCalculationEngine from '../load/LoadCalculationEngine.js';

const RPE_MULTIPLIERS = {
  1: 0.6,
  2: 0.65,
  3: 0.7,
  4: 0.8,
  5: 0.9,
  6: 1.0,
  7: 1.1,
  8: 1.2,
  9: 1.3,
  10: 1.4,
};

class SessionLogger {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.authManager = window.AuthManager;
    this.eventBus = window.EventBus;
    this.isLogging = false;
    this.intensityManuallySet = false;

    Object.defineProperty(this, 'sessionData', {
      configurable: true,
      enumerable: true,
      get: () => this._sessionData,
      set: value => {
        this._sessionData = this.mergeSessionData(value);
      },
    });

    this.sessionData = this.getDefaultSessionData();
  }

  /**
   * Default session data template
   * @returns {Object} Default session data
   */
  getDefaultSessionData() {
    return {
      date: new Date().toISOString().split('T')[0],
      workout_name: '',
      modality: '',
      duration_minutes: '',
      distance: '',
      distance_unit: 'km',
      rpe: '',
      hr_data: {
        avg_hr: '',
        max_hr: '',
      },
      intensity: '',
      notes: '',
      sets: 0,
      reps: 0,
      weight: 0,
    };
  }

  /**
   * Merge incoming session data with defaults
   * @param {Object} data - Incoming session data
   * @returns {Object} Merged session data
   */
  mergeSessionData(data = {}) {
    const defaults = this.getDefaultSessionData();
    const incoming = data || {};

    const merged = {
      ...defaults,
      ...incoming,
    };

    merged.hr_data = {
      ...defaults.hr_data,
      ...(incoming.hr_data || {}),
    };

    merged.sets = Number(incoming.sets ?? defaults.sets) || 0;
    merged.reps = Number(incoming.reps ?? defaults.reps) || 0;
    merged.weight = Number(incoming.weight ?? defaults.weight) || 0;

    // Reset manual flag unless explicitly set through updateField
    this.intensityManuallySet = false;

    return merged;
  }

  /**
   * Initialize and render session logger
   */
  render() {
    const container = this.getContainer();

    container.innerHTML = `
            <div class="session-logger">
                <div class="logger-header">
                    <h2>Log Workout Session</h2>
                    <button class="close-btn" onclick="window.sessionLogger.close()">×</button>
                </div>

                <form class="session-form" onsubmit="window.sessionLogger.handleSubmit(event)">
                    <div class="form-group">
                        <label for="workout-date">Date</label>
                        <input type="date" id="workout-date" value="${this.sessionData.date}"
                               onchange="window.sessionLogger.updateField('date', this.value)" required>
                    </div>

                    <div class="form-group">
                        <label for="workout-name">Workout Name (optional)</label>
                        <input type="text" id="workout-name" placeholder="e.g., Morning Run, Bike Commute"
                               value="${this.sessionData.workout_name}"
                               onchange="window.sessionLogger.updateField('workout_name', this.value)">
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="modality">Activity Type</label>
                            <select id="modality" onchange="window.sessionLogger.updateField('modality', this.value)" required>
                                <option value="">Select activity</option>
                                <option value="running" ${this.sessionData.modality === 'running' ? 'selected' : ''}>Running</option>
                                <option value="cycling" ${this.sessionData.modality === 'cycling' ? 'selected' : ''}>Cycling</option>
                                <option value="swimming" ${this.sessionData.modality === 'swimming' ? 'selected' : ''}>Swimming</option>
                                <option value="strength" ${this.sessionData.modality === 'strength' ? 'selected' : ''}>Strength Training</option>
                                <option value="other" ${this.sessionData.modality === 'other' ? 'selected' : ''}>Other</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="duration">Duration (minutes)</label>
                            <input type="number" id="duration" min="1" max="600"
                                   value="${this.sessionData.duration_minutes}"
                                   onchange="window.sessionLogger.updateField('duration_minutes', parseInt(this.value))" required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="distance">Distance (optional)</label>
                            <input type="number" id="distance" min="0" step="0.1"
                                   value="${this.sessionData.distance}"
                                   onchange="window.sessionLogger.updateField('distance', parseFloat(this.value))">
                        </div>

                        <div class="form-group">
                            <label for="distance-unit">Unit</label>
                            <select id="distance-unit" onchange="window.sessionLogger.updateField('distance_unit', this.value)">
                                <option value="km" ${this.sessionData.distance_unit === 'km' ? 'selected' : ''}>km</option>
                                <option value="miles" ${this.sessionData.distance_unit === 'miles' ? 'selected' : ''}>miles</option>
                                <option value="m" ${this.sessionData.distance_unit === 'm' ? 'selected' : ''}>meters</option>
                                <option value="yards" ${this.sessionData.distance_unit === 'yards' ? 'selected' : ''}>yards</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="rpe">RPE (Rate of Perceived Exertion)</label>
                        <div class="rpe-input">
                            <input type="range" id="rpe-slider" min="1" max="10"
                                   value="${this.sessionData.rpe || 5}"
                                   oninput="window.sessionLogger.updateRPE(this.value)">
                            <div class="rpe-display">
                                <span class="rpe-value">${this.sessionData.rpe || 5}</span>
                                <span class="rpe-label">${this.getRPELabel(this.sessionData.rpe || 5)}</span>
                            </div>
                        </div>
                        <div class="rpe-scale">
                            <span>1 - Very Easy</span>
                            <span>5 - Moderate</span>
                            <span>10 - Maximal</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="intensity">Training Zone (optional)</label>
                        <select id="intensity" onchange="window.sessionLogger.updateField('intensity', this.value)">
                            <option value="">Auto-estimate from RPE</option>
                            <option value="Z1" ${this.sessionData.intensity === 'Z1' ? 'selected' : ''}>Z1 - Recovery</option>
                            <option value="Z2" ${this.sessionData.intensity === 'Z2' ? 'selected' : ''}>Z2 - Aerobic</option>
                            <option value="Z3" ${this.sessionData.intensity === 'Z3' ? 'selected' : ''}>Z3 - Tempo</option>
                            <option value="Z4" ${this.sessionData.intensity === 'Z4' ? 'selected' : ''}>Z4 - Threshold</option>
                            <option value="Z5" ${this.sessionData.intensity === 'Z5' ? 'selected' : ''}>Z5 - VO2/Anaerobic</option>
                        </select>
                    </div>

                    <div class="hr-section">
                        <h3>Heart Rate (optional)</h3>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="avg-hr">Average HR</label>
                                <input type="number" id="avg-hr" min="30" max="220"
                                       value="${this.sessionData.hr_data.avg_hr}"
                                       onchange="window.sessionLogger.updateHRField('avg_hr', parseInt(this.value))">
                            </div>

                            <div class="form-group">
                                <label for="max-hr">Max HR</label>
                                <input type="number" id="max-hr" min="30" max="220"
                                       value="${this.sessionData.hr_data.max_hr}"
                                       onchange="window.sessionLogger.updateHRField('max_hr', parseInt(this.value))">
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="notes">Notes (optional)</label>
                        <textarea id="notes" rows="3" placeholder="How did the workout feel? Any observations?"
                                  onchange="window.sessionLogger.updateField('notes', this.value)">${this.sessionData.notes}</textarea>
                    </div>

                    <div class="load-preview" style="display: ${this.canCalculateLoad() ? 'block' : 'none'}">
                        <h3>Training Load Preview</h3>
                        <div class="load-calculation">
                            ${this.renderLoadPreview()}
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn-secondary" onclick="window.sessionLogger.close()">Cancel</button>
                        <button type="submit" class="btn-primary" ${this.isLogging ? 'disabled' : ''}>
                            ${this.isLogging ? 'Saving...' : 'Save Session'}
                        </button>
                    </div>
                </form>
            </div>
        `;

    // Store reference for onclick handlers
    window.sessionLogger = this;
  }

  /**
   * Update form field
   */
  updateField(field, value) {
    if (field === 'intensity') {
      this.intensityManuallySet = Boolean(value);
      this.sessionData.intensity = value;
    } else if (field === 'rpe') {
      const numericValue = value === '' ? '' : parseInt(value, 10);
      this.sessionData.rpe = numericValue;
      if (!this.intensityManuallySet) {
        const estimated = this.estimateIntensityFromRPE(numericValue);
        this.sessionData.intensity = estimated;
        const intensitySelect = document.getElementById('intensity');
        if (intensitySelect) {
          intensitySelect.value = estimated;
        }
      }
    } else if (field === 'sets' || field === 'reps' || field === 'weight') {
      this.sessionData[field] = Number(value) || 0;
    } else {
      this.sessionData[field] = value;
    }

    // Update load preview if we can calculate it
    if (this.canCalculateLoad()) {
      this.updateLoadPreview();
    }
  }

  /**
   * Update HR field
   */
  updateHRField(field, value) {
    if (!this.sessionData.hr_data) {
      this.sessionData.hr_data = { avg_hr: '', max_hr: '' };
    }
    this.sessionData.hr_data[field] = value || '';

    if (this.canCalculateLoad()) {
      this.updateLoadPreview();
    }
  }

  /**
   * Update RPE and refresh display
   */
  updateRPE(value) {
    const numericValue = parseInt(value, 10);
    this.sessionData.rpe = isNaN(numericValue) ? '' : numericValue;

    // Update display
    const rpeValue = document.querySelector('.rpe-value');
    const rpeLabel = document.querySelector('.rpe-label');

    if (rpeValue) {
      rpeValue.textContent = value;
    }
    if (rpeLabel) {
      rpeLabel.textContent = this.getRPELabel(value);
    }

    // Auto-estimate intensity
    if (!this.intensityManuallySet) {
      const estimated = this.estimateIntensityFromRPE(numericValue);
      this.sessionData.intensity = estimated;
      const intensitySelect = document.getElementById('intensity');
      if (intensitySelect) {
        intensitySelect.value = estimated;
      }
    }

    if (this.canCalculateLoad()) {
      this.updateLoadPreview();
    }
  }

  /**
   * Get RPE label description
   */
  getRPELabel(rpe) {
    const labels = {
      1: 'Very Easy',
      2: 'Easy',
      3: 'Easy',
      4: 'Moderate',
      5: 'Moderate',
      6: 'Moderate Hard',
      7: 'Hard',
      8: 'Hard',
      9: 'Very Hard',
      10: 'Maximal',
    };
    return labels[parseInt(rpe)] || 'Moderate';
  }

  /**
   * Estimate training zone from RPE
   */
  estimateIntensityFromRPE(rpe) {
    const rpeValue = parseInt(rpe, 10);
    if (!Number.isFinite(rpeValue)) {
      return '';
    }
    if (rpeValue <= 3) {
      return 'Z1';
    }
    if (rpeValue <= 5) {
      return 'Z2';
    }
    if (rpeValue <= 7) {
      return 'Z3';
    }
    if (rpeValue <= 9) {
      return 'Z4';
    }
    return 'Z5';
  }

  /**
   * Check if we can calculate load
   */
  canCalculateLoad() {
    const duration = Number(this.sessionData.duration_minutes) || 0;
    const hasRPE = Number(this.sessionData.rpe) > 0;
    const hasHR = !!(this.sessionData.hr_data && this.sessionData.hr_data.avg_hr);
    const hasIntensity = this.intensityManuallySet && !!this.sessionData.intensity;
    return duration > 0 && (hasRPE || hasHR || hasIntensity);
  }

  /**
   * Render load preview
   */
  renderLoadPreview() {
    if (!this.canCalculateLoad()) {
      return '<p>Enter duration and RPE/HR to see training load</p>';
    }

    try {
      const loadResult = this.calculateCurrentLoad();

      return `
                <div class="load-result">
                    <div class="load-score">
                        <span class="score-value">${loadResult.total_load}</span>
                        <span class="score-label">Training Load</span>
                    </div>
                    <div class="load-method">
                        Method: ${loadResult.method_used} (confidence: ${Math.round(loadResult.confidence * 100)}%)
                    </div>
                    <div class="load-category">
                        Intensity: ${this.getLoadCategory(loadResult.total_load)}
                    </div>
                </div>
            `;
    } catch (error) {
      return '<p class="error">Unable to calculate load</p>';
    }
  }

  /**
   * Update load preview in real-time
   */
  updateLoadPreview() {
    const loadPreview = document.querySelector('.load-calculation');
    if (loadPreview) {
      loadPreview.innerHTML = this.renderLoadPreview();
    }

    // Show/hide load preview section
    const loadSection = document.querySelector('.load-preview');
    if (loadSection) {
      loadSection.style.display = this.canCalculateLoad() ? 'block' : 'none';
    }
  }

  /**
   * Calculate current load for preview
   */
  calculateCurrentLoad() {
    const session = {
      duration_minutes: this.sessionData.duration_minutes,
      rpe: this.sessionData.rpe,
      modality: this.sessionData.modality,
      intensity: this.sessionData.intensity,
      user_profile: this.getUserProfile(),
    };

    if (this.sessionData?.hr_data?.avg_hr) {
      session.hr_data = {
        avg_hr: this.sessionData.hr_data.avg_hr,
      };
    }

    let loadResult = null;

    if (LoadCalculationEngine?.compute_load) {
      loadResult = LoadCalculationEngine.compute_load(session);
    }

    const strengthMetrics = this.calculateStrengthLoad(this.sessionData);
    if (strengthMetrics && (!loadResult || !loadResult.total_load)) {
      loadResult = {
        total_load: strengthMetrics.total,
        method_used: 'Strength_Volume',
        confidence: 0.8,
        breakdown: {
          volume: strengthMetrics.volume,
          multiplier: strengthMetrics.multiplier,
        },
      };
    }

    if (!loadResult) {
      throw new Error('Load calculation unavailable');
    }

    return loadResult;
  }

  /**
   * Get user profile for load calculation
   */
  getUserProfile() {
    // Get from storage or use defaults
    const profile = this.storageManager?.getItem('user_profile') || {};

    return {
      age: profile.age || 35,
      gender: profile.gender || 'male',
      max_hr: profile.max_hr || LoadCalculationEngine.estimateMaxHR(profile.age, profile.gender),
      rest_hr: profile.rest_hr || 60,
    };
  }

  /**
   * Get multiplier for strength session load based on RPE
   * @param {number} rpe - RPE value
   * @returns {number} Multiplier
   */
  getRpeMultiplier(rpe) {
    const key = Number(rpe);
    return RPE_MULTIPLIERS[key] || 1;
  }

  /**
   * Calculate session volume (sets × reps × weight)
   * @param {Object} data - Session data
   * @returns {number} Session volume
   */
  calculateSessionVolume(data = this.sessionData) {
    const sets = Number(data?.sets) || 0;
    const reps = Number(data?.reps) || 0;
    const weight = Number(data?.weight) || 0;
    if (!sets || !reps || !weight) {
      return 0;
    }
    return sets * reps * weight;
  }

  /**
   * Calculate strength-based session load using volume and RPE multiplier
   * @param {Object} data - Session data
   * @returns {Object|null} Strength load metrics
   */
  calculateStrengthLoad(data = this.sessionData) {
    const volume = this.calculateSessionVolume(data);
    if (!volume) {
      return null;
    }
    const multiplier = this.getRpeMultiplier(data?.rpe);
    return {
      total: Math.round(volume * multiplier),
      volume,
      multiplier,
    };
  }

  /**
   * Calculate weekly volume from sessions
   * @param {Array} sessions - Array of session records
   * @returns {number} Weekly volume
   */
  calculateWeeklyVolume(sessions = []) {
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return 0;
    }
    return sessions.reduce((sum, session) => {
      const volume = Number(session?.volume) || 0;
      return sum + volume;
    }, 0);
  }

  /**
   * Calculate adherence/consistency score
   * @param {Array} plannedSessions - Planned sessions
   * @param {Array} completedSessions - Completed sessions
   * @returns {number} Consistency percentage
   */
  calculateConsistency(plannedSessions = [], completedSessions = []) {
    const planned = Array.isArray(plannedSessions) ? plannedSessions.length : 0;
    const completed = Array.isArray(completedSessions) ? completedSessions.length : 0;
    if (planned === 0) {
      return completed > 0 ? 100 : 0;
    }
    return Math.round((completed / planned) * 100);
  }

  /**
   * Get load category description
   */
  getLoadCategory(load) {
    if (load < 50) {
      return 'Light';
    }
    if (load < 100) {
      return 'Moderate';
    }
    if (load < 200) {
      return 'High';
    }
    return 'Very High';
  }

  /**
   * Handle form submission
   */
  async handleSubmit(event) {
    event.preventDefault();

    if (this.isLogging) {
      return;
    }

    try {
      this.isLogging = true;
      this.updateSubmitButton();

      // Validate required fields
      if (!this.validateSession()) {
        return;
      }

      // Calculate final load
      const loadResult = this.calculateCurrentLoad();

      const strengthMetrics = this.calculateStrengthLoad(this.sessionData);
      const sessionVolume = strengthMetrics
        ? strengthMetrics.volume
        : this.calculateSessionVolume(this.sessionData);

      // Create session record
      const sessionRecord = {
        user_id:
          this.authManager?.getCurrentUserId() ||
          this.authManager?.getCurrentUsername() ||
          'anonymous',
        session_id: this.generateSessionId(),
        date: this.sessionData.date,
        workout_name: this.sessionData.workout_name || this.generateWorkoutName(),
        modality: this.sessionData.modality,
        duration: this.sessionData.duration_minutes,
        distance: this.sessionData.distance || null,
        distance_unit: this.sessionData.distance_unit,
        rpe: this.sessionData.rpe,
        intensity: this.sessionData.intensity,
        hr_data: this.sessionData.hr_data.avg_hr
          ? {
              avg_hr: this.sessionData.hr_data.avg_hr,
              max_hr: this.sessionData.hr_data.max_hr,
            }
          : null,
        calculated_load: loadResult.total_load,
        load_method: loadResult.method_used,
        load_confidence: loadResult.confidence,
        notes: this.sessionData.notes,
        logged_at: new Date().toISOString(),
        volume: sessionVolume || null,
        strength_load: strengthMetrics ? strengthMetrics.total : null,
        rpe_multiplier: strengthMetrics ? strengthMetrics.multiplier : null,
      };

      // Save session
      await this.saveSession(sessionRecord);

      // Emit event
      if (this.eventBus) {
        this.eventBus.emit('session:logged', { session: sessionRecord });
      }

      // Show success and close
      this.showSuccess('Session logged successfully!');
      setTimeout(() => this.close(), 1500);
    } catch (error) {
      this.logger.error('Failed to save session:', error);
      this.showError('Failed to save session. Please try again.');
    } finally {
      this.isLogging = false;
      this.updateSubmitButton();
    }
  }

  /**
   * Validate session data
   */
  validateSession() {
    if (!this.sessionData.modality) {
      this.showError('Please select an activity type');
      return false;
    }

    if (!this.sessionData.duration_minutes || this.sessionData.duration_minutes <= 0) {
      this.showError('Please enter a valid duration');
      return false;
    }

    if (!this.sessionData.rpe && !this.sessionData.hr_data.avg_hr) {
      this.showError('Please enter either RPE or heart rate data');
      return false;
    }

    return true;
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session_${timestamp}_${random}`;
  }

  /**
   * Generate workout name if not provided
   */
  generateWorkoutName() {
    const modalities = {
      running: 'Run',
      cycling: 'Bike',
      swimming: 'Swim',
      strength: 'Strength',
      other: 'Workout',
    };

    const modalityName = modalities[this.sessionData.modality] || 'Workout';
    const duration = this.sessionData.duration_minutes;
    const { distance } = this.sessionData;

    if (distance && ['running', 'cycling', 'swimming'].includes(this.sessionData.modality)) {
      return `${distance}${this.sessionData.distance_unit} ${modalityName}`;
    } else {
      return `${duration}min ${modalityName}`;
    }
  }

  /**
   * Save session to storage and database
   */
  async saveSession(sessionRecord) {
    // Save to local storage first
    if (this.storageManager) {
      const sessions = (await this.storageManager.getItem('logged_sessions')) || [];
      sessions.push(sessionRecord);
      await this.storageManager.setItem('logged_sessions', sessions);
    }

    // Save to database
    try {
      const response = await fetch('/.netlify/functions/sessions-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authManager?.getToken() || ''}`,
        },
        body: JSON.stringify(sessionRecord),
      });

      if (!response.ok) {
        throw new Error('Database save failed');
      }

      this.logger.info('Session saved to database successfully');
    } catch (error) {
      this.logger.warn('Database save failed, using local storage only:', error);
      // Continue - local storage save was successful
    }
  }

  /**
   * Update submit button state
   */
  updateSubmitButton() {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = this.isLogging;
      submitBtn.textContent = this.isLogging ? 'Saving...' : 'Save Session';
    }
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
    messageDiv.className = `session-message session-${type}`;
    messageDiv.textContent = message;

    const form = document.querySelector('.session-form');
    if (form) {
      form.insertBefore(messageDiv, form.firstChild);
      setTimeout(() => messageDiv.remove(), 5000);
    }
  }

  /**
   * Close session logger
   */
  close() {
    const container = this.getContainer();
    container.style.display = 'none';

    // Reset form data
    this.resetForm();
  }

  /**
   * Reset form data
   */
  resetForm() {
    this.sessionData = this.getDefaultSessionData();
    this.intensityManuallySet = false;
    this.isLogging = false;
  }

  /**
   * Show session logger
   */
  show() {
    const container = this.getContainer();
    container.style.display = 'flex';
    this.render();
  }

  /**
   * Get or create container
   */
  getContainer() {
    let container = document.getElementById('session-logger-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'session-logger-container';
      container.className = 'modal-overlay';
      document.body.appendChild(container);
    }
    return container;
  }
}

export default SessionLogger;
