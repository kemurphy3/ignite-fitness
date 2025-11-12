/**
 * ProgressRenderer - Basic chart visualization for strength gains and consistency metrics
 * Renders weekly volume bar charts and PR progression line charts using ChartManager
 */

import { ChartManager } from '../ui/charts/ChartManager.js';

class ProgressRenderer {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.chartManager = null; // ChartManager instance
    this.charts = new Map(); // Active charts
    this.cache = {
      progressData: null,
      cacheTime: null,
      ttl: 5 * 60 * 1000, // 5 minutes
    };
    this.trendAnalyzer = window.TrendAnalyzer ? new window.TrendAnalyzer(this.logger) : null;
    this.progressProjector = window.ProgressProjector
      ? new window.ProgressProjector({ logger: this.logger })
      : null;
    this.plateauDetector = window.PlateauDetector
      ? new window.PlateauDetector({ logger: this.logger })
      : null;
    this.performancePredictor = window.PerformancePredictor
      ? new window.PerformancePredictor({ logger: this.logger })
      : null;

    // Initialize on page load
    this.init();
  }

  /**
   * Initialize progress renderer
   */
  async init() {
    this.logger.debug('Initializing ProgressRenderer');

    // Initialize ChartManager
    try {
      if (!ChartManager) {
        this.logger.warn('ChartManager not available, charts will be disabled');
        this.chartManager = null;
        return;
      }

      this.chartManager = new ChartManager();
      await this.chartManager.init();
      this.logger.debug('ChartManager initialized');
    } catch (error) {
      this.logger.warn(
        'Failed to initialize ChartManager, charts will be disabled:',
        error.message
      );
      this.chartManager = null;
    }
  }

  /**
   * Render progress charts in a container
   * @param {string|HTMLElement} container - Container ID or element
   * @param {Object} options - Render options
   */
  async renderCharts(container, _options = {}) {
    try {
      const element =
        typeof container === 'string' ? document.getElementById(container) : container;

      if (!element) {
        this.logger.error('Progress chart container not found:', container);
        return;
      }

      // Show loading skeleton
      this.showSkeleton(element);

      // Get progress data
      const data = await this.getProgressData();

      element.innerHTML = '';

      // Render charts
      await this.renderWeeklyVolumeChart(element, data);
      await this.renderPRProgressionChart(element, data);
      await this.renderConsistencyChart(element, data);
      await this.renderTrendForecastChart(element, data);
      this.renderPlateauAlert(element, data);
      this.renderTimelineSummary(element, data);
    } catch (error) {
      this.logger.error('Failed to render progress charts:', error);
      const element =
        typeof container === 'string' ? document.getElementById(container) : container;
      this.showError(element, error);
    }
  }

  /**
   * Get progress data from session logs and progression events
   * @returns {Promise<Object>} Progress data
   */
  async getProgressData() {
    // Check cache
    if (this.cache.progressData && this.isCacheValid()) {
      this.logger.debug('Using cached progress data');
      return this.cache.progressData;
    }

    const userId =
      window.AuthManager?.getCurrentUserId() ||
      window.AuthManager?.getCurrentUsername() ||
      'anonymous';
    const sessions = this.getUserSessions(userId);
    const progressionEvents = this.getUserProgressionEvents(userId);

    // Calculate weekly volumes
    const weeklyVolumes = this.calculateWeeklyVolumes(sessions);

    // Identify PRs
    const strengthPRs = this.identifyPRs(sessions, progressionEvents);

    // Calculate consistency
    const consistency = this.calculateConsistency(sessions);

    const data = {
      weeklyVolumes,
      strengthPRs,
      consistency,
      totalWorkouts: sessions.length,
      dateRange: this.getDateRange(sessions),
    };

    const seriesForForecast = weeklyVolumes
      .filter(item => Number.isFinite(item.volume) && item.startDate)
      .map(item => ({
        timestamp: new Date(item.startDate).getTime(),
        value: item.volume,
      }));

    data.trendInsights = this.computeTrendInsights(seriesForForecast);
    data.plateauStatus = this.computePlateauStatus(seriesForForecast);
    data.projections = this.computeProjections(seriesForForecast);

    // Cache data
    this.cache.progressData = data;
    this.cache.cacheTime = Date.now();

    return data;
  }

  /**
   * Get user sessions
   * @param {string} userId - User ID
   * @returns {Array} Session logs
   */
  getUserSessions(userId) {
    try {
      const allLogs = this.storageManager.getSessionLogs();
      const userSessions = Object.values(allLogs)
        .filter(log => log.userId === userId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      return userSessions;
    } catch (error) {
      this.logger.error('Failed to get user sessions:', error);
      return [];
    }
  }

  /**
   * Get user progression events
   * @param {string} userId - User ID
   * @returns {Array} Progression events
   */
  getUserProgressionEvents(userId) {
    try {
      const allEvents = this.storageManager.getProgressionEvents();
      const userEvents = Object.values(allEvents)
        .filter(event => event.userId === userId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      return userEvents;
    } catch (error) {
      this.logger.error('Failed to get progression events:', error);
      return [];
    }
  }

  /**
   * Calculate weekly volumes from sessions
   * @param {Array} sessions - Session logs
   * @returns {Array} Weekly volume data
   */
  calculateWeeklyVolumes(sessions) {
    const weeklyData = {};

    sessions.forEach(session => {
      const weekKey = this.getWeekKey(new Date(session.date));

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          week: weekKey,
          volume: 0,
          workouts: 0,
          exercises: new Set(),
          startDate: this.getWeekStartDate(new Date(session.date)).toISOString(),
        };
      } else if (!weeklyData[weekKey].startDate) {
        weeklyData[weekKey].startDate = this.getWeekStartDate(new Date(session.date)).toISOString();
      }

      // Calculate session volume (sets × reps × weight)
      const sessionVolume = this.calculateSessionVolume(session);
      weeklyData[weekKey].volume += sessionVolume;
      weeklyData[weekKey].workouts += 1;

      // Track exercises
      if (session.exercises) {
        session.exercises.forEach(ex => {
          if (ex.name) {
            weeklyData[weekKey].exercises.add(ex.name);
          }
        });
      }
    });

    // Convert to array and sort by week
    const volumes = Object.values(weeklyData).map(week => ({
      week: week.week,
      volume: Math.round(week.volume),
      workouts: week.workouts,
      exerciseCount: week.exercises.size,
      startDate: week.startDate,
    }));

    return volumes.sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * Calculate session volume
   * @param {Object} session - Session data
   * @returns {number} Total volume (sets × reps × weight)
   */
  calculateSessionVolume(session) {
    let totalVolume = 0;

    if (session.exercises && Array.isArray(session.exercises)) {
      session.exercises.forEach(exercise => {
        if (exercise.sets && Array.isArray(exercise.sets)) {
          exercise.sets.forEach(set => {
            const weight = set.weight || set.targetWeight || 0;
            const reps = set.reps || set.targetReps || 0;
            totalVolume += weight * reps;
          });
        }
      });
    }

    return totalVolume;
  }

  /**
   * Identify PRs from sessions and progression events
   * @param {Array} sessions - Session logs
   * @param {Array} progressionEvents - Progression events
   * @returns {Object} PR data by exercise
   */
  identifyPRs(sessions, progressionEvents) {
    const prs = {};

    // Check progression events for explicit PRs
    progressionEvents.forEach(event => {
      if (event.type === 'pr' || event.type === 'personal_record') {
        const exerciseName = event.exercise || event.exerciseName || 'Unknown';
        if (!prs[exerciseName] || event.weight > prs[exerciseName].max) {
          prs[exerciseName] = {
            max: event.weight,
            date: event.date,
            previous: prs[exerciseName]?.max || null,
          };
        }
      }
    });

    // Analyze sessions for implicit PRs (highest weight per exercise)
    const exerciseMaxes = {};

    sessions.forEach(session => {
      if (session.exercises && Array.isArray(session.exercises)) {
        session.exercises.forEach(exercise => {
          const exerciseName = exercise.name || exercise.exercise || 'Unknown';
          if (!exerciseMaxes[exerciseName]) {
            exerciseMaxes[exerciseName] = { max: 0, date: session.date };
          }

          if (exercise.sets && Array.isArray(exercise.sets)) {
            exercise.sets.forEach(set => {
              const weight = set.weight || set.targetWeight || 0;
              if (weight > exerciseMaxes[exerciseName].max) {
                exerciseMaxes[exerciseName].max = weight;
                exerciseMaxes[exerciseName].date = session.date;
              }
            });
          }
        });
      }
    });

    // Merge implicit PRs with explicit ones
    Object.entries(exerciseMaxes).forEach(([exerciseName, data]) => {
      if (!prs[exerciseName] || data.max > prs[exerciseName].max) {
        const previous = prs[exerciseName]?.max || null;
        prs[exerciseName] = {
          max: data.max,
          date: data.date,
          previous,
        };
      }
    });

    return prs;
  }

  /**
   * Calculate consistency metrics
   * @param {Array} sessions - Session logs
   * @returns {Object} Consistency data by week
   */
  calculateConsistency(sessions) {
    const weeklyCounts = {};

    sessions.forEach(session => {
      const weekKey = this.getWeekKey(new Date(session.date));
      weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
    });

    return weeklyCounts;
  }

  /**
   * Get week key for grouping
   * @param {Date} date - Date
   * @returns {string} Week key (YYYY-MM-WW)
   */
  getWeekKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    return `${year}-${month}-W${week}`;
  }

  /**
   * Get the start date (Monday) for the week of a given date.
   * @param {Date} date
   * @returns {Date}
   */
  getWeekStartDate(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = (start.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    start.setDate(start.getDate() - day);
    return start;
  }

  computeTrendInsights(series) {
    if (!this.trendAnalyzer || series.length < 2) {
      return null;
    }
    const points = series.map((point, index) => ({ x: index, y: point.value }));
    const regression = this.trendAnalyzer.linearRegression(points);
    const ema = this.trendAnalyzer.exponentialMovingAverage(series.map(point => point.value));
    return {
      slope: regression.slope,
      intercept: regression.intercept,
      r2: Number(regression.r2.toFixed(4)),
      standardError: regression.standardError,
      latestEMA: ema.at(-1) ?? null,
    };
  }

  computePlateauStatus(series) {
    if (!this.plateauDetector || series.length < 5) {
      return {
        plateau: false,
        confidence: 0,
        reasons: [],
        recommendations: [],
        changePoint: false,
      };
    }
    return this.plateauDetector.detect(series);
  }

  computeProjections(series) {
    if (!this.progressProjector || series.length < 2) {
      return null;
    }
    return this.progressProjector.project(series, { steps: 4, intervalDays: 7 });
  }

  /**
   * Get date range from sessions
   * @param {Array} sessions - Session logs
   * @returns {Object} Date range
   */
  getDateRange(sessions) {
    if (sessions.length === 0) {
      return { start: null, end: null };
    }

    const dates = sessions.map(s => new Date(s.date)).sort((a, b) => a - b);
    return {
      start: dates[0],
      end: dates[dates.length - 1],
    };
  }

  /**
   * Check if cache is valid
   * @returns {boolean} Cache valid
   */
  isCacheValid() {
    if (!this.cache.cacheTime) {
      return false;
    }
    return Date.now() - this.cache.cacheTime < this.cache.ttl;
  }

  /**
   * Render weekly volume bar chart
   * @param {HTMLElement} container - Container element
   * @param {Object} data - Progress data
   */
  async renderWeeklyVolumeChart(container, data) {
    if (!this.chartManager) {
      this.logger.warn('ChartManager not available for weekly volume chart');
      return;
    }

    const chartContainer = this.createChartContainer(
      container,
      'weekly-volume-chart',
      'Weekly Volume'
    );

    try {
      const config = {
        type: 'bar',
        data: {
          labels: data.weeklyVolumes.map(w => w.week),
          datasets: [
            {
              label: 'Volume (lbs)',
              data: data.weeklyVolumes.map(w => w.volume),
              backgroundColor: 'rgba(54, 162, 235, 0.6)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Weekly Training Volume',
            },
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Volume (lbs)',
              },
            },
            x: {
              title: {
                display: true,
                text: 'Week',
              },
            },
          },
        },
      };

      const canvas = chartContainer.querySelector('canvas');
      await this.chartManager.createChart('weekly-volume-chart', config, canvas);

      // Add accessibility
      this.addChartAccessibility(chartContainer, 'weekly-volume-chart', data);
    } catch (error) {
      this.logger.error('Failed to render weekly volume chart:', error);
      this.showError(chartContainer, error);
    }
  }

  /**
   * Render PR progression line chart
   * @param {HTMLElement} container - Container element
   * @param {Object} data - Progress data
   */
  async renderPRProgressionChart(container, data) {
    if (!this.chartManager) {
      this.logger.warn('ChartManager not available for PR progression chart');
      return;
    }

    const chartContainer = this.createChartContainer(
      container,
      'pr-progression-chart',
      'PR Progression'
    );

    try {
      const prs = data.strengthPRs;
      const exercises = Object.keys(prs);

      if (exercises.length === 0) {
        chartContainer.innerHTML =
          '<p class="chart-empty">No personal records recorded yet. Start tracking your strength progress!</p>';
        return;
      }

      // Limit to top 5 exercises by max weight
      const topExercises = exercises
        .map(ex => ({ name: ex, max: prs[ex].max }))
        .sort((a, b) => b.max - a.max)
        .slice(0, 5)
        .map(ex => ex.name);

      const datasets = topExercises.map((exercise, index) => {
        const colors = [
          { bg: 'rgba(255, 99, 132, 0.6)', border: 'rgba(255, 99, 132, 1)' },
          { bg: 'rgba(54, 162, 235, 0.6)', border: 'rgba(54, 162, 235, 1)' },
          { bg: 'rgba(255, 206, 86, 0.6)', border: 'rgba(255, 206, 86, 1)' },
          { bg: 'rgba(75, 192, 192, 0.6)', border: 'rgba(75, 192, 192, 1)' },
          { bg: 'rgba(153, 102, 255, 0.6)', border: 'rgba(153, 102, 255, 1)' },
        ];
        const color = colors[index % colors.length];

        return {
          label: exercise,
          data: [{ x: prs[exercise].date, y: prs[exercise].max }],
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        };
      });

      const config = {
        type: 'line',
        data: {
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Personal Records (Top 5 Exercises)',
            },
            legend: {
              display: true,
              position: 'bottom',
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Weight (lbs)',
              },
            },
            x: {
              type: 'time',
              time: {
                unit: 'day',
                displayFormats: {
                  day: 'MMM D',
                },
              },
              title: {
                display: true,
                text: 'Date',
              },
            },
          },
        },
      };

      const canvas = chartContainer.querySelector('canvas');
      await this.chartManager.createChart('pr-progression-chart', config, canvas);

      // Add accessibility
      this.addChartAccessibility(chartContainer, 'pr-progression-chart', data);
    } catch (error) {
      this.logger.error('Failed to render PR progression chart:', error);
      this.showError(chartContainer, error);
    }
  }

  /**
   * Render consistency bar chart
   * @param {HTMLElement} container - Container element
   * @param {Object} data - Progress data
   */
  async renderConsistencyChart(container, data) {
    if (!this.chartManager) {
      this.logger.warn('ChartManager not available for consistency chart');
      return;
    }

    const chartContainer = this.createChartContainer(
      container,
      'consistency-chart',
      'Workout Consistency'
    );

    try {
      const { consistency } = data;
      const weeks = Object.keys(consistency).sort();

      if (weeks.length === 0) {
        chartContainer.innerHTML = '<p class="chart-empty">No consistency data available yet.</p>';
        return;
      }

      const config = {
        type: 'bar',
        data: {
          labels: weeks,
          datasets: [
            {
              label: 'Workouts per Week',
              data: weeks.map(w => consistency[w]),
              backgroundColor: weeks.map(w => {
                const count = consistency[w];
                if (count >= 3) {
                  return 'rgba(75, 192, 192, 0.6)';
                } // Good
                if (count >= 2) {
                  return 'rgba(255, 206, 86, 0.6)';
                } // Fair
                return 'rgba(255, 99, 132, 0.6)'; // Poor
              }),
              borderColor: weeks.map(w => {
                const count = consistency[w];
                if (count >= 3) {
                  return 'rgba(75, 192, 192, 1)';
                }
                if (count >= 2) {
                  return 'rgba(255, 206, 86, 1)';
                }
                return 'rgba(255, 99, 132, 1)';
              }),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Workout Consistency (Workouts per Week)',
            },
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
              },
              title: {
                display: true,
                text: 'Workouts',
              },
            },
            x: {
              title: {
                display: true,
                text: 'Week',
              },
            },
          },
        },
      };

      const canvas = chartContainer.querySelector('canvas');
      await this.chartManager.createChart('consistency-chart', config, canvas);

      // Add accessibility
      this.addChartAccessibility(chartContainer, 'consistency-chart', data);
    } catch (error) {
      this.logger.error('Failed to render consistency chart:', error);
      this.showError(chartContainer, error);
    }
  }

  async renderTrendForecastChart(container, data) {
    if (!this.chartManager || !data.projections || !data.weeklyVolumes?.length) {
      return;
    }

    const chartContainer = this.createChartContainer(
      container,
      'trend-forecast-chart',
      'Trend Forecast'
    );

    try {
      const actualSeries = data.weeklyVolumes
        .filter(item => item.startDate)
        .map(item => ({
          x: item.startDate,
          y: item.volume,
        }));

      const baseline = data.projections.baseline.map(point => ({
        x: new Date(point.timestamp).toISOString(),
        y: Number(point.value.toFixed(2)),
      }));
      const upper = data.projections.upper.map(point => ({
        x: new Date(point.timestamp).toISOString(),
        y: Number(point.value.toFixed(2)),
      }));
      const lower = data.projections.lower.map(point => ({
        x: new Date(point.timestamp).toISOString(),
        y: Number(point.value.toFixed(2)),
      }));

      const config = {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Actual Volume',
              data: actualSeries,
              borderColor: 'rgba(46, 204, 113, 1)',
              backgroundColor: 'rgba(46, 204, 113, 0.15)',
              borderWidth: 2,
              pointRadius: 4,
              tension: 0.25,
              parsing: false,
            },
            {
              label: 'Forecast',
              data: baseline,
              borderColor: 'rgba(52, 152, 219, 1)',
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 3,
              tension: 0.25,
              parsing: false,
            },
            {
              label: 'Upper Confidence',
              data: upper,
              borderColor: 'rgba(52, 152, 219, 0)',
              backgroundColor: 'rgba(52, 152, 219, 0.12)',
              pointRadius: 0,
              fill: '+1',
              tension: 0.25,
              parsing: false,
            },
            {
              label: 'Lower Confidence',
              data: lower,
              borderColor: 'rgba(52, 152, 219, 0)',
              pointRadius: 0,
              parsing: false,
              tension: 0.25,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          parsing: false,
          plugins: {
            title: {
              display: true,
              text: 'Projected Weekly Volume (95% Confidence Interval)',
            },
            legend: {
              position: 'bottom',
            },
            tooltip: {
              callbacks: {
                label: context => {
                  const value = context.parsed?.y ?? context.raw?.y;
                  return `${context.dataset.label}: ${Number(value).toFixed(0)} lbs`;
                },
              },
            },
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'week',
              },
              title: {
                display: true,
                text: 'Week',
              },
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Volume (lbs)',
              },
            },
          },
        },
      };

      const canvas = chartContainer.querySelector('canvas');
      await this.chartManager.createChart('trend-forecast-chart', config, canvas);
      this.addChartAccessibility(chartContainer, 'trend-forecast-chart', data);
    } catch (error) {
      this.logger.error('Failed to render trend forecast chart:', error);
      this.showError(chartContainer, error);
    }
  }

  renderPlateauAlert(container, data) {
    const existing = container.querySelector('.plateau-alert');
    if (existing) {
      existing.remove();
    }

    const status = data.plateauStatus;
    if (!status || !status.plateau || status.confidence < 0.8) {
      return;
    }

    const alert = document.createElement('div');
    alert.className = 'plateau-alert';
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
            <h4>Progress Plateau Detected</h4>
            <p>Confidence: ${(status.confidence * 100).toFixed(0)}%</p>
            <ul>
                ${status.reasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
            <p><strong>Recommendation:</strong> ${status.recommendations.join(' ')}</p>
        `;
    container.appendChild(alert);
  }

  renderTimelineSummary(container, data) {
    const existing = container.querySelector('.trend-timeline-summary');
    if (existing) {
      existing.remove();
    }

    const insights = data.trendInsights;
    const latest = data.weeklyVolumes?.at(-1);
    if (
      !insights ||
      !latest ||
      !this.performancePredictor ||
      !Number.isFinite(insights.slope) ||
      insights.slope <= 0
    ) {
      return;
    }

    const targetVolume = latest.volume * 1.1;
    const timeline = this.performancePredictor.estimateGoalTimeline(
      latest.volume,
      targetVolume,
      insights.slope
    );

    if (
      !timeline ||
      !Number.isFinite(timeline.days) ||
      timeline.days <= 0 ||
      timeline.days === Infinity
    ) {
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'trend-timeline-summary';
    const plateauMessage = data.plateauStatus?.plateau
      ? '<p class="plateau-note">Progress has plateaued; adjustments are recommended before relying on projections.</p>'
      : '';
    summary.innerHTML = `
            <h4>Timeline Projection</h4>
            <p>At current rate, a 10% volume increase is projected in <strong>${Math.round(timeline.days)}</strong> days.</p>
            <p>Trend strength (R²): ${Number(insights.r2 || 0).toFixed(2)}</p>
            ${plateauMessage}
        `;
    container.appendChild(summary);
  }

  /**
   * Create chart container element
   * @param {HTMLElement} parent - Parent container
   * @param {string} chartId - Chart ID
   * @param {string} title - Chart title
   * @returns {HTMLElement} Chart container
   */
  createChartContainer(parent, chartId, title) {
    const container = document.createElement('div');
    container.className = 'progress-chart-container';
    container.id = chartId;

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    container.appendChild(titleEl);

    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'chart-wrapper';
    canvasWrapper.style.height = '300px';
    canvasWrapper.style.position = 'relative';

    const canvas = document.createElement('canvas');
    canvas.dataset.chartId = chartId;
    canvasWrapper.appendChild(canvas);
    container.appendChild(canvasWrapper);

    parent.appendChild(container);
    return container;
  }

  /**
   * Add accessibility features to chart
   * @param {HTMLElement} container - Chart container
   * @param {string} chartId - Chart ID
   * @param {Object} data - Chart data
   */
  addChartAccessibility(container, chartId, data) {
    const canvas = container.querySelector('canvas');
    if (!canvas) {
      return;
    }

    // Add ARIA attributes
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${chartId} chart`);

    // Add description (hidden)
    const description = document.createElement('div');
    description.className = 'sr-only';
    description.id = `${chartId}-description`;
    description.textContent = this.generateChartDescription(chartId, data);
    container.appendChild(description);
  }

  /**
   * Generate chart description for screen readers
   * @param {string} chartId - Chart ID
   * @param {Object} data - Chart data
   * @returns {string} Description
   */
  generateChartDescription(chartId, data) {
    if (chartId === 'weekly-volume-chart') {
      const volumes = data.weeklyVolumes || [];
      if (volumes.length === 0) {
        return 'No volume data available.';
      }
      const avg = Math.round(volumes.reduce((sum, w) => sum + w.volume, 0) / volumes.length);
      return `Weekly training volume chart showing ${volumes.length} weeks of data. Average weekly volume: ${avg} pounds.`;
    }

    if (chartId === 'pr-progression-chart') {
      const prs = data.strengthPRs || {};
      const exercises = Object.keys(prs);
      if (exercises.length === 0) {
        return 'No personal records recorded yet.';
      }
      return `Personal records chart showing ${exercises.length} exercises with recorded PRs.`;
    }

    if (chartId === 'consistency-chart') {
      const consistency = data.consistency || {};
      const weeks = Object.keys(consistency);
      if (weeks.length === 0) {
        return 'No consistency data available.';
      }
      const total = Object.values(consistency).reduce((sum, count) => sum + count, 0);
      const avg = Math.round(total / weeks.length);
      return `Workout consistency chart showing ${weeks.length} weeks of data. Average workouts per week: ${avg}.`;
    }

    if (chartId === 'trend-forecast-chart') {
      const trend = data.trendInsights;
      if (!trend) {
        return 'Trend forecast unavailable due to limited data.';
      }
      return `Forecast chart with slope ${trend.slope.toFixed(2)} and confidence ${Number(trend.r2 || 0).toFixed(2)}.`;
    }

    return `${chartId} chart`;
  }

  /**
   * Show loading skeleton
   * @param {HTMLElement} element - Container element
   */
  showSkeleton(element) {
    element.innerHTML = '<div class="chart-loading"><p>Loading progress charts...</p></div>';
  }

  /**
   * Show error message
   * @param {HTMLElement} element - Container element
   * @param {Error} error - Error object
   */
  showError(element, error) {
    element.innerHTML = `
            <div class="chart-error">
                <p>Failed to load progress charts.</p>
                <p class="error-detail">${error.message || 'Unknown error'}</p>
            </div>
        `;
  }
}

// Create global instance
window.ProgressRenderer = new ProgressRenderer();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressRenderer;
}
