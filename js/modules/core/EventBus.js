/**
 * EventBus - Central event management system
 * Provides pub/sub pattern for loose coupling between modules
 * 
 * Core Topics:
 * - READINESS_UPDATED: Daily readiness check-in completed
 * - SESSION_COMPLETED: Workout session completed
 * - PHASE_CHANGED: Training phase changed
 * - PROFILE_UPDATED: User profile updated
 */
class EventBus {
    constructor() {
        this.events = new Map();
        this.maxListeners = 50;
        
        // Core event topics
        this.TOPICS = {
            READINESS_UPDATED: 'READINESS_UPDATED',
            SESSION_COMPLETED: 'SESSION_COMPLETED',
            PHASE_CHANGED: 'PHASE_CHANGED',
            PROFILE_UPDATED: 'PROFILE_UPDATED',
            SYNC_QUEUE_UPDATED: 'SYNC_QUEUE_UPDATED',
            OFFLINE_STATE_CHANGED: 'OFFLINE_STATE_CHANGED'
        };
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context to bind callback to
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, context = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);
        if (listeners.length >= this.maxListeners) {
            console.warn(`Event '${event}' has reached maximum listeners (${this.maxListeners})`);
        }

        const listener = { callback, context };
        listeners.push(listener);

        // Return unsubscribe function
        return () => this.off(event, callback, context);
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context to bind callback to
     * @returns {Function} Unsubscribe function
     */
    once(event, callback, context = null) {
        const onceCallback = (...args) => {
            callback.apply(context, args);
            this.off(event, onceCallback, context);
        };
        return this.on(event, onceCallback, context);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} context - Context
     */
    off(event, callback, context = null) {
        if (!this.events.has(event)) return;

        const listeners = this.events.get(event);
        const index = listeners.findIndex(listener => 
            listener.callback === callback && listener.context === context
        );

        if (index !== -1) {
            listeners.splice(index, 1);
        }

        // Clean up empty event arrays
        if (listeners.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to callbacks
     */
    emit(event, ...args) {
        if (!this.events.has(event)) return;

        const listeners = this.events.get(event);
        const listenersToCall = [...listeners]; // Create copy to avoid issues with modifications during iteration

        listenersToCall.forEach(listener => {
            try {
                if (listener.context) {
                    listener.callback.apply(listener.context, args);
                } else {
                    listener.callback(...args);
                }
            } catch (error) {
                console.error(`Error in event listener for '${event}':`, error);
            }
        });
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Listener count
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * Get all event names
     * @returns {Array<string>} Event names
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Set maximum number of listeners per event
     * @param {number} max - Maximum listeners
     */
    setMaxListeners(max) {
        this.maxListeners = max;
    }
}

// Create global instance
window.EventBus = new EventBus();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
}
