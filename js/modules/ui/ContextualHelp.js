/**
 * ContextualHelp - Adaptive help system for Simple and Advanced modes
 * Provides mode-specific help content and floating help button
 */

class ContextualHelp {
  constructor() {
    this.simpleMode = window.SimpleModeManager?.isEnabled() ?? true;
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.helpTips = this.loadHelpContent();
    this.autoShowHelp = !localStorage.getItem('ignite.help.autoShowDisabled');
    this.setupHelpSystem();

    // Listen for Simple Mode changes
    if (this.eventBus) {
      this.eventBus.on('simpleMode:changed', data => {
        this.simpleMode = data.enabled;
      });
    }
  }

  /**
   * Load help content for both modes
   * @returns {Object} Help content structure
   */
  loadHelpContent() {
    return {
      simple: {
        dashboard: {
          title: 'Your Fitness Dashboard',
          content:
            'This is your home base. Start workouts, check your progress, and celebrate your achievements!',
          tips: [
            "Tap 'Start Workout' when you're ready to exercise",
            'Check your streak to stay motivated',
            'Your progress updates automatically',
            'Ask the AI Coach anytime for workout advice',
          ],
        },
        workouts: {
          title: 'Your Workout Plan',
          content:
            'Your AI coach has created workouts just for you. Each one adapts based on your feedback.',
          tips: [
            "Start with today's recommended workout",
            'Rate how you feel after each exercise (RPE)',
            "Don't worry about being perfect - focus on consistency",
            'You can modify exercises if needed',
          ],
        },
        progress: {
          title: 'View Your Progress',
          content: "See how you're improving over time with simple, easy-to-understand metrics.",
          tips: [
            'Your workout count shows your consistency',
            'Track your day streak to stay motivated',
            'Progress updates after each completed workout',
          ],
        },
      },
      advanced: {
        dashboard: {
          title: 'Advanced Dashboard',
          content:
            'Your comprehensive fitness command center with detailed analytics and insights.',
          tips: [
            'Use charts to track progress over time',
            'AI insights provide personalized recommendations',
            'Strava integration syncs automatically',
            'Customize your dashboard layout in settings',
          ],
        },
        analytics: {
          title: 'Advanced Analytics',
          content: 'Deep dive into your fitness data with detailed charts and AI insights.',
          tips: [
            'Use filters to focus on specific time periods',
            'Compare different metrics to find patterns',
            'Export data for external analysis',
            'Load metrics show training stress over time',
          ],
        },
        workouts: {
          title: 'Advanced Workout Management',
          content:
            'Full control over your training plan with detailed periodization and load management.',
          tips: [
            'View periodization phases and blocks',
            'Monitor training load and recovery',
            'Adjust workouts based on readiness scores',
            'Track progression across multiple metrics',
          ],
        },
        integrations: {
          title: 'External Integrations',
          content: 'Connect external services to automatically sync your fitness data.',
          tips: [
            'Strava integration syncs activities automatically',
            'Data is deduplicated to prevent duplicates',
            'Load calculations use real heart rate data',
            'Set up once, syncs automatically',
          ],
        },
      },
    };
  }

  /**
   * Setup help system
   */
  setupHelpSystem() {
    // Add floating help button if not in Simple Mode
    if (!this.simpleMode) {
      this.addFloatingHelp();
    }

    // Listen for route changes to show contextual help
    window.addEventListener('route:changed', e => {
      if (this.autoShowHelp) {
        const routeName = e.detail?.config?.name || '';
        this.showContextualHelpForRoute(routeName);
      }
    });
  }

  /**
   * Show contextual help for current page
   * @param {string} page - Page identifier
   */
  showContextualHelp(page) {
    const helpContent = this.simpleMode ? this.helpTips.simple[page] : this.helpTips.advanced[page];

    if (!helpContent) {
      this.logger.debug('No help content for page:', page);
      return;
    }

    this.displayHelpOverlay(helpContent);
  }

  /**
   * Show contextual help for route
   * @param {string} routeName - Route name
   */
  showContextualHelpForRoute(routeName) {
    const routeMap = {
      dashboard: 'dashboard',
      training: 'workouts',
      workouts: 'workouts',
      progress: 'progress',
      analytics: 'analytics',
      integrations: 'integrations',
    };

    const page = routeMap[routeName];
    if (page) {
      // Delay to avoid showing help immediately on every navigation
      setTimeout(() => {
        this.showContextualHelp(page);
      }, 1000);
    }
  }

