/**
 * StravaTokenManager - orchestrates access/refresh token lifecycle via backend endpoints.
 * Handles secure retrieval, refresh, and memoization for Strava OAuth tokens.
 */
class StravaTokenManager {
    constructor(options = {}) {
        const defaultFetch = (typeof fetch === 'function') ? fetch.bind(globalThis) : null;
        if (!defaultFetch && !options.fetchImpl) {
            throw new Error('StravaTokenManager requires a fetch implementation');
        }

        this.fetchImpl = options.fetchImpl || defaultFetch;
        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
        this.authManager = options.authManager || (typeof window !== 'undefined' ? window.AuthManager : null);
        this.cacheTtlMs = options.cacheTtlMs || 60 * 1000; // 1 minute cache for status responses
        this.statusCache = new Map();
        this.baseUrl = options.baseUrl || '';
    }

    /**
     * Ensure a valid access token is available for the user.
     * Refreshes the token when necessary and returns the active token payload.
     * @param {string} userId
     * @returns {Promise<{ accessToken: string, expiresAt: string, scope: string }>} token payload
     */
    async ensureAccessToken(userId) {
        if (!userId) {
            throw new Error('userId is required to obtain Strava tokens');
        }

        const status = await this.getTokenStatus(userId);
        if (!status || status.status === 'not_found') {
            throw new Error('Strava integration not connected for this user');
        }

        if (status.needs_refresh) {
            await this.refreshToken(userId);
            return this.ensureAccessToken(userId); // Retry after refresh
        }

        return {
            accessToken: status.token,
            expiresAt: status.expires_at,
            scope: status.scope
        };
    }

    async getTokenStatus(userId) {
        const cacheKey = `status_${userId}`;
        const cached = this.statusCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTtlMs) {
            return cached.value;
        }

        const response = await this._authorizedFetch(`${this.baseUrl}/.netlify/functions/strava-token-status?userId=${encodeURIComponent(userId)}`);
        if (response.status === 404) {
            return { status: 'not_found' };
        }
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to read Strava token status: ${error}`);
        }
        const data = await response.json();

        // Scope validation
        if (!data.scope || !String(data.scope).includes('activity:read')) {
            throw new Error('Insufficient permissions: activity:read scope missing');
        }

        const formatted = {
            status: data.status,
            needs_refresh: data.needs_refresh,
            expires_at: data.expires_at,
            scope: data.scope,
            token: data.access_token || data.token // allow backend to include masked token
        };

        this.statusCache.set(cacheKey, { timestamp: Date.now(), value: formatted });
        return formatted;
    }

    async refreshToken(userId) {
        const response = await this._authorizedFetch(`${this.baseUrl}/.netlify/functions/strava-refresh-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to refresh Strava token: ${error}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error('Strava token refresh did not succeed');
        }

        // Bust cache so next ensureAccessToken retrieves fresh data
        this.statusCache.delete(`status_${userId}`);
        return data;
    }

    async _authorizedFetch(url, options = {}) {
        const headers = new Headers(options.headers || {});
        const token = this._getAuthToken();
        if (!token) {
            throw new Error('Auth token not available for Strava token operations');
        }
        headers.set('Authorization', `Bearer ${token}`);
        if (options.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        const fetchOptions = {
            ...options,
            headers
        };

        return this.fetchImpl(url, fetchOptions);
    }

    _getAuthToken() {
        if (this.authManager && typeof this.authManager.getAuthState === 'function') {
            const state = this.authManager.getAuthState();
            return state?.token || null;
        }
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.StravaTokenManager = StravaTokenManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StravaTokenManager;
    module.exports.default = StravaTokenManager;
}
