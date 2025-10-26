/**
 * GestureHandler - Mobile gesture handling system
 * Handles swipe, long-press, pull-to-refresh, and double-tap gestures
 */
class GestureHandler {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.activeGestures = new Map();
        this.gestureCallbacks = this.initializeGestureCallbacks();
        
        this.setupEventListeners();
    }

    /**
     * Initialize gesture callback definitions
     * @returns {Object} Gesture callbacks
     */
    initializeGestureCallbacks() {
        return {
            swipe: {
                left: {
                    'exercise_card': 'next_exercise',
                    'workout_list': 'next_workout',
                    'progress_chart': 'previous_week'
                },
                right: {
                    'exercise_card': 'previous_exercise',
                    'workout_list': 'previous_workout',
                    'progress_chart': 'next_week'
                },
                up: {
                    'exercise_card': 'view_details',
                    'dashboard_summary': 'expand_view'
                },
                down: {
                    'exercise_detail': 'minimize_view',
                    'dashboard': 'refresh_data'
                }
            },
            longPress: {
                'exercise_card': 'quick_actions_menu',
                'workout_item': 'edit_options',
                'progress_chart': 'export_data'
            },
            pullToRefresh: {
                'dashboard': 'refresh_data',
                'progress': 'sync_latest_workouts',
                'exercises': 'update_exercise_library'
            },
            doubleTap: {
                'exercise_demo': 'toggle_fullscreen',
                'progress_chart': 'zoom_timeframe',
                'card': 'favorite_toggle'
            }
        };
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Touch event listeners
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        
        // Mouse event listeners for desktop testing
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e), { passive: true });
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e), { passive: true });
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e), { passive: true });
        
        // Prevent pull-to-refresh on most pages
        this.preventPullToRefresh();
    }

    /**
     * Prevent default pull-to-refresh
     */
    preventPullToRefresh() {
        let touchStartY = 0;
        let touchEndY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const touchDistance = touchStartY - touchEndY;
            
            // If user pulled down significantly at top of page
            if (touchDistance < -50 && window.scrollY === 0) {
                e.preventDefault();
            }
        }, { passive: false });
    }

    /**
     * Handle touch start
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        const touch = event.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (!element) return;
        
        this.activeGestures.set('current', {
            element: element,
            startX: touch.clientX,
            startY: touch.clientY,
            startTime: Date.now(),
            target: this.getGestureTarget(element)
        });
    }

    /**
     * Handle touch move
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        const current = this.activeGestures.get('current');
        if (!current) return;
        
        const touch = event.touches[0];
        
        current.currentX = touch.clientX;
        current.currentY = touch.clientY;
        current.deltaX = touch.clientX - current.startX;
        current.deltaY = touch.clientY - current.startY;
    }

    /**
     * Handle touch end
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        const current = this.activeGestures.get('current');
        if (!current) return;
        
        const duration = Date.now() - current.startTime;
        const deltaX = current.deltaX || 0;
        const deltaY = current.deltaY || 0;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Determine gesture type
        if (duration > 500) {
            // Long press
            this.handleLongPress(current);
        } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            // Horizontal swipe
            this.handleSwipe(current, deltaX > 0 ? 'right' : 'left');
        } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
            // Vertical swipe
            this.handleSwipe(current, deltaY > 0 ? 'down' : 'up');
        } else if (distance < 10) {
            // Tap
            this.handleTap(current, event);
        }
        
        this.activeGestures.delete('current');
    }

    /**
     * Handle swipe gesture
     * @param {Object} gestureData - Gesture data
     * @param {string} direction - Swipe direction
     */
    handleSwipe(gestureData, direction) {
        const target = gestureData.target;
        const callbacks = this.gestureCallbacks.swipe?.[direction];
        
        if (!callbacks || !target) return;
        
        const action = callbacks[target];
        if (!action) return;
        
        this.logger.debug('Swipe gesture detected:', { target, direction, action });
        
        // Emit custom event
        gestureData.element.dispatchEvent(new CustomEvent('gesture:swipe', {
            detail: { direction, target, action }
        }));
        
        // Execute action
        this.executeAction(action, gestureData.element);
    }

    /**
     * Handle long press gesture
     * @param {Object} gestureData - Gesture data
     */
    handleLongPress(gestureData) {
        const target = gestureData.target;
        const callbacks = this.gestureCallbacks.longPress;
        
        if (!callbacks || !target) return;
        
        const action = callbacks[target];
        if (!action) return;
        
        this.logger.debug('Long press detected:', { target, action });
        
        // Emit custom event
        gestureData.element.dispatchEvent(new CustomEvent('gesture:longpress', {
            detail: { target, action }
        }));
        
        // Execute action
        this.executeAction(action, gestureData.element);
    }

    /**
     * Handle tap gesture
     * @param {Object} gestureData - Gesture data
     * @param {Event} event - Touch event
     */
    handleTap(gestureData, event) {
        const currentTime = Date.now();
        const lastTap = this.activeGestures.get('lastTap');
        
        if (lastTap && currentTime - lastTap < 300) {
            // Double tap detected
            this.handleDoubleTap(gestureData);
            this.activeGestures.delete('lastTap');
        } else {
            // Single tap
            this.activeGestures.set('lastTap', currentTime);
        }
    }

    /**
     * Handle double tap gesture
     * @param {Object} gestureData - Gesture data
     */
    handleDoubleTap(gestureData) {
        const target = gestureData.target;
        const callbacks = this.gestureCallbacks.doubleTap;
        
        if (!callbacks || !target) return;
        
        const action = callbacks[target];
        if (!action) return;
        
        this.logger.debug('Double tap detected:', { target, action });
        
        // Emit custom event
        gestureData.element.dispatchEvent(new CustomEvent('gesture:doubletap', {
            detail: { target, action }
        }));
        
        // Execute action
        this.executeAction(action, gestureData.element);
    }

    /**
     * Get gesture target from element
     * @param {HTMLElement} element - Element
     * @returns {string|null} Gesture target
     */
    getGestureTarget(element) {
        // Check for explicit gesture target
        if (element.dataset.gestureTarget) {
            return element.dataset.gestureTarget;
        }
        
        // Check for class-based targets
        if (element.classList.contains('exercise-card')) return 'exercise_card';
        if (element.classList.contains('workout-item')) return 'workout_item';
        if (element.classList.contains('progress-chart')) return 'progress_chart';
        if (element.classList.contains('dashboard')) return 'dashboard';
        if (element.classList.contains('card')) return 'card';
        
        return null;
    }

    /**
     * Execute gesture action
     * @param {string} action - Action to execute
     * @param {HTMLElement} element - Target element
     */
    executeAction(action, element) {
        const actionHandlers = {
            'next_exercise': () => this.navigateExercise(element, 'next'),
            'previous_exercise': () => this.navigateExercise(element, 'previous'),
            'view_details': () => this.viewDetails(element),
            'minimize_view': () => this.minimizeView(element),
            'quick_actions_menu': () => this.showQuickActionsMenu(element),
            'edit_options': () => this.showEditOptions(element),
            'export_data': () => this.exportData(element),
            'toggle_fullscreen': () => this.toggleFullscreen(element),
            'zoom_timeframe': () => this.zoomTimeframe(element),
            'favorite_toggle': () => this.toggleFavorite(element),
            'refresh_data': () => this.refreshData(element)
        };

        const handler = actionHandlers[action];
        if (handler) {
            handler();
        } else {
            this.logger.warn('Unknown action:', action);
        }
    }

    /**
     * Navigate exercise
     * @param {HTMLElement} element - Element
     * @param {string} direction - Navigation direction
     */
    navigateExercise(element, direction) {
        const event = new CustomEvent('exercise:navigate', {
            detail: { direction, element }
        });
        element.dispatchEvent(event);
        this.logger.debug('Exercise navigation:', direction);
    }

    /**
     * View details
     * @param {HTMLElement} element - Element
     */
    viewDetails(element) {
        const event = new CustomEvent('view:details', {
            detail: { element }
        });
        element.dispatchEvent(event);
        this.logger.debug('View details triggered');
    }

    /**
     * Minimize view
     * @param {HTMLElement} element - Element
     */
    minimizeView(element) {
        element.classList.add('minimized');
        this.logger.debug('View minimized');
    }

    /**
     * Show quick actions menu
     * @param {HTMLElement} element - Element
     */
    showQuickActionsMenu(element) {
        const rect = element.getBoundingClientRect();
        const event = new CustomEvent('menu:quickactions', {
            detail: { element, position: { top: rect.top, left: rect.left } }
        });
        element.dispatchEvent(event);
        this.logger.debug('Quick actions menu shown');
    }

    /**
     * Show edit options
     * @param {HTMLElement} element - Element
     */
    showEditOptions(element) {
        const event = new CustomEvent('menu:edit', {
            detail: { element }
        });
        element.dispatchEvent(event);
        this.logger.debug('Edit options shown');
    }

    /**
     * Export data
     * @param {HTMLElement} element - Element
     */
    exportData(element) {
        const event = new CustomEvent('data:export', {
            detail: { element }
        });
        element.dispatchEvent(event);
        this.logger.debug('Data export triggered');
    }

    /**
     * Toggle fullscreen
     * @param {HTMLElement} element - Element
     */
    toggleFullscreen(element) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        }
        this.logger.debug('Fullscreen toggled');
    }

    /**
     * Zoom timeframe
     * @param {HTMLElement} element - Element
     */
    zoomTimeframe(element) {
        const event = new CustomEvent('chart:zoom', {
            detail: { element }
        });
        element.dispatchEvent(event);
        this.logger.debug('Chart zoom triggered');
    }

    /**
     * Toggle favorite
     * @param {HTMLElement} element - Element
     */
    toggleFavorite(element) {
        element.classList.toggle('favorited');
        const event = new CustomEvent('item:favorite', {
            detail: { element, favorited: element.classList.contains('favorited') }
        });
        element.dispatchEvent(event);
        this.logger.debug('Favorite toggled');
    }

    /**
     * Refresh data
     * @param {HTMLElement} element - Element
     */
    refreshData(element) {
        const event = new CustomEvent('data:refresh', {
            detail: { element }
        });
        element.dispatchEvent(event);
        this.logger.debug('Data refresh triggered');
    }

    /**
     * Mouse event handlers for desktop testing
     */
    handleMouseDown(event) {
        if (this.isTouchDevice()) return;
        
        const element = event.target;
        this.activeGestures.set('current', {
            element: element,
            startX: event.clientX,
            startY: event.clientY,
            startTime: Date.now(),
            target: this.getGestureTarget(element)
        });
    }

    handleMouseMove(event) {
        if (this.isTouchDevice()) return;
        
        const current = this.activeGestures.get('current');
        if (!current) return;
        
        current.currentX = event.clientX;
        current.currentY = event.clientY;
        current.deltaX = event.clientX - current.startX;
        current.deltaY = event.clientY - current.startY;
    }

    handleMouseUp(event) {
        if (this.isTouchDevice()) return;
        
        const current = this.activeGestures.get('current');
        if (!current) return;
        
        const duration = Date.now() - current.startTime;
        const deltaX = current.deltaX || 0;
        const deltaY = current.deltaY || 0;
        
        if (duration > 500 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
            this.handleLongPress(current);
        } else if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
            this.handleSwipe(current, Math.abs(deltaX) > Math.abs(deltaY) ? 
                (deltaX > 0 ? 'right' : 'left') : 
                (deltaY > 0 ? 'down' : 'up'));
        }
        
        this.activeGestures.delete('current');
    }

    /**
     * Check if device is touch-enabled
     * @returns {boolean} Is touch device
     */
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }

    /**
     * Register custom gesture callback
     * @param {string} gestureType - Gesture type
     * @param {string} target - Target element type
     * @param {Function} callback - Callback function
     */
    registerCallback(gestureType, target, callback) {
        if (!this.gestureCallbacks[gestureType]) {
            this.gestureCallbacks[gestureType] = {};
        }
        
        this.gestureCallbacks[gestureType][target] = callback;
    }

    /**
     * Unregister gesture callback
     * @param {string} gestureType - Gesture type
     * @param {string} target - Target element type
     */
    unregisterCallback(gestureType, target) {
        if (this.gestureCallbacks[gestureType]) {
            delete this.gestureCallbacks[gestureType][target];
        }
    }
}

// Create global instance
window.GestureHandler = new GestureHandler();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GestureHandler;
}
