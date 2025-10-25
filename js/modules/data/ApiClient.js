/**
 * ApiClient - Centralized API communication with retries, auth, and CSRF
 * Handles all server communication with proper error handling
 */
class ApiClient {
    constructor() {
        this.baseURL = '/.netlify/functions';
        this.timeout = 30000; // 30 seconds
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.csrfToken = null;
        
        this.initializeCSRF();
    }

    /**
     * Initialize CSRF token
     */
    async initializeCSRF() {
        try {
            const response = await this.request('GET', '/csrf-token');
            if (response.success && response.data.token) {
                this.csrfToken = response.data.token;
                this.logger.debug('CSRF token initialized');
            }
        } catch (error) {
            this.logger.warn('Failed to initialize CSRF token', error);
        }
    }

    /**
     * Make API request with retries and error handling
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {Object} options - Request options
     * @returns {Object} Response data
     */
    async request(method, endpoint, data = null, options = {}) {
        const startTime = Date.now();
        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.makeRequest(method, endpoint, data, options);
                
                // Log performance
                const duration = Date.now() - startTime;
                this.logger.performance('API_REQUEST', duration, { 
                    method, 
                    endpoint, 
                    attempt,
                    status: response.status 
                });

                return response;
            } catch (error) {
                lastError = error;
                this.logger.warn(`API request attempt ${attempt} failed`, { 
                    method, 
                    endpoint, 
                    error: error.message 
                });

                // Don't retry on certain errors
                if (this.shouldNotRetry(error)) {
                    break;
                }

                // Wait before retry
                if (attempt < this.maxRetries) {
                    await this.delay(this.retryDelay * attempt);
                }
            }
        }

        // All retries failed
        this.logger.error('API request failed after all retries', { 
            method, 
            endpoint, 
            attempts: this.maxRetries,
            error: lastError?.message 
        });

        throw lastError;
    }

    /**
     * Make actual HTTP request
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {Object} options - Request options
     * @returns {Object} Response data
     */
    async makeRequest(method, endpoint, data, options) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
            ...options.headers
        };

        // Add CSRF token if available
        if (this.csrfToken) {
            headers['X-CSRF-Token'] = this.csrfToken;
        }

        const requestOptions = {
            method,
            headers,
            ...options
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            requestOptions.body = JSON.stringify(data);
        }

        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        requestOptions.signal = controller.signal;

        try {
            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            // Handle different response types
            if (response.status === 204) {
                return { success: true, status: response.status };
            }

            const responseData = await response.json();

            if (!response.ok) {
                throw new Error(responseData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return {
                success: true,
                status: response.status,
                data: responseData
            };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Get authentication headers
     * @returns {Object} Auth headers
     */
    getAuthHeaders() {
        const headers = {};
        
        // Add JWT token if available
        const token = localStorage.getItem('ignitefitness_jwt_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Add user ID if available
        const userId = window.AuthManager?.getCurrentUsername();
        if (userId) {
            headers['X-User-ID'] = userId;
        }

        return headers;
    }

    /**
     * Check if error should not be retried
     * @param {Error} error - Error to check
     * @returns {boolean} Should not retry
     */
    shouldNotRetry(error) {
        // Don't retry on authentication errors
        if (error.message.includes('401') || error.message.includes('403')) {
            return true;
        }

        // Don't retry on client errors (4xx)
        if (error.message.includes('400') || error.message.includes('404')) {
            return true;
        }

        // Don't retry on timeout
        if (error.name === 'AbortError') {
            return true;
        }

        return false;
    }

    /**
     * Delay execution
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Object} Response data
     */
    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {Object} options - Request options
     * @returns {Object} Response data
     */
    async post(endpoint, data, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {Object} options - Request options
     * @returns {Object} Response data
     */
    async put(endpoint, data, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Object} Response data
     */
    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    /**
     * Upload file
     * @param {string} endpoint - API endpoint
     * @param {File} file - File to upload
     * @param {Object} metadata - File metadata
     * @returns {Object} Response data
     */
    async uploadFile(endpoint, file, metadata = {}) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('metadata', JSON.stringify(metadata));

            const headers = this.getAuthHeaders();
            delete headers['Content-Type']; // Let browser set it for FormData

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            return {
                success: true,
                data: await response.json()
            };
        } catch (error) {
            this.logger.error('File upload failed', error);
            throw error;
        }
    }

    /**
     * Sync offline data
     * @returns {Object} Sync result
     */
    async syncOfflineData() {
        try {
            const syncQueue = await window.StorageManager?.getSyncQueue();
            if (!syncQueue || syncQueue.length === 0) {
                return { success: true, synced: 0 };
            }

            let synced = 0;
            const errors = [];

            for (const item of syncQueue) {
                try {
                    const endpoint = this.getSyncEndpoint(item.type);
                    const response = await this.post(endpoint, item.data);
                    
                    if (response.success) {
                        await window.StorageManager?.removeFromSyncQueue(item.id);
                        synced++;
                    }
                } catch (error) {
                    errors.push({ id: item.id, error: error.message });
                }
            }

            this.logger.info('Offline data sync completed', { synced, errors: errors.length });
            this.eventBus?.emit('api:offlineSyncCompleted', { synced, errors });

            return { success: true, synced, errors };
        } catch (error) {
            this.logger.error('Offline data sync failed', error);
            throw error;
        }
    }

    /**
     * Get sync endpoint for item type
     * @param {string} type - Item type
     * @returns {string} Endpoint
     */
    getSyncEndpoint(type) {
        const endpoints = {
            'workout': '/sync-workout',
            'session': '/sync-session',
            'user_data': '/sync-user-data'
        };
        
        return endpoints[type] || '/sync-generic';
    }

    /**
     * Handle authentication errors
     * @param {Error} error - Authentication error
     */
    handleAuthError(error) {
        this.logger.security('AUTH_ERROR', { error: error.message });
        
        // Clear stored tokens
        localStorage.removeItem('ignitefitness_jwt_token');
        localStorage.removeItem('ignitefitness_current_user');
        
        // Emit auth error event
        this.eventBus?.emit('auth:error', { error: error.message });
        
        // Redirect to login if needed
        if (window.AuthManager?.isUserLoggedIn()) {
            window.AuthManager.logout();
        }
    }

    /**
     * Set authentication token
     * @param {string} token - JWT token
     */
    setAuthToken(token) {
        this.csrfToken = token;
        localStorage.setItem('ignitefitness_jwt_token', token);
        this.logger.debug('Auth token set');
    }

    /**
     * Clear authentication token
     */
    clearAuthToken() {
        this.csrfToken = null;
        localStorage.removeItem('ignitefitness_jwt_token');
        this.logger.debug('Auth token cleared');
    }
}

// Create global instance
window.ApiClient = new ApiClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
}
