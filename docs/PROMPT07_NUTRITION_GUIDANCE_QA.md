# Prompt 7 - Nutrition Guidance (Non-Tracking) Manual QA Guide

## Overview

This document provides manual QA instructions for testing the Nutrition Guidance
feature (Prompt 7).

## Implementation Summary

### Files Created/Modified

- `js/modules/nutrition/MacroGuidance.js` - Frontend nutrition guidance module
- `netlify/functions/nutrition-calculator.js` - Backend calculator (exists)
- `tests/nutrition/nutrition-calculator.test.js` - Unit tests
- `index.html` - Added MacroGuidance script

### Key Features

1. **Non-Tracking**: Provides daily targets without food logging
2. **Mifflin-St Jeor BMR**: Accurate calorie calculation
3. **Goal-Based**: Adjusts for performance, muscle, fat-loss, toning
4. **Day-Type Adjustments**: Different targets for game/training/rest
5. **Soccer-Specific**: Game day carb bump
6. **Timing Guidance**: Pre/post meal examples
7. **Hydration Targets**: Daily and pre-workout hydration

## Manual QA Instructions

### 1. Basic Nutrition Card Display

#### Test: Card Renders on Dashboard

1. Navigate to dashboard
2. Verify nutrition card appears
3. Verify shows calories, protein, carbs, fat
4. Verify day type badge visible

**Expected:** Card displays with all macros

#### Test: Default Targets

1. Fresh profile with no preferences
2. Generate nutrition guidance
3. Verify targets are reasonable (2000-3000 cals)
4. Verify protein is 100-200g range
5. Verify carbs and fat are present

**Expected:** Sensible defaults without user input

### 2. BMR Calculation

#### Test: Mifflin-St Jeor for Male

1. Profile: Male, 25 years, 75kg, 180cm
2. Generate guidance
3. Verify BMR is 1700-1800 range
4. Verify this is the base for all calculations

**Expected:** Accurate BMR calculation

#### Test: Mifflin-St Jeor for Female

1. Profile: Female, 25 years, 60kg, 165cm
2. Generate guidance
3. Verify BMR is 1300-1400 range
4. Verify lower than male equivalent

**Expected:** Gender-specific BMR

#### Test: Katch-McArdle with Body Fat

1. Profile with body fat % provided
2. Generate guidance
3. Verify uses Katch-McArdle equation
4. Verify more accurate than Mifflin-St Jeor

**Expected:** More accurate with body fat data

### 3. Day Type Adjustments

#### Test: Rest Day Calories

1. Set day type to "rest"
2. Generate guidance
3. Verify calories reduced by 15%
4. Verify rationale explains rest day reduction

**Expected:** Lower calories on rest days

#### Test: Training Day Calories

1. Set day type to "training"
2. Generate guidance
3. Verify maintenance calories
4. Verify normal macronutrients

**Expected:** Normal calories for training

#### Test: Game Day Calories

1. Set day type to "game" or mark game on calendar
2. Generate guidance
3. Verify calories INCREASED by 20%
4. Verify carbs are higher
5. Verify rationale mentions game day

**Expected:** Higher calories and carbs for game

#### Test: Heavy Training Day

1. Set day type to "heavy"
2. Generate guidance
3. Verify calories increased by 10%
4. Verify higher protein needs

**Expected:** Slight increase for heavy training

### 4. Goal-Specific Adjustments

#### Test: Performance Goal

1. Set goal to "performance"
2. Generate guidance
3. Verify protein ~0.9g per lb bodyweight
4. Verify carbs adequate for training
5. Verify rationale mentions performance

**Expected:** Optimized for sports performance

#### Test: Muscle Building Goal

1. Set goal to "muscle"
2. Generate guidance
3. Verify slight calorie surplus
4. Verify adequate protein
5. Verify rationale mentions muscle building

**Expected:** Surplus calories for growth

#### Test: Fat Loss Goal

1. Set goal to "fat-loss"
2. Generate guidance
3. Verify calories reduced by 300-500
4. Verify higher protein (1.2g per lb)
5. Verify rationale mentions fat loss

**Expected:** Deficit with higher protein

#### Test: Toning Goal

1. Set goal to "toning"
2. Generate guidance
3. Verify maintenance calories
4. Verify moderate protein
5. Verify balanced macros

**Expected:** Maintenance-focused guidance

### 5. Soccer Game Day Adjustments

#### Test: Game Day Carb Bump

1. Set sport to soccer
2. Set day type to game
3. Generate guidance
4. Verify carbs are 400-500g range
5. Verify rationale mentions "soccer game"

**Expected:** Extra carbs for soccer game

#### Test: Game Timing

1. Mark game on calendar
2. Generate guidance
3. Verify pre-meal suggestions
4. Verify post-game recovery meals
5. Verify hydration increased

