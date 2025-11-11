/**
 * StravaHook - Production-grade Strava activity synchronizer.
 * Handles token lifecycle, pagination, rate limiting, heart-rate stream retrieval,
 * deduplication, session matching, and persistence through StravaProcessor.
 */

const ActivityMatcherClass = (typeof window !== 'undefined' && window.ActivityMatcher)
    ? window.ActivityMatcher
    : (() => {
        try {
            return require('./ActivityMatcher.js');
        } catch (error) {
            return null;
        }
    })();

const StravaTokenManagerClass = (typeof window !== 'undefined' && window.StravaTokenManager)
    ? window.StravaTokenManager
    : (() => {
        try {
            return require('./StravaTokenManager.js');
        } catch (error) {
            return null;
        }
    })();

class UnauthorizedError extends Error {
    constructor(message = 'Strava access token unauthorized') {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

class StravaHook {
    constructor(options = {}) {
        const defaultFetch = (typeof fetch === 'function') ? fetch.bind(globalThis) : null;
        if (!defaultFetch && !options.fetchImpl) {
            throw new Error('StravaHook requires a fetch implementation');
        }

        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
        this.fetchImpl = options.fetchImpl || defaultFetch;
        this.storageManager = options.storageManager || (typeof window !== 'undefined' ? window.StorageManager : null);
        this.tokenManager = options.tokenManager || (StravaTokenManagerClass ? new StravaTokenManagerClass({ logger: this.logger }) : null);
        this.activityMatcher = options.activityMatcher || (ActivityMatcherClass ? new ActivityMatcherClass({ logger: this.logger }) : null);
        this.stravaProcessor = options.stravaProcessor || (typeof window !== 'undefined' ? window.StravaProcessor : null);
        this.eventBus = options.eventBus || (typeof window !== 'undefined' ? window.EventBus : null);
        this.baseUrl = options.baseUrl || 'https://www.strava.com/api/v3';
        this.requestTimestamps = [];
        this.maxRequestsPerWindow = 600;
        this.rateLimitWindowMs = 15 * 60 * 1000; // 15 minutes
        this.retryAttempts = options.retryAttempts || 5;
        this.retryBaseDelay = options.retryBaseDelay || 1000;
        this.syncMetadataKey = 'ignitefitness_strava_sync_metadata';
    }

    /**
     * Synchronize Strava activities for a user.
     * @param {string} userId - Application user identifier.
     * @param {Object} options - Sync options ({ perPage, after, sessions }).
     * @returns {Promise<Object>} Sync summary.
     */
    async syncActivities(userId, options = {}) {
        if (!this.tokenManager) {
            throw new Error('StravaTokenManager is not configured');
        }
        this.emitStatus('strava:sync:start', { userId });

        try {
            const tokenPayload = await this.tokenManager.ensureAccessToken(userId);
            const lastSync = options.after || this.getLastSync(userId);
            const activities = await this.fetchActivities(tokenPayload.accessToken, userId, {
                perPage: options.perPage || 200,
                after: lastSync
            });

            this.logger.info?.('StravaHook: fetched activities', { count: activities.length, userId });

            const uniqueActivities = this.filterDuplicates(userId, activities);
            const activitiesWithStreams = await this.attachStreams(tokenPayload.accessToken, userId, uniqueActivities);

            const sessions = options.sessions || this.getRecentSessions();
            const matches = this.activityMatcher ? this.activityMatcher.matchActivities(activitiesWithStreams, sessions) : [];

            const importResult = await this.importActivities(userId, activitiesWithStreams);

            if (activitiesWithStreams.length > 0) {
                const newest = activitiesWithStreams
                    .map(activity => new Date(activity.start_date).getTime())
                    .filter(ts => Number.isFinite(ts))
                    .sort((a, b) => b - a)[0];
                if (newest) {
                    this.setLastSync(userId, new Date(newest).toISOString());
                }
            }

            const summary = {
                fetched: activities.length,
                processed: activitiesWithStreams.length,
                imported: importResult?.processed || 0,
                matches
            };

            this.emitStatus('strava:sync:complete', { userId, summary });
            return summary;
        } catch (error) {
            if (error instanceof UnauthorizedError && this.tokenManager && !options.__retried) {
                this.logger.warn('StravaHook: retrying sync after refreshing token', { userId });
                await this.tokenManager.refreshToken(userId);
                return this.syncActivities(userId, { ...options, __retried: true });
            }
            this.logger.error('StravaHook: sync failed', error);
            this.emitStatus('strava:sync:error', { userId, error: error.message });
            throw error;
        }
    }

    filterDuplicates(userId, activities) {
        if (!this.stravaProcessor || !Array.isArray(activities)) {
            return activities;
        }

        const existing = this.stravaProcessor.getExternalActivities?.(userId) || [];
        const seen = new Set();
        const filtered = [];

        for (const activity of activities) {
            const candidateId = activity.id?.toString?.();
            const duplicate = existing.some(item => ActivityMatcherClass?.isDuplicate?.(item, activity));
            if (duplicate) {
                this.logger.debug?.('StravaHook: skipping duplicate activity', { id: candidateId });
                continue;
            }
            if (candidateId && seen.has(candidateId)) {
                continue;
            }
            if (candidateId) {seen.add(candidateId);}
            filtered.push(activity);
        }
        return filtered;
    }

    async importActivities(userId, activities) {
        if (!this.stravaProcessor || typeof this.stravaProcessor.importActivities !== 'function') {
            return null;
        }

        const payload = await this.stravaProcessor.importActivities(activities);
        this.logger.info?.('StravaHook: import summary', payload);
        return payload;
    }

    async fetchActivities(accessToken, userId, { perPage = 200, after } = {}) {
        const results = [];
        let page = 1;
        let continuePaging = true;
        const afterSeconds = after ? Math.floor(new Date(after).getTime() / 1000) : undefined;

        while (continuePaging) {
            this.throttleIfNeeded();
            const query = new URLSearchParams({ per_page: String(perPage), page: String(page) });
            if (afterSeconds) {
                query.append('after', String(afterSeconds));
            }
            const url = `${this.baseUrl}/athlete/activities?${query.toString()}`;
            const response = await this.performRequest(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                userId
            });
            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                continuePaging = false;
            } else {
                results.push(...data);
                page += 1;
                if (data.length < perPage) {
                    continuePaging = false;
                }
            }
        }

        return results;
    }