  /**
   * Display help overlay
   * @param {Object} content - Help content
   */
  displayHelpOverlay(content) {
    // Remove existing overlay
    const existing = document.querySelector('.help-overlay');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'help-overlay';
    overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        `;

    overlay.innerHTML = `
            <div class="help-modal" style="
                background: white;
                border-radius: 12px;
                max-width: 500px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            ">
                <div class="help-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                ">
                    <h3 style="margin: 0; color: #2d3748;">${content.title}</h3>
                    <button class="help-close" onclick="window.ContextualHelpInstance.closeHelp()" 
                            style="
                                background: none;
                                border: none;
                                font-size: 1.5rem;
                                color: #718096;
                                cursor: pointer;
                                padding: 0;
                                width: 32px;
                                height: 32px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            "
                            aria-label="Close help">×</button>
                </div>
                
                <div class="help-content" style="padding: 1.5rem;">
                    <p style="margin: 0 0 1rem 0; color: #4a5568; line-height: 1.6;">${content.content}</p>
                    
                    ${
                      content.tips
                        ? `
                        <div class="help-tips" style="margin-top: 1.5rem;">
                            <h4 style="margin: 0 0 1rem 0; color: #2d3748; font-size: 1rem;">💡 Tips:</h4>
                            <ul style="margin: 0; padding-left: 1.5rem; color: #4a5568; line-height: 1.8;">
                                ${content.tips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                    `
                        : ''
                    }
                </div>
                
                <div class="help-actions" style="
                    padding: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                ">
                    <button class="btn-primary" onclick="window.ContextualHelpInstance.closeHelp()" style="
                        background: #4299e1;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: 600;
                        width: 100%;
                    ">Got it!</button>
                    <label class="help-checkbox" style="
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        color: #718096;
                        font-size: 0.875rem;
                        cursor: pointer;
                    ">
                        <input type="checkbox" onchange="window.ContextualHelpInstance.toggleAutoHelp(this.checked)">
                        Don't show tips automatically
                    </label>
                </div>
            </div>
        `;

    document.body.appendChild(overlay);

    // Add click-outside-to-close
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        this.closeHelp();
      }
    });

    // Store reference
    this.currentOverlay = overlay;
  }

  /**
   * Close help overlay
   */
  closeHelp() {
    if (this.currentOverlay) {
      this.currentOverlay.remove();
      this.currentOverlay = null;
    }
  }

  /**
   * Toggle auto-show help
   * @param {boolean} disabled - Whether to disable auto-show
   */
  toggleAutoHelp(disabled) {
    this.autoShowHelp = !disabled;
    if (disabled) {
      localStorage.setItem('ignite.help.autoShowDisabled', 'true');
    } else {
      localStorage.removeItem('ignite.help.autoShowDisabled');
    }
  }

  /**
   * Add floating help button
   */
  addFloatingHelp() {
    // Remove existing button
    const existing = document.querySelector('.floating-help');
    if (existing) {
      existing.remove();
    }

    const helpButton = document.createElement('button');
    helpButton.className = 'floating-help';
    helpButton.innerHTML = '?';
    helpButton.title = 'Get help with this page';
    helpButton.setAttribute('aria-label', 'Show help for this page');
    helpButton.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #4299e1;
            color: white;
            border: none;
            font-size: 1.5rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        `;

    helpButton.addEventListener('click', () => {
      const route = window.Router?.getCurrentRoute?.() || '#/';
      const routeMap = {
        '#/': 'dashboard',
        '#/dashboard': 'dashboard',
        '#/training': 'workouts',
        '#/workouts': 'workouts',
        '#/progress': 'progress',
        '#/analytics': 'analytics',
        '#/integrations': 'integrations',
      };
      const page = routeMap[route] || 'dashboard';
      this.showContextualHelp(page);
    });

    helpButton.addEventListener('mouseenter', () => {
      helpButton.style.transform = 'scale(1.1)';
    });

    helpButton.addEventListener('mouseleave', () => {
      helpButton.style.transform = 'scale(1)';
    });

    document.body.appendChild(helpButton);
    this.helpButton = helpButton;
  }

  /**
   * Get current page identifier
   * @returns {string} Current page
   */
  getCurrentPage() {
    const route = window.Router?.getCurrentRoute?.() || '#/';
    const routeMap = {
      '#/': 'dashboard',
      '#/dashboard': 'dashboard',
      '#/training': 'workouts',
      '#/workouts': 'workouts',
      '#/progress': 'progress',
      '#/analytics': 'analytics',
      '#/integrations': 'integrations',
    };
    return routeMap[route] || 'dashboard';
  }
}

// Create global instance
window.ContextualHelp = ContextualHelp;
window.ContextualHelpInstance = new ContextualHelp();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextualHelp;
}
