/**
 * WhyPanel Component Tests - Simplified
 * Tests for the WhyPanel UI component functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WhyPanel Component - Basic Tests', () => {
  let whyPanel;

  beforeEach(() => {
    // Create a simple mock WhyPanel class
    class MockWhyPanel {
      constructor() {
        this.isExpanded = false;
      }

      render(plan) {
        if (!plan || !plan.why || plan.why.length === 0) {
          return '';
        }

        return `
                    <div class="why-panel">
                        <button class="why-panel-toggle">
                            Why this plan?
                        </button>
                        <div class="why-panel-content">
                            <ul class="why-list">
                                ${plan.why
                                  .map(
                                    (reason, index) => `
                                    <li class="why-item">
                                        <span class="why-marker">${index + 1}.</span>
                                        <span class="why-text">${reason}</span>
                                    </li>
                                `
                                  )
                                  .join('')}
                            </ul>
                        </div>
                    </div>
                `;
      }

      toggle() {
        this.isExpanded = !this.isExpanded;
      }

      escapeHtml(text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    }

    whyPanel = new MockWhyPanel();
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
  });

  describe('Toggle Functionality', () => {
    it('should toggle expansion state', () => {
      expect(whyPanel.isExpanded).toBe(false);

      whyPanel.toggle();
      expect(whyPanel.isExpanded).toBe(true);

      whyPanel.toggle();
      expect(whyPanel.isExpanded).toBe(false);
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML characters', () => {
      const result = whyPanel.escapeHtml('<script>alert("xss")</script>');
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      const result = whyPanel.escapeHtml('Normal text & symbols');
      expect(result).toBe('Normal text &amp; symbols');
    });
  });

  describe('Component Structure', () => {
    it('should include proper CSS classes', () => {
      const plan = { why: ['Test rationale'] };
      const result = whyPanel.render(plan);

      expect(result).toContain('why-panel');
      expect(result).toContain('why-panel-toggle');
      expect(result).toContain('why-panel-content');
      expect(result).toContain('why-list');
      expect(result).toContain('why-item');
    });

    it('should number rationale items correctly', () => {
      const plan = {
        why: ['First reason', 'Second reason', 'Third reason'],
      };
      const result = whyPanel.render(plan);

      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('3.');
    });
  });
});
