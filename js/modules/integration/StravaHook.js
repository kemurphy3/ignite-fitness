/**
 * StravaHook - Scaffold for Strava integration (mock endpoint for now)
 * Maps external Strava activities to internal format
 */
class StravaHook {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.isAuthenticated = false;
        this.lastSync = null;
    }

    /**
     * Mock endpoint for fetching Strava activities
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Strava activities
     */
    async fetchActivities(userId) {
        // MOCK: Return mock data for testing
        this.logger.debug('StravaHook: Fetching activities (mock)', { userId });

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mock recent activity
        const mockActivity = {
            id: `strava_${Date.now()}`,
            name: 'Morning Run',
            type: 'Run',
            distance: 5000, // meters
            duration: 1800, // seconds (30 min)
            averageIntensity: 6,
            timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            source: 'strava'
        };

        return [mockActivity];
    }

    /**
     * Sync Strava activities to internal storage
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Sync result
     */
    async syncActivities(userId) {
        try {
            const activities = await this.fetchActivities(userId);

            // Map to internal format
            const mappedActivities = activities.map(activity =>
                this.mapToInternal(activity)
            );

            // Store in external_activities table
            for (const activity of mappedActivities) {
                await this.storageManager.saveData(userId, 'external_activities', activity);
            }

            this.lastSync = new Date();

            return {
                synced: mappedActivities.length,
                activities: mappedActivities
            };
        } catch (error) {
            this.logger.error('Failed to sync Strava activities', error);
            throw error;
        }
    }

    /**
     * Map Strava activity to internal format
     * @param {Object} stravaActivity - Strava activity
     * @returns {Object} Internal activity format
     */
    mapToInternal(stravaActivity) {
        return {
            id: stravaActivity.id,
            userId: this.getUserId(),
            source: 'strava',
            type: this.mapActivityType(stravaActivity.type),
            duration: stravaActivity.duration, // seconds
            distance: stravaActivity.distance, // meters
            averageIntensity: stravaActivity.averageIntensity,
            timestamp: stravaActivity.timestamp,
            name: stravaActivity.name,
            rawData: stravaActivity // Store original for audit
        };
    }

    /**
     * Map Strava activity type to internal type
     * @param {string} stravaType - Strava activity type
     * @returns {string} Internal activity type
     */
    mapActivityType(stravaType) {
        const typeMap = {
            'Run': 'running',
            'Ride': 'cycling',
            'Swim': 'swimming',
            'Workout': 'strength',
            'Walk': 'walking'
        };

        return typeMap[stravaType] || 'unknown';
    }

    /**
     * Mock authentication endpoint
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Auth success
     */
    async authenticate(userId) {
        // MOCK: Simulate authentication
        this.logger.debug('StravaHook: Authenticating (mock)', { userId });

        await new Promise(resolve => setTimeout(resolve, 1000));

        this.isAuthenticated = true;

        return true;
    }

    /**
     * Get last sync timestamp
     * @returns {Date|null} Last sync
     */
    getLastSync() {
        return this.lastSync;
    }

    /**
     * Get user ID
     * @returns {string} User ID
     */
    getUserId() {
        return window.AuthManager?.getCurrentUsername() || 'anonymous';
    }
}

window.StravaHook = StravaHook;