**Expected:** Game-specific timing and meals

### 6. Timing Guidance

#### Test: Pre-Workout Recommendations

1. Generate guidance for training day
2. Verify pre-workout meal example
3. Verify timing recommendation
4. Verify simple, actionable advice

**Expected:** Clear pre-workout guidance

#### Test: Post-Workout Recommendations

1. Generate guidance for training day
2. Verify post-workout meal example
3. Verify timing (within 30-60 min)
4. Verify protein + carbs focus

**Expected:** Clear post-workout guidance

#### Test: Rest Day Guidance

1. Generate guidance for rest day
2. Verify lighter meal examples
3. Verify reduced pre/post emphasis

**Expected:** Lighter recommendations for rest

### 7. Hydration Targets

#### Test: Daily Hydration

1. Generate guidance
2. Verify hydration target displayed
3. Verify target is 2.5-3.5L for most
4. Verify weight-adjusted

**Expected:** Daily hydration target provided

#### Test: Pre-Workout Hydration

1. Generate guidance for training day
2. Verify pre-workout hydration tip
3. Verify actionable (e.g., "500ml 1-2 hours before")

**Expected:** Pre-workout hydration advice

#### Test: Game Day Hydration

1. Generate guidance for game day
2. Verify increased hydration emphasis
3. Verify electrolyte considerations

**Expected:** Enhanced hydration for game

### 8. Meal Examples

#### Test: Meal Examples Provided

1. Generate guidance
2. Verify pre-workout meal example
3. Verify post-workout meal example
4. Verify examples are realistic

**Expected:** Practical meal suggestions

#### Test: Soccer-Specific Examples

1. Set sport to soccer
2. Generate guidance
3. Verify sport-relevant meal examples
4. Verify appropriate for athletes

**Expected:** Sport-appropriate meals

### 9. Rationale Display

#### Test: Rationale Explains Adjustments

1. Generate guidance
2. Verify rationale explains why targets are set
3. Verify mentions goal, day type, sport
4. Verify no tracking required message

**Expected:** Clear, educational rationale

#### Test: Updates with Day Changes

1. Generate guidance for training day
2. Note targets
3. Mark game on calendar
4. Regenerate guidance
5. Verify targets changed
6. Verify rationale updated

**Expected:** Dynamic updates based on context

### 10. Edge Cases

#### Test: Missing Profile Data

1. No profile data available
2. Generate guidance
3. Verify fallback guidance provided
4. Verify no errors

**Expected:** Graceful fallback

#### Test: Invalid Goal

1. Set invalid goal
2. Generate guidance
3. Verify defaults to performance goal
4. Verify no errors

**Expected:** Sensible defaults

#### Test: Extreme Weights

1. Very light weight (50kg)
2. Very heavy weight (150kg)
3. Generate guidance for both
4. Verify calculations are reasonable

**Expected:** Scales appropriately

## Definition of Done Checklist

### Core Functionality

- [ ] BMR calculated using Mifflin-St Jeor
- [ ] Goal adjustments applied (performance/muscle/fat-loss/toning)
- [ ] Day type adjustments work (rest/training/game)
- [ ] Soccer game day carb bump works
- [ ] Macros calculated correctly (P/C/F)

### Display

- [ ] Card shows on dashboard
- [ ] All macros visible (calories, protein, carbs, fat)
- [ ] Timing recommendations displayed
- [ ] Hydration targets shown
- [ ] Meal examples provided

### Dynamics

- [ ] Changes when day type changes
- [ ] Updates for game day
- [ ] Rationale explains changes
- [ ] No tracking required messaging

### Edge Cases

- [ ] Handles missing data gracefully
- [ ] Handles invalid inputs
- [ ] Scales for different body sizes
- [ ] Works for different goals

## Expected Behaviors

### Scenario 1: Training Day, Performance Goal

- **Day Type**: Training
- **Goal**: Performance
- **Expected Macros**: Maintenance calories, ~0.9g protein/lb
- **Rationale**: "Performance goal • Training day"

### Scenario 2: Soccer Game Day

- **Day Type**: Game
- **Sport**: Soccer
- **Expected Macros**: +20% calories, 400-500g carbs
- **Rationale**: "Game day • +20% for game • Soccer carb emphasis"

### Scenario 3: Rest Day, Fat Loss Goal

- **Day Type**: Rest
- **Goal**: Fat loss
- **Expected Macros**: -15% calories (rest) - 300 cals (deficit) = -500 total
- **Rationale**: "Fat loss deficit • Rest day adjustment"

## Known Issues

None at this time.

## Future Enhancements

- Meal timing schedule
- Shopping list generation
- Macro distribution throughout day
- Personalized meal suggestions
