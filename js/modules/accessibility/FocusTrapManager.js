/**
 * FocusTrapManager - Manages focus trapping for modal dialogs and overlays
 * Ensures keyboard users can navigate within modals and return focus properly
 */
class FocusTrapManager {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.activeTraps = new Map();
    this.focusableElements = [
      'button',
      '[href]',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ];

    this.init();
  }

  /**
   * Initialize focus trap manager
   */
  init() {
    this.setupEventListeners();
    this.logger.debug('FocusTrapManager initialized');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for modal events
    EventBus.subscribe('modal:open', this.handleModalOpen.bind(this));
    EventBus.subscribe('modal:close', this.handleModalClose.bind(this));

    // Listen for overlay events
    EventBus.subscribe('overlay:show', this.handleOverlayShow.bind(this));
    EventBus.subscribe('overlay:hide', this.handleOverlayHide.bind(this));
  }

  /**
   * Handle modal open event
   * @param {Object} data - Modal data
   */
  handleModalOpen(data) {
    const { modalId, triggerElement } = data;
    this.trapFocus(modalId, triggerElement);
  }

  /**
   * Handle modal close event
   * @param {Object} data - Modal data
   */
  handleModalClose(data) {
    const { modalId } = data;
    this.releaseFocus(modalId);
  }

  /**
   * Handle overlay show event
   * @param {Object} data - Overlay data
   */
  handleOverlayShow(data) {
    const { overlayId, triggerElement } = data;
    this.trapFocus(overlayId, triggerElement);
  }

  /**
   * Handle overlay hide event
   * @param {Object} data - Overlay data
   */
  handleOverlayHide(data) {
    const { overlayId } = data;
    this.releaseFocus(overlayId);
  }

  /**
   * Trap focus within a modal or overlay
   * @param {string} containerId - Container element ID
   * @param {HTMLElement} triggerElement - Element that triggered the modal
   */
  trapFocus(containerId, triggerElement = null) {
    const container = document.getElementById(containerId);
    if (!container) {
      this.logger.warn('Container not found for focus trap:', containerId);
      return;
    }

    // Store trigger element for focus return
    const trapData = {
      container,
      triggerElement,
      firstFocusableElement: null,
      lastFocusableElement: null,
      focusableElements: [],
      keydownHandler: null,
      focusHandler: null,
    };

    // Get focusable elements
    this.updateFocusableElements(trapData);

    if (trapData.focusableElements.length === 0) {
      this.logger.warn('No focusable elements found in container:', containerId);
      return;
    }

    // Set first and last focusable elements
    trapData.firstFocusableElement = trapData.focusableElements[0];
    trapData.lastFocusableElement =
      trapData.focusableElements[trapData.focusableElements.length - 1];

    // Create keyboard handler
    trapData.keydownHandler = e => {
      this.handleKeydown(e, trapData);
    };

    // Create focus handler
    trapData.focusHandler = e => {
      this.handleFocus(e, trapData);
    };

    // Add event listeners
    container.addEventListener('keydown', trapData.keydownHandler);
    document.addEventListener('focusin', trapData.focusHandler);

    // Focus first element
    trapData.firstFocusableElement.focus();

    // Store trap data
    this.activeTraps.set(containerId, trapData);

    this.logger.debug('Focus trapped in container:', containerId);
  }

  /**
   * Release focus trap
   * @param {string} containerId - Container element ID
   */
  releaseFocus(containerId) {
    const trapData = this.activeTraps.get(containerId);
    if (!trapData) {
      this.logger.warn('No active focus trap found for:', containerId);
      return;
    }

    // Remove event listeners
    trapData.container.removeEventListener('keydown', trapData.keydownHandler);
    document.removeEventListener('focusin', trapData.focusHandler);

    // Return focus to trigger element
    if (trapData.triggerElement && trapData.triggerElement.focus) {
      trapData.triggerElement.focus();
    }

    // Remove from active traps
    this.activeTraps.delete(containerId);

    this.logger.debug('Focus trap released for container:', containerId);
  }

  /**
   * Update focusable elements for a trap
   * @param {Object} trapData - Trap data object
   */
  updateFocusableElements(trapData) {
    const { container } = trapData;
    const selector = this.focusableElements.join(', ');

    trapData.focusableElements = Array.from(container.querySelectorAll(selector)).filter(
      element => {
        return this.isElementFocusable(element);
      }
    );
  }

  /**
   * Check if element is focusable
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} Whether element is focusable
   */
  isElementFocusable(element) {
    if (!element || element.disabled || element.hidden) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex === '-1') {
      return false;
    }

    return true;
  }

  /**
   * Handle keyboard events within focus trap
   * @param {KeyboardEvent} e - Keyboard event
   * @param {Object} trapData - Trap data object
   */
  handleKeydown(e, trapData) {
    switch (e.key) {
      case 'Tab':
        this.handleTabKey(e, trapData);
        break;
      case 'Escape':
        this.handleEscapeKey(e, trapData);
        break;
    }
  }

  /**
   * Handle Tab key within focus trap
   * @param {KeyboardEvent} e - Keyboard event
   * @param {Object} trapData - Trap data object
   */
  handleTabKey(e, trapData) {
    const { firstFocusableElement, lastFocusableElement, focusableElements } = trapData;

    if (focusableElements.length === 1) {
      e.preventDefault();
      firstFocusableElement.focus();
      return;
    }

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusableElement) {
        e.preventDefault();
        lastFocusableElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusableElement) {
        e.preventDefault();
        firstFocusableElement.focus();
      }
    }
  }

  /**
   * Handle Escape key within focus trap
   * @param {KeyboardEvent} e - Keyboard event
   * @param {Object} trapData - Trap data object
   */
  handleEscapeKey(e, trapData) {
    e.preventDefault();

    // Find container ID from trap data
    let containerId = null;
    for (const [id, data] of this.activeTraps.entries()) {
      if (data === trapData) {
        containerId = id;
        break;
      }
    }

    if (containerId) {
      // Close modal/overlay
      EventBus.publish('modal:close', { modalId: containerId });
      EventBus.publish('overlay:hide', { overlayId: containerId });
    }
  }

  /**
   * Handle focus events to ensure focus stays within trap
   * @param {FocusEvent} e - Focus event
   * @param {Object} trapData - Trap data object
   */
  handleFocus(e, trapData) {
    const { container, firstFocusableElement, lastFocusableElement } = trapData;

    // Check if focus is within the container
    if (!container.contains(e.target)) {
      // Focus escaped, bring it back
      firstFocusableElement.focus();
    }
  }

  /**
   * Create accessible modal
   * @param {Object} options - Modal options
   * @returns {HTMLElement} Modal element
   */
  createAccessibleModal(options = {}) {
    const {
      id = `modal-${Date.now()}`,
      title = 'Modal',
      content = '',
      closeButton = true,
      backdropClick = true,
    } = options;

    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', `${id}-title`);
    modal.setAttribute('aria-describedby', `${id}-content`);

    modal.innerHTML = `
            <div class="modal-backdrop" ${backdropClick ? 'data-backdrop="true"' : ''}></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="${id}-title" class="modal-title">${title}</h2>
                    ${closeButton ? `<button class="modal-close" aria-label="Close modal" data-modal-close="${id}">×</button>` : ''}
                </div>
                <div id="${id}-content" class="modal-body">
                    ${content}
                </div>
            </div>
        `;

    // Add event listeners
    this.setupModalEventListeners(modal, options);

    return modal;
  }

  /**
   * Setup modal event listeners
   * @param {HTMLElement} modal - Modal element
   * @param {Object} options - Modal options
   */
  setupModalEventListeners(modal, options) {
    const modalId = modal.id;

    // Close button
    const closeButton = modal.querySelector('[data-modal-close]');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeModal(modalId);
      });
    }

    // Backdrop click
    const backdrop = modal.querySelector('[data-backdrop]');
    if (backdrop) {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) {
          this.closeModal(modalId);
        }
      });
    }

    // Escape key (handled by focus trap)
    // Focus trap will handle escape key automatically
  }

  /**
   * Open modal with focus trap
   * @param {string} modalId - Modal ID
   * @param {HTMLElement} triggerElement - Trigger element
   */
  openModal(modalId, triggerElement = null) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      this.logger.warn('Modal not found:', modalId);
      return;
    }

    // Show modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // Trap focus
    this.trapFocus(modalId, triggerElement);

    // Announce modal opening
    if (window.LiveRegionManager) {
      window.LiveRegionManager.announce('status-announcements', 'Modal opened', 'normal');
    }

    // Publish event
    EventBus.publish('modal:open', { modalId, triggerElement });
  }

  /**
   * Close modal and release focus trap
   * @param {string} modalId - Modal ID
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      this.logger.warn('Modal not found:', modalId);
      return;
    }

    // Hide modal
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    // Release focus trap
    this.releaseFocus(modalId);

    // Announce modal closing
    if (window.LiveRegionManager) {
      window.LiveRegionManager.announce('status-announcements', 'Modal closed', 'normal');
    }

    // Publish event
    EventBus.publish('modal:close', { modalId });
  }

  /**
   * Get active focus traps
   * @returns {Array} Array of active trap IDs
   */
  getActiveTraps() {
    return Array.from(this.activeTraps.keys());
  }

  /**
   * Check if focus is trapped in a container
   * @param {string} containerId - Container ID
   * @returns {boolean} Whether focus is trapped
   */
  isFocusTrapped(containerId) {
    return this.activeTraps.has(containerId);
  }

  /**
   * Update focusable elements for all active traps
   */
  updateAllFocusableElements() {
    this.activeTraps.forEach((trapData, containerId) => {
      this.updateFocusableElements(trapData);
    });
  }

  /**
   * Destroy all focus traps
   */
  destroyAllTraps() {
    const trapIds = Array.from(this.activeTraps.keys());
    trapIds.forEach(trapId => {
      this.releaseFocus(trapId);
    });
  }
}

// Create global instance
window.FocusTrapManager = new FocusTrapManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FocusTrapManager;
}
