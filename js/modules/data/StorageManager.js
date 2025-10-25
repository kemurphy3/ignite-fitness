/**
 * StorageManager - Unified storage management
 * Handles localStorage, IndexedDB, and server synchronization
 */
class StorageManager {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.indexedDB = null;
        this.dbName = 'IgniteFitnessDB';
        this.dbVersion = 1;
        
        this.initializeIndexedDB();
    }

    /**
     * Initialize IndexedDB for offline storage
     */
    async initializeIndexedDB() {
        try {
            if (!window.indexedDB) {
                this.logger.warn('IndexedDB not supported, using localStorage only');
                return;
            }

            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.dbVersion);
                
                request.onerror = () => {
                    this.logger.error('IndexedDB initialization failed', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    this.indexedDB = request.result;
                    this.logger.info('IndexedDB initialized successfully');
                    resolve(this.indexedDB);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    
                    // Create object stores
                    if (!db.objectStoreNames.contains('workouts')) {
                        const workoutStore = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
                        workoutStore.createIndex('userId', 'userId', { unique: false });
                        workoutStore.createIndex('date', 'date', { unique: false });
                    }
                    
                    if (!db.objectStoreNames.contains('sessions')) {
                        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                        sessionStore.createIndex('userId', 'userId', { unique: false });
                        sessionStore.createIndex('startAt', 'startAt', { unique: false });
                    }
                    
                    if (!db.objectStoreNames.contains('syncQueue')) {
                        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
                        syncStore.createIndex('type', 'type', { unique: false });
                        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };
            });
        } catch (error) {
            this.logger.error('Failed to initialize IndexedDB', error);
        }
    }

    /**
     * Save data to localStorage (UI state only)
     * @param {string} key - Storage key
     * @param {any} data - Data to save
     * @returns {Object} Save result
     */
    saveToLocalStorage(key, data) {
        try {
            const appData = {
                version: '2.0',
                data: data,
                last_updated: Date.now()
            };
            localStorage.setItem(`ignitefitness_${key}`, JSON.stringify(appData));
            
            this.logger.debug('Data saved to localStorage', { key });
            this.eventBus?.emit('storage:localSaved', { key, data });
            
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to save to localStorage', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get data from localStorage
     * @param {string} key - Storage key
     * @returns {any} Stored data
     */
    getFromLocalStorage(key) {
        try {
            const stored = localStorage.getItem(`ignitefitness_${key}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed.data;
            }
            return null;
        } catch (error) {
            this.logger.error('Failed to get from localStorage', error);
            return null;
        }
    }

    /**
     * Save workout to IndexedDB
     * @param {Object} workout - Workout data
     * @returns {Object} Save result
     */
    async saveWorkoutToIndexedDB(workout) {
        try {
            if (!this.indexedDB) {
                return { success: false, error: 'IndexedDB not available' };
            }

            const transaction = this.indexedDB.transaction(['workouts'], 'readwrite');
            const store = transaction.objectStore('workouts');
            
            const request = store.add({
                ...workout,
                userId: window.AuthManager?.getCurrentUsername() || 'anonymous',
                timestamp: Date.now()
            });

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.logger.debug('Workout saved to IndexedDB', { id: request.result });
                    this.eventBus?.emit('storage:workoutSaved', { workout, id: request.result });
                    resolve({ success: true, id: request.result });
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to save workout to IndexedDB', request.error);
                    reject({ success: false, error: request.error });
                };
            });
        } catch (error) {
            this.logger.error('Failed to save workout to IndexedDB', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get workouts from IndexedDB
     * @param {string} userId - User ID
     * @param {number} limit - Limit results
     * @returns {Array} Workouts
     */
    async getWorkoutsFromIndexedDB(userId, limit = 50) {
        try {
            if (!this.indexedDB) {
                return [];
            }

            const transaction = this.indexedDB.transaction(['workouts'], 'readonly');
            const store = transaction.objectStore('workouts');
            const index = store.index('userId');
            
            const request = index.getAll(userId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const workouts = request.result
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, limit);
                    resolve(workouts);
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to get workouts from IndexedDB', request.error);
                    reject([]);
                };
            });
        } catch (error) {
            this.logger.error('Failed to get workouts from IndexedDB', error);
            return [];
        }
    }

    /**
     * Save session to IndexedDB
     * @param {Object} session - Session data
     * @returns {Object} Save result
     */
    async saveSessionToIndexedDB(session) {
        try {
            if (!this.indexedDB) {
                return { success: false, error: 'IndexedDB not available' };
            }

            const transaction = this.indexedDB.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            
            const request = store.add({
                ...session,
                userId: window.AuthManager?.getCurrentUsername() || 'anonymous',
                timestamp: Date.now()
            });

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.logger.debug('Session saved to IndexedDB', { id: request.result });
                    this.eventBus?.emit('storage:sessionSaved', { session, id: request.result });
                    resolve({ success: true, id: request.result });
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to save session to IndexedDB', request.error);
                    reject({ success: false, error: request.error });
                };
            });
        } catch (error) {
            this.logger.error('Failed to save session to IndexedDB', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Add item to sync queue
     * @param {string} type - Item type
     * @param {Object} data - Item data
     * @returns {Object} Add result
     */
    async addToSyncQueue(type, data) {
        try {
            if (!this.indexedDB) {
                return { success: false, error: 'IndexedDB not available' };
            }

            const transaction = this.indexedDB.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            
            const request = store.add({
                type,
                data,
                timestamp: Date.now(),
                userId: window.AuthManager?.getCurrentUsername() || 'anonymous'
            });

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.logger.debug('Item added to sync queue', { type, id: request.result });
                    this.eventBus?.emit('storage:syncQueued', { type, data, id: request.result });
                    resolve({ success: true, id: request.result });
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to add to sync queue', request.error);
                    reject({ success: false, error: request.error });
                };
            });
        } catch (error) {
            this.logger.error('Failed to add to sync queue', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get sync queue items
     * @param {string} type - Item type filter
     * @returns {Array} Sync queue items
     */
    async getSyncQueue(type = null) {
        try {
            if (!this.indexedDB) {
                return [];
            }

            const transaction = this.indexedDB.transaction(['syncQueue'], 'readonly');
            const store = transaction.objectStore('syncQueue');
            
            const request = type ? store.index('type').getAll(type) : store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const items = request.result.sort((a, b) => a.timestamp - b.timestamp);
                    resolve(items);
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to get sync queue', request.error);
                    reject([]);
                };
            });
        } catch (error) {
            this.logger.error('Failed to get sync queue', error);
            return [];
        }
    }

    /**
     * Remove item from sync queue
     * @param {number} id - Item ID
     * @returns {Object} Remove result
     */
    async removeFromSyncQueue(id) {
        try {
            if (!this.indexedDB) {
                return { success: false, error: 'IndexedDB not available' };
            }

            const transaction = this.indexedDB.transaction(['syncQueue'], 'readwrite');
            const store = transaction.objectStore('syncQueue');
            
            const request = store.delete(id);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    this.logger.debug('Item removed from sync queue', { id });
                    this.eventBus?.emit('storage:syncRemoved', { id });
                    resolve({ success: true });
                };
                
                request.onerror = () => {
                    this.logger.error('Failed to remove from sync queue', request.error);
                    reject({ success: false, error: request.error });
                };
            });
        } catch (error) {
            this.logger.error('Failed to remove from sync queue', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear all storage
     * @returns {Object} Clear result
     */
    async clearAllStorage() {
        try {
            // Clear localStorage
            const keys = Object.keys(localStorage).filter(key => key.startsWith('ignitefitness_'));
            keys.forEach(key => localStorage.removeItem(key));
            
            // Clear IndexedDB
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['workouts', 'sessions', 'syncQueue'], 'readwrite');
                
                await Promise.all([
                    transaction.objectStore('workouts').clear(),
                    transaction.objectStore('sessions').clear(),
                    transaction.objectStore('syncQueue').clear()
                ]);
            }
            
            this.logger.audit('STORAGE_CLEARED');
            this.eventBus?.emit('storage:cleared');
            
            return { success: true };
        } catch (error) {
            this.logger.error('Failed to clear storage', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get storage statistics
     * @returns {Object} Storage statistics
     */
    async getStorageStats() {
        try {
            const stats = {
                localStorage: {
                    keys: Object.keys(localStorage).filter(key => key.startsWith('ignitefitness_')).length,
                    size: 0
                },
                indexedDB: {
                    workouts: 0,
                    sessions: 0,
                    syncQueue: 0
                }
            };

            // Calculate localStorage size
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('ignitefitness_')) {
                    stats.localStorage.size += localStorage.getItem(key).length;
                }
            });

            // Get IndexedDB counts
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['workouts', 'sessions', 'syncQueue'], 'readonly');
                
                stats.indexedDB.workouts = await this.getObjectStoreCount(transaction.objectStore('workouts'));
                stats.indexedDB.sessions = await this.getObjectStoreCount(transaction.objectStore('sessions'));
                stats.indexedDB.syncQueue = await this.getObjectStoreCount(transaction.objectStore('syncQueue'));
            }

            return stats;
        } catch (error) {
            this.logger.error('Failed to get storage stats', error);
            return null;
        }
    }

    /**
     * Get object store count
     * @param {IDBObjectStore} store - Object store
     * @returns {number} Count
     */
    async getObjectStoreCount(store) {
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(0);
        });
    }
}

// Create global instance
window.StorageManager = new StorageManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
