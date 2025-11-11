/**
 * SimpleModeToggle - UI component for switching between Simple and Advanced modes
 * Displays comparison view and handles mode switching
 */

class SimpleModeToggle {
  constructor(container) {
    this.container = container || document.body;
    this.simpleMode = window.SimpleModeManager?.isEnabled() ?? true;
    this.logger = window.SafeLogger || console;
  }

  /**
   * Render toggle interface
   */
  render() {
    if (!this.container) {
      this.logger.error('SimpleModeToggle: No container provided');
      return;
    }

    this.container.innerHTML = `
            <div class="simple-mode-toggle">
                <div class="toggle-header" style="margin-bottom: 2rem;">
                    <h3 style="margin: 0 0 0.5rem 0; color: #2d3748;">Interface Mode</h3>
                    <p style="margin: 0; color: #718096; font-size: 0.875rem;">Choose the experience that works best for you</p>
                </div>
                
                <div class="toggle-options" style="display: flex; flex-direction: column; gap: 1rem;">
                    ${this.renderModeOption('simple')}
                    ${this.renderModeOption('advanced')}
                </div>
                
                <div class="toggle-actions" style="margin-top: 2rem; display: flex; gap: 1rem;">
                    <button class="btn-primary" onclick="window.SimpleModeToggleInstance.applyModeChange()" style="flex: 1;">
                        Apply Changes
                    </button>
                    <button class="btn-secondary" onclick="window.SimpleModeToggleInstance.cancelModeChange()" style="flex: 1;">
                        Cancel
                    </button>
                </div>
            </div>
        `;

    this.setupEventListeners();
  }

  /**
   * Render mode option card
   * @param {string} mode - Mode ('simple' or 'advanced')
   * @returns {string} Mode option HTML
   */
  renderModeOption(mode) {
    const isSimple = mode === 'simple';
    const isActive = isSimple === this.simpleMode;
    const isSelected = isActive;

    const option = isSimple
      ? {
          icon: '🎯',
          title: 'Simple Mode',
          description: 'Clean, focused interface with essential features',
          features: [
            'Easy workout tracking',
            'Basic progress view',
            'Simple goal setting',
            'Quick navigation (3-4 tabs)',
          ],
        }
      : {
          icon: '🚀',
          title: 'Advanced Mode',
          description: 'Full-featured interface with detailed analytics',
          features: [
            'Detailed analytics & charts',
            'AI coaching insights',
            'Strava integration',
            'Advanced customization',
            'Complete navigation menu',
          ],
        };

    return `
            <div class="toggle-option ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}" 
                 data-mode="${mode}"
                 onclick="window.SimpleModeToggleInstance.selectMode('${mode}')"
                 style="
                     background: ${isSelected ? '#edf2f7' : 'white'};
                     border: 2px solid ${isSelected ? '#4299e1' : '#e2e8f0'};
                     border-radius: 12px;
                     padding: 1.5rem;
                     cursor: pointer;
                     transition: all 0.2s;
                     display: flex;
                     gap: 1rem;
                 ">
                <div class="option-icon" style="font-size: 2.5rem;">${option.icon}</div>
                <div class="option-content" style="flex: 1;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #2d3748;">${option.title}</h4>
                    <p style="margin: 0 0 1rem 0; color: #718096; font-size: 0.875rem;">${option.description}</p>
                    <ul class="option-features" style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem;">
                        ${option.features
                          .map(
                            feature => `
                            <li style="color: #4a5568; font-size: 0.875rem;">✓ ${feature}</li>
                        `
                          )
                          .join('')}
                    </ul>
                </div>
                <div class="option-selector" style="display: flex; align-items: center;">
                    <input type="radio" 
                           name="interface-mode" 
                           value="${mode}" 
                           ${isSelected ? 'checked' : ''} 
                           id="mode-${mode}"
                           style="width: 20px; height: 20px; cursor: pointer;">
                    <label for="mode-${mode}" class="sr-only">Select ${option.title}</label>
                </div>
            </div>
        `;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const radios = this.container.querySelectorAll('input[name="interface-mode"]');
    radios.forEach(radio => {
      radio.addEventListener('change', e => {
        this.selectMode(e.target.value);
      });
    });
  }

  /**
   * Select mode for preview
   * @param {string} mode - Mode to select
   */
  selectMode(mode) {
    const isSimple = mode === 'simple';

    // Update visual selection
    const options = this.container.querySelectorAll('.toggle-option');
    options.forEach(option => {
      const optionMode = option.dataset.mode;
      const isSelected = optionMode === mode;
      option.classList.toggle('selected', isSelected);
      option.style.border = isSelected ? '2px solid #4299e1' : '2px solid #e2e8f0';
      option.style.background = isSelected ? '#edf2f7' : 'white';

      const radio = option.querySelector(`input[value="${optionMode}"]`);
      if (radio) {
        radio.checked = isSelected;
      }
    });

    this.selectedMode = mode;
  }

  /**
   * Apply mode change
   */
  applyModeChange() {
    const selectedMode = this.container.querySelector(
      'input[name="interface-mode"]:checked'
    )?.value;
    if (!selectedMode) {
      this.logger.warn('No mode selected');
      return;
    }

    const isSimple = selectedMode === 'simple';

    // Update Simple Mode Manager
    if (window.SimpleModeManager) {
      window.SimpleModeManager.setEnabled(isSimple);
    }

    // Show success message
    this.showSuccess(
      `Switched to ${selectedMode === 'simple' ? 'Simple' : 'Advanced'} mode successfully!`
    );

    // Refresh interface
    this.refreshInterface();
  }

  /**
   * Cancel mode change
   */
  cancelModeChange() {
    // Reset to current mode
    this.render();
  }

  /**
   * Refresh interface after mode change
   */
  refreshInterface() {
    // Trigger re-render of adaptive components
    if (window.EventBus) {
      window.EventBus.emit('simpleMode:changed', {
        enabled: window.SimpleModeManager?.isEnabled(),
      });
    }

    // Smooth transition
    document.body.classList.add('mode-transitioning');
    setTimeout(() => {
      document.body.classList.remove('mode-transitioning');
    }, 500);

    // Reload current view
    if (window.Router) {
      const currentRoute = window.Router.getCurrentRoute?.() || '#/dashboard';
      window.Router.navigate(currentRoute, { replace: true });
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #48bb78;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Create global instance
window.SimpleModeToggle = SimpleModeToggle;

// Helper to create toggle in container
window.createSimpleModeToggle = function (containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found:', containerId);
    return null;
  }

  window.SimpleModeToggleInstance = new SimpleModeToggle(container);
  window.SimpleModeToggleInstance.render();
  return window.SimpleModeToggleInstance;
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SimpleModeToggle;
}
