/**
 * AuthManager - Handles user authentication and authorization
 * Extracted from app.js for modular architecture
 */
class AuthManager {
    constructor() {
        this.authState = {
            isAuthenticated: false, // MUST stay false until readFromStorage() completes
            token: null,
            user: null
        };
        this.users = {};
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.authStateCallbacks = new Set(); // Event system for auth state changes
        this.loginTimestamp = null; // Track login time for consistent token age calculation
        this.storageKeys = {
            token: 'ignite.auth.token',
            user: 'ignite.user',
            prefs: 'ignite.prefs',
            currentUser: 'ignitefitness_current_user',
            users: 'ignitefitness_users'
        };

        // DO NOT auto-load on construction - wait for explicit readFromStorage() call
    }

    /**
     * Subscribe to auth state changes
     * @param {Function} callback - Callback function (authState) => {}
     * @returns {Function} Unsubscribe function
     */
    onAuthStateChange(callback) {
        this.authStateCallbacks.add(callback);
        // Immediately call with current state
        const currentState = this.getAuthState();
        try {
            callback({ type: 'init', ...currentState });
        } catch (error) {
            this.logger.error('Auth state callback error', error);
        }

        // Return unsubscribe function
        return () => {
            this.authStateCallbacks.delete(callback);
        };
    }

    /**
     * Emit auth state change event
     * @private
     * @param {string} type - Event type (login, logout, login_failed, etc.)
     * @param {Object} data - Event data
     */
    emitAuthChange(type, data) {
        const eventData = { type, ...data };

        // Notify all callbacks
        this.authStateCallbacks.forEach(callback => {
            try {
                callback(eventData);
            } catch (error) {
                this.logger.error('Auth state callback error', error);
            }
        });

        // Emit to global event bus if available
        if (this.eventBus) {
            this.eventBus.emit('auth:stateChange', eventData);
        }

        this.logger.debug('Auth state change emitted', { type, hasUser: !!data.user });
    }

    /**
     * Get current auth state (single source of truth)
     * @returns {Object} { isAuthenticated, token, user }
     */
    getAuthState() {
        return { ...this.authState };
    }

    /**
     * Read auth state from storage with strict validation
     * @returns {Promise<void>}
     */
    async readFromStorage() {
        try {
            // Load users first
            const savedUsers = localStorage.getItem(this.storageKeys.users);
            if (savedUsers) {
                try {
                    this.users = JSON.parse(savedUsers);
                    this.logger.info('Users loaded from storage');
                } catch (error) {
                    this.logger.error('Failed to parse users from storage', error);
                    this.users = {};
                }
            }

            // Check for token
            const tokenStr = localStorage.getItem(this.storageKeys.token);
            const currentUserStr = localStorage.getItem(this.storageKeys.currentUser);

            // Validate token if present
            if (tokenStr) {
                try {
                    const tokenData = JSON.parse(tokenStr);

                    // Cheap parse/shape check
                    if (!tokenData || typeof tokenData !== 'object') {
                        throw new Error('Invalid token format');
                    }

                    // CRITICAL FIX: Use consistent Date.now() comparison instead of Date objects
                    // This prevents inconsistent Date comparisons causing random logouts
                    if (tokenData.created_at) {
                        // Try to restore loginTimestamp from token creation time
                        const createdTimestamp = new Date(tokenData.created_at).getTime();
                        if (!isNaN(createdTimestamp)) {
                            this.loginTimestamp = createdTimestamp;
                        }
                    }

                    // Check token age using consistent Date.now() - loginTimestamp
                    // 86400000 = 24 hours in milliseconds
                    if (this.loginTimestamp) {
                        const tokenAge = Date.now() - this.loginTimestamp;
                        if (tokenAge >= 86400000) {
                            this.logger.info('Token expired (24 hours), clearing storage');
                            this.clearStorage();
                            return;
                        }
                    } else {
                        // No loginTimestamp - check created_at as fallback
                        if (tokenData.created_at) {
                            const createdTimestamp = new Date(tokenData.created_at).getTime();
                            if (!isNaN(createdTimestamp)) {
                                const tokenAge = Date.now() - createdTimestamp;
                                if (tokenAge >= 86400000) {
                                    this.logger.info('Token expired (24 hours), clearing storage');
                                    this.clearStorage();
                                    return;
                                }
                                // Restore loginTimestamp for future checks
                                this.loginTimestamp = createdTimestamp;
                            }
                        }
                    }

                    // Token passes validation
                    if (currentUserStr && this.users[currentUserStr]) {
                        this.authState = {
                            isAuthenticated: true,
                            token: tokenData.value || tokenStr,
                            user: this.users[currentUserStr]
                        };
                        this.logger.info('Auth state loaded from storage', { user: currentUserStr });
                        return;
                    }
                } catch (error) {
                    this.logger.warn('Invalid token in storage, clearing', error);
                    this.clearStorage();
                    return;
                }
            }

            // No valid token or user - ensure logged out state
            this.authState = {
                isAuthenticated: false,
                token: null,
                user: null
            };
            this.logger.info('No valid auth state found, logged out');

        } catch (error) {
            this.logger.error('Failed to read from storage', error);
            this.clearStorage();
        }
    }

