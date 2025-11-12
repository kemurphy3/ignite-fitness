/**
 * WorkoutTracker - Tracks workout session with timers, RPE, and flow
 * Provides in-gym experience with progress tracking and RPE collection
 */
class WorkoutTracker {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.storageManager = window.StorageManager;
    this.timerOverlay = window.TimerOverlay;
    this.progressionEngine = window.ProgressionEngine;
    this.whyPanel = window.WhyPanel;
    this.workoutTimer = window.WorkoutTimer;
    this.weightMath = window.WeightMath;
    this.substitutionEngine = window.SubstitutionEngine;
    this.guardrailManager = window.GuardrailManager;

    this.currentSession = null;
    this.currentPlan = null; // Store current plan
    this.currentExerciseIndex = 0;
    this.exerciseData = [];
    this.sessionStartTime = null;
    this.totalDuration = 0;
    this.isActive = false;
    this.substitutionOptions = null; // Store substitution options
    this.guardrailValidation = null; // Store validation result

    this.initializeSession();
  }

  /**
   * Start workout with plan
   * @param {Object} plan - Workout plan
   */
  async startWorkout(plan) {
    this.currentPlan = plan;

    if (!plan || !plan.blocks) {
      this.logger.warn('No plan provided');
      return;
    }

    // Validate workout against safety guardrails
    const validationResult = await this.validateWorkout(plan);
    this.guardrailValidation = validationResult;

    // Handle blocking issues
    if (!validationResult.isAllowed && validationResult.blocks.length > 0) {
      const blockMessage = validationResult.blocks.join('\n');
      if (window.showErrorNotification) {
        window.showErrorNotification(`Workout blocked: ${blockMessage}`, 'error');
      } else {
        // eslint-disable-next-line no-alert
        alert(`Workout blocked:\n${blockMessage}\n\nPlease adjust your plan or wait for recovery.`);
      }

      // Show modified workout if available
      if (validationResult.autoAdjustments.length > 0) {
        const modifiedPlan = this.guardrailManager.applyAutoAdjustments(
          plan,
          validationResult.autoAdjustments
        );
        this.showModifiedWorkout(modifiedPlan, validationResult);
      }

      return; // Don't start blocked workout
    }

    // Apply auto-adjustments if needed
    let finalPlan = plan;
    if (validationResult.autoAdjustments.length > 0) {
      finalPlan = this.guardrailManager.applyAutoAdjustments(
        plan,
        validationResult.autoAdjustments
      );
      this.currentPlan = finalPlan;

      // Show confirmation for adjustments
      this.showAdjustmentConfirmation(finalPlan, validationResult);
    }

    // Store plan for overrides
    this.initializeSession({ exercises: this.extractExercises(finalPlan) });

    // Generate substitution options (async, non-blocking)
    this.generateSubstitutionOptions(finalPlan).catch(err => {
      this.logger.warn('Failed to generate substitutions', err);
    });

    // Start session timer
    if (this.workoutTimer) {
      this.workoutTimer.startSession();
    }

    // Render workout view (includes warnings)
    this.render();
  }

  /**
   * Validate workout against safety guardrails
   * @param {Object} plan - Workout plan
   * @returns {Promise<Object>} Validation result
   */
  async validateWorkout(plan) {
    if (!this.guardrailManager) {
      this.logger.debug('GuardrailManager not available');
      return {
        isAllowed: true,
        warnings: [],
        modifications: [],
        autoAdjustments: [],
        blocks: [],
      };
    }

    try {
      // Get user profile
      const userProfile = await this.getUserProfile();

      // Get recent sessions
      const recentSessions = (await this.getRecentSessions()) || [];

      // Get readiness data
      const readinessData = await this.getReadinessData();

      // Validate workout
      const validationResult = await this.guardrailManager.validateWorkout(
        plan,
        userProfile,
        recentSessions,
        readinessData
      );

      this.logger.debug('Workout validation result', validationResult);

      return validationResult;
    } catch (error) {
      this.logger.error('Workout validation failed', error);
      // Fail safe: allow workout if validation fails
      return {
        isAllowed: true,
        warnings: ['Safety validation unavailable. Proceed with caution.'],
        modifications: [],
        autoAdjustments: [],
        blocks: [],
      };
    }
  }

  /**
   * Get user profile for validation
   * @returns {Promise<Object>} User profile
   */
  async getUserProfile() {
    const authManager = window.AuthManager;
    const userId = authManager?.getCurrentUsername();
    const { storageManager } = this;

    if (!userId || !storageManager) {
      return { trainingLevel: 'intermediate' }; // Default
    }

    try {
      const userData = storageManager.get('user_profile', {}) || {};
      return {
        trainingLevel: userData.trainingLevel || 'intermediate',
        age: userData.age,
        experience: userData.experience,
      };
    } catch (error) {
      this.logger.warn('Failed to get user profile', error);
      return { trainingLevel: 'intermediate' };
    }
  }

  /**
   * Get readiness data for validation
   * @returns {Promise<Object>} Readiness data
   */
  async getReadinessData() {
    const authManager = window.AuthManager;
    const userId = authManager?.getCurrentUsername();
    const { storageManager } = this;

    if (!userId || !storageManager) {
      return {}; // No readiness data
    }

    try {
      // Get today's readiness check-in
      const today = new Date().toISOString().split('T')[0];
      const readinessData = storageManager.get(`readiness_${today}`, {}) || {};

      // Also check passive readiness if available
      if (window.PassiveReadiness) {
        const passiveReadiness = window.PassiveReadiness.getCurrentReadiness?.(userId);
        if (passiveReadiness) {
          return {
            ...readinessData,
            ...passiveReadiness,
          };
        }
      }

      return readinessData;
    } catch (error) {
      this.logger.warn('Failed to get readiness data', error);
      return {};
    }
  }

  /**
   * Show modified workout confirmation
   * @param {Object} modifiedPlan - Modified workout plan
   * @param {Object} validationResult - Validation result
   */
  showModifiedWorkout(modifiedPlan, validationResult) {
    const modal = document.createElement('div');
    modal.className = 'modal guardrail-modal';
    modal.id = 'guardrailModal';
    modal.innerHTML = `
            <div class="modal-content guardrail-content">
                <div class="modal-header">
                    <h3>⚠️ Workout Safety Adjustment</h3>
                    <button onclick="window.WorkoutTracker.closeGuardrailModal()" class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="guardrail-warning">
                        <h4>Workout Blocked</h4>
                        <ul class="block-list">
                            ${validationResult.blocks.map(block => `<li>${block}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="guardrail-suggestions">
                        <h4>Safety-Adjusted Workout</h4>
                        <p>The system has adjusted your workout to meet safety requirements:</p>
                        <ul class="adjustment-list">
                            ${validationResult.autoAdjustments.map(adj => `<li><strong>${adj.reason}</strong>: ${adj.type}</li>`).join('')}
                        </ul>
                        <div class="modal-actions">
                            <button class="btn btn-primary" onclick="window.WorkoutTracker.useModifiedWorkout()">
                                Use Adjusted Workout
                            </button>
                            <button class="btn btn-secondary" onclick="window.WorkoutTracker.closeGuardrailModal()">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Store modified plan for use
    this.modifiedPlan = modifiedPlan;
  }

  /**
   * Show adjustment confirmation
   * @param {Object} modifiedPlan - Modified workout plan
   * @param {Object} validationResult - Validation result
   */
  showAdjustmentConfirmation(modifiedPlan, validationResult) {
    if (validationResult.warnings.length === 0) {
      return; // No warnings to show
    }

    // Create warning banner in workout view
    const warningBanner = document.createElement('div');
    warningBanner.className = 'guardrail-warning-banner';
    warningBanner.id = 'guardrailWarningBanner';
    warningBanner.innerHTML = `
            <div class="warning-content">
                <span class="warning-icon">⚠️</span>
                <div class="warning-text">
                    <strong>Safety Adjustments Applied</strong>
                    <ul class="warning-list">
                        ${validationResult.warnings.map(warning => `<li>${warning}</li>`).join('')}
                    </ul>
                    ${
                      validationResult.autoAdjustments.length > 0
                        ? `
                        <div class="adjustment-info">
                            <small>Adjustments: ${validationResult.autoAdjustments.map(a => a.reason).join(', ')}</small>
                        </div>
                    `
                        : ''
                    }
                </div>
                <button class="warning-close" onclick="document.getElementById('guardrailWarningBanner').remove()">×</button>
            </div>
        `;

    // Insert at top of workout view
    const workoutView =
      document.getElementById('workout-view') || document.querySelector('.workout-view');
    if (workoutView) {
      workoutView.insertBefore(warningBanner, workoutView.firstChild);
    }
  }

  /**
   * Use modified workout
   */
  useModifiedWorkout() {
    if (this.modifiedPlan) {
      this.closeGuardrailModal();
      this.startWorkout(this.modifiedPlan);
    }
  }

  /**
   * Close guardrail modal
   */
  closeGuardrailModal() {
    const modal = document.getElementById('guardrailModal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Generate substitution options for current workout
   * @param {Object} plan - Workout plan
   * @returns {Promise<void>}
   */
  async generateSubstitutionOptions(plan) {
    if (!this.substitutionEngine) {
      this.logger.debug('SubstitutionEngine not available');
      return;
    }

    try {
      // Convert plan to workout format for substitution engine
      const workoutFormat = this.convertPlanToWorkoutFormat(plan);

      // Get user constraints
      const constraints = await this.getUserConstraints();

      // Generate substitutions
      const substitutions = await this.substitutionEngine.generateSubstitutions(
        workoutFormat,
        constraints
      );

      this.substitutionOptions = substitutions;

      this.logger.debug('Substitution options generated', {
        count: substitutions.length,
        options: substitutions.map(s => ({
          name: s.name,
          modality: s.modality,
          load: s.estimatedLoad,
        })),
      });
    } catch (error) {
      this.logger.error('Failed to generate substitution options', error);
      this.substitutionOptions = [];
    }
  }

  /**
   * Convert plan format to workout format for substitution engine
   * @param {Object} plan - Workout plan with blocks
   * @returns {Object} Workout format
   */
  convertPlanToWorkoutFormat(plan) {
    // Extract structure from blocks
    const structure = [];
    let totalDuration = 0;
    let _maxIntensity = 'Z1';

    if (plan.blocks) {
      plan.blocks.forEach(block => {
        if (block.name?.toLowerCase().includes('warm')) {
          structure.push({
            type: 'warmup',
            duration: (block.durationMin || 10) * 60,
            intensity: 'Z1',
          });
          totalDuration += block.durationMin || 10;
        } else if (block.name?.toLowerCase().includes('main')) {
          if (block.items && block.items.length > 0) {
            // Interval-style main work
            const firstItem = block.items[0];
            structure.push({
              type: 'main',
              sets: firstItem.sets || 3,
              work: {
                duration: this.estimateExerciseDuration(firstItem),
                intensity: this.mapRPEToZone(firstItem.targetRPE || 7),
              },
              rest: {
                duration: 90, // Default 90s rest
                intensity: 'Z1',
              },
            });
            totalDuration += block.durationMin || 20;
          } else {
            // Continuous main work
            structure.push({
              type: 'main',
              duration: (block.durationMin || 20) * 60,
              intensity: 'Z3', // Default to tempo
            });
            totalDuration += block.durationMin || 20;
          }

          // Track max intensity
          block.items?.forEach(item => {
            const zone = this.mapRPEToZone(item.targetRPE || 7);
            if (['Z4', 'Z5'].includes(zone)) {
              _maxIntensity = zone;
            }
          });
        } else if (block.name?.toLowerCase().includes('cooldown')) {
          structure.push({
            type: 'cooldown',
            duration: (block.durationMin || 10) * 60,
            intensity: 'Z1',
          });
          totalDuration += block.durationMin || 10;
        }
      });
    }

    return {
      id: plan.id || 'workout',
      name: plan.name || 'Workout',
      modality: plan.modality || 'running',
      structure:
        structure.length > 0
          ? structure
          : [{ type: 'main', duration: totalDuration * 60, intensity: 'Z3' }],
      adaptation: plan.why?.[0] || 'aerobic',
      estimatedLoad: plan.intensityScale ? Math.round(75 * plan.intensityScale) : 75,
      equipment: plan.equipment || [],
      timeRequired: totalDuration,
    };
  }

  /**
   * Estimate exercise duration from exercise item
   * @param {Object} item - Exercise item
   * @returns {number} Duration in seconds
   */
  estimateExerciseDuration(item) {
    // Rough estimate: sets * reps * 2 seconds per rep
    if (typeof item.reps === 'string' && item.reps.includes('-')) {
      const reps = parseInt(item.reps.split('-')[1]);
      return Math.min(item.sets * reps * 2, 120); // Cap at 2 minutes
    }
    if (typeof item.reps === 'number') {
      return Math.min(item.sets * item.reps * 2, 120);
    }
    return 60; // Default 1 minute
  }

  /**
   * Map RPE to zone
   * @param {number} rpe - RPE value (1-10)
   * @returns {string} Zone (Z1-Z5)
   */
  mapRPEToZone(rpe) {
    if (rpe <= 3) {
      return 'Z1';
    }
    if (rpe <= 5) {
      return 'Z2';
    }
    if (rpe <= 7) {
      return 'Z3';
    }
    if (rpe <= 9) {
      return 'Z4';
    }
    return 'Z5';
  }

  /**
   * Get user constraints for substitution
   * @returns {Promise<Object>} User constraints
   */
  async getUserConstraints() {
    const authManager = window.AuthManager;
    const userId = authManager?.getCurrentUsername();
    const { storageManager } = this;

    // Get user preferences
    const preferences = storageManager?.getPreferences?.(userId) || {};
    const equipment = preferences.equipment || [];

    // Get recent sessions for load calculation
    const recentSessions = (await this.getRecentSessions()) || [];

    // Get today's load
    const todayLoad =
      this.loadCalculator?.calculateSessionLoad?.({
        exercises: this.exerciseData,
      })?.total || 0;

    return {
      equipment,
      availableTime: preferences.availableTime || 120, // Default 2 hours
      preferences,
      recentSessions,
      todayLoad,
    };
  }

  /**
   * Get recent training sessions
   * @returns {Promise<Array>} Recent sessions
   */
  async getRecentSessions() {
    try {
      const userId = this.getUserId();
      if (!userId || !this.storageManager) {
        return [];
      }

      const sessions = this.storageManager.get('training_sessions', []) || [];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      return sessions.filter(session => {
        const sessionDate = new Date(session.date || session.startTime || session.start_at);
        return sessionDate >= sevenDaysAgo;
      });
    } catch (error) {
      this.logger.warn('Failed to get recent sessions', error);
      return [];
    }
  }

  /**
   * Extract exercises from plan blocks
   * @param {Object} plan - Workout plan
   * @returns {Array} Exercise list
   */
  extractExercises(plan) {
    const exercises = [];

    plan.blocks.forEach(block => {
      if (block.items) {
        block.items.forEach(item => {
          exercises.push({
            name: item.name,
            sets: item.sets,
            reps: item.reps,
            targetRPE: item.targetRPE,
            notes: item.notes,
            category: item.category,
          });
        });
      }
    });

    return exercises;
  }

  /**
   * Render workout view with WhyPanel
   */
  render() {
    if (!this.currentPlan) {
      this.logger.warn('No plan to render');
      return;
    }

    const workoutView =
      document.getElementById('workout-view') || document.querySelector('.workout-view');

    if (!workoutView) {
      this.logger.warn('Workout view container not found');
      return;
    }

    // Render why panel
    const whyPanelHtml = this.whyPanel?.render(this.currentPlan) || '';

    // Render timer display
    const timerHtml = this.renderTimers();

    // Render plan blocks
    const blocksHtml = this.renderPlanBlocks(this.currentPlan);

    // Render substitution options if available
    const substitutionHtml = this.renderSubstitutionOptions();

    // Render guardrail warnings if available
    const guardrailWarningsHtml = this.renderGuardrailWarnings();

    workoutView.innerHTML = `
            <div class="workout-container">
                ${whyPanelHtml}
                ${timerHtml}
                
                ${guardrailWarningsHtml}
                
                ${substitutionHtml}
                
                <div class="workout-plan">
                    ${blocksHtml}
                </div>
            </div>
        `;

    this.logger.debug('Workout rendered', this.currentPlan);
  }

  /**
   * Render guardrail warnings
   * @returns {string} HTML for warnings
   */
  renderGuardrailWarnings() {
    if (!this.guardrailValidation || this.guardrailValidation.warnings.length === 0) {
      return '';
    }

    const { warnings } = this.guardrailValidation;
    const adjustments = this.guardrailValidation.autoAdjustments || [];

    return `
            <div class="guardrail-warnings">
                <div class="warning-card">
                    <div class="warning-header">
                        <span class="warning-icon">⚠️</span>
                        <strong>Safety Notice</strong>
                    </div>
                    <div class="warning-body">
                        <ul class="warning-list">
                            ${warnings.map(warning => `<li>${warning}</li>`).join('')}
                        </ul>
                        ${
                          adjustments.length > 0
                            ? `
                            <div class="adjustment-info">
                                <strong>Automatic Adjustments:</strong>
                                <ul class="adjustment-list">
                                    ${adjustments.map(adj => `<li>${adj.reason}</li>`).join('')}
                                </ul>
                            </div>
                        `
                            : ''
                        }
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Render substitution options UI
   * @returns {string} HTML for substitution options
   */
  renderSubstitutionOptions() {
    if (!this.substitutionOptions || this.substitutionOptions.length === 0) {
      return '';
    }

    return `
            <div class="substitution-panel">
                <div class="substitution-header">
                    <h4>💡 Alternative Workouts</h4>
                    <button class="btn btn-small btn-secondary" onclick="window.WorkoutTracker.showSubstitutionOptions()">
                        View Alternatives
                    </button>
                </div>
                <div class="substitution-preview">
                    <small>${this.substitutionOptions.length} equivalent workout${this.substitutionOptions.length > 1 ? 's' : ''} available</small>
                </div>
            </div>
        `;
  }

  /**
   * Show substitution options modal
   */
  async showSubstitutionOptions() {
    if (!this.substitutionOptions || this.substitutionOptions.length === 0) {
      // Try to generate if not available
      if (this.currentPlan) {
        await this.generateSubstitutionOptions(this.currentPlan);
      }

      if (!this.substitutionOptions || this.substitutionOptions.length === 0) {
        // eslint-disable-next-line no-alert
        alert('No substitution options available. Please check your equipment and preferences.');
        return;
      }
    }

    // Create modal for substitution options
    const modal = document.createElement('div');
    modal.className = 'modal substitution-modal';
    modal.id = 'substitutionModal';
    modal.innerHTML = `
            <div class="modal-content substitution-content">
                <div class="modal-header">
                    <h3>Alternative Workout Options</h3>
                    <button onclick="window.WorkoutTracker.closeSubstitutionModal()" class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="current-workout">
                        <h4>Current Workout</h4>
                        <div class="workout-info">
                            <strong>${this.currentPlan.name || 'Workout'}</strong>
                            <div class="workout-meta">
                                ${this.currentPlan.modality ? `<span class="badge">${this.currentPlan.modality}</span>` : ''}
                                ${this.currentPlan.timeRequired ? `<span>${this.currentPlan.timeRequired} min</span>` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="substitution-options">
                        <h4>Alternative Options</h4>
                        ${this.substitutionOptions
                          .map(
                            (option, index) => `
                            <div class="substitution-option" data-index="${index}">
                                <div class="option-header">
                                    <h5>${option.name}</h5>
                                    <span class="badge badge-modality">${option.modality}</span>
                                </div>
                                <div class="option-details">
                                    <div class="option-load">
                                        <strong>Load:</strong> ${option.estimatedLoad} 
                                        <span class="load-comparison ${option.loadComparison.variance <= 0.05 ? 'match' : 'adjust'}">
                                            (${option.loadComparison.variance <= 0.05 ? 'Match' : `${(option.loadComparison.variance * 100).toFixed(0)}% ${option.loadComparison.substituted > option.loadComparison.original ? 'higher' : 'lower'}`})
                                        </span>
                                    </div>
                                    ${option.timeRequired ? `<div><strong>Duration:</strong> ${option.timeRequired} min</div>` : ''}
                                    ${
                                      option.equipment && option.equipment.length > 0
                                        ? `<div><strong>Equipment:</strong> ${option.equipment.join(', ')}</div>`
                                        : '<div><strong>Equipment:</strong> None required</div>'
                                    }
                                    <div class="option-reason">
                                        <em>${option.substitutionReason || 'Equivalent training adaptation'}</em>
                                    </div>
                                </div>
                                <div class="option-actions">
                                    <button class="btn btn-primary" onclick="window.WorkoutTracker.selectSubstitution(${index})">
                                        Use This Workout
                                    </button>
                                </div>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="window.WorkoutTracker.closeSubstitutionModal()">Cancel</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
  }

  /**
   * Close substitution modal
   */
  closeSubstitutionModal() {
    const modal = document.getElementById('substitutionModal');
    if (modal) {
      modal.remove();
    }
  }

  /**
   * Select and apply substitution
   * @param {number} index - Substitution option index
   */
  async selectSubstitution(index) {
    if (!this.substitutionOptions || !this.substitutionOptions[index]) {
      this.logger.warn('Invalid substitution index:', index);
      return;
    }

    const substitution = this.substitutionOptions[index];

    try {
      // Convert substitution workout back to plan format
      const newPlan = this.convertWorkoutToPlanFormat(substitution);

      // Update current plan
      this.currentPlan = newPlan;

      // Re-initialize session with new plan
      this.initializeSession({ exercises: this.extractExercises(newPlan) });

      // Close modal
      this.closeSubstitutionModal();

      // Re-render workout view
      this.render();

      // Show success message
      if (window.showSuccessNotification) {
        window.showSuccessNotification(`Workout switched to ${substitution.name}`, 'success');
      }

      this.logger.info('WORKOUT_SUBSTITUTED', {
        from: this.currentPlan.name,
        to: substitution.name,
        modality: substitution.modality,
      });
    } catch (error) {
      this.logger.error('Failed to apply substitution', error);
      if (window.showErrorNotification) {
        window.showErrorNotification('Failed to switch workout. Please try again.', 'error');
      }
    }
  }

  /**
   * Convert workout format back to plan format
   * @param {Object} workout - Workout from substitution engine
   * @returns {Object} Plan format
   */
  convertWorkoutToPlanFormat(workout) {
    const blocks = [];

    if (workout.structure) {
      workout.structure.forEach(segment => {
        if (segment.type === 'warmup') {
          blocks.push({
            name: 'Warm-up',
            items: [
              {
                name: 'Dynamic Warm-up',
                sets: 1,
                reps: '5-10',
                targetRPE: 5,
                category: 'warmup',
              },
            ],
            durationMin: Math.round(segment.duration / 60),
          });
        } else if (segment.type === 'main') {
          if (segment.sets) {
            // Interval workout
            const items = [];
            for (let i = 0; i < segment.sets; i++) {
              items.push({
                name: workout.name || 'Interval',
                sets: 1,
                reps: this.estimateRepsFromDuration(segment.work.duration),
                targetRPE: this.mapZoneToRPE(segment.work.intensity),
                category: 'main',
              });
            }
            blocks.push({
              name: 'Main',
              items,
              durationMin: Math.round((segment.work.duration * segment.sets) / 60),
            });
          } else {
            // Continuous workout
            blocks.push({
              name: 'Main',
              items: [
                {
                  name: workout.name || 'Continuous Work',
                  sets: 1,
                  reps: this.estimateRepsFromDuration(segment.duration),
                  targetRPE: this.mapZoneToRPE(segment.intensity),
                  category: 'main',
                },
              ],
              durationMin: Math.round(segment.duration / 60),
            });
          }
        } else if (segment.type === 'cooldown') {
          blocks.push({
            name: 'Cooldown',
            items: [
              {
                name: 'Light Movement',
                sets: 1,
                reps: '5-10',
                targetRPE: 3,
                category: 'cooldown',
              },
            ],
            durationMin: Math.round(segment.duration / 60),
          });
        }
      });
    }

    return {
      id: workout.id,
      name: workout.name,
      modality: workout.modality,
      blocks:
        blocks.length > 0
          ? blocks
          : [
              {
                name: 'Main',
                items: [{ name: workout.name, sets: 3, reps: '10-12', targetRPE: 7 }],
                durationMin: workout.timeRequired || 30,
              },
            ],
      equipment: workout.equipment || [],
      isSubstitution: true,
      originalWorkout: workout.originalWorkout,
    };
  }

  /**
   * Estimate reps from duration
   * @param {number} duration - Duration in seconds
   * @returns {string} Rep range
   */
  estimateRepsFromDuration(duration) {
    // Rough estimate: 1 rep per 2 seconds
    const reps = Math.round(duration / 2);
    if (reps <= 10) {
      return `${reps}`;
    }
    return `${reps - 2}-${reps}`;
  }

  /**
   * Map zone to RPE
   * @param {string} zone - Zone (Z1-Z5)
   * @returns {number} RPE value (1-10)
   */
  mapZoneToRPE(zone) {
    const zoneMap = {
      Z1: 3,
      Z2: 5,
      Z3: 7,
      Z4: 9,
      Z5: 10,
    };
    return zoneMap[zone] || zoneMap[zone.split('-')[0]] || 7;
  }

  /**
   * Render timer display
   * @returns {string} HTML for timer section
   */
  renderTimers() {
    if (!this.workoutTimer) {
      return '';
    }

    const sessionDuration = this.workoutTimer.getSessionDuration();
    const sessionTime = this.workoutTimer.formatDuration(sessionDuration);
    const restRemaining = this.workoutTimer.getRestRemaining();
    const restTime = restRemaining > 0 ? this.workoutTimer.formatDuration(restRemaining) : '0:00';

    return `
            <div class="workout-timers">
                <div class="timer-card session-timer">
                    <div class="timer-label">Session</div>
                    <div class="timer-display" id="session-timer-display">${sessionTime}</div>
                    <div class="timer-controls">
                        <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.pauseSession()" aria-label="Pause session">⏸</button>
                        <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.resumeSession()" aria-label="Resume session">▶</button>
                        <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.stopSession()" aria-label="Stop session">⏹</button>
                    </div>
                </div>
                
                ${
                  restRemaining > 0
                    ? `
                    <div class="timer-card rest-timer">
                        <div class="timer-label">Rest</div>
                        <div class="timer-display warning" id="rest-timer-display">${restTime}</div>
                        <div class="timer-controls">
                            <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.addRestTime(15)" aria-label="Add 15 seconds">+15s</button>
                            <button class="timer-btn" onclick="window.WorkoutTracker.workoutTimer.stopRest()" aria-label="Skip rest">Skip</button>
                        </div>
                    </div>
                `
                    : ''
                }
            </div>
        `;
  }

  /**
   * Render plan blocks with override buttons
   * @param {Object} plan - Workout plan
   * @returns {string} HTML for plan blocks
   */
  renderPlanBlocks(plan) {
    if (!plan.blocks || plan.blocks.length === 0) {
      return '<p>No workout plan available</p>';
    }

    // Get next exercise for preview
    const nextExercise = this.getNextExercise(plan);

    return `
            ${nextExercise ? this.renderNextExercisePreview(nextExercise) : ''}
            ${plan.blocks
              .map(
                (block, blockIndex) => `
                <div class="workout-block" data-block="${blockIndex}">
                    <h3 class="block-title">${block.name}</h3>
                    <div class="block-duration">${block.durationMin} minutes</div>
                    
                    <div class="block-items">
                        ${block.items
                          .map(
                            (item, itemIndex) => `
                            <div class="workout-item">
                                <div class="item-header">
                                    <div class="item-info">
                                        <strong class="item-name">${item.name}</strong>
                                        <div class="item-details">
                                            ${item.sets} sets × ${item.reps} reps @ RPE ${item.targetRPE || 7}
                                        </div>
                                        ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
                                    </div>
                                    <div class="item-actions">
                                        ${this.renderRPEQuickInput(item, itemIndex)}
                                        ${this.whyPanel?.renderOverrideButton(item.name, itemIndex) || ''}
                                    </div>
                                    ${this.renderSubstituteButton(plan, blockIndex, itemIndex)}
                                </div>
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                </div>
            `
              )
              .join('')}
        `;
  }

  /**
   * Get next exercise to preview
   * @param {Object} plan - Workout plan
   * @returns {Object|null} Next exercise info
   */
  getNextExercise(plan) {
    if (!plan.blocks || plan.blocks.length === 0) {
      return null;
    }

    // Find first incomplete exercise
    for (const block of plan.blocks) {
      if (block.items && block.items.length > 0) {
        for (const item of block.items) {
          // Check if this exercise hasn't been completed
          if (!item.completed) {
            return {
              name: item.name,
              sets: item.sets,
              reps: item.reps,
              targetRPE: item.targetRPE || 7,
              notes: item.notes,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Render next exercise preview
   * @param {Object} exercise - Exercise info
   * @returns {string} HTML for preview
   */
  renderNextExercisePreview(exercise) {
    if (!exercise) {
      return '';
    }

    return `
            <div class="next-exercise-preview">
                <h4>Next Up</h4>
                <div class="next-exercise-name">${exercise.name}</div>
                <div class="next-exercise-details">
                    ${exercise.sets} sets × ${exercise.reps} reps @ RPE ${exercise.targetRPE}
                    ${exercise.notes ? ` · ${exercise.notes}` : ''}
                </div>
            </div>
        `;
  }

  /**
   * Render RPE quick input buttons
   * @param {Object} exercise - Exercise item
   * @param {number} index - Exercise index
   * @returns {string} HTML for RPE input
   */
  renderRPEQuickInput(exercise, index) {
    return `
            <div class="rpe-quick-input">
                <label class="rpe-label">RPE:</label>
                <div class="rpe-buttons">
                    ${[6, 7, 8, 9, 10]
                      .map(
                        rpe => `
                        <button 
                            class="rpe-btn ${exercise.targetRPE === rpe ? 'selected' : ''}"
                            onclick="window.WorkoutTracker.recordRPEQuick(${rpe}, ${index})"
                            aria-label="RPE ${rpe}"
                        >
                            ${rpe}
                        </button>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
  }

  /**
   * Record RPE from quick input
   * @param {number} rpe - RPE value (6-10)
   * @param {number} exerciseIndex - Exercise index
   */
  recordRPEQuick(rpe, exerciseIndex) {
    if (rpe < 6 || rpe > 10) {
      this.logger.warn('Invalid RPE value for quick input:', rpe);
      return;
    }

    // Record RPE
    this.recordRPE(rpe, { exerciseIndex });

    // Start rest timer
    if (this.workoutTimer) {
      this.workoutTimer.startRest(90); // 90 second default rest
    }

    // Update UI to show completed
    const exerciseItem = document.querySelector(`[data-index="${exerciseIndex}"]`);
    if (exerciseItem) {
      exerciseItem.classList.add('completed');
    }

    this.logger.debug('Quick RPE recorded', { rpe, exerciseIndex });
  }

  /**
   * Render substitute button for workout substitution
   * @param {Object} plan - Workout plan
   * @param {number} blockIndex - Block index
   * @param {number} itemIndex - Item index
   * @returns {string} HTML for substitute button
   */
  renderSubstituteButton(plan, blockIndex, itemIndex) {
    // Only show on main block, first item
    if (blockIndex === 0 && itemIndex === 0) {
      return `
                <div class="substitute-section">
                    <button class="btn btn-small btn-secondary" onclick="window.WorkoutTracker.showSubstitutionOptions()" aria-label="View alternative workouts">
                        🔄 Substitute Workout
                    </button>
                </div>
            `;
    }
    return '';
  }

  /**
   * Format target weight as plate loading instruction
   * @param {number} targetWeight - Target weight in pounds/kg
   * @param {string} unit - 'lb' or 'kg'
   * @returns {string} Loading instruction text
   */
  formatWeightInstruction(targetWeight, unit = 'lb') {
    if (!this.weightMath) {
      return `${targetWeight} ${unit}`;
    }

    const config = {
      mode: unit === 'kg' ? 'metric' : 'us',
      unit,
    };

    const loadPlan = this.weightMath.gymLoadPlan(config, targetWeight);

    return loadPlan.text;
  }

  /**
   * Update plan after override
   * @param {Object} newPlan - Updated plan
   */
  updatePlan(newPlan) {
    this.currentPlan = newPlan;
    this.render();
  }

  /**
   * Refresh for mode
   * @param {string} mode - Current mode
   */
  refreshForMode(_mode) {
    if (this.currentPlan) {
      this.render();
    }
  }

  /**
   * Initialize workout session
   * @param {Object} workout - Workout data
   */
  initializeSession(workout) {
    if (!workout) {
      this.logger.warn('No workout provided');
      return;
    }

    this.currentSession = {
      workoutId: workout.id || `workout_${Date.now()}`,
      workoutName: workout.name || 'Workout',
      exercises: workout.exercises || [],
      startTime: new Date().toISOString(),
      status: 'active',
    };

    this.currentExerciseIndex = 0;
    this.exerciseData = [];
    this.sessionStartTime = Date.now();
    this.isActive = true;

    this.logger.debug('Workout session initialized', this.currentSession);

    // Start session timer
    if (this.timerOverlay) {
      this.timerOverlay.startSessionTimer();
    }
  }

  /**
   * Start next exercise
   * @returns {Object|null} Next exercise data
   */
  startNextExercise() {
    if (!this.currentSession) {
      this.logger.warn('No active session');
      return null;
    }

    const exercise = this.currentSession.exercises[this.currentExerciseIndex];
    if (!exercise) {
      this.logger.debug('All exercises completed');
      return null;
    }

    const exerciseData = {
      exerciseId: exercise.id || `exercise_${Date.now()}`,
      exerciseName: exercise.name,
      sets: exercise.sets || 1,
      reps: exercise.reps || '8-10',
      weight: exercise.weight || null,
      status: 'in_progress',
      startTime: new Date().toISOString(),
      completedSets: [],
      rpeData: [],
    };

    this.exerciseData.push(exerciseData);

    this.logger.debug('Exercise started', exerciseData);
    return exerciseData;
  }

  /**
   * Complete current set
   * @param {Object} setData - Set data
   * @returns {Object} Updated exercise data
   */
  completeSet(setData = {}) {
    const currentExercise = this.getCurrentExercise();
    if (!currentExercise) {
      return null;
    }

    const set = {
      setNumber: currentExercise.completedSets.length + 1,
      weight: setData.weight || currentExercise.weight,
      reps: setData.reps || currentExercise.reps,
      completedAt: new Date().toISOString(),
      restCompleted: setData.restCompleted || false,
    };

    currentExercise.completedSets.push(set);

    this.logger.debug('Set completed', set);

    // Emit event
    this.eventBus.emit('workout:set_completed', {
      sessionId: this.currentSession.workoutId,
      exercise: currentExercise,
      set,
    });

    return currentExercise;
  }

  /**
   * Record RPE for current exercise
   * @param {number} rpe - Rate of perceived exertion (1-10)
   * @param {Object} context - Additional context
   * @returns {Object} Updated exercise data
   */
  recordRPE(rpe, context = {}) {
    if (rpe < 1 || rpe > 10) {
      this.logger.warn('Invalid RPE value:', rpe);
      return null;
    }

    const currentExercise = this.getCurrentExercise();
    if (!currentExercise) {
      return null;
    }

    const rpeData = {
      rpe,
      exerciseId: currentExercise.exerciseId,
      exerciseName: currentExercise.exerciseName,
      recordedAt: new Date().toISOString(),
      ...context,
    };

    currentExercise.rpeData.push(rpeData);

    this.logger.debug('RPE recorded', rpeData);

    // Emit event
    this.eventBus.emit('workout:rpe_recorded', rpeData);

    // Store in progression system
    if (this.progressionEngine) {
      this.progressionEngine.saveRPE(this.getUserId(), new Date().toISOString().split('T')[0], {
        rpe,
        exercise: currentExercise.exerciseName,
        ...context,
      });
    }

    return currentExercise;
  }

  /**
   * Complete current exercise and move to next
   * @returns {Object|null} Next exercise
   */
  completeExercise() {
    const currentExercise = this.getCurrentExercise();
    if (!currentExercise) {
      return null;
    }

    currentExercise.status = 'completed';
    currentExercise.endTime = new Date().toISOString();
    currentExercise.duration = Date.now() - new Date(currentExercise.startTime).getTime();

    this.logger.debug('Exercise completed', currentExercise);

    // Emit event
    this.eventBus.emit('workout:exercise_completed', {
      sessionId: this.currentSession.workoutId,
      exercise: currentExercise,
    });

    // Move to next exercise
    this.currentExerciseIndex++;

    return this.startNextExercise();
  }

  /**
   * Swap exercise for alternative
   * @param {Object} alternativeExercise - Alternative exercise
   * @returns {Object} Updated session
   */
  swapExercise(alternativeExercise) {
    if (!this.currentSession) {
      return null;
    }

    const currentIndex = this.currentExerciseIndex;
    const currentExercise = this.currentSession.exercises[currentIndex];

    // Replace in session
    this.currentSession.exercises[currentIndex] = {
      ...alternativeExercise,
      swapped: true,
      originalExercise: currentExercise.name,
      swappedAt: new Date().toISOString(),
    };

    this.logger.debug('Exercise swapped', {
      from: currentExercise.name,
      to: alternativeExercise.name,
    });

    // Emit event
    this.eventBus.emit('workout:exercise_swapped', {
      sessionId: this.currentSession.workoutId,
      from: currentExercise,
      to: alternativeExercise,
    });

    return this.currentSession;
  }

  /**
   * Get current exercise
   * @returns {Object|null} Current exercise data
   */
  getCurrentExercise() {
    if (!this.exerciseData.length) {
      return null;
    }

    return this.exerciseData[this.exerciseData.length - 1];
  }

  /**
   * Get workout progress
   * @returns {Object} Progress data
   */
  getProgress() {
    if (!this.currentSession) {
      return { percentage: 0, completedExercises: 0, totalExercises: 0 };
    }

    const totalExercises = this.currentSession.exercises.length;
    const completedExercises = this.currentExerciseIndex;
    const percentage = (completedExercises / totalExercises) * 100;

    const currentExercise = this.getCurrentExercise();
    let exerciseProgress = 0;

    if (currentExercise) {
      const totalSets = currentExercise.sets;
      const completedSets = currentExercise.completedSets.length;
      exerciseProgress = (completedSets / totalSets) * 100;
    }

    return {
      percentage: Math.round(percentage),
      completedExercises,
      totalExercises,
      currentExerciseProgress: Math.round(exerciseProgress),
      currentExercise: this.currentSession.exercises[this.currentExerciseIndex],
      elapsedTime: Date.now() - this.sessionStartTime,
    };
  }

  /**
   * Complete entire workout session
   * @returns {Promise<Object>} Session completion data
   */
  async completeSession() {
    if (!this.currentSession || !this.isActive) {
      return null;
    }

    const endTime = new Date().toISOString();
    this.totalDuration = Date.now() - this.sessionStartTime;

    const sessionData = {
      ...this.currentSession,
      status: 'completed',
      endTime,
      duration: this.totalDuration,
      exercises: this.exerciseData,
      totalExercises: this.exerciseData.length,
      totalVolume: this.calculateTotalVolume(),
      averageRPE: this.calculateAverageRPE(),
    };

    // Save to storage
    const userId = this.getUserId();
    if (userId) {
      const date = new Date().toISOString().split('T')[0];
      await this.storageManager.saveSessionLog(userId, date, sessionData);
    }

    // Emit SESSION_COMPLETED event
    this.eventBus.emit(this.eventBus.TOPICS.SESSION_COMPLETED, sessionData);

    // Stop timers
    if (this.timerOverlay) {
      this.timerOverlay.stopSessionTimer();
    }

    this.isActive = false;

    this.logger.audit('SESSION_COMPLETED', sessionData);

    return sessionData;
  }

  /**
   * Calculate total volume
   * @returns {number} Total volume
   */
  calculateTotalVolume() {
    return this.exerciseData.reduce((total, exercise) => {
      const exerciseVolume = exercise.completedSets.reduce((sum, set) => {
        return sum + set.weight * set.reps;
      }, 0);
      return total + exerciseVolume;
    }, 0);
  }

  /**
   * Calculate average RPE
   * @returns {number} Average RPE
   */
  calculateAverageRPE() {
    const allRPE = this.exerciseData.flatMap(ex => ex.rpeData.map(r => r.rpe));
    if (allRPE.length === 0) {
      return 0;
    }

    const avg = allRPE.reduce((sum, rpe) => sum + rpe, 0) / allRPE.length;
    return Math.round(avg * 10) / 10;
  }

  /**
   * Pause session
   */
  pauseSession() {
    if (this.isActive && this.timerOverlay) {
      this.timerOverlay.pauseSessionTimer();
      this.isActive = false;

      this.logger.debug('Session paused');
    }
  }

  /**
   * Resume session
   */
  resumeSession() {
    if (!this.isActive) {
      this.isActive = true;
      if (this.timerOverlay) {
        this.timerOverlay.resumeSessionTimer();
      }

      this.logger.debug('Session resumed');
    }
  }

  /**
   * Get user ID
   * @returns {string} User ID
   */
  getUserId() {
    const authManager = window.AuthManager;
    return authManager?.getCurrentUsername() || 'anonymous';
  }

  /**
   * Get session summary
   * @returns {Object} Session summary
   */
  getSessionSummary() {
    if (!this.currentSession) {
      return null;
    }

    const progress = this.getProgress();

    return {
      sessionId: this.currentSession.workoutId,
      workoutName: this.currentSession.workoutName,
      status: this.currentSession.status,
      progress: `${progress.percentage}%`,
      completedExercises: `${progress.completedExercises}/${progress.totalExercises}`,
      elapsedTime: this.formatDuration(Date.now() - this.sessionStartTime),
      currentExercise: progress.currentExercise?.name || 'None',
      isActive: this.isActive,
    };
  }

  /**
   * Format duration
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Create global instance
window.WorkoutTracker = new WorkoutTracker();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkoutTracker;
}
