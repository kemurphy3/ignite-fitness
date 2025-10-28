/**
 * DataInspector - Admin/Debug view for verifying dedup + merges
 * Dev-only route: /#/admin/ingest
 */

class DataInspector {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.eventBus = window.EventBus;
        this.coordinator = window.ExpertCoordinator;
        this.planCache = window.PlanCache;
        
        this.currentUserId = 1; // Mock user for admin view
        this.activities = [];
        this.isVisible = false;
    }

    /**
     * Initialize the admin inspector
     */
    init() {
        this.logger.info('Initializing DataInspector');
        this.setupRoute();
        this.setupUI();
    }

    /**
     * Setup admin route handling
     */
    setupRoute() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });

        // Check initial route
        this.handleRouteChange();
    }

    /**
     * Handle route changes
     */
    handleRouteChange() {
        const hash = window.location.hash;
        
        if (hash === '#/admin/ingest') {
            this.show();
        } else if (this.isVisible) {
            this.hide();
        }
    }

    /**
     * Show the admin inspector
     */
    async show() {
        this.logger.info('Showing DataInspector');
        this.isVisible = true;
        
        // Create container if it doesn't exist
        this.createContainer();
        
        // Load and display activities
        await this.loadActivities();
        this.renderActivities();
        
        // Show the container
        const container = document.getElementById('data-inspector');
        if (container) {
            container.style.display = 'block';
        }
    }

    /**
     * Hide the admin inspector
     */
    hide() {
        this.logger.info('Hiding DataInspector');
        this.isVisible = false;
        
        const container = document.getElementById('data-inspector');
        if (container) {
            container.style.display = 'none';
        }
    }

    /**
     * Create the admin container
     */
    createContainer() {
        let container = document.getElementById('data-inspector');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'data-inspector';
            container.className = 'admin-inspector';
            
            // Add to body
            document.body.appendChild(container);
        }

        // Set up container styles
        container.innerHTML = `
            <div class="admin-header">
                <h2>Data Inspector - Activity Dedup & Merge Verification</h2>
                <div class="admin-actions">
                    <button id="recompute-today" class="btn btn-primary">Recompute Today</button>
                    <button id="why-tomorrow" class="btn btn-secondary">Open Why for Tomorrow</button>
                    <button id="refresh-activities" class="btn btn-outline">Refresh Activities</button>
                </div>
            </div>
            <div class="admin-content">
                <div class="activity-filters">
                    <input type="date" id="date-filter" placeholder="Filter by date">
                    <select id="source-filter">
                        <option value="">All Sources</option>
                        <option value="manual">Manual</option>
                        <option value="strava">Strava</option>
                        <option value="garmin">Garmin</option>
                    </select>
                    <input type="text" id="type-filter" placeholder="Filter by type">
                </div>
                <div class="activities-table-container">
                    <table class="activities-table">
                        <thead>
                            <tr>
                                <th>Start Time</th>
                                <th>Type</th>
                                <th>Duration</th>
                                <th>Canonical Source</th>
                                <th>Richness</th>
                                <th>Source Set</th>
                                <th>Excluded</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="activities-tbody">
                        </tbody>
                    </table>
                </div>
                <div class="admin-stats">
                    <div class="stat-card">
                        <h3>Total Activities</h3>
                        <span id="total-activities">0</span>
                    </div>
                    <div class="stat-card">
                        <h3>Manual</h3>
                        <span id="manual-count">0</span>
                    </div>
                    <div class="stat-card">
                        <h3>Strava</h3>
                        <span id="strava-count">0</span>
                    </div>
                    <div class="stat-card">
                        <h3>Merged</h3>
                        <span id="merged-count">0</span>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        this.addStyles();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Add CSS styles for the admin inspector
     */
    addStyles() {
        const styleId = 'data-inspector-styles';
        
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .admin-inspector {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.9);
                    z-index: 10000;
                    color: white;
                    font-family: monospace;
                    overflow-y: auto;
                    display: none;
                }

                .admin-header {
                    padding: 20px;
                    border-bottom: 1px solid #333;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .admin-header h2 {
                    margin: 0;
                    color: #00ff00;
                }

                .admin-actions {
                    display: flex;
                    gap: 10px;
                }

                .admin-actions .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }

                .btn-primary {
                    background: #007bff;
                    color: white;
                }

                .btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .btn-outline {
                    background: transparent;
                    color: #00ff00;
                    border: 1px solid #00ff00;
                }

                .admin-content {
                    padding: 20px;
                }

                .activity-filters {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }

                .activity-filters input,
                .activity-filters select {
                    padding: 8px;
                    border: 1px solid #333;
                    background: #222;
                    color: white;
                    border-radius: 4px;
                }

                .activities-table-container {
                    overflow-x: auto;
                    margin-bottom: 20px;
                }

                .activities-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: #111;
                }

                .activities-table th,
                .activities-table td {
                    padding: 8px 12px;
                    text-align: left;
                    border: 1px solid #333;
                }

                .activities-table th {
                    background: #333;
                    color: #00ff00;
                    font-weight: bold;
                }

                .activities-table tr:nth-child(even) {
                    background: #1a1a1a;
                }

                .activities-table tr:hover {
                    background: #2a2a2a;
                }

                .source-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    margin: 1px;
                }

                .source-manual {
                    background: #ffc107;
                    color: #000;
                }

                .source-strava {
                    background: #fc4c02;
                    color: white;
                }

                .source-garmin {
                    background: #007cc3;
                    color: white;
                }

                .richness-score {
                    font-weight: bold;
                }

                .richness-high {
                    color: #00ff00;
                }

                .richness-medium {
                    color: #ffaa00;
                }

                .richness-low {
                    color: #ff6666;
                }

                .admin-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }

                .stat-card {
                    background: #222;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                }

                .stat-card h3 {
                    margin: 0 0 10px 0;
                    color: #00ff00;
                }

                .stat-card span {
                    font-size: 24px;
                    font-weight: bold;
                    color: white;
                }

                .excluded-badge {
                    background: #dc3545;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                }

                .action-btn {
                    padding: 4px 8px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    margin: 1px;
                }

                .action-view {
                    background: #17a2b8;
                    color: white;
                }

                .action-exclude {
                    background: #dc3545;
                    color: white;
                }

                .action-include {
                    background: #28a745;
                    color: white;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Recompute today button
        document.getElementById('recompute-today')?.addEventListener('click', () => {
            this.recomputeToday();
        });

        // Why tomorrow button
        document.getElementById('why-tomorrow')?.addEventListener('click', () => {
            this.showWhyTomorrow();
        });

        // Refresh activities button
        document.getElementById('refresh-activities')?.addEventListener('click', () => {
            this.loadActivities().then(() => this.renderActivities());
        });

        // Filter inputs
        document.getElementById('date-filter')?.addEventListener('change', () => {
            this.renderActivities();
        });

        document.getElementById('source-filter')?.addEventListener('change', () => {
            this.renderActivities();
        });

        document.getElementById('type-filter')?.addEventListener('input', () => {
            this.renderActivities();
        });
    }

    /**
     * Load activities from storage/mock data
     */
    async loadActivities() {
        try {
            // In a real implementation, this would fetch from the database
            // For now, we'll use mock data that demonstrates dedup/merge scenarios
            this.activities = this.generateMockActivities();
            
            this.logger.info('Loaded activities for inspection', { count: this.activities.length });
            
        } catch (error) {
            this.logger.error('Error loading activities:', error);
            this.activities = [];
        }
    }

    /**
     * Generate mock activities for demonstration
     */
    generateMockActivities() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        return [
            {
                id: 1,
                start_ts: new Date(today.getTime() + 8 * 60 * 60 * 1000).toISOString(), // 8 AM
                type: 'Run',
                duration_s: 1800, // 30 minutes
                canonical_source: 'strava',
                canonical_external_id: 'strava_123',
                richness: 0.85,
                source_set: {
                    strava: { id: 'strava_123', richness: 0.85 },
                    manual: { id: 'manual_1', richness: 0.3 }
                },
                is_excluded: false,
                name: 'Morning Run'
            },
            {
                id: 2,
                start_ts: new Date(today.getTime() + 10 * 60 * 60 * 1000).toISOString(), // 10 AM
                type: 'Strength',
                duration_s: 3600, // 60 minutes
                canonical_source: 'manual',
                canonical_external_id: null,
                richness: 0.4,
                source_set: {
                    manual: { id: 'manual_2', richness: 0.4 }
                },
                is_excluded: false,
                name: 'Gym Session'
            },
            {
                id: 3,
                start_ts: new Date(today.getTime() + 14 * 60 * 60 * 1000).toISOString(), // 2 PM
                type: 'Ride',
                duration_s: 5400, // 90 minutes
                canonical_source: 'strava',
                canonical_external_id: 'strava_456',
                richness: 0.92,
                source_set: {
                    strava: { id: 'strava_456', richness: 0.92 },
                    garmin: { id: 'garmin_789', richness: 0.88 }
                },
                is_excluded: false,
                name: 'Afternoon Ride'
            },
            {
                id: 4,
                start_ts: new Date(today.getTime() + 16 * 60 * 60 * 1000).toISOString(), // 4 PM
                type: 'Run',
                duration_s: 1200, // 20 minutes
                canonical_source: 'manual',
                canonical_external_id: null,
                richness: 0.25,
                source_set: {
                    manual: { id: 'manual_3', richness: 0.25 }
                },
                is_excluded: true,
                name: 'Quick Run (Excluded)'
            }
        ];
    }

    /**
     * Render activities table
     */
    renderActivities() {
        const tbody = document.getElementById('activities-tbody');
        if (!tbody) return;

        // Get filter values
        const dateFilter = document.getElementById('date-filter')?.value;
        const sourceFilter = document.getElementById('source-filter')?.value;
        const typeFilter = document.getElementById('type-filter')?.value.toLowerCase();

        // Filter activities
        let filteredActivities = this.activities.filter(activity => {
            if (dateFilter) {
                const activityDate = new Date(activity.start_ts).toISOString().split('T')[0];
                if (activityDate !== dateFilter) return false;
            }
            
            if (sourceFilter && activity.canonical_source !== sourceFilter) {
                return false;
            }
            
            if (typeFilter && !activity.type.toLowerCase().includes(typeFilter)) {
                return false;
            }
            
            return true;
        });

        // Render table rows
        tbody.innerHTML = filteredActivities.map(activity => {
            const startTime = new Date(activity.start_ts).toLocaleString();
            const duration = this.formatDuration(activity.duration_s);
            const richnessClass = this.getRichnessClass(activity.richness);
            const sourceSetHtml = this.renderSourceSet(activity.source_set);
            
            return `
                <tr>
                    <td>${startTime}</td>
                    <td>${activity.type}</td>
                    <td>${duration}</td>
                    <td><span class="source-badge source-${activity.canonical_source}">${activity.canonical_source}</span></td>
                    <td><span class="richness-score ${richnessClass}">${activity.richness.toFixed(2)}</span></td>
                    <td>${sourceSetHtml}</td>
                    <td>${activity.is_excluded ? '<span class="excluded-badge">Excluded</span>' : 'No'}</td>
                    <td>
                        <button class="action-btn action-view" onclick="dataInspector.viewActivity(${activity.id})">View</button>
                        ${activity.is_excluded ? 
                            `<button class="action-btn action-include" onclick="dataInspector.includeActivity(${activity.id})">Include</button>` :
                            `<button class="action-btn action-exclude" onclick="dataInspector.excludeActivity(${activity.id})">Exclude</button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');

        // Update stats
        this.updateStats(filteredActivities);
    }

    /**
     * Render source set as badges
     */
    renderSourceSet(sourceSet) {
        if (!sourceSet) return '';
        
        return Object.entries(sourceSet).map(([source, data]) => {
            return `<span class="source-badge source-${source}">${source} (${data.richness.toFixed(2)})</span>`;
        }).join(' ');
    }

    /**
     * Get richness CSS class
     */
    getRichnessClass(richness) {
        if (richness >= 0.7) return 'richness-high';
        if (richness >= 0.4) return 'richness-medium';
        return 'richness-low';
    }

    /**
     * Format duration in human readable format
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Update statistics
     */
    updateStats(activities) {
        const total = activities.length;
        const manual = activities.filter(a => a.canonical_source === 'manual').length;
        const strava = activities.filter(a => a.canonical_source === 'strava').length;
        const merged = activities.filter(a => Object.keys(a.source_set || {}).length > 1).length;

        document.getElementById('total-activities').textContent = total;
        document.getElementById('manual-count').textContent = manual;
        document.getElementById('strava-count').textContent = strava;
        document.getElementById('merged-count').textContent = merged;
    }

    /**
     * Recompute today's aggregates
     */
    async recomputeToday() {
        try {
            this.logger.info('Recomputing today\'s aggregates');
            
            // In a real implementation, this would call the recompute job
            // For now, we'll simulate the action
            const today = new Date().toISOString().split('T')[0];
            
            // Show loading state
            const btn = document.getElementById('recompute-today');
            const originalText = btn.textContent;
            btn.textContent = 'Recomputing...';
            btn.disabled = true;
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Show success
            btn.textContent = 'Recomputed!';
            btn.style.background = '#28a745';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.background = '';
            }, 2000);
            
            this.logger.info('Recompute completed for today');
            
        } catch (error) {
            this.logger.error('Error recomputing today:', error);
        }
    }

    /**
     * Show why panel for tomorrow
     */
    async showWhyTomorrow() {
        try {
            this.logger.info('Opening why panel for tomorrow');
            
            // In a real implementation, this would generate tomorrow's plan
            // and show the why panel
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Simulate plan generation
            const mockPlan = {
                why: [
                    'High-intensity run yesterday → reducing lower-body volume',
                    'Weekly strain suggests deload week → adding mobility focus',
                    'Rolling load indicates good readiness → maintaining intensity',
                    'Plan updated after new data sync.'
                ]
            };
            
            // Show why panel (in a real implementation, this would open the actual panel)
            alert(`Tomorrow's Plan Rationale:\n\n${mockPlan.why.join('\n')}`);
            
        } catch (error) {
            this.logger.error('Error showing why tomorrow:', error);
        }
    }

    /**
     * View activity details
     */
    viewActivity(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (activity) {
            const details = `
Activity Details:
- ID: ${activity.id}
- Name: ${activity.name}
- Start: ${new Date(activity.start_ts).toLocaleString()}
- Type: ${activity.type}
- Duration: ${this.formatDuration(activity.duration_s)}
- Canonical Source: ${activity.canonical_source}
- Richness: ${activity.richness}
- Source Set: ${JSON.stringify(activity.source_set, null, 2)}
- Excluded: ${activity.is_excluded}
            `;
            alert(details);
        }
    }

    /**
     * Exclude activity
     */
    async excludeActivity(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (activity) {
            activity.is_excluded = true;
            this.renderActivities();
            this.logger.info('Activity excluded', { activityId });
        }
    }

    /**
     * Include activity
     */
    async includeActivity(activityId) {
        const activity = this.activities.find(a => a.id === activityId);
        if (activity) {
            activity.is_excluded = false;
            this.renderActivities();
            this.logger.info('Activity included', { activityId });
        }
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.DataInspector = DataInspector;
    
    // Create global instance
    window.dataInspector = new DataInspector();
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.dataInspector.init();
        });
    } else {
        window.dataInspector.init();
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataInspector;
}