    /**
     * Write auth state to storage
     * @param {Object} state - { token, user }
     */
    writeToStorage(state) {
        try {
            const { token, user } = state;

            if (!user || !user.username) {
                throw new Error('Invalid user data');
            }

            // Store token with metadata
            const tokenData = {
                value: token || `session_${Date.now()}`,
                created_at: new Date().toISOString(),
                username: user.username
            };
            localStorage.setItem(this.storageKeys.token, JSON.stringify(tokenData));

            // Store current user
            localStorage.setItem(this.storageKeys.currentUser, user.username);

            // Ensure user is in users object
            if (!this.users[user.username]) {
                this.users[user.username] = user;
            }
            localStorage.setItem(this.storageKeys.users, JSON.stringify(this.users));

            // Update in-memory state
            this.authState = {
                isAuthenticated: true,
                token: tokenData.value,
                user: this.users[user.username]
            };

            this.logger.info('Auth state written to storage', { user: user.username });
        } catch (error) {
            this.logger.error('Failed to write to storage', error);
            throw error;
        }
    }

    /**
     * Clear all auth-related storage
     */
    clearStorage() {
        try {
            localStorage.removeItem(this.storageKeys.token);
            localStorage.removeItem(this.storageKeys.user);
            localStorage.removeItem(this.storageKeys.prefs);
            localStorage.removeItem(this.storageKeys.currentUser);

            // Reset auth state
            this.authState = {
                isAuthenticated: false,
                token: null,
                user: null
            };

            this.logger.info('Auth storage cleared');
        } catch (error) {
            this.logger.error('Failed to clear storage', error);
        }
    }

