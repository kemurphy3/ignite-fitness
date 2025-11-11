/**
 * Trends - Real chart rendering with ChartManager
 * Uses web worker for chart rendering to prevent main thread blocking
 */
class Trends {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.chartManager = null; // ChartManager instance
    this.charts = new Map(); // Active charts
    this.cache = {
      last30Days: null,
      cacheTime: null,
      ttl: 5 * 60 * 1000, // 5 minutes
    };

    // Initialize on page load
    this.init();
  }

  /**
   * Initialize trends module
   */
  async init() {
    this.logger.debug('Initializing Trends module');

    // Initialize ChartManager
    try {
      if (typeof ChartManager === 'undefined') {
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
      // Don't return - allow Trends to continue without charts
    }

    // Set up intersection observer for lazy loading
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.dataset.loaded) {
              entry.target.dataset.loaded = 'true';
              this.loadChartForElement(entry.target);
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before visible
        }
      );

      // Watch for chart placeholders
      document.querySelectorAll('.chart-placeholder').forEach(el => {
        this.observer.observe(el);
      });
    } else {
      // Fallback: load all charts immediately
      this.logger.warn('IntersectionObserver not supported, loading all charts');
      document.querySelectorAll('.chart-placeholder').forEach(el => {
        this.loadChartForElement(el);
      });
    }
  }

  /**
   * Load chart for a specific element
   * @param {HTMLElement} element - Chart container element
   */
  async loadChartForElement(element) {
    try {
      const chartId = element.id || element.getAttribute('data-chart-id');

      if (!chartId) {
        this.logger.warn('No chart ID found for element', element);
        return;
      }

      // Show loading skeleton
      this.showSkeleton(element);

      // Get data for chart
      const data = await this.getDataForChart(chartId);

      // Render chart using ChartManager
      await this.renderChart(element, chartId, data);
    } catch (error) {
      this.logger.error('Failed to load chart', error);
      this.showError(element, error);
    }
  }

  /**
   * Lazy load Chart.js library
   */
  async loadChartLibrary() {
    if (this.chartLibrary) {
      return;
    }

    try {
      // Dynamic import of Chart.js
      const ChartModule = await import(
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js'
      );
      this.chartLibrary = ChartModule.Chart;

      this.logger.debug('Chart.js loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load Chart.js', error);
      throw error;
    }
  }

  /**
   * Get cached or fetch data for chart
   * @param {string} chartId - Chart identifier
   * @returns {Promise<Object>} Chart data
   */
  async getDataForChart(chartId) {
    // Check cache first
    if (this.cache.last30Days && this.isCacheValid()) {
      this.logger.debug('Using cached chart data');
      return this.cache.last30Days;
    }

    // Fetch fresh data
    const userId = window.AuthManager?.getCurrentUsername() || 'anonymous';
    const sessions = await this.getLast30DaysSessions(userId);

    // Aggregate data
    const data = this.aggregateData(sessions);

    // Cache data
    this.cache.last30Days = data;
    this.cache.cacheTime = Date.now();

    return data;
  }

  /**
   * Get last 30 days of workout sessions
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Session data
   */
  async getLast30DaysSessions(userId) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      // Get all session logs
      const allSessions = this.storageManager.getSessionLogs();

      // Filter for user and date range
      const sessions = [];
      Object.entries(allSessions).forEach(([key, session]) => {
        if (session.userId === userId && session.session) {
          const sessionDate = new Date(session.session.timestamp || session.session.date);
          if (sessionDate >= startDate && sessionDate <= endDate) {
            sessions.push({
              timestamp: session.session.timestamp || session.session.date,
              exercises: session.session.exercises || [],
              readinessScore: session.session.readiness || session.session.readinessScore,
              volume: session.session.volume,
              ...session.session,
            });
          }
        }
      });

      // Sort by date
      sessions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return sessions;
    } catch (error) {
      this.logger.error('Failed to fetch sessions', error);
      return [];
    }
  }

  /**
   * Aggregate session data for charts
   * @param {Array} sessions - Session data
   * @returns {Object} Aggregated data
   */
  aggregateData(sessions) {
    const weeklyVolume = this.calculateWeeklyVolume(sessions);
    const readinessTrend = this.calculateReadinessTrend(sessions);
    const strengthPRs = this.detectStrengthPRs(sessions);

    return {
      weeklyVolume,
      readinessTrend,
      strengthPRs,
    };
  }

  /**
   * Calculate weekly volume by category
   * @param {Array} sessions - Session data
   * @returns {Array} Weekly volume data
   */
  calculateWeeklyVolume(sessions) {
    const weeks = {};

    sessions.forEach(session => {
      const date = new Date(session.timestamp);
      const weekKey = this.getWeekKey(date);

      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          upper: 0,
          lower: 0,
          core: 0,
          cardio: 0,
        };
      }

      // Categorize and sum volume
      session.exercises?.forEach(ex => {
        const category = this.getExerciseCategory(ex.name);
        const volume = ex.sets?.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0) || 0;
        weeks[weekKey][category] += volume;
      });
    });

    // Convert to array and sort by date
    return Object.entries(weeks)
      .map(([key, data]) => ({ date: key, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate readiness trend
   * @param {Array} sessions - Session data
   * @returns {Array} Readiness scores over time
   */
  calculateReadinessTrend(sessions) {
    const readinessData = [];

    sessions.forEach(session => {
      if (session.readinessScore !== undefined) {
        readinessData.push({
          date: session.timestamp,
          score: session.readinessScore,
        });
      }
    });

    return readinessData.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Detect strength PRs
   * @param {Array} sessions - Session data
   * @returns {Object} PRs by exercise
   */
  detectStrengthPRs(sessions) {
    const prs = {};

    sessions.forEach(session => {
      session.exercises?.forEach(ex => {
        if (!ex.name) {
          return;
        }

        const category = this.getExerciseCategory(ex.name);

        // Only track heavy strength lifts
        if (category !== 'upper' && category !== 'lower') {
          return;
        }

        ex.sets?.forEach(set => {
          if (!set.reps || !set.weight) {
            return;
          }

          // 1-5 reps = strength range
          if (set.reps >= 1 && set.reps <= 5) {
            const oneRepMax = this.calculate1RM(set.weight, set.reps);

            if (!prs[ex.name] || prs[ex.name].max < oneRepMax) {
              prs[ex.name] = {
                max: oneRepMax,
                date: session.timestamp,
                weight: set.weight,
                reps: set.reps,
              };
            }
          }
        });
      });
    });

    return prs;
  }

  /**
   * Get week key for grouping
   * @param {Date} date - Date object
   * @returns {string} Week key (YYYY-WW)
   */
  getWeekKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    return `${year}-${month}-W${week}`;
  }

  /**
   * Get exercise category
   * @param {string} exerciseName - Exercise name
   * @returns {string} Category
   */
  getExerciseCategory(exerciseName) {
    const name = exerciseName.toLowerCase();

    if (
      name.includes('squat') ||
      name.includes('deadlift') ||
      name.includes('leg') ||
      name.includes('calf') ||
      name.includes('glute') ||
      name.includes('hip')
    ) {
      return 'lower';
    }

    if (
      name.includes('press') ||
      name.includes('curl') ||
      name.includes('row') ||
      name.includes('pull') ||
      name.includes('shoulder') ||
      name.includes('tricep') ||
      name.includes('bicep') ||
      name.includes('chest') ||
      name.includes('lat')
    ) {
      return 'upper';
    }

    if (
      name.includes('core') ||
      name.includes('ab') ||
      name.includes('plank') ||
      name.includes('crunch') ||
      name.includes('sit-up')
    ) {
      return 'core';
    }

    return 'cardio';
  }

  /**
   * Calculate estimated 1RM
   * @param {number} weight - Weight lifted
   * @param {number} reps - Reps performed
   * @returns {number} Estimated 1RM
   */
  calculate1RM(weight, reps) {
    // Brzycki formula
    if (reps === 1) {
      return weight;
    }
    return weight * (36 / (37 - reps));
  }

  /**
   * Render chart based on type
   * @param {HTMLElement} element - Container element
   * @param {string} chartId - Chart identifier
   * @param {Object} data - Chart data
   */
  async renderChart(element, chartId, data) {
    if (!this.chartManager) {
      this.logger.warn('ChartManager not available, showing fallback message');
      element.innerHTML =
        '<div class="chart-error" style="padding: 2rem; text-align: center; color: var(--text-secondary, #666);"><p>Charts are not available. Please check console for details.</p></div>';
      return;
    }

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.dataset.chartId = chartId;
    canvas.width = element.offsetWidth || 400;
    canvas.height = element.offsetHeight || 300;

    // Clear element and add canvas
    element.innerHTML = '';
    element.appendChild(canvas);

    // Determine chart type and get configuration
    let config;
    if (chartId.includes('strength') || chartId.includes('strengthChart')) {
      config = this.getStrengthChartConfig(data);
    } else if (chartId.includes('volume') || chartId.includes('volumeChart')) {
      config = this.getVolumeChartConfig(data);
    } else if (chartId.includes('consistency') || chartId.includes('consistencyChart')) {
      config = this.getConsistencyChartConfig(data);
    } else {
      this.logger.warn('Unknown chart type', chartId);
      return;
    }

    // Create chart using ChartManager
    try {
      const chart = await this.chartManager.createChart(chartId, config, canvas);
      this.charts.set(chartId, chart);

      // Add accessibility features
      this.addChartAccessibility(element, chartId, data, config);
    } catch (error) {
      this.logger.error('Failed to create chart:', error);
      throw error;
    }
  }

  /**
   * Add accessibility features to chart
   * @param {HTMLElement} element - Chart container element
   * @param {string} chartId - Chart identifier
   * @param {Object} data - Chart data
   * @param {Object} config - Chart configuration
   */
  addChartAccessibility(element, chartId, data, config) {
    const canvas = element.querySelector('canvas');
    if (!canvas) {
      return;
    }

    // Add ARIA attributes to canvas
    const chartDescription = this.generateChartDescription(chartId, data, config);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', chartDescription.title);
    canvas.setAttribute('aria-describedby', `${chartId}-description`);

    // Add description
    const descriptionDiv = document.createElement('div');
    descriptionDiv.id = `${chartId}-description`;
    descriptionDiv.className = 'sr-only';
    descriptionDiv.innerHTML = chartDescription.full;
    element.appendChild(descriptionDiv);

    // Add data table for screen readers
    const dataTable = this.createDataTable(chartId, data, config);
    if (dataTable) {
      element.appendChild(dataTable);
    }

    // Add keyboard navigation
    this.addKeyboardNavigation(canvas, chartId);
  }

  /**
   * Generate chart description for screen readers
   * @param {string} chartId - Chart identifier
   * @param {Object} data - Chart data
   * @param {Object} config - Chart configuration
   * @returns {Object} Description object
   */
  generateChartDescription(chartId, data, config) {
    const descriptions = {
      'strength-chart': {
        title: 'Strength progress chart showing personal records over time',
        full: this.generateStrengthDescription(data),
      },
      'volume-chart': {
        title: 'Training volume chart showing weekly workout intensity',
        full: this.generateVolumeDescription(data),
      },
      'consistency-chart': {
        title: 'Workout consistency chart showing training frequency',
        full: this.generateConsistencyDescription(data),
      },
    };

    return (
      descriptions[chartId] || {
        title: `Chart displaying ${chartId} data`,
        full: `Data visualization showing ${chartId} information.`,
      }
    );
  }

  /**
   * Generate strength chart description
   * @param {Object} data - Chart data
   * @returns {string} Description text
   */
  generateStrengthDescription(data) {
    const prs = data.strengthPRs || {};
    const exercises = Object.keys(prs);

    if (exercises.length === 0) {
      return 'No personal records recorded yet. Start tracking your strength progress.';
    }

    let description = `Strength progress chart showing personal records for ${exercises.length} exercises. `;

    exercises.forEach(exercise => {
      const pr = prs[exercise];
      description += `${exercise}: ${pr.max} pounds on ${pr.date}. `;
    });

    return description;
  }

  /**
   * Generate volume chart description
   * @param {Object} data - Chart data
   * @returns {string} Description text
   */
  generateVolumeDescription(data) {
    const volumes = data.weeklyVolumes || [];

    if (volumes.length === 0) {
      return 'No training volume data available yet.';
    }

    const totalVolume = volumes.reduce((sum, week) => sum + week.volume, 0);
    const averageVolume = Math.round(totalVolume / volumes.length);
    const peakWeek = volumes.reduce(
      (max, week) => (week.volume > max.volume ? week : max),
      volumes[0]
    );

    return (
      `Training volume chart showing ${volumes.length} weeks of data. ` +
      `Average weekly volume: ${averageVolume} pounds. ` +
      `Peak week: ${peakWeek.volume} pounds on ${peakWeek.week}.`
    );
  }

  /**
   * Generate consistency chart description
   * @param {Object} data - Chart data
   * @returns {string} Description text
   */
  generateConsistencyDescription(data) {
    const consistency = data.consistency || {};
    const weeks = Object.keys(consistency);

    if (weeks.length === 0) {
      return 'No consistency data available yet.';
    }

    const totalWorkouts = Object.values(consistency).reduce((sum, count) => sum + count, 0);
    const averageWorkouts = Math.round(totalWorkouts / weeks.length);

    return (
      `Workout consistency chart showing ${weeks.length} weeks of training data. ` +
      `Average workouts per week: ${averageWorkouts}. ` +
      `Total workouts completed: ${totalWorkouts}.`
    );
  }

  /**
   * Create data table for screen readers
   * @param {string} chartId - Chart identifier
   * @param {Object} data - Chart data
   * @param {Object} config - Chart configuration
   * @returns {HTMLElement} Data table element
   */
  createDataTable(chartId, data, config) {
    const table = document.createElement('table');
    table.className = 'sr-only chart-data-table';
    table.setAttribute('aria-label', `Data table for ${chartId}`);

    // Create table based on chart type
    if (chartId.includes('strength')) {
      this.createStrengthDataTable(table, data);
    } else if (chartId.includes('volume')) {
      this.createVolumeDataTable(table, data);
    } else if (chartId.includes('consistency')) {
      this.createConsistencyDataTable(table, data);
    } else {
      return null; // Unknown chart type
    }

    return table;
  }

  /**
   * Create strength data table
   * @param {HTMLElement} table - Table element
   * @param {Object} data - Chart data
   */
  createStrengthDataTable(table, data) {
    const prs = data.strengthPRs || {};

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
            <tr>
                <th scope="col">Exercise</th>
                <th scope="col">Personal Record</th>
                <th scope="col">Date</th>
                <th scope="col">Previous PR</th>
            </tr>
        `;
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    Object.entries(prs).forEach(([exercise, pr]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
                <td>${exercise}</td>
                <td>${pr.max} lbs</td>
                <td>${pr.date}</td>
                <td>${pr.previous || 'N/A'}</td>
            `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
  }

  /**
   * Create volume data table
   * @param {HTMLElement} table - Table element
   * @param {Object} data - Chart data
   */
  createVolumeDataTable(table, data) {
    const volumes = data.weeklyVolumes || [];

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
            <tr>
                <th scope="col">Week</th>
                <th scope="col">Volume (lbs)</th>
                <th scope="col">Workouts</th>
                <th scope="col">Average per Workout</th>
            </tr>
        `;
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    volumes.forEach(week => {
      const row = document.createElement('tr');
      const avgPerWorkout = Math.round(week.volume / week.workouts);
      row.innerHTML = `
                <td>${week.week}</td>
                <td>${week.volume}</td>
                <td>${week.workouts}</td>
                <td>${avgPerWorkout}</td>
            `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
  }

  /**
   * Create consistency data table
   * @param {HTMLElement} table - Table element
   * @param {Object} data - Chart data
   */
  createConsistencyDataTable(table, data) {
    const consistency = data.consistency || {};

    // Table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
            <tr>
                <th scope="col">Week</th>
                <th scope="col">Workouts</th>
                <th scope="col">Consistency Score</th>
            </tr>
        `;
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    Object.entries(consistency).forEach(([week, count]) => {
      const row = document.createElement('tr');
      const score = count >= 3 ? 'Good' : count >= 2 ? 'Fair' : 'Poor';
      row.innerHTML = `
                <td>${week}</td>
                <td>${count}</td>
                <td>${score}</td>
            `;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
  }

  /**
   * Add keyboard navigation to chart
   * @param {HTMLElement} canvas - Canvas element
   * @param {string} chartId - Chart identifier
   */
  addKeyboardNavigation(canvas, chartId) {
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute(
      'aria-label',
      `Interactive chart: ${chartId}. Use arrow keys to navigate data points.`
    );

    canvas.addEventListener('keydown', e => {
      this.handleChartKeyboardNavigation(e, chartId);
    });
  }

  /**
   * Handle keyboard navigation for charts
   * @param {KeyboardEvent} e - Keyboard event
   * @param {string} chartId - Chart identifier
   */
  handleChartKeyboardNavigation(e, chartId) {
    const chart = this.charts.get(chartId);
    if (!chart) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.announceChartData(chartId, 'previous');
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.announceChartData(chartId, 'next');
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.announceChartSummary(chartId);
        break;
      case 'Escape':
        e.preventDefault();
        this.announceChartExit(chartId);
        break;
    }
  }

  /**
   * Announce chart data to screen readers
   * @param {string} chartId - Chart identifier
   * @param {string} direction - Navigation direction
   */
  announceChartData(chartId, direction) {
    const chart = this.charts.get(chartId);
    if (!chart) {
      return;
    }

    // This would announce specific data points
    // Implementation depends on chart data structure
    const announcement = `Navigating ${direction} in ${chartId} chart`;
    this.announceToScreenReader(announcement);
  }

  /**
   * Announce chart summary to screen readers
   * @param {string} chartId - Chart identifier
   */
  announceChartSummary(chartId) {
    const chart = this.charts.get(chartId);
    if (!chart) {
      return;
    }

    const summary = `Chart summary: ${chartId} data visualization`;
    this.announceToScreenReader(summary);
  }

  /**
   * Announce chart exit to screen readers
   * @param {string} chartId - Chart identifier
   */
  announceChartExit(chartId) {
    const announcement = `Exiting ${chartId} chart navigation`;
    this.announceToScreenReader(announcement);
  }

  /**
   * Announce text to screen readers
   * @param {string} text - Text to announce
   */
  announceToScreenReader(text) {
    let liveRegion = document.getElementById('chart-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'chart-announcements';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'sr-only';
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = text;

    // Clear announcement after a short delay
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 1000);
  }

  /**
   * Get strength chart configuration
   * @param {Object} data - Chart data
   * @returns {Object} Chart.js configuration
   */
  getStrengthChartConfig(data) {
    const prs = data.strengthPRs || {};
    const labels = Object.keys(prs);
    const maxWeights = Object.values(prs).map(pr => pr.max);

    return {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No PRs yet'],
        datasets: [
          {
            label: 'Max 1RM',
            data: maxWeights.length > 0 ? maxWeights : [0],
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
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
            text: 'Strength Progress (Personal Records)',
          },
          legend: {
            display: true,
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
        },
      },
    };
  }

  /**
   * Get volume chart configuration
   * @param {Object} data - Chart data
   * @returns {Object} Chart.js configuration
   */
  getVolumeChartConfig(data) {
    const volumeData = data.volumeTrend || [];
    const labels = volumeData.map(d => d.date);
    const upperData = volumeData.map(d => d.upper);
    const lowerData = volumeData.map(d => d.lower);
    const coreData = volumeData.map(d => d.core);
    const cardioData = volumeData.map(d => d.cardio);

    return {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No data'],
        datasets: [
          {
            label: 'Upper Body',
            data: upperData.length > 0 ? upperData : [0],
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.1,
          },
          {
            label: 'Lower Body',
            data: lowerData.length > 0 ? lowerData : [0],
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.1,
          },
          {
            label: 'Core',
            data: coreData.length > 0 ? coreData : [0],
            borderColor: 'rgba(168, 85, 247, 1)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            tension: 0.1,
          },
          {
            label: 'Cardio',
            data: cardioData.length > 0 ? cardioData : [0],
            borderColor: 'rgba(245, 158, 11, 1)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Training Volume by Category',
          },
          legend: {
            display: true,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Volume',
            },
          },
        },
      },
    };
  }

  /**
   * Get consistency chart configuration
   * @param {Object} data - Chart data
   * @returns {Object} Chart.js configuration
   */
  getConsistencyChartConfig(data) {
    const consistencyData = data.consistencyTrend || [];
    const labels = consistencyData.map(d => d.week);
    const workoutCounts = consistencyData.map(d => d.workouts);
    const avgDuration = consistencyData.map(d => d.avgDuration);

    return {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No data'],
        datasets: [
          {
            label: 'Workouts per Week',
            data: workoutCounts.length > 0 ? workoutCounts : [0],
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: 'Avg Duration (min)',
            data: avgDuration.length > 0 ? avgDuration : [0],
            backgroundColor: 'rgba(34, 197, 94, 0.6)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Training Consistency',
          },
          legend: {
            display: true,
          },
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Workouts per Week',
            },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Avg Duration (min)',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      },
    };
  }

  /**
   * Render strength progress chart (PRs)
   * @param {HTMLElement} element - Container element
   * @param {Object} data - Chart data
   */
  renderStrengthChart(element, data) {
    const ctx = this.createCanvas(element);
    const prs = data.strengthPRs || {};

    const labels = Object.keys(prs);
    const maxWeights = Object.values(prs).map(pr => pr.max);

    const chart = new this.chartLibrary(ctx, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No PRs yet'],
        datasets: [
          {
            label: 'Max 1RM',
            data: maxWeights.length > 0 ? maxWeights : [0],
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: context => {
                const pr = Object.values(prs)[context.dataIndex];
                return `${pr.max.toFixed(1)} lbs (${pr.weight} lbs × ${pr.reps} reps)`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Estimated 1RM (lbs)',
            },
          },
        },
      },
    });

    this.charts.set(element.id, chart);
  }

  /**
   * Render volume trend chart
   * @param {HTMLElement} element - Container element
   * @param {Object} data - Chart data
   */
  renderVolumeChart(element, data) {
    const ctx = this.createCanvas(element);
    const weeklyData = data.weeklyVolume || [];

    const labels = weeklyData.map(d => d.date);
    const upperData = weeklyData.map(d => d.upper || 0);
    const lowerData = weeklyData.map(d => d.lower || 0);
    const coreData = weeklyData.map(d => d.core || 0);
    const cardioData = weeklyData.map(d => d.cardio || 0);

    const chart = new this.chartLibrary(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No data yet'],
        datasets: [
          {
            label: 'Upper Body',
            data: upperData.length > 0 ? upperData : [0],
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            borderColor: 'rgba(239, 68, 68, 1)',
            borderWidth: 2,
            fill: true,
          },
          {
            label: 'Lower Body',
            data: lowerData.length > 0 ? lowerData : [0],
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 2,
            fill: true,
          },
          {
            label: 'Core',
            data: coreData.length > 0 ? coreData : [0],
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 2,
            fill: true,
          },
          {
            label: 'Cardio',
            data: cardioData.length > 0 ? cardioData : [0],
            backgroundColor: 'rgba(251, 191, 36, 0.2)',
            borderColor: 'rgba(251, 191, 36, 1)',
            borderWidth: 2,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
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
        },
      },
    });

    this.charts.set(element.id, chart);
  }

  /**
   * Render consistency chart (readiness trend)
   * @param {HTMLElement} element - Container element
   * @param {Object} data - Chart data
   */
  renderConsistencyChart(element, data) {
    const ctx = this.createCanvas(element);
    const readinessData = data.readinessTrend || [];

    const labels = readinessData.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const scores = readinessData.map(d => d.score);

    const chart = new this.chartLibrary(ctx, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['No data yet'],
        datasets: [
          {
            label: 'Readiness Score',
            data: scores.length > 0 ? scores : [0],
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            borderColor: 'rgba(139, 92, 246, 1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: context => `Readiness: ${context.parsed.y}/10`,
            },
          },
        },
        scales: {
          y: {
            min: 0,
            max: 10,
            title: {
              display: true,
              text: 'Readiness Score',
            },
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });

    this.charts.set(element.id, chart);
  }

  /**
   * Create canvas element for chart
   * @param {HTMLElement} element - Container element
   * @returns {HTMLCanvasElement} Canvas element
   */
  createCanvas(element) {
    // Clear existing content
    element.innerHTML = '';

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.style.maxHeight = '400px';
    element.appendChild(canvas);

    // Return context
    return canvas.getContext('2d');
  }

  /**
   * Show loading skeleton
   * @param {HTMLElement} element - Container element
   */
  showSkeleton(element) {
    element.innerHTML = `
            <div class="chart-skeleton">
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
                <div class="skeleton-line"></div>
            </div>
        `;
  }

  /**
   * Show error message
   * @param {HTMLElement} element - Container element
   * @param {Error} error - Error object
   */
  showError(element, error) {
    element.innerHTML = `
            <div class="chart-error">
                <p>Unable to load chart</p>
                <small>${error.message}</small>
            </div>
        `;
  }

  /**
   * Check if cache is valid
   * @returns {boolean} True if cache is valid
   */
  isCacheValid() {
    if (!this.cache.cacheTime) {
      return false;
    }
    return Date.now() - this.cache.cacheTime < this.cache.ttl;
  }

  /**
   * Destroy all charts and clear cache
   */
  destroy() {
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();

    if (this.observer) {
      this.observer.disconnect();
    }

    this.cache.last30Days = null;
    this.cache.cacheTime = null;
  }

  /**
   * Refresh charts with new data
   */
  async refresh() {
    this.cache.last30Days = null;
    this.destroy();
    await this.init();
  }
}

window.Trends = new Trends();
