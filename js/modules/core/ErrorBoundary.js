/**
 * Error Boundary System for Vanilla JavaScript
 * Catches unhandled promise rejections and JavaScript errors
 * Provides fallback UI and error reporting
 */

(function() {
    'use strict';

    // Global error tracking
    const errorQueue = [];
    const MAX_ERROR_QUEUE_SIZE = 100;

    /**
     * Error Boundary Class
     * Provides comprehensive error catching and recovery
     */
    class ErrorBoundary {
        constructor(config = {}) {
            this.config = {
                logToConsole: config.logToConsole !== false,
                logToRemote: config.logToRemote || false,
                remoteEndpoint: config.remoteEndpoint || null,
                showFallbackUI: config.showFallbackUI !== false,
                onError: config.onError || null,
                ...config
            };
            
            this.errorCount = 0;
            this.isInitialized = false;
        }

        /**
         * Initialize error boundary
         */
        init() {
            if (this.isInitialized) return;
            
            console.log('Error Boundary initialized');
            
            // Catch unhandled promise rejections
            this.setupPromiseRejectionHandler();
            
            // Catch JavaScript errors
            this.setupErrorHandler();
            
            // Catch resource loading errors
            this.setupResourceErrorHandler();
            
            // Setup error recovery
            this.setupErrorRecovery();
            
            this.isInitialized = true;
        }

        /**
         * Setup promise rejection handler
         */
        setupPromiseRejectionHandler() {
            window.addEventListener('unhandledrejection', (event) => {
                console.error('Unhandled promise rejection:', event.reason);
                
                this.handleError({
                    type: 'promise_rejection',
                    message: event.reason?.message || 'Unhandled Promise Rejection',
                    stack: event.reason?.stack || '',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    userAgent: navigator.userAgent
                });
                
                // Prevent default console error
                event.preventDefault();
            });
        }

        /**
         * Setup JavaScript error handler
         */
        setupErrorHandler() {
            window.addEventListener('error', (event) => {
                console.error('JavaScript error:', event.error);
                
                this.handleError({
                    type: 'javascript_error',
                    message: event.message || 'JavaScript Error',
                    filename: event.filename || '',
                    lineno: event.lineno || 0,
                    colno: event.colno || 0,
                    stack: event.error?.stack || '',
                    timestamp: new Date().toISOString(),
                    url: window.location.href,
                    userAgent: navigator.userAgent
                });
            });
        }

        /**
         * Setup resource loading error handler
         */
        setupResourceErrorHandler() {
            window.addEventListener('error', (event) => {
                // Check if it's a resource loading error
                if (event.target && event.target !== window && !event.error) {
                    console.error('Resource loading error:', event.target);
                    
                    this.handleError({
                        type: 'resource_error',
                        message: `Failed to load resource: ${event.target.tagName}`,
                        filename: event.target.src || event.target.href || '',
                        timestamp: new Date().toISOString(),
                        url: window.location.href
                    });
                }
            }, true); // Use capture phase
        }

        /**
         * Handle error
         */
        handleError(errorInfo) {
            this.errorCount++;
            
            // Add to error queue
            errorQueue.push(errorInfo);
            if (errorQueue.length > MAX_ERROR_QUEUE_SIZE) {
                errorQueue.shift();
            }
            
            // Log to console
            if (this.config.logToConsole) {
                console.group('🔴 Error Caught');
                console.error('Type:', errorInfo.type);
                console.error('Message:', errorInfo.message);
                console.error('Timestamp:', errorInfo.timestamp);
                if (errorInfo.stack) console.error('Stack:', errorInfo.stack);
                console.groupEnd();
            }
            
            // Show fallback UI
            if (this.config.showFallbackUI && this.errorCount === 1) {
                this.showErrorFallbackUI(errorInfo);
            }
            
            // Custom error handler
            if (this.config.onError) {
                try {
                    this.config.onError(errorInfo);
                } catch (e) {
                    console.error('Error in custom error handler:', e);
                }
            }
            
            // Log to remote endpoint if configured
            if (this.config.logToRemote && this.config.remoteEndpoint) {
                this.logToRemote(errorInfo).catch(e => {
                    console.error('Failed to log error to remote:', e);
                });
            }
        }

        /**
         * Show error fallback UI
         */
        showErrorFallbackUI(errorInfo) {
            // Remove existing error UI
            const existingErrorUI = document.getElementById('error-boundary-ui');
            if (existingErrorUI) {
                existingErrorUI.remove();
            }
            
            const errorUI = document.createElement('div');
            errorUI.id = 'error-boundary-ui';
            errorUI.innerHTML = `
                <div class="error-boundary-container">
                    <div class="error-boundary-content">
                        <div class="error-boundary-icon">⚠️</div>
                        <h2 class="error-boundary-title">Oops! Something went wrong</h2>
                        <p class="error-boundary-message">
                            We encountered an unexpected error. Don't worry, your data is safe.
                        </p>
                        <div class="error-boundary-actions">
                            <button onclick="window.location.reload()" class="error-boundary-btn error-boundary-btn-primary">
                                Reload Page
                            </button>
                            <button onclick="document.getElementById('error-boundary-ui').remove()" class="error-boundary-btn error-boundary-btn-secondary">
                                Dismiss
                            </button>
                        </div>
                        <details class="error-boundary-details">
                            <summary>Technical Details</summary>
                            <pre>${JSON.stringify(errorInfo, null, 2)}</pre>
                        </details>
                    </div>
                </div>
            `;
            
            errorUI.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 99999;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            `;
            
            document.body.appendChild(errorUI);
            
            // Add styles if not already added
            if (!document.getElementById('error-boundary-styles')) {
                const style = document.createElement('style');
                style.id = 'error-boundary-styles';
                style.textContent = `
                    .error-boundary-container {
                        background: white;
                        border-radius: 12px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        max-width: 500px;
                        width: 100%;
                    }
                    
                    .error-boundary-content {
                        padding: 30px;
                        text-align: center;
                    }
                    
                    .error-boundary-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    
                    .error-boundary-title {
                        font-size: 24px;
                        font-weight: 600;
                        color: #2d3748;
                        margin: 0 0 10px 0;
                    }
                    
                    .error-boundary-message {
                        font-size: 16px;
                        color: #4a5568;
                        margin: 0 0 30px 0;
                        line-height: 1.5;
                    }
                    
                    .error-boundary-actions {
                        display: flex;
                        gap: 10px;
                        justify-content: center;
                        margin-bottom: 20px;
                    }
                    
                    .error-boundary-btn {
                        padding: 12px 24px;
                        border-radius: 6px;
                        font-size: 16px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        border: none;
                    }
                    
                    .error-boundary-btn-primary {
                        background: #4299e1;
                        color: white;
                    }
                    
                    .error-boundary-btn-primary:hover {
                        background: #3182ce;
                    }
                    
                    .error-boundary-btn-secondary {
                        background: #e2e8f0;
                        color: #2d3748;
                    }
                    
                    .error-boundary-btn-secondary:hover {
                        background: #cbd5e0;
                    }
                    
                    .error-boundary-details {
                        text-align: left;
                        margin-top: 20px;
                    }
                    
                    .error-boundary-details summary {
                        cursor: pointer;
                        color: #4299e1;
                        font-weight: 500;
                        margin-bottom: 10px;
                    }
                    
                    .error-boundary-details pre {
                        background: #f7fafc;
                        padding: 15px;
                        border-radius: 6px;
                        overflow-x: auto;
                        font-size: 12px;
                        color: #2d3748;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        /**
         * Log error to remote endpoint
         */
        async logToRemote(errorInfo) {
            try {
                await fetch(this.config.remoteEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: errorInfo,
                        context: {
                            url: window.location.href,
                            userAgent: navigator.userAgent,
                            timestamp: new Date().toISOString()
                        }
                    })
                });
            } catch (e) {
                console.error('Failed to log error to remote:', e);
            }
        }

        /**
         * Setup error recovery
         */
        setupErrorRecovery() {
            // Auto-recover after multiple errors
            if (this.errorCount > 3) {
                console.warn('Multiple errors detected, attempting recovery...');
                setTimeout(() => {
                    if (confirm('Multiple errors detected. Would you like to reload the page?')) {
                        window.location.reload();
                    }
                }, 5000);
            }
        }

        /**
         * Get error queue
         */
        getErrorQueue() {
            return [...errorQueue];
        }

        /**
         * Clear error queue
         */
        clearErrorQueue() {
            errorQueue.length = 0;
        }

        /**
         * Reset error boundary
         */
        reset() {
            this.errorCount = 0;
            this.clearErrorQueue();
            const errorUI = document.getElementById('error-boundary-ui');
            if (errorUI) {
                errorUI.remove();
            }
        }
    }

    // Create global instance
    const errorBoundary = new ErrorBoundary({
        logToConsole: true,
        showFallbackUI: true,
        onError: (errorInfo) => {
            // Custom error handling logic
            console.log('Custom error handler called with:', errorInfo);
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            errorBoundary.init();
        });
    } else {
        errorBoundary.init();
    }

    // Expose globally
    window.ErrorBoundary = errorBoundary;

})();
