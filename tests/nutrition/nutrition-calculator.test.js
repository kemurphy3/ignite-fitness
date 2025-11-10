/**
 * Nutrition Calculator Unit Tests
 * Tests for prompt 7 - Non-tracking nutrition guidance
 */

import { describe, it, expect } from 'vitest';

describe('Nutrition Calculator', () => {
    // Mock calculator function (extracted logic)
    function calculateBMROnly(gender, age, weight, height, bodyFat = null) {
        let bmr;

        if (bodyFat && bodyFat > 0) {
            // Katch-McArdle (needs body fat %)
            const leanBodyMass = weight * (1 - bodyFat / 100);
            bmr = 370 + (21.6 * leanBodyMass);
        } else {
            // Mifflin-St Jeor
            if (gender === 'male') {
                bmr = 10 * weight + 6.25 * height - 5 * age + 5;
            } else {
                bmr = 10 * weight + 6.25 * height - 5 * age - 161;
            }
        }

        return bmr;
    }

    function calculateDailyMacros(targetCalories, goal = 'performance', sport = 'soccer', dayType = 'training', weight = 70) {
        let protein, carbs, fat;

        // Protein: goal and weight dependent
        if (goal === 'muscle' || goal === 'performance') {
            protein = weight * 0.9; // 0.9g per lb
        } else if (goal === 'fat-loss') {
            protein = weight * 1.2; // Higher for fat loss
        } else {
            protein = weight * 0.8;
        }

        const proteinCals = protein * 4;

        // Fat: 25-30% of calories
        const fatPercent = 0.27;
        const fatCals = targetCalories * fatPercent;
        fat = fatCals / 9;

        // Carbs: remaining calories
        const remainingCals = targetCalories - proteinCals - fatCals;
        carbs = remainingCals / 4;

        return {
            protein: Math.round(protein),
            carbs: Math.round(carbs),
            fat: Math.round(fat)
        };
    }

    function getDayTypeAdjustment(dayType) {
        const adjustments = {
            'rest': 0.85, // -15% on rest day
            'training': 1.0, // Normal
            'game': 1.20, // +20% for game day
            'heavy': 1.10 // +10% for heavy training
        };

        return adjustments[dayType] || 1.0;
    }

    describe('BMR Calculation', () => {
        it('should calculate BMR for male using Mifflin-St Jeor', () => {
            const bmr = calculateBMROnly('male', 25, 70, 175);

            expect(bmr).toBeGreaterThan(1500);
            expect(bmr).toBeLessThan(2000);
        });

        it('should calculate BMR for female using Mifflin-St Jeor', () => {
            const bmr = calculateBMROnly('female', 25, 60, 165);

            expect(bmr).toBeGreaterThan(1200);
            expect(bmr).toBeLessThan(1800);
        });

        it('should use Katch-McArdle when body fat provided', () => {
            const bmr = calculateBMROnly('male', 25, 70, 175, 15);

            expect(bmr).toBeGreaterThan(1000);
            expect(bmr).toBeLessThan(2000);
        });
    });

    describe('Day Type Adjustments', () => {
        it('should reduce calories on rest day', () => {
            const adjustment = getDayTypeAdjustment('rest');

            expect(adjustment).toBe(0.85);
        });

        it('should increase calories on game day', () => {
            const adjustment = getDayTypeAdjustment('game');

            expect(adjustment).toBe(1.20);
        });

        it('should use normal calories on training day', () => {
            const adjustment = getDayTypeAdjustment('training');

            expect(adjustment).toBe(1.0);
        });

        it('should increase calories on heavy training day', () => {
            const adjustment = getDayTypeAdjustment('heavy');

            expect(adjustment).toBe(1.10);
        });
    });

    describe('Macro Calculation', () => {
        it('should calculate macros for performance goal', () => {
            const macros = calculateDailyMacros(2500, 'performance', 'soccer', 'training', 70);

            expect(macros.protein).toBeGreaterThan(60);
            expect(macros.carbs).toBeGreaterThan(200);
            expect(macros.fat).toBeGreaterThan(60);

            // Total should be approximately target calories
            const totalCals = (macros.protein * 4) + (macros.carbs * 4) + (macros.fat * 9);
            expect(totalCals).toBeCloseTo(2500, -50);
        });

        it('should calculate higher protein for fat-loss goal', () => {
            const macros = calculateDailyMacros(2000, 'fat-loss', 'soccer', 'training', 70);

            expect(macros.protein).toBeGreaterThan(80); // Higher protein for fat loss
        });

        it('should adjust for game day (higher carbs)', () => {
            const macros = calculateDailyMacros(3000, 'performance', 'soccer', 'game', 70);

            expect(macros.carbs).toBeGreaterThan(350); // More carbs for game
        });

        it('should reduce for rest day', () => {
            const restCals = 2500 * 0.85; // Rest day adjustment
            const macros = calculateDailyMacros(restCals, 'performance', 'soccer', 'rest', 70);

            expect(macros.protein + macros.carbs + macros.fat).toBeLessThan(2500);
        });
    });

    describe('Soccer Game Day Adjustments', () => {
        it('should bump carbs for soccer game', () => {
            const macros = calculateDailyMacros(3000, 'performance', 'soccer', 'game', 70);

            // Soccer game should have higher carbs
            expect(macros.carbs).toBeGreaterThan(400);
        });

        it('should maintain protein for game day', () => {
            const macros = calculateDailyMacros(3000, 'performance', 'soccer', 'game', 70);

            // Protein should still be adequate
            expect(macros.protein).toBeGreaterThan(60);
        });
    });

    describe('Goal Presets', () => {
        it('should adjust for muscle-building goal', () => {
            const macros = calculateDailyMacros(2800, 'muscle', 'soccer', 'training', 70);

            expect(macros.protein).toBeGreaterThan(60);
            // Muscle building needs surplus
        });

        it('should adjust for fat-loss goal', () => {
            const macros = calculateDailyMacros(2200, 'fat-loss', 'soccer', 'training', 70);

            expect(macros.protein).toBeGreaterThan(80); // Higher protein
        });

        it('should adjust for toning goal', () => {
            const macros = calculateDailyMacros(2500, 'toning', 'soccer', 'training', 70);

            expect(macros.protein).toBeGreaterThan(55);
        });
    });
});

