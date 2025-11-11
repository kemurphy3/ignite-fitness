/**
 * WhyThis - UI component for displaying "Why This Today?" reasoning
 * Shows compact "Why?" chip that expands to show rationale
 */
class WhyThis {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.storageManager = window.StorageManager;
    this.whyThisDecider = window.WhyThisDecider;
  }

  /**
   * Render "Why This?" chip
   * @param {Object} block - Exercise block
   * @param {Object} context - User context
   * @param {string} reason - Pre-computed reason
   * @returns {HTMLElement} Why chip element
   */
  render(block, context, reason = null) {
    const chip = document.createElement('div');
    chip.className = 'why-this-chip';

    // Generate reason if not provided
    if (!reason) {
      reason =
        this.whyThisDecider?.generateWhyToday(block, context) ||
        'Standard progression aligned with your goals.';
    }

    // Store expanded state
    chip.dataset.expanded = 'false';
    chip.dataset.reason = reason;

    // Compact chip
    chip.innerHTML = `
            <button class="why-chip-button" aria-expanded="false">
                <span class="why-icon">💡</span>
                <span class="why-label">Why?</span>
            </button>
            <div class="why-expansion" aria-hidden="true">
                <div class="why-reason">${reason}</div>
            </div>
        `;

    // Toggle expansion
    const button = chip.querySelector('.why-chip-button');
    button.addEventListener('click', () => this.toggle(chip));

    return chip;
  }

  /**
   * Toggle chip expansion
   * @param {HTMLElement} chip - Chip element
   */
  toggle(chip) {
    const isExpanded = chip.dataset.expanded === 'true';
    chip.dataset.expanded = !isExpanded;

    const button = chip.querySelector('.why-chip-button');
    const expansion = chip.querySelector('.why-expansion');

    if (!isExpanded) {
      // Expand
      expansion.setAttribute('aria-hidden', 'false');
      expansion.style.maxHeight = `${expansion.scrollHeight}px`;
      expansion.style.opacity = '1';
      button.setAttribute('aria-expanded', 'true');

      // Log to progression_events
      this.logReasonView(chip.dataset.reason);
    } else {
      // Collapse
      expansion.setAttribute('aria-hidden', 'true');
      expansion.style.maxHeight = '0';
      expansion.style.opacity = '0';
      button.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Log reason view to progression_events
   * @param {string} reason - Reason that was viewed
   */
  async logReasonView(reason) {
    try {
      const userId = window.AuthManager?.getCurrentUsername();
      if (!userId) {
        return;
      }

      const event = {
        userId,
        eventType: 'WHY_REASON_VIEWED',
        reason,
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'why_this_chip',
          userAction: 'tapped_expand',
        },
      };

      await this.storageManager.logProgressionEvent(userId, event);

      // Emit event
      this.eventBus?.emit(this.eventBus?.TOPICS?.PROFILE_UPDATED, {
        type: 'reason_viewed',
        data: event,
      });

      this.logger.debug('Reason view logged', event);
    } catch (error) {
      this.logger.error('Failed to log reason view', error);
    }
  }

  /**
   * Render reason chip for multiple blocks
   * @param {Array} blocks - Exercise blocks
   * @param {Object} context - User context
   * @returns {Array<HTMLElement>} Array of chip elements
   */
  renderForBlocks(blocks, context) {
    return blocks.map(block => {
      // Generate reason for this block
      const reason = this.whyThisDecider?.generateWhyToday(block, context);
      return this.render(block, context, reason);
    });
  }

  /**
   * Attach "Why?" chips to existing workout elements
   * @param {HTMLElement} container - Container element
   * @param {Array} blocks - Exercise blocks
   * @param {Object} context - User context
   */
  attachToWorkout(container, blocks, context) {
    const exerciseElements = container.querySelectorAll('[data-exercise-block]');

    exerciseElements.forEach((element, index) => {
      if (index < blocks.length) {
        const chip = this.render(blocks[index], context);
        element.appendChild(chip);
      }
    });
  }
}

window.WhyThis = WhyThis;
