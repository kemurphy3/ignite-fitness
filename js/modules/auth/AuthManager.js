/**
 * AuthManager - Handles user authentication and authorization
 * Extracted from app.js for modular architecture
 */
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this.users = {};
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        
        this.loadUsers();
        this.loadCurrentUser();
    }

    /**
     * Load users from localStorage
     */
    loadUsers() {
        try {
            const savedUsers = localStorage.getItem('ignitefitness_users');
            if (savedUsers) {
                this.users = JSON.parse(savedUsers);
                this.logger.info('Users loaded from storage', { count: 'loaded' });
            }
        } catch (error) {
            this.logger.error('Failed to load users from storage', error);
            this.users = {};
        }
    }

    /**
     * Load current user from localStorage
     */
    loadCurrentUser() {
        try {
            const savedUser = localStorage.getItem('ignitefitness_current_user');
            if (savedUser && this.users[savedUser]) {
                this.currentUser = savedUser;
                this.isLoggedIn = true;
                this.logger.info('Current user loaded', { user: savedUser });
            }
        } catch (error) {
            this.logger.error('Failed to load current user', error);
        }
    }

    /**
     * Simple hash function for password hashing
     * @param {string} str - String to hash
     * @returns {string} Hashed string
     */
    simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash;
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
                    this.currentUser = username;
                    this.isLoggedIn = true;
                    
                    // Save to localStorage
                    localStorage.setItem('ignitefitness_current_user', username);
                    localStorage.setItem('ignitefitness_login_time', Date.now().toString());
                    
                    this.logger.audit('USER_LOGIN', { username });
                    this.eventBus?.emit('user:login', { username });
                    
                    return { success: true, user: this.users[username] };
                } else {
                    this.logger.security('INVALID_LOGIN_ATTEMPT', { username });
                    return { success: false, error: 'Invalid username or password' };
                }
            } else {
                this.logger.security('LOGIN_USER_NOT_FOUND', { username });
                return { success: false, error: 'User not found. Please register first.' };
            }
        } catch (error) {
            this.logger.error('Login failed', error);
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
                athleteName: athleteName,
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
            localStorage.setItem('ignitefitness_users', JSON.stringify(this.users));
            
            this.logger.audit('USER_REGISTRATION', { username, athleteName });
            this.eventBus?.emit('user:registered', { username, athleteName });
            
            return { success: true, user: this.users[username] };
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
            if (this.currentUser) {
                this.logger.audit('USER_LOGOUT', { username: this.currentUser });
                this.eventBus?.emit('user:logout', { username: this.currentUser });
            }

            this.currentUser = null;
            this.isLoggedIn = false;
            localStorage.removeItem('ignitefitness_current_user');
            
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
        return this.currentUser ? this.users[this.currentUser] : null;
    }

    /**
     * Check if user is logged in
     * @returns {boolean} Login status
     */
    isUserLoggedIn() {
        return this.isLoggedIn && this.currentUser !== null;
    }

    /**
     * Get current username
     * @returns {string|null} Current username
     */
    getCurrentUsername() {
        return this.currentUser;
    }

    /**
     * Update user data
     * @param {Object} data - Data to update
     * @returns {Object} Update result
     */
    updateUserData(data) {
        try {
            if (!this.currentUser) {
                return { success: false, error: 'No user logged in' };
            }

            if (!this.users[this.currentUser]) {
                this.users[this.currentUser] = {
                    version: '2.0',
                    username: this.currentUser,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }

            // Merge new data with existing user data
            this.users[this.currentUser] = {
                ...this.users[this.currentUser],
                ...data,
                updatedAt: new Date().toISOString()
            };

            // Save to localStorage
            localStorage.setItem('ignitefitness_users', JSON.stringify(this.users));
            
            this.logger.audit('USER_DATA_UPDATED', { username: this.currentUser });
            this.eventBus?.emit('user:dataUpdated', { username: this.currentUser, data });
            
            return { success: true, user: this.users[this.currentUser] };
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