    async attachStreams(accessToken, userId, activities) {
        const enriched = [];
        for (const activity of activities) {
            try {
                const streams = await this.fetchActivityStreams(accessToken, userId, activity.id);
                activity.streams = streams;
                activity.heartRateSeries = ActivityMatcherClass?.buildHeartRateSeries?.(streams) || [];
            } catch (error) {
                if (error instanceof UnauthorizedError && this.tokenManager && !activity.__retried) {
                    const refreshed = await this.tokenManager.ensureAccessToken(userId);
                    activity.__retried = true;
                    const streams = await this.fetchActivityStreams(refreshed.accessToken, userId, activity.id);
                    activity.streams = streams;
                    activity.heartRateSeries = ActivityMatcherClass?.buildHeartRateSeries?.(streams) || [];
                } else {
                    this.logger.warn?.('StravaHook: failed to fetch streams', { activityId: activity.id, error: error.message });
                    activity.streams = null;
                    activity.heartRateSeries = [];
                }
            }
            enriched.push(activity);
        }
        return enriched;
    }

    async fetchActivityStreams(accessToken, userId, activityId) {
        if (!activityId) {return {};}
        this.throttleIfNeeded();
        const url = `${this.baseUrl}/activities/${activityId}/streams?keys=time,heartrate&key_by_type=true`;
        const response = await this.performRequest(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            userId
        });
        if (response.status === 204) {
            return {};
        }
        if (!response.ok) {
            throw new Error(`Stream request failed (${response.status})`);
        }
        return response.json();
    }

    async performRequest(url, options = {}, attempt = 1) {
        this.recordRequest();
        const { userId, ...fetchOptions } = options;
        try {
            const response = await this.fetchImpl(url, fetchOptions);
            if (response.status === 429) {
                await this.handleRateLimit(response);
                return this.performRequest(url, options, attempt);
            }
            if (response.status === 401) {
                throw new UnauthorizedError();
            }
            return response;
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                throw error;
            }
            if (attempt >= this.retryAttempts) {
                throw error;
            }
            const delay = this.retryBaseDelay * Math.pow(2, attempt - 1);
            this.logger.warn?.('StravaHook: request failed, retrying', { url, attempt, delay });
            await this.sleep(delay);
            return this.performRequest(url, options, attempt + 1);
        }
    }

    throttleIfNeeded() {
        const now = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter(ts => now - ts < this.rateLimitWindowMs);
        if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
            this.logger.warn?.('StravaHook: hit local throttle limit, pausing requests');
            return this.sleep(this.rateLimitWindowMs);
        }
        return null;
    }

    recordRequest() {
        this.requestTimestamps.push(Date.now());
    }

    async handleRateLimit(response) {
        const retryAfterHeader = response.headers.get('retry-after');
        const rateResetHeader = response.headers.get('x-ratelimit-reset');
        let delayMs = 60 * 1000; // default 60 seconds
        if (retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))) {
            delayMs = Number(retryAfterHeader) * 1000;
        } else if (rateResetHeader && !Number.isNaN(Number(rateResetHeader))) {
            const reset = Number(rateResetHeader) * 1000;
            delayMs = Math.max(0, reset - Date.now());
        } else {
            delayMs = 15 * 60 * 1000;
        }
        this.logger.warn?.('StravaHook: rate limited, backing off', { delayMs });
        await this.sleep(delayMs);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getLastSync(userId) {
        if (!this.storageManager) {return null;}
        const metadata = this.storageManager.getStorage?.(this.syncMetadataKey, {}) || {};
        return metadata[userId]?.lastSync || null;
    }

    setLastSync(userId, isoString) {
        if (!this.storageManager) {return;}
        const metadata = this.storageManager.getStorage?.(this.syncMetadataKey, {}) || {};
        metadata[userId] = {
            ...(metadata[userId] || {}),
            lastSync: isoString,
            updatedAt: new Date().toISOString()
        };
        this.storageManager.setStorage?.(this.syncMetadataKey, metadata);
    }

    getRecentSessions() {
        try {
            const tracker = (typeof window !== 'undefined') ? window.WorkoutTracker : null;
            if (tracker && typeof tracker.getRecentSessions === 'function') {
                return tracker.getRecentSessions(30) || [];
            }
        } catch (error) {
            this.logger.warn?.('StravaHook: failed to read recent sessions', error);
        }
        return [];
    }

    emitStatus(event, payload) {
        if (this.eventBus && typeof this.eventBus.emit === 'function') {
            this.eventBus.emit(event, payload);
        }
    }
}

if (typeof window !== 'undefined') {
    window.StravaHook = StravaHook;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StravaHook;
    module.exports.default = StravaHook;
}
