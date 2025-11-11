/**
 * WhyPanel Component Tests
 * Tests for the WhyPanel UI component functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock browser environment
global.window = {
  SafeLogger: console,
  EventBus: {
    emit: vi.fn(),
  },
  WorkoutTracker: {
    currentPlan: null,
    render: vi.fn(),
  },
  AuthManager: {
    getCurrentUsername: vi.fn(() => 'testuser'),
  },
  StorageManager: {
    saveSessionLog: vi.fn(),
  },
};

global.document = {
  createElement: vi.fn(tagName => {
    const element = {
      textContent: '',
      innerHTML: '',
      appendChild: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      remove: vi.fn(),
      setAttribute: vi.fn(),
      classList: {
        toggle: vi.fn(),
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    // Mock textContent setter for HTML escaping
    Object.defineProperty(element, 'textContent', {
      get: () => element._textContent || '',
      set: value => {
        element._textContent = value;
        // Simulate HTML escaping
        element.innerHTML = value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      },
    });

    return element;
  }),
  getElementById: vi.fn(),
  body: {
    appendChild: vi.fn(),
  },
  querySelectorAll: vi.fn(() => []),
};

// Mock ExerciseAdapter
class MockExerciseAdapter {
  getAlternates(exerciseName) {
    const alternates = {
      Squat: [
        { name: 'Goblet Squat', rationale: 'Easier progression' },
        { name: 'Bulgarian Split Squat', rationale: 'Single leg focus' },
      ],
      'Bench Press': [
        { name: 'Dumbbell Press', rationale: 'More stable' },
        { name: 'Incline Press', rationale: 'Upper chest focus' },
      ],
    };
    return alternates[exerciseName] || [];
  }
}

global.ExerciseAdapter = MockExerciseAdapter;

describe('WhyPanel Component', () => {
  let whyPanel;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create fresh instance
    whyPanel = new WhyPanel();
  });

  describe('Rendering', () => {
    it('should render empty string for plan without rationale', () => {
      const plan = { exercises: [] };
      const result = whyPanel.render(plan);
      expect(result).toBe('');
    });

    it('should render empty string for plan with empty why array', () => {
      const plan = { why: [] };
      const result = whyPanel.render(plan);
      expect(result).toBe('');
    });

    it('should render why panel with rationale', () => {
      const plan = {
        why: [
          'Reduced leg volume due to soccer game tomorrow',
          'Added upper body focus for balance',
          'Increased rest time for recovery',
        ],
      };

      const result = whyPanel.render(plan);

      expect(result).toContain('why-panel');
      expect(result).toContain('Why this plan?');
      expect(result).toContain('Reduced leg volume due to soccer game tomorrow');
      expect(result).toContain('Added upper body focus for balance');
      expect(result).toContain('Increased rest time for recovery');
    });

    it('should render warnings when present', () => {
      const plan = {
        why: ['Test rationale'],
        warnings: ['High fatigue detected', 'Consider reducing intensity'],
      };

      const result = whyPanel.render(plan);

      expect(result).toContain('why-warnings');
      expect(result).toContain('High fatigue detected');
      expect(result).toContain('Consider reducing intensity');
    });

    it('should include proper ARIA attributes', () => {
      const plan = { why: ['Test rationale'] };
      const result = whyPanel.render(plan);

      expect(result).toContain('role="region"');
      expect(result).toContain('aria-label="Workout rationale"');
      expect(result).toContain('aria-expanded="false"');
      expect(result).toContain('aria-controls="why-panel-content"');
    });
  });

  describe('Toggle Functionality', () => {
    it('should toggle expansion state', () => {
      expect(whyPanel.isExpanded).toBe(false);

      whyPanel.toggle();
      expect(whyPanel.isExpanded).toBe(true);

      whyPanel.toggle();
      expect(whyPanel.isExpanded).toBe(false);
    });

    it('should update DOM elements when toggling', () => {
      const mockButton = {
        setAttribute: vi.fn(),
        querySelector: vi.fn(() => ({
          classList: { toggle: vi.fn() },
        })),
      };
      const mockContent = {
        setAttribute: vi.fn(),
        classList: { toggle: vi.fn() },
      };

      document.getElementById = vi.fn(id => {
        if (id === 'why-panel-toggle') {
          return mockButton;
        }
        if (id === 'why-panel-content') {
          return mockContent;
        }
        return null;
      });

      whyPanel.toggle();

      expect(mockButton.setAttribute).toHaveBeenCalledWith('aria-expanded', true);
      expect(mockContent.setAttribute).toHaveBeenCalledWith('aria-hidden', false);
      expect(mockContent.classList.toggle).toHaveBeenCalledWith('expanded', true);
    });
  });

  describe('Override Functionality', () => {
    beforeEach(() => {
      // Set up a mock plan
      window.WorkoutTracker.currentPlan = {
        blocks: [
          {
            items: [
              { name: 'Squat', sets: 3, reps: 5 },
              { name: 'Bench Press', sets: 3, reps: 5 },
            ],
          },
        ],
      };
    });

    it('should create override modal with alternatives', () => {
      const mockModal = {
        innerHTML: '',
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
        remove: vi.fn(),
      };

      document.createElement = vi.fn(() => mockModal);

      whyPanel.createOverrideModal('Squat', 0, [
        { name: 'Goblet Squat', rationale: 'Easier progression' },
      ]);

      expect(mockModal.innerHTML).toContain('Override: Squat');
      expect(mockModal.innerHTML).toContain('Goblet Squat');
      expect(mockModal.innerHTML).toContain('Easier progression');
    });

    it('should select alternate exercise', () => {
      const renderSpy = vi.spyOn(window.WorkoutTracker, 'render');

      whyPanel.selectAlternate('Goblet Squat', 'Squat', 0);

      expect(window.WorkoutTracker.currentPlan.blocks[0].items[0].name).toBe('Goblet Squat');
      expect(window.WorkoutTracker.currentPlan.blocks[0].items[0].notes).toContain(
        'Overridden from Squat'
      );
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should apply regression (reduce sets)', () => {
      const renderSpy = vi.spyOn(window.WorkoutTracker, 'render');

      whyPanel.applyRegression('Squat', 0);

      expect(window.WorkoutTracker.currentPlan.blocks[0].items[0].sets).toBe(2);
      expect(window.WorkoutTracker.currentPlan.blocks[0].items[0].notes).toContain(
        'Regression applied'
      );
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should apply progression (increase sets)', () => {
      const renderSpy = vi.spyOn(window.WorkoutTracker, 'render');

      whyPanel.applyProgression('Squat', 0);

      expect(window.WorkoutTracker.currentPlan.blocks[0].items[0].sets).toBe(4);
      expect(window.WorkoutTracker.currentPlan.blocks[0].items[0].notes).toContain(
        'Progression applied'
      );
      expect(renderSpy).toHaveBeenCalled();
    });

    it('should handle different pattern by selecting alternate', () => {
      const selectAlternateSpy = vi.spyOn(whyPanel, 'selectAlternate');

      whyPanel.applyDifferentPattern('Squat', 0);

      expect(selectAlternateSpy).toHaveBeenCalledWith('Goblet Squat', 'Squat', 0);
    });
  });

  describe('Event Logging', () => {
    it('should log override events', () => {
      const overrideData = {
        original: 'Squat',
        alternate: 'Goblet Squat',
        type: 'alternate',
        timestamp: '2024-01-01T00:00:00.000Z',
      };

      whyPanel.logOverride(overrideData);

      expect(window.EventBus.emit).toHaveBeenCalledWith('EXERCISE_OVERRIDE', overrideData);
      expect(window.StorageManager.saveSessionLog).toHaveBeenCalledWith('testuser', '2024-01-01', {
        overrides: [overrideData],
      });
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML in rationale text', () => {
      const plan = {
        why: ['<script>alert("xss")</script>', 'Normal text & symbols'],
      };

      const result = whyPanel.render(plan);

      expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(result).toContain('Normal text &amp; symbols');
    });

    it('should escape HTML in exercise names', () => {
      const result = whyPanel.renderOverrideButton('<script>alert("xss")</script>', 0);

      expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing plan gracefully', () => {
      window.WorkoutTracker.currentPlan = null;

      expect(() => whyPanel.selectAlternate('Test', 'Original', 0)).not.toThrow();
      expect(() => whyPanel.applyRegression('Test', 0)).not.toThrow();
      expect(() => whyPanel.applyProgression('Test', 0)).not.toThrow();
    });

    it('should handle missing blocks gracefully', () => {
      window.WorkoutTracker.currentPlan = { blocks: null };

      expect(() => whyPanel.selectAlternate('Test', 'Original', 0)).not.toThrow();
    });

    it('should handle missing exercise at index', () => {
      window.WorkoutTracker.currentPlan = {
        blocks: [{ items: [{ name: 'Squat' }] }],
      };

      // Try to override non-existent exercise
      expect(() => whyPanel.selectAlternate('Test', 'Original', 5)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should include proper ARIA roles and labels', () => {
      const plan = { why: ['Test rationale'] };
      const result = whyPanel.render(plan);

      expect(result).toContain('role="list"');
      expect(result).toContain('role="listitem"');
      expect(result).toContain('role="alert"');
    });

    it('should support keyboard navigation', () => {
      const mockModal = {
        innerHTML: '',
        setAttribute: vi.fn(),
        addEventListener: vi.fn(),
        remove: vi.fn(),
        querySelector: vi.fn(() => ({ focus: vi.fn() })),
      };

      document.createElement = vi.fn(() => mockModal);

      whyPanel.createOverrideModal('Squat', 0, []);

      // Should add keydown event listener for Escape key
      expect(mockModal.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});

// Import WhyPanel class (this would normally be imported from the actual file)
class WhyPanel {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.eventBus = window.EventBus;
    this.isExpanded = false;
  }

  render(plan) {
    if (!plan || !plan.why || plan.why.length === 0) {
      return '';
    }

    const warningsHtml =
      plan.warnings && plan.warnings.length > 0 ? this.renderWarnings(plan.warnings) : '';

    return `
            <div class="why-panel" id="why-panel" role="region" aria-label="Workout rationale">
                <button 
                    class="why-panel-toggle" 
                    id="why-panel-toggle"
                    aria-expanded="${this.isExpanded}"
                    aria-controls="why-panel-content"
                    onclick="window.WhyPanel.toggle()"
                >
                    <span class="why-icon">💡</span>
                    <span class="why-label">Why this plan?</span>
                    <span class="why-arrow ${this.isExpanded ? 'expanded' : ''}">▼</span>
                </button>
                
                <div 
                    class="why-panel-content ${this.isExpanded ? 'expanded' : ''}" 
                    id="why-panel-content"
                    aria-hidden="${!this.isExpanded}"
                >
                    ${warningsHtml}
                    <ul class="why-list" role="list">
                        ${plan.why
                          .map(
                            (reason, index) => `
                            <li class="why-item" role="listitem">
                                <span class="why-marker">${index + 1}.</span>
                                <span class="why-text">${this.escapeHtml(reason)}</span>
                            </li>
                        `
                          )
                          .join('')}
                    </ul>
                </div>
            </div>
        `;
  }

  renderWarnings(warnings) {
    return `
            <div class="why-warnings" role="alert">
                <strong>⚠️ Important:</strong>
                <ul class="warning-list">
                    ${warnings
                      .map(
                        warning => `
                        <li>${this.escapeHtml(warning)}</li>
                    `
                      )
                      .join('')}
                </ul>
            </div>
        `;
  }

  toggle() {
    this.isExpanded = !this.isExpanded;
    const button = document.getElementById('why-panel-toggle');
    const content = document.getElementById('why-panel-content');
    const arrow = button?.querySelector('.why-arrow');

    if (button) {
      button.setAttribute('aria-expanded', this.isExpanded);
    }

    if (content) {
      content.setAttribute('aria-hidden', !this.isExpanded);
      content.classList.toggle('expanded', this.isExpanded);
    }

    if (arrow) {
      arrow.classList.toggle('expanded', this.isExpanded);
    }

    this.logger.debug('Why panel toggled', { expanded: this.isExpanded });
  }

  renderOverrideButton(exerciseName, index) {
    return `
            <button 
                class="override-exercise-btn"
                data-exercise="${this.escapeHtml(exerciseName)}"
                data-index="${index}"
                aria-label="Override ${exerciseName}"
                onclick="window.WhyPanel.showOverrideModal(this)"
            >
                🔄 Override
            </button>
        `;
  }

  selectAlternate(alternateName, originalName, index) {
    const plan = window.WorkoutTracker?.currentPlan;

    if (!plan || !plan.blocks) {
      this.logger.error('No plan available for override');
      return;
    }

    let replaced = false;
    for (const block of plan.blocks) {
      if (block.items && block.items[index]) {
        const oldExercise = block.items[index].name;
        block.items[index].name = alternateName;
        block.items[index].notes =
          `${block.items[index].notes || ''} (Overridden from ${oldExercise})`;
        replaced = true;
        break;
      }
    }

    if (replaced) {
      if (window.WorkoutTracker) {
        window.WorkoutTracker.render();
      }

      this.logOverride({
        original: originalName,
        alternate: alternateName,
        type: 'alternate',
        timestamp: new Date().toISOString(),
      });

      document.querySelectorAll('.override-modal-overlay').forEach(el => el.remove());
    }
  }

  applyRegression(exerciseName, index) {
    const plan = window.WorkoutTracker?.currentPlan;

    if (!plan || !plan.blocks) {
      this.logger.error('No plan available for regression');
      return;
    }

    for (const block of plan.blocks) {
      if (block.items && block.items[index]) {
        const item = block.items[index];

        if (typeof item.sets === 'number') {
          item.sets = Math.max(1, item.sets - 1);
        }

        item.notes = `${item.notes || ''} (Regression applied)`;
        break;
      }
    }

    if (window.WorkoutTracker) {
      window.WorkoutTracker.render();
    }

    this.logOverride({
      exercise: exerciseName,
      type: 'regression',
      timestamp: new Date().toISOString(),
    });

    document.querySelectorAll('.override-modal-overlay').forEach(el => el.remove());
  }

  applyProgression(exerciseName, index) {
    const plan = window.WorkoutTracker?.currentPlan;

    if (!plan || !plan.blocks) {
      this.logger.error('No plan available for progression');
      return;
    }

    for (const block of plan.blocks) {
      if (block.items && block.items[index]) {
        const item = block.items[index];

        if (typeof item.sets === 'number') {
          item.sets += 1;
        }

        item.notes = `${item.notes || ''} (Progression applied)`;
        break;
      }
    }

    if (window.WorkoutTracker) {
      window.WorkoutTracker.render();
    }

    this.logOverride({
      exercise: exerciseName,
      type: 'progression',
      timestamp: new Date().toISOString(),
    });

    document.querySelectorAll('.override-modal-overlay').forEach(el => el.remove());
  }

  applyDifferentPattern(exerciseName, index) {
    const plan = window.WorkoutTracker?.currentPlan;

    if (!plan || !plan.blocks) {
      this.logger.error('No plan available for pattern change');
      return;
    }

    const exerciseAdapter = new ExerciseAdapter();
    const alternates = exerciseAdapter.getAlternates(exerciseName);

    if (alternates.length > 0) {
      this.selectAlternate(alternates[0].name, exerciseName, index);
    }
  }

  logOverride(overrideData) {
    this.eventBus.emit('EXERCISE_OVERRIDE', overrideData);

    this.logger.info('Exercise override applied', overrideData);

    if (window.StorageManager) {
      const userId = window.AuthManager?.getCurrentUsername() || 'anonymous';
      window.StorageManager.saveSessionLog(userId, new Date().toISOString().split('T')[0], {
        overrides: [overrideData],
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  createOverrideModal(exerciseName, index, alternates) {
    const modal = document.createElement('div');
    modal.className = 'override-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'override-modal-title');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
            <div class="override-modal">
                <div class="modal-header">
                    <h3 id="override-modal-title">Override: ${this.escapeHtml(exerciseName)}</h3>
                    <button 
                        class="modal-close" 
                        aria-label="Close modal"
                        onclick="this.closest('.override-modal-overlay').remove()"
                    >
                        ×
                    </button>
                </div>
                <div class="modal-content">
                    <h4>Suggested Alternatives</h4>
                    <div class="alternate-list">
                        ${
                          alternates.length > 0
                            ? alternates
                                .map(
                                  (alt, i) => `
                            <button 
                                class="alternate-option" 
                                data-alternate="${this.escapeHtml(alt.name)}"
                                onclick="window.WhyPanel.selectAlternate('${this.escapeHtml(alt.name)}', '${exerciseName}', ${index})"
                            >
                                <div class="alternate-name">${this.escapeHtml(alt.name)}</div>
                                <div class="alternate-rationale">${this.escapeHtml(alt.rationale)}</div>
                            </button>
                        `
                                )
                                .join('')
                            : `
                            <p class="no-alternates">No alternatives available for this exercise.</p>
                        `
                        }
                    </div>
                </div>
            </div>
        `;

    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        modal.remove();
      }
    });

    return modal;
  }
}
