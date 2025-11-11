/**
 * WhyPanel Component Tests
 * Tests for rationale display and exercise overrides
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WhyPanel Component', () => {
    let whyPanel;
    let mockPlan;

    beforeEach(() => {
            whyPanel = window.WhyPanel;
            
            mockPlan = {
                blocks: [
                    {
                        name: 'Warm-up',
                        items: [
                            { name: 'Dynamic Stretches', sets: 1, reps: '10', targetRPE: 5 }
                        ],
                        durationMin: 10
                    },
                    {
                        name: 'Main',
                        items: [
                            { name: 'Back Squat', sets: 3, reps: '8-10', targetRPE: 7 }
                        ],
                        durationMin: 24
                    }
                ],
                intensityScale: 0.9,
                why: [
                    'Dynamic warm-up prepares movement patterns',
                    'Main movements target strength and power'
                ],
                warnings: ['Low readiness. Focus on recovery and form.']
            };
        });

        describe('render', () => {
            it('should render why panel with rationale', () => {
                const html = whyPanel.render(mockPlan);
                
                expect(html).toContain('Why this plan?');
                expect(html).toContain('Dynamic warm-up prepares movement patterns');
                expect(html).toContain('Main movements target strength');
            });

            it('should render warnings when present', () => {
                const html = whyPanel.render(mockPlan);
                
                expect(html).toContain('Important');
                expect(html).toContain('Low readiness. Focus on recovery and form.');
            });

            it('should not render if no rationale', () => {
                const emptyPlan = { blocks: [], why: [], intensityScale: 0.8 };
                const html = whyPanel.render(emptyPlan);
                
                expect(html).toBe('');
            });

            it('should include accessibility attributes', () => {
                const html = whyPanel.render(mockPlan);
                
                expect(html).toContain('role="region"');
                expect(html).toContain('aria-label="Workout rationale"');
                expect(html).toContain('aria-expanded');
                expect(html).toContain('aria-controls');
            });
        });

        describe('toggle', () => {
            it('should toggle panel expansion', () => {
                // Create DOM elements
                const container = document.createElement('div');
                container.innerHTML = whyPanel.render(mockPlan);
                document.body.appendChild(container);

                const initialExpanded = whyPanel.isExpanded;
                whyPanel.toggle();
                const afterToggle = whyPanel.isExpanded;

                expect(afterToggle).not.toBe(initialExpanded);
            });

            it('should update ARIA attributes', () => {
                const container = document.createElement('div');
                container.innerHTML = whyPanel.render(mockPlan);
                document.body.appendChild(container);

                const button = container.querySelector('#why-panel-toggle');
                
                whyPanel.toggle();
                
                expect(button.getAttribute('aria-expanded')).toBe('true');
            });
        });

        describe('overrideButton', () => {
            it('should render override button', () => {
                const html = whyPanel.renderOverrideButton('Back Squat', 0);
                
                expect(html).toContain('Override');
                expect(html).toContain('Back Squat');
                expect(html).toContain('data-exercise');
            });

            it('should include accessibility attributes', () => {
                const html = whyPanel.renderOverrideButton('Deadlift', 1);
                
                expect(html).toContain('aria-label');
                expect(html).toContain('Override Deadlift');
            });
        });

        describe('showOverrideModal', () => {
            it('should create modal with alternates', async () => {
                const button = document.createElement('button');
                button.dataset.exercise = 'Back Squat';
                button.dataset.index = '0';
                
                await whyPanel.showOverrideModal(button);
                
                const modal = document.querySelector('.override-modal-overlay');
                expect(modal).toBeTruthy();
                expect(modal.getAttribute('role')).toBe('dialog');
            });

            it('should include quick actions', async () => {
                const button = document.createElement('button');
                button.dataset.exercise = 'Squat';
                button.dataset.index = '0';
                
                await whyPanel.showOverrideModal(button);
                
                expect(document.querySelector('.quick-action.regression')).toBeTruthy();
                expect(document.querySelector('.quick-action.progression')).toBeTruthy();
                expect(document.querySelector('.quick-action.pattern')).toBeTruthy();
            });

            it('should close on Escape key', async () => {
                const button = document.createElement('button');
                button.dataset.exercise = 'Bench Press';
                button.dataset.index = '0';
                
                await whyPanel.showOverrideModal(button);
                
                const modal = document.querySelector('.override-modal-overlay');
                expect(modal).toBeTruthy();
                
                // Simulate Escape key
                modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                
                const closedModal = document.querySelector('.override-modal-overlay');
                expect(closedModal).toBeFalsy();
            });
        });

        describe('selectAlternate', () => {
            it('should replace exercise in plan', () => {
                // Setup mock workout tracker
                window.WorkoutTracker = {
                    currentPlan: mockPlan,
                    render: vi.fn()
                };

                whyPanel.selectAlternate('Front Squat', 'Back Squat', 1);

                expect(window.WorkoutTracker.render).toHaveBeenCalled();
            });

            it('should log override event', () => {
                const logSpy = vi.spyOn(whyPanel.logger, 'info');
                
                window.WorkoutTracker = {
                    currentPlan: mockPlan,
                    render: vi.fn()
                };

                whyPanel.selectAlternate('Goblet Squat', 'Back Squat', 1);

                expect(logSpy).toHaveBeenCalled();
            });
        });

        describe('regression', () => {
            it('should reduce sets by 1', () => {
                window.WorkoutTracker = {
                    currentPlan: mockPlan,
                    render: vi.fn()
                };

                const initialSets = mockPlan.blocks[1].items[0].sets;
                
                whyPanel.applyRegression('Back Squat', 0);

                expect(mockPlan.blocks[1].items[0].sets).toBe(initialSets - 1);
                expect(window.WorkoutTracker.render).toHaveBeenCalled();
            });
        });

        describe('progression', () => {
            it('should increase sets by 1', () => {
                window.WorkoutTracker = {
                    currentPlan: mockPlan,
                    render: vi.fn()
                };

                const initialSets = mockPlan.blocks[1].items[0].sets;
                
                whyPanel.applyProgression('Back Squat', 0);

                expect(mockPlan.blocks[1].items[0].sets).toBe(initialSets + 1);
                expect(window.WorkoutTracker.render).toHaveBeenCalled();
            });
        });

        describe('accessibility', () => {
            it('should support keyboard navigation', () => {
                const html = whyPanel.render(mockPlan);
                
                // Check for keyboard support
                expect(html).toContain('tabindex');
            });

            it('should have proper focus order', () => {
                const container = document.createElement('div');
                container.innerHTML = whyPanel.render(mockPlan);
                document.body.appendChild(container);

                const button = container.querySelector('#why-panel-toggle');
                expect(button.getAttribute('tabindex')).toBeTruthy();
                
                document.body.removeChild(container);
            });
        });
    });
});