    /**
     * Simple hash function for password hashing
     * @param {string} str - String to hash
     * @returns {string} Hashed string
     */
    simpleHash(str) {
        let hash = 0;
        if (str.length === 0) {return hash;}
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Login user
     * @param {string} username - Username
     * @param {string} password - Password
     * @returns {Object} Login result
     */
    login(username, password) {
        try {
            if (!username || !password) {
                return { success: false, error: 'Please enter both username and password' };
            }

            // Check if user exists and verify password hash
            if (this.users[username] && this.users[username].passwordHash) {
                const passwordHash = this.simpleHash(password);
                if (this.users[username].passwordHash === passwordHash) {
                    // CRITICAL FIX: Set loginTimestamp for consistent token age calculation
                    this.loginTimestamp = Date.now();

                    // Use writeToStorage to persist auth state
                    const userData = {
                        ...this.users[username],
                        username,
                        lastLogin: this.loginTimestamp
                    };

                    this.writeToStorage({
                        token: `session_${this.loginTimestamp}_${username}`,
                        user: userData
                    });

                    this.logger.audit('USER_LOGIN', { username });
                    this.eventBus?.emit('user:login', { username });

                    // Emit auth change event
                    this.emitAuthChange('login', this.getAuthState());

                    return { success: true, user: this.authState.user };
                } else {
                    this.logger.security('INVALID_LOGIN_ATTEMPT', { username });
                    this.emitAuthChange('login_failed', { error: 'Invalid username or password', username });
                    return { success: false, error: 'Invalid username or password' };
                }
            } else {
                this.logger.security('LOGIN_USER_NOT_FOUND', { username });
                this.emitAuthChange('login_failed', { error: 'User not found', username });
                return { success: false, error: 'User not found. Please register first.' };
            }
        } catch (error) {
            this.logger.error('Login failed', error);
            this.emitAuthChange('login_failed', { error: error.message || 'Login failed' });
            return { success: false, error: 'Login failed. Please try again.' };
        }
    }

    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Object} Registration result
     */
    register(userData) {
        try {
            const { username, password, confirmPassword, athleteName } = userData;

            if (!username || !password || !athleteName) {
                return { success: false, error: 'Please fill in all fields' };
            }

            if (password !== confirmPassword) {
                return { success: false, error: 'Passwords do not match' };
            }

            if (this.users[username]) {
                return { success: false, error: 'Username already exists' };
            }

            if (password.length < 6) {
                return { success: false, error: 'Password must be at least 6 characters long' };
            }

            // Create new user with hashed password
            this.users[username] = {
                passwordHash: this.simpleHash(password),
                athleteName,
                personalData: {},
                goals: {},
                wearableSettings: {},
                workoutPlan: null,
                data: {
                    workouts: [],
                    soccerSessions: [],
                    recoveryData: [],
                    stravaData: [],
                    sleepData: []
                },
                createdAt: Date.now(),
                lastLogin: null
            };

            // Save users
            localStorage.setItem(this.storageKeys.users, JSON.stringify(this.users));

            // Auto-login after registration
            const userData = {
                ...this.users[username],
                username
            };

            // CRITICAL FIX: Set loginTimestamp for consistent token age calculation
            this.loginTimestamp = Date.now();

            this.writeToStorage({
                token: `session_${this.loginTimestamp}_${username}`,
                user: userData
            });

            this.logger.audit('USER_REGISTRATION', { username, athleteName });
            this.eventBus?.emit('user:registered', { username, athleteName });

            // Emit auth change event (registration = auto-login)
            this.emitAuthChange('login', this.getAuthState());

            return { success: true, user: this.authState.user };
        } catch (error) {
            this.logger.error('Registration failed', error);
            return { success: false, error: 'Registration failed. Please try again.' };
        }
    }

    /**
     * Reset user password
     * @param {Object} resetData - Password reset data
     * @returns {Object} Reset result
     */
    resetPassword(resetData) {
        try {
            const { username, athleteName, newPassword, confirmPassword } = resetData;

            if (!username || !athleteName || !newPassword || !confirmPassword) {
                return { success: false, error: 'Please fill in all fields' };
            }

            if (newPassword !== confirmPassword) {
                return { success: false, error: 'Passwords do not match' };
            }

            if (newPassword.length < 6) {
                return { success: false, error: 'Password must be at least 6 characters long' };
            }

            // Verify user exists and athlete name matches
            if (this.users[username] && this.users[username].athleteName === athleteName) {
                // Update password hash
                this.users[username].passwordHash = this.simpleHash(newPassword);
                this.users[username].lastPasswordReset = Date.now();

                // Save updated users
                localStorage.setItem('ignitefitness_users', JSON.stringify(this.users));

                this.logger.audit('PASSWORD_RESET', { username });
                this.eventBus?.emit('user:passwordReset', { username });

                return { success: true };
            } else {
                this.logger.security('PASSWORD_RESET_INVALID', { username, athleteName });
                return { success: false, error: 'Invalid username or athlete name' };
            }
        } catch (error) {
            this.logger.error('Password reset failed', error);
            return { success: false, error: 'Password reset failed. Please try again.' };
        }
    }

