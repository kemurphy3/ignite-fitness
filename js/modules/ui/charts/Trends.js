/**
 * Trends - Real chart rendering with lazy loading
 * Replaces chart placeholders with Chart.js visualizations
 */
class Trends {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.chartLibrary = null; // Lazy loaded
        this.charts = new Map(); // Active charts
        this.cache = {
            last30Days: null,
            cacheTime: null,
            ttl: 5 * 60 * 1000 // 5 minutes
        };
        
        // Initialize on page load
        this.init();
    }

    /**
     * Initialize trends module
     */
    async init() {
        this.logger.debug('Initializing Trends module');
        
        // Set up intersection observer for lazy loading
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !entry.target.dataset.loaded) {
                        entry.target.dataset.loaded = 'true';
                        this.loadChartForElement(entry.target);
                    }
                });
            }, {
                rootMargin: '50px' // Start loading 50px before visible
            });

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

            // Load chart library if not already loaded
            if (!this.chartLibrary) {
                await this.loadChartLibrary();
            }

            // Get data for chart
            const data = await this.getDataForChart(chartId);

            // Render chart
            this.renderChart(element, chartId, data);

        } catch (error) {
            this.logger.error('Failed to load chart', error);
            this.showError(element, error);
        }
    }

    /**
     * Lazy load Chart.js library
     */
    async loadChartLibrary() {
        if (this.chartLibrary) return;

        try {
            // Dynamic import of Chart.js
            const ChartModule = await import('https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js');
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
                            ...session.session
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
            strengthPRs
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
                    cardio: 0
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
                    score: session.readinessScore
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
                if (!ex.name) return;

                const category = this.getExerciseCategory(ex.name);
                
                // Only track heavy strength lifts
                if (category !== 'upper' && category !== 'lower') return;

                ex.sets?.forEach(set => {
                    if (!set.reps || !set.weight) return;
                    
                    // 1-5 reps = strength range
                    if (set.reps >= 1 && set.reps <= 5) {
                        const oneRepMax = this.calculate1RM(set.weight, set.reps);
                        
                        if (!prs[ex.name] || prs[ex.name].max < oneRepMax) {
                            prs[ex.name] = {
                                max: oneRepMax,
                                date: session.timestamp,
                                weight: set.weight,
                                reps: set.reps
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
        
        if (name.includes('squat') || name.includes('deadlift') || name.includes('leg') || 
            name.includes('calf') || name.includes('glute') || name.includes('hip')) {
            return 'lower';
        }
        
        if (name.includes('press') || name.includes('curl') || name.includes('row') || 
            name.includes('pull') || name.includes('shoulder') || name.includes('tricep') || 
            name.includes('bicep') || name.includes('chest') || name.includes('lat')) {
            return 'upper';
        }
        
        if (name.includes('core') || name.includes('ab') || name.includes('plank') || 
            name.includes('crunch') || name.includes('sit-up')) {
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
        if (reps === 1) return weight;
        return weight * (36 / (37 - reps));
    }

    /**
     * Render chart based on type
     * @param {HTMLElement} element - Container element
     * @param {string} chartId - Chart identifier
     * @param {Object} data - Chart data
     */
    renderChart(element, chartId, data) {
        if (!this.chartLibrary) {
            throw new Error('Chart library not loaded');
        }

        // Determine chart type
        if (chartId.includes('strength') || chartId.includes('strengthChart')) {
            this.renderStrengthChart(element, data);
        } else if (chartId.includes('volume') || chartId.includes('volumeChart')) {
            this.renderVolumeChart(element, data);
        } else if (chartId.includes('consistency') || chartId.includes('consistencyChart')) {
            this.renderConsistencyChart(element, data);
        } else {
            this.logger.warn('Unknown chart type', chartId);
        }
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
                datasets: [{
                    label: 'Max 1RM',
                    data: maxWeights.length > 0 ? maxWeights : [0],
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const pr = Object.values(prs)[context.dataIndex];
                                return `${pr.max.toFixed(1)} lbs (${pr.weight} lbs × ${pr.reps} reps)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Estimated 1RM (lbs)'
                        }
                    }
                }
            }
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
                        fill: true
                    },
                    {
                        label: 'Lower Body',
                        data: lowerData.length > 0 ? lowerData : [0],
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'Core',
                        data: coreData.length > 0 ? coreData : [0],
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'Cardio',
                        data: cardioData.length > 0 ? cardioData : [0],
                        backgroundColor: 'rgba(251, 191, 36, 0.2)',
                        borderColor: 'rgba(251, 191, 36, 1)',
                        borderWidth: 2,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Volume (lbs)'
                        }
                    }
                }
            }
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
                datasets: [{
                    label: 'Readiness Score',
                    data: scores.length > 0 ? scores : [0],
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    borderColor: 'rgba(139, 92, 246, 1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => `Readiness: ${context.parsed.y}/10`
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 10,
                        title: {
                            display: true,
                            text: 'Readiness Score'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
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
        if (!this.cache.cacheTime) return false;
        return (Date.now() - this.cache.cacheTime) < this.cache.ttl;
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

