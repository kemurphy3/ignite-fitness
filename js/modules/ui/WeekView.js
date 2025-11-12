/**
 * WeekView - Weekly training load visualization and planning
 * Shows planned vs completed load with color-coded status
 */
class WeekView {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.loadCalculator = window.LoadCalculator;
    this.loadGuardrails = window.LoadGuardrails;
    this.authManager = window.AuthManager;
    this.storageManager = window.StorageManager;

    this.currentWeekOffset = 0; // 0 = current week, -1 = last week, +1 = next week
    this.loadThresholds = this.initializeLoadThresholds();

    this.initializeEventListeners();
  }

  /**
   * Initialize load status thresholds
   * @returns {Object} Load thresholds
   */
  initializeLoadThresholds() {
    return {
      onTrack: { min: 0.95, max: 1.05, color: '#10b981', label: 'On Track' },
      slightlyOver: { min: 1.05, max: 1.2, color: '#f59e0b', label: 'Slightly Over' },
      slightlyUnder: { min: 0.8, max: 0.95, color: '#f59e0b', label: 'Slightly Under' },
      significantlyOver: { min: 1.2, max: Infinity, color: '#ef4444', label: 'Too Much' },
      significantlyUnder: { min: 0, max: 0.8, color: '#ef4444', label: 'Too Little' },
    };
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.on(this.eventBus.TOPICS?.SESSION_COMPLETED, () => {
      this.refreshWeekView();
    });

    this.eventBus.on('SESSION_PLANNED', () => {
      this.refreshWeekView();
    });

    this.eventBus.on('GUARDRAIL_APPLIED', () => {
      this.updateGuardrailStatus();
    });
  }

  /**
   * Render the week view
   * @param {string} containerId - Container element ID
   * @param {Object} options - Rendering options
   */
  async render(containerId, options = {}) {
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      const weekData = await this.getWeekData();
      const loadAnalysis = this.analyzeWeeklyLoad(weekData);

      const userId =
        this.authManager?.getCurrentUsername?.() || this.authManager?.getCurrentUser?.()?.username;
      const guardrailStatus = userId
        ? await this.loadGuardrails?.getGuardrailStatus?.(userId)
        : null;

      container.innerHTML = this.generateWeekViewHTML(
        weekData,
        loadAnalysis,
        guardrailStatus,
        options
      );
      this.attachEventHandlers(container);

      // Emit render complete event
      if (this.eventBus) {
        this.eventBus.emit('WEEK_VIEW_RENDERED', {
          weekData,
          loadAnalysis,
        });
      }
    } catch (error) {
      this.logger.error('Week view render failed', error);
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = this.generateErrorHTML(error.message);
      }
    }
  }

  /**
   * Get week data for current week offset
   * @returns {Object} Week data with planned and completed sessions
   */
  async getWeekData() {
    const userId =
      this.authManager?.getCurrentUsername?.() || this.authManager?.getCurrentUser?.()?.username;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const weekStart = this.getWeekStart(this.currentWeekOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Get planned sessions
    const plannedSessions = await this.getPlannedSessions(userId, weekStart, weekEnd);

    // Get completed sessions
    const completedSessions = await this.getCompletedSessions(userId, weekStart, weekEnd);

    // Calculate daily breakdown
    const dailyBreakdown = this.calculateDailyBreakdown(
      weekStart,
      plannedSessions,
      completedSessions
    );

    return {
      weekStart,
      weekEnd,
      weekOffset: this.currentWeekOffset,
      plannedSessions,
      completedSessions,
      dailyBreakdown,
      isCurrentWeek: this.currentWeekOffset === 0,
      isFutureWeek: this.currentWeekOffset > 0,
    };
  }

  /**
   * Get planned sessions for date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Planned sessions
   */
  async getPlannedSessions(userId, startDate, endDate) {
    try {
      // Try to get from upcoming sessions storage
      const stored = localStorage.getItem(`ignite_upcoming_sessions_${userId}`);
      if (stored) {
        const sessions = JSON.parse(stored);
        return sessions
          .filter(s => {
            const sessionDate = new Date(s.date || s.planned_date || s.start_at);
            return sessionDate >= startDate && sessionDate <= endDate;
          })
          .map(s => ({
            ...s,
            date: s.date || s.planned_date || s.start_at,
            isPlanned: true,
          }));
      }

      // Fallback: try storageManager
      if (this.storageManager?.getPlannedSessions) {
        return await this.storageManager.getPlannedSessions(userId, startDate, endDate);
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get planned sessions', error);
      return [];
    }
  }

  /**
   * Get completed sessions for date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Completed sessions
   */
  async getCompletedSessions(userId, startDate, endDate) {
    try {
      // Get from storageManager
      const sessions = await this.getUserSessions(userId);

      return sessions
        .filter(s => {
          const sessionDate = new Date(s.date || s.start_at || s.created_at);
          return sessionDate >= startDate && sessionDate <= endDate && s.completed !== false;
        })
        .map(s => ({
          ...s,
          date: s.date || s.start_at || s.created_at,
          isCompleted: true,
        }));
    } catch (error) {
      this.logger.error('Failed to get completed sessions', error);
      return [];
    }
  }

  /**
   * Get user sessions
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User sessions
   */
  async getUserSessions(userId) {
    try {
      if (this.storageManager?.getUserSessions) {
        return await this.storageManager.getUserSessions(userId);
      }

      // Fallback: try localStorage
      const stored = localStorage.getItem(`ignite_sessions_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get user sessions', error);
      return [];
    }
  }

  /**
   * Analyze weekly load status
   * @param {Object} weekData - Week data
   * @returns {Object} Load analysis
   */
  analyzeWeeklyLoad(weekData) {
    const plannedLoad = this.calculateTotalLoad(weekData.plannedSessions);
    const completedLoad = this.calculateTotalLoad(weekData.completedSessions);

    const loadRatio = plannedLoad > 0 ? completedLoad / plannedLoad : 0;
    const loadStatus = this.determineLoadStatus(loadRatio);
    const variance = Math.abs(completedLoad - plannedLoad);
    const variancePercentage = plannedLoad > 0 ? (variance / plannedLoad) * 100 : 0;
    const weeklyVolume = this.calculateWeeklyVolume(weekData.completedSessions);
    const consistency = this.calculateConsistencyScore(
      weekData.plannedSessions,
      weekData.completedSessions
    );

    return {
      plannedLoad: Math.round(plannedLoad),
      completedLoad: Math.round(completedLoad),
      loadRatio,
      variance: Math.round(variance),
      variancePercentage: Math.round(variancePercentage),
      status: loadStatus,
      message: this.generateLoadMessage(loadStatus, variancePercentage),
      recommendation: this.generateLoadRecommendation(loadStatus, weekData),
      weeklyVolume: Math.round(weeklyVolume),
      consistency,
    };
  }

  /**
   * Determine load status based on ratio
   * @param {number} ratio - Completed/planned load ratio
   * @returns {Object} Load status
   */
  determineLoadStatus(ratio) {
    for (const [statusKey, threshold] of Object.entries(this.loadThresholds)) {
      if (ratio >= threshold.min && ratio < threshold.max) {
        return {
          key: statusKey,
          ...threshold,
        };
      }
    }
    // Default fallback
    return {
      key: 'onTrack',
      ...this.loadThresholds.onTrack,
    };
  }

  /**
   * Determine daily status label based on planned/completed load
   * @param {number} plannedLoad - Planned load for the day
   * @param {number} completedLoad - Completed load for the day
   * @param {number} percentage - Completion percentage
   * @returns {string} Daily status key
   */
  getDailyStatus(plannedLoad, completedLoad, percentage) {
    if (plannedLoad === 0 && completedLoad === 0) {
      return 'no_data';
    }
    if (plannedLoad === 0 && completedLoad > 0) {
      return 'unplanned';
    }
    if (percentage < 80) {
      return 'too_little';
    }
    if (percentage > 120) {
      return 'too_much';
    }
    return 'on_track';
  }

  /**
   * Generate week view HTML
   * @param {Object} weekData - Week data
   * @param {Object} loadAnalysis - Load analysis
   * @param {Object} guardrailStatus - Guardrail status
   * @param {Object} options - Rendering options
   * @returns {string} HTML string
   */
  generateWeekViewHTML(weekData, loadAnalysis, guardrailStatus, options = {}) {
    const simple = options.simple || false;

    return `
            <div class="week-view ${simple ? 'simple-mode' : ''}">
                ${this.generateHeaderHTML(weekData, loadAnalysis)}
                ${simple ? '' : this.generateLoadSummaryHTML(loadAnalysis, guardrailStatus)}
                ${this.generateDailyBreakdownHTML(weekData.dailyBreakdown, simple)}
                ${simple ? '' : this.generateInsightsHTML(loadAnalysis, guardrailStatus)}
                ${this.generateNavigationHTML()}
            </div>
        `;
  }

  /**
   * Generate week view header
   * @param {Object} weekData - Week data
   * @param {Object} loadAnalysis - Load analysis
   * @returns {string} Header HTML
   */
  generateHeaderHTML(weekData, loadAnalysis) {
    const weekLabel = this.getWeekLabel(weekData.weekOffset);
    const dateRange = this.formatDateRange(weekData.weekStart, weekData.weekEnd);

    return `
            <div class="week-header">
                <div class="week-title">
                    <h2>${weekLabel}</h2>
                    <p class="week-dates">${dateRange}</p>
                </div>
                <div class="week-status">
                    <div class="load-indicator" style="background-color: ${loadAnalysis.status.color}">
                        <span class="load-status">${loadAnalysis.status.label}</span>
                        <span class="load-percentage">${Math.round(loadAnalysis.loadRatio * 100)}%</span>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Generate load summary section
   * @param {Object} loadAnalysis - Load analysis
   * @param {Object} guardrailStatus - Guardrail status
   * @returns {string} Load summary HTML
   */
  generateLoadSummaryHTML(loadAnalysis, guardrailStatus) {
    const guardrailWarning = guardrailStatus?.isUnderGuardrail
      ? `<div class="guardrail-warning">
                <i class="icon-shield">🛡️</i>
                <span>Load restrictions active</span>
            </div>`
      : '';

    const completedWidth = Math.min(loadAnalysis.loadRatio * 100, 100);
    const completedPercentage = Math.round(loadAnalysis.loadRatio * 100);

    return `
            <div class="load-summary">
                <div class="load-comparison">
                    <div class="load-bar-container">
                        <div class="load-bar">
                            <div class="planned-load-bar" style="width: 100%">
                                <span>Planned: ${loadAnalysis.plannedLoad}</span>
                            </div>
                            <div class="completed-load-bar"
                                 style="width: ${completedWidth}%;
                                        background-color: ${loadAnalysis.status.color}">
                                <span>Completed: ${loadAnalysis.completedLoad} (${completedPercentage}%)</span>
                            </div>
                        </div>
                    </div>
                    <div class="load-details">
                        <p class="load-message">${loadAnalysis.message}</p>
                        ${guardrailWarning}
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Generate daily breakdown
   * @param {Array} dailyBreakdown - Daily data
   * @param {boolean} simple - Simple mode flag
   * @returns {string} Daily breakdown HTML
   */
  generateDailyBreakdownHTML(dailyBreakdown, simple = false) {
    const maxLoad = Math.max(
      ...dailyBreakdown.map(d => Math.max(d.plannedLoad, d.completedLoad)),
      1
    );

    const daysHTML = dailyBreakdown
      .map(day => {
        const dayStatus = this.determineDayStatus(day);

        return `
                <div class="day-card ${dayStatus.class}" data-date="${day.date}">
                    <div class="day-header">
                        <span class="day-name">${day.dayName}</span>
                        <span class="day-date">${day.dateNumber}</span>
                    </div>
                    <div class="day-load">
                        <div class="load-comparison-mini">
                            <div class="planned-mini" title="Planned: ${day.plannedLoad}">
                                <div class="load-bar-mini planned" 
                                     style="height: ${this.normalizeLoadHeight(day.plannedLoad, maxLoad)}%"></div>
                            </div>
                            <div class="completed-mini" title="Completed: ${day.completedLoad}">
                                <div class="load-bar-mini completed"
                                     style="height: ${this.normalizeLoadHeight(day.completedLoad, maxLoad)}%;
                                            background-color: ${dayStatus.color}"></div>
                            </div>
                        </div>
                        <div class="load-numbers">
                            <span class="planned">${day.plannedLoad}</span>
                            <span class="separator">/</span>
                            <span class="completed">${day.completedLoad}</span>
                            <span class="percentage">${day.percentage}%</span>
                        </div>
                    </div>
                    ${simple ? '' : this.generateDaySessionsHTML(day)}
                </div>
            `;
      })
      .join('');

    return `
            <div class="daily-breakdown">
                <h3>Daily Breakdown</h3>
                <div class="days-grid">
                    ${daysHTML}
                </div>
            </div>
        `;
  }

  /**
   * Generate day sessions HTML
   * @param {Object} day - Day data
   * @returns {string} Day sessions HTML
   */
  generateDaySessionsHTML(day) {
    const allSessions = [...day.plannedSessions, ...day.completedSessions];
    if (allSessions.length === 0) {
      return '<div class="day-sessions">No sessions</div>';
    }

    const sessionsHTML = allSessions
      .slice(0, 3)
      .map(session => {
        const sessionName = session.name || session.template_id || session.type || 'Session';
        const status = session.isCompleted ? '✓' : '○';
        return `<div class="session-item">${status} ${sessionName}</div>`;
      })
      .join('');

    const moreCount = allSessions.length > 3 ? `+${allSessions.length - 3} more` : '';

    return `
            <div class="day-sessions">
                ${sessionsHTML}
                ${moreCount ? `<div class="session-more">${moreCount}</div>` : ''}
            </div>
        `;
  }

  /**
   * Determine day status
   * @param {Object} day - Day data
   * @returns {Object} Day status
   */
  determineDayStatus(day) {
    const statusStyles = {
      on_track: { class: 'on-track', color: '#10b981' },
      too_little: { class: 'too-little', color: '#ef4444' },
      too_much: { class: 'too-much', color: '#ef4444' },
      unplanned: { class: 'unplanned', color: '#8b5cf6' },
      no_data: { class: 'no-data', color: '#6b7280' },
    };

    const baseStatus = statusStyles[day.status] || statusStyles.on_track;
    let classNames = baseStatus.class;

    if (day.isToday) {
      classNames = `${classNames} today`;
    } else if (day.isPast) {
      classNames = `${classNames} past`;
    }

    return {
      class: classNames.trim(),
      color: baseStatus.color,
    };
  }

  /**
   * Normalize load height for visualization
   * @param {number} load - Load value
   * @param {number} maxLoad - Maximum load for normalization
   * @returns {number} Normalized height percentage
   */
  normalizeLoadHeight(load, maxLoad = 100) {
    if (maxLoad === 0) {
      return 0;
    }
    return Math.min((load / maxLoad) * 100, 100);
  }

  /**
   * Normalize various date inputs to yyyy-mm-dd format
   * @param {Date|string} value - Input date
   * @returns {string|null} Normalized date string or null if invalid
   */
  normalizeDateKey(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
      ].join('-');
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return null;
      }
      if (trimmed.includes('T')) {
        return trimmed.split('T')[0];
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString().split('T')[0];
  }

  /**
   * Generate insights section
   * @param {Object} loadAnalysis - Load analysis
   * @param {Object} guardrailStatus - Guardrail status
   * @returns {string} Insights HTML
   */
  generateInsightsHTML(loadAnalysis, guardrailStatus) {
    const insights = this.generateInsights(loadAnalysis, guardrailStatus);

    if (insights.length === 0) {
      return '';
    }

    return `
            <div class="week-insights">
                <h3>Insights & Recommendations</h3>
                <div class="insights-list">
                    ${insights
                      .map(
                        insight => `
                        <div class="insight-item ${insight.type}">
                            <i class="icon-${insight.icon}">${this.getIcon(insight.icon)}</i>
                            <div class="insight-content">
                                <h4>${insight.title}</h4>
                                <p>${insight.message}</p>
                                ${insight.action ? `<button class="insight-action" data-action="${insight.action}">${insight.actionText}</button>` : ''}
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
  }

  /**
   * Get icon emoji/symbol
   * @param {string} iconName - Icon name
   * @returns {string} Icon symbol
   */
  getIcon(iconName) {
    const icons = {
      'alert-triangle': '⚠️',
      'trending-down': '📉',
      shield: '🛡️',
      target: '🎯',
      info: 'ℹ️',
    };
    return icons[iconName] || '•';
  }

  /**
   * Generate insights based on load analysis and guardrail status
   * @param {Object} loadAnalysis - Load analysis
   * @param {Object} guardrailStatus - Guardrail status
   * @returns {Array} Insights array
   */
  generateInsights(loadAnalysis, guardrailStatus) {
    const insights = [];

    // Load-based insights
    if (loadAnalysis.status.key === 'significantlyOver') {
      insights.push({
        type: 'warning',
        icon: 'alert-triangle',
        title: 'Overreaching Risk',
        message:
          'Your training load is significantly higher than planned. Consider taking an extra rest day.',
        action: 'schedule_rest',
        actionText: 'Schedule Rest Day',
      });
    }

    if (loadAnalysis.status.key === 'significantlyUnder') {
      insights.push({
        type: 'info',
        icon: 'trending-down',
        title: 'Training Missed',
        message:
          "You've missed significant training this week. Plan catch-up sessions if possible.",
        action: 'plan_catchup',
        actionText: 'Plan Catch-up',
      });
    }

    // Guardrail insights
    if (guardrailStatus?.isUnderGuardrail) {
      const activeAdjustments = guardrailStatus.activeAdjustments || [];
      const adjustmentCount = activeAdjustments.length;
      insights.push({
        type: 'caution',
        icon: 'shield',
        title: 'Load Restrictions Active',
        message: `Training intensity is being automatically reduced for your safety (${adjustmentCount} active restriction${adjustmentCount !== 1 ? 's' : ''}).`,
        action: 'view_restrictions',
        actionText: 'View Details',
      });
    }

    // Trend insights
    if (loadAnalysis.loadRatio > 1.1) {
      insights.push({
        type: 'tip',
        icon: 'target',
        title: 'Consistency Focus',
        message: 'Aim for more consistent daily training rather than cramming sessions.',
        action: 'redistribute_load',
        actionText: 'Redistribute Load',
      });
    }

    // On track encouragement
    if (loadAnalysis.status.key === 'onTrack') {
      insights.push({
        type: 'tip',
        icon: 'target',
        title: 'Great Progress!',
        message: "You're staying consistent with your training plan. Keep it up!",
        action: null,
        actionText: null,
      });
    }

    return insights;
  }

  /**
   * Generate navigation HTML
   * @returns {string} Navigation HTML
   */
  generateNavigationHTML() {
    return `
            <div class="week-navigation">
                <button class="week-nav-button week-nav-prev" aria-label="Previous week">← Previous</button>
                <button class="week-nav-button week-nav-today" aria-label="Current week">Today</button>
                <button class="week-nav-button week-nav-next" aria-label="Next week">Next →</button>
            </div>
        `;
  }

  /**
   * Calculate daily breakdown
   * @param {Date} weekStart - Week start date
   * @param {Array} plannedSessions - Planned sessions
   * @param {Array} completedSessions - Completed sessions
   * @returns {Array} Daily breakdown
   */
  calculateDailyBreakdown(weekStart, plannedSessions, completedSessions) {
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(currentDate.getDate() + i);
      const dateString = this.normalizeDateKey(currentDate);

      const dayPlanned = plannedSessions.filter(s => {
        const normalized = this.normalizeDateKey(s.date || s.planned_date || s.start_at);
        return normalized === dateString;
      });
      const dayCompleted = completedSessions.filter(s => {
        const normalized = this.normalizeDateKey(s.date || s.start_at || s.created_at);
        return normalized === dateString;
      });

      const calculatedPlannedLoad = this.calculateTotalLoad(dayPlanned);
      const fallbackPlannedLoad = dayPlanned.reduce(
        (sum, session) => sum + (Number(session.load) || 0),
        0
      );
      const plannedLoad = Math.round(calculatedPlannedLoad || fallbackPlannedLoad);

      const calculatedCompletedLoad = this.calculateTotalLoad(dayCompleted);
      const fallbackCompletedLoad = dayCompleted.reduce(
        (sum, session) => sum + (Number(session.load) || 0),
        0
      );
      const completedLoad = Math.round(calculatedCompletedLoad || fallbackCompletedLoad);
      const percentage =
        plannedLoad > 0
          ? Math.round((completedLoad / plannedLoad) * 100)
          : completedLoad > 0
            ? 100
            : 0;
      const status = this.getDailyStatus(plannedLoad, completedLoad, percentage);

      days.push({
        date: dateString,
        dayName: dayNames[currentDate.getDay()],
        dateNumber: currentDate.getDate(),
        plannedSessions: dayPlanned,
        completedSessions: dayCompleted,
        plannedLoad,
        completedLoad,
        plannedVolume: this.calculateWeeklyVolume(dayPlanned),
        completedVolume: this.calculateWeeklyVolume(dayCompleted),
        percentage,
        status,
        isToday: this.isToday(currentDate),
        isPast: currentDate < new Date() && !this.isToday(currentDate),
      });
    }

    return days;
  }

  /**
   * Generate load message
   * @param {Object} status - Load status
   * @param {number} variancePercentage - Variance percentage
   * @returns {string} Load message
   */
  generateLoadMessage(status, variancePercentage) {
    const messages = {
      onTrack: "You're right on track with your training plan!",
      slightlyOver: `You're doing ${Math.round(variancePercentage)}% more than planned. Consider scaling back slightly.`,
      slightlyUnder: `You're ${Math.round(variancePercentage)}% under your planned load. Try to catch up if possible.`,
      significantlyOver: `You're significantly over your planned load (${Math.round(variancePercentage)}% more). Rest and recovery recommended.`,
      significantlyUnder: `You're well below your planned load (${Math.round(variancePercentage)}% less). Consider what prevented you from training.`,
    };

    return messages[status.key] || status.label;
  }

  /**
   * Generate load recommendation
   * @param {Object} status - Load status
   * @returns {string} Recommendation
   */
  generateLoadRecommendation(status) {
    if (status.key === 'onTrack') {
      return 'Continue with your current training plan.';
    }
    if (status.key === 'significantlyOver') {
      return 'Consider adding an extra rest day or reducing intensity.';
    }
    if (status.key === 'significantlyUnder') {
      return 'Try to catch up on missed training if possible, or adjust your plan.';
    }
    return 'Monitor your training load and adjust as needed.';
  }

  /**
   * Attach event handlers to week view
   * @param {Element} container - Container element
   */
  attachEventHandlers(container) {
    // Navigation buttons
    const prevButton = container.querySelector('.week-nav-prev');
    const nextButton = container.querySelector('.week-nav-next');
    const todayButton = container.querySelector('.week-nav-today');

    prevButton?.addEventListener('click', () => this.navigateWeek(-1));
    nextButton?.addEventListener('click', () => this.navigateWeek(1));
    todayButton?.addEventListener('click', () => this.navigateToToday());

    // Day cards
    const dayCards = container.querySelectorAll('.day-card');
    dayCards.forEach(card => {
      card.addEventListener('click', e => {
        const { date } = e.currentTarget.dataset;
        this.handleDayClick(date);
      });
    });

    // Insight actions
    const insightActions = container.querySelectorAll('.insight-action');
    insightActions.forEach(action => {
      action.addEventListener('click', e => {
        const actionType = e.target.dataset.action;
        this.handleInsightAction(actionType);
      });
    });
  }

  /**
   * Handle day click
   * @param {string} date - Date string
   */
  handleDayClick(date) {
    if (this.eventBus) {
      this.eventBus.emit('DAY_SELECTED', { date });
    }
    this.logger.debug('Day clicked', { date });
  }

  /**
   * Handle insight action
   * @param {string} actionType - Action type
   */
  handleInsightAction(actionType) {
    if (this.eventBus) {
      this.eventBus.emit('INSIGHT_ACTION', { actionType });
    }
    this.logger.debug('Insight action', { actionType });
  }

  /**
   * Navigate to different week
   * @param {number} direction - Direction (-1 for previous, 1 for next)
   */
  navigateWeek(direction) {
    this.currentWeekOffset += direction;
    this.refreshWeekView();
  }

  /**
   * Navigate to current week
   */
  navigateToToday() {
    this.currentWeekOffset = 0;
    this.refreshWeekView();
  }

  /**
   * Refresh the week view
   */
  async refreshWeekView() {
    const container = document.querySelector('.week-view');
    if (container && container.parentElement) {
      const containerId = container.parentElement.id;
      if (containerId) {
        await this.render(containerId);
      }
    }
  }

  /**
   * Update guardrail status
   */
  async updateGuardrailStatus() {
    await this.refreshWeekView();
  }

  /**
   * Get week start date for offset
   * @param {number} offset - Week offset
   * @returns {Date} Week start date
   */
  getWeekStart(offset) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + offset * 7);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Calculate total load for sessions
   * @param {Array} sessions - Sessions array
   * @returns {number} Total load
   */
  calculateTotalLoad(sessions) {
    if (!sessions || sessions.length === 0) {
      return 0;
    }

    return sessions.reduce((total, session) => {
      const sessionLoad = this.loadCalculator?.calculateSessionLoad?.(session);
      const volume = Number(session.volume) || 0;
      const fallback = session.load ?? session.session_load ?? volume;
      return total + (sessionLoad?.total ?? fallback ?? 0);
    }, 0);
  }

  /**
   * Calculate aggregate training volume for sessions
   * @param {Array} sessions - Array of session objects
   * @returns {number} Total volume
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
   * Calculate consistency between planned and completed sessions
   * @param {Array} plannedSessions - Planned sessions for the week
   * @param {Array} completedSessions - Completed sessions for the week
   * @returns {number} Consistency percentage
   */
  calculateConsistencyScore(plannedSessions = [], completedSessions = []) {
    const planned = Array.isArray(plannedSessions) ? plannedSessions.length : 0;
    const completed = Array.isArray(completedSessions) ? completedSessions.length : 0;
    if (planned === 0) {
      return completed > 0 ? 100 : 0;
    }
    return Math.round((completed / planned) * 100);
  }

  /**
   * Get week label for offset
   * @param {number} offset - Week offset
   * @returns {string} Week label
   */
  getWeekLabel(offset) {
    if (offset === 0) {
      return 'This Week';
    }
    if (offset === -1) {
      return 'Last Week';
    }
    if (offset === 1) {
      return 'Next Week';
    }
    if (offset < 0) {
      return `${Math.abs(offset)} Weeks Ago`;
    }
    return `${offset} Weeks Ahead`;
  }

  /**
   * Format date range
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @returns {string} Formatted date range
   */
  formatDateRange(start, end) {
    const options = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);
    return `${startStr} - ${endStr}`;
  }

  /**
   * Check if date is today
   * @param {Date} date - Date to check
   * @returns {boolean} Is today
   */
  isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Generate error HTML
   * @param {string} message - Error message
   * @returns {string} Error HTML
   */
  generateErrorHTML(message) {
    return `
            <div class="week-view-error">
                <p>Unable to load week view: ${message}</p>
                <button onclick="window.WeekView?.refreshWeekView()">Retry</button>
            </div>
        `;
  }
}

// Create global instance
window.WeekView = new WeekView();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WeekView;
}
