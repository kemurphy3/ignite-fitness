/**
 * WhyPanel Integration Tests
 * Tests for override flow with ExerciseAdapter integration
 */

(function() {
    'use strict';

    describe('WhyPanel Integration', () => {
        let whyPanel;
        let workoutTracker;
        let exerciseAdapter;

        beforeEach(() => {
            whyPanel = window.WhyPanel;
            workoutTracker = window.WorkoutTracker;
            exerciseAdapter = new ExerciseAdapter();

            // Mock plan
            workoutTracker.currentPlan = {
                blocks: [
                    {
                        name: 'Main',
                        items: [
                            { name: 'Bulgarian Split Squat', sets: 3, reps: '8-10', targetRPE: 7 }
                        ],
                        durationMin: 24
                    }
                ],
                intensityScale: 0.9,
                why: [
                    'Time constraint. Keeping workout focused and effective.'
                ]
            };
        });

        describe('override flow', () => {
            it('should show modal when override button clicked', async () => {
                const button = document.createElement('button');
                button.dataset.exercise = 'Bulgarian Split Squat';
                button.dataset.index = '0';

                await whyPanel.showOverrideModal(button);

                const modal = document.querySelector('.override-modal-overlay');
                expect(modal).toBeTruthy();

                // Cleanup
                modal.remove();
            });

            it('should show alternates from ExerciseAdapter', async () => {
                const alternates = exerciseAdapter.getAlternates('Bulgarian Split Squat');

                const button = document.createElement('button');
                button.dataset.exercise = 'Bulgarian Split Squat';
                button.dataset.index = '0';

                await whyPanel.showOverrideModal(button);

                // Should show alternates in modal
                expect(alternates.length).toBeGreaterThan(0);

                const modal = document.querySelector('.override-modal-overlay');
                modal.remove();
            });

            it('should replace exercise when alternate selected', () => {
                const originalName = workoutTracker.currentPlan.blocks[0].items[0].name;

                whyPanel.selectAlternate('Walking Lunges', 'Bulgarian Split Squat', 0);

                const newName = workoutTracker.currentPlan.blocks[0].items[0].name;

                expect(newName).toBe('Walking Lunges');
                expect(newName).not.toBe(originalName);
            });

            it('should update plan notes with override info', () => {
                const originalNotes = workoutTracker.currentPlan.blocks[0].items[0].notes;

                whyPanel.selectAlternate('Goblet Squat', 'Bulgarian Split Squat', 0);

                const updatedNotes = workoutTracker.currentPlan.blocks[0].items[0].notes;

                expect(updatedNotes).toContain('Overridden from');
            });
        });

        describe('regression flow', () => {
            it('should reduce sets by 1', () => {
                const initialSets = workoutTracker.currentPlan.blocks[0].items[0].sets;

                whyPanel.applyRegression('Bulgarian Split Squat', 0);

                const newSets = workoutTracker.currentPlan.blocks[0].items[0].sets;

                expect(newSets).toBe(initialSets - 1);
                expect(newSets).toBeGreaterThanOrEqual(1); // Minimum 1 set
            });

            it('should not reduce below 1 set', () => {
                // Set to minimum
                workoutTracker.currentPlan.blocks[0].items[0].sets = 1;

                whyPanel.applyRegression('Bulgarian Split Squat', 0);

                const {sets} = workoutTracker.currentPlan.blocks[0].items[0];

                expect(sets).toBe(1); // Should stay at 1
            });

            it('should add regression note', () => {
                whyPanel.applyRegression('Bulgarian Split Squat', 0);

                const {notes} = workoutTracker.currentPlan.blocks[0].items[0];

                expect(notes).toContain('Regression applied');
            });
        });

        describe('progression flow', () => {
            it('should increase sets by 1', () => {
                const initialSets = workoutTracker.currentPlan.blocks[0].items[0].sets;

                whyPanel.applyProgression('Bulgarian Split Squat', 0);

                const newSets = workoutTracker.currentPlan.blocks[0].items[0].sets;

                expect(newSets).toBe(initialSets + 1);
            });

            it('should add progression note', () => {
                whyPanel.applyProgression('Bulgarian Split Squat', 0);

                const {notes} = workoutTracker.currentPlan.blocks[0].items[0];

                expect(notes).toContain('Progression applied');
            });
        });

        describe('event logging', () => {
            it('should log override event', () => {
                const logSpy = spyOn(whyPanel.eventBus, 'emit');

                whyPanel.selectAlternate('Walking Lunges', 'Bulgarian Split Squat', 0);

                expect(logSpy).toHaveBeenCalledWith('EXERCISE_OVERRIDE', jasmine.any(Object));
            });

            it('should include timestamp in log', () => {
                const logSpy = spyOn(whyPanel.logger, 'info');

                whyPanel.selectAlternate('Goblet Squat', 'Bulgarian Split Squat', 0);

                expect(logSpy).toHaveBeenCalled();
                const callArgs = logSpy.calls.mostRecent().args;
                expect(callArgs[1]).toHaveProperty('timestamp');
            });
        });

        describe('plan persistence', () => {
            it('should maintain plan structure after override', () => {
                const originalBlocks = workoutTracker.currentPlan.blocks.length;

                whyPanel.selectAlternate('Walking Lunges', 'Bulgarian Split Squat', 0);

                const newBlocks = workoutTracker.currentPlan.blocks.length;

                expect(newBlocks).toBe(originalBlocks);
                expect(workoutTracker.currentPlan.blocks[0].items.length).toBeGreaterThan(0);
            });

            it('should preserve intensity scale', () => {
                const originalScale = workoutTracker.currentPlan.intensityScale;

                whyPanel.selectAlternate('Walking Lunges', 'Bulgarian Split Squat', 0);

                const newScale = workoutTracker.currentPlan.intensityScale;

                expect(newScale).toBe(originalScale);
            });

            it('should keep why rationale', () => {
                const originalWhy = workoutTracker.currentPlan.why;

                whyPanel.selectAlternate('Walking Lunges', 'Bulgarian Split Squat', 0);

                const newWhy = workoutTracker.currentPlan.why;

                expect(newWhy).toEqual(originalWhy);
            });
        });
    });
})();