    /**
     * Logout current user
     * @returns {Object} Logout result
     */
    logout() {
        try {
            const username = this.authState.user?.username;
            if (username) {
                this.logger.audit('USER_LOGOUT', { username });
                this.eventBus?.emit('user:logout', { username });
            }

            // Clear ALL auth-related storage
            const keysToRemove = [
                this.storageKeys.token,
                this.storageKeys.user,
                this.storageKeys.prefs,
                this.storageKeys.currentUser,
                'ignite.ui.simpleMode', // Reset simple mode on logout
                'ignite_login_time', // Clear login timestamp
                'ignitefitness_last_user' // Clear legacy last user
            ];

            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    this.logger.warn(`Failed to remove ${key}:`, e);
                }
            });

            // Reset internal state
            this.authState = {
                isAuthenticated: false,
                token: null,
                user: null
            };

            // CRITICAL FIX: Clear loginTimestamp on logout
            this.loginTimestamp = null;

            // Emit logout event
            this.emitAuthChange('logout', this.authState);

            return { success: true };
        } catch (error) {
            this.logger.error('Logout failed', error);
            return { success: false, error: 'Logout failed' };
        }
    }

    /**
     * Get current user data
     * @returns {Object|null} Current user data
     */
    getCurrentUser() {
        return this.authState.user;
    }

    /**
     * Check if user is logged in
     * @returns {boolean} Login status
     */
    isUserLoggedIn() {
        return this.authState.isAuthenticated;
    }

    /**
     * Check if user is logged in (alias for compatibility)
     * @returns {boolean} Login status
     */
    isLoggedIn() {
        return this.isUserLoggedIn();
    }

    /**
     * Get current username
     * @returns {string|null} Current username
     */
    getCurrentUsername() {
        return this.authState.user?.username || null;
    }

    /**
     * Update user data
     * @param {Object} data - Data to update
     * @returns {Object} Update result
     */
    updateUserData(data) {
        try {
            const username = this.authState.user?.username;
            if (!username) {
                return { success: false, error: 'No user logged in' };
            }

            if (!this.users[username]) {
                this.users[username] = {
                    version: '2.0',
                    username,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            // Merge new data with existing user data
            this.users[username] = {
                ...this.users[username],
                ...data,
                updatedAt: new Date().toISOString()
            };

            // Update auth state if this is the current user
            if (this.authState.user && this.authState.user.username === username) {
                this.authState.user = this.users[username];
            }

            // Save to localStorage
            localStorage.setItem(this.storageKeys.users, JSON.stringify(this.users));

            this.logger.audit('USER_DATA_UPDATED', { username });
            this.eventBus?.emit('user:dataUpdated', { username, data });

            return { success: true, user: this.users[username] };
        } catch (error) {
            this.logger.error('Failed to update user data', error);
            return { success: false, error: 'Failed to update user data' };
        }
    }

    /**
     * Save user data to storage
     * @param {string} userId - User ID
     * @param {Object} data - Data to save
     * @returns {Object} Save result
     */
    saveUserDataToStorage(userId, data) {
        try {
            if (!this.users[userId]) {
                this.users[userId] = {
                    version: '2.0',
                    username: userId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            // Merge new data with existing user data
            this.users[userId] = {
                ...this.users[userId],
                ...data,
                updatedAt: new Date().toISOString()
            };

            localStorage.setItem('ignitefitness_users', JSON.stringify(this.users));
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to save user data', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get user data from storage
     * @param {string} userId - User ID
     * @returns {Object|null} User data
     */
    getUserDataFromStorage(userId) {
        return this.users[userId] || null;
    }
}

// Create global instance
window.AuthManager = new AuthManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
