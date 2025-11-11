# Prompt 4 - Weight Math (Alternates + Real Gym Math) Manual QA Guide

## Overview

This document provides manual QA instructions for testing the Weight Math
feature (Prompt 4).

## Implementation Summary

### Files Created/Modified

- `js/modules/workout/WeightMath.js` - Plate math calculations
- `js/modules/workout/WorkoutTracker.js` - Integrated formatWeightInstruction
- `index.html` - Added WeightMath script
- `tests/workout/weightMath.test.js` - Unit tests

### Key Features

1. **Real Gym Math**: Converts target weights to achievable plate combinations
2. **Equipment Awareness**: Honors available plates from user preferences
3. **Plate Loading Instructions**: "Load 45 lb bar + 35 + 10 + 2.5 per side →
   135 lb total"
4. **Rounding Logic**: Handles impossible loads by rounding to nearest
   achievable
5. **Missing Plate Handling**: Suggests alternatives when plates unavailable
6. **No Decimals**: All weights shown as practical loading instructions

## Manual QA Instructions

### 1. Basic Weight Display

#### Test: Exact Load with 2.5s

1. Set equipment to US with all plates [45, 35, 25, 10, 5, 2.5]
2. Enter target weight: 135 lbs
3. Verify instruction: "Load 45 lb bar + 45 per side → 135 lb total"
4. Verify NO decimal weights shown

**Expected:** Exact match with clear loading instructions

#### Test: Exact Load Metric

1. Set equipment to Metric with all plates [20, 15, 10, 5, 2.5, 1.25]
2. Enter target weight: 100 kg
3. Verify instruction shows kg
4. Verify plate breakdown is correct

**Expected:** Metric calculations work correctly

### 2. Rounding Behavior

#### Test: Rounding Without 2.5s

1. Set equipment WITHOUT 2.5 lb plates
2. Enter target weight: 137.5 lbs
3. Verify rounds to nearest achievable (135 or 140)
4. Verify note explains rounding
5. Verify instruction shows achievable weight

**Expected:** Rounds intelligently and explains why

#### Test: Impossible Exact Weight

1. Enter target weight: 133.7 lbs
2. Verify rounds to 135 lbs (nearest achievable)
3. Verify shows both target and actual
4. Verify note explains the difference

**Expected:** Handles decimal targets gracefully

### 3. Equipment Availability

#### Test: Missing Standard Plates

1. Remove 25 lb plates from available equipment
2. Enter target weight: 135 lbs
3. Verify suggests alternative loading
4. Verify uses only available plates
5. Verify instruction still works

**Expected:** Adapts to available equipment

#### Test: Minimal Plate Set

1. Set available plates: [45, 25, 10, 5]
2. Enter various target weights
3. Verify all instructions are achievable
4. Verify never suggests unavailable plates

**Expected:** Works with limited equipment

### 4. Edge Cases

#### Test: Weight Less Than Bar

1. Enter target weight: 30 lbs
2. Verify instruction: "Load 45 lb bar only"
3. Verify warns that weight is less than bar

**Expected:** Handles below-bar weights

#### Test: Exactly Bar Weight

1. Enter target weight: 45 lbs
2. Verify instruction: "Load 45 lb bar only"
3. Verify no plates suggested

**Expected:** Recognizes empty bar

#### Test: Very Heavy Loads

1. Enter target weight: 500 lbs
2. Verify calculates correct plate combination
3. Verify instruction is readable and correct
4. Verify no calculation errors

**Expected:** Handles high loads correctly

### 5. Format Consistency

#### Test: No Decimals in Display

1. Generate workout plan with various weights
2. Verify NO decimal numbers appear
3. Verify ALL weights use "Load X lb bar + plates per side" format
4. Verify total always shown

**Expected:** 100% decimal-free displays

#### Test: Consistent Format

1. View multiple exercises in workout
2. Verify ALL use same instruction format
3. Verify consistent formatting across exercise types

**Expected:** Uniform formatting everywhere

### 6. Integration with Workout

#### Test: Weight in Exercise Display

1. View workout with exercises
2. Verify loading instructions appear for all weighted exercises
3. Verify no decimal targets shown

**Expected:** Seamless integration with workout flow

#### Test: Weight Updates with Equipment Changes

1. Change equipment preferences
2. Verify workout weights update immediately
3. Verify no stale data

**Expected:** Real-time equipment awareness

### 7. Metric vs US

#### Test: US Mode

1. Set to US pounds
2. Verify all weights in lbs
3. Verify plates: [45, 35, 25, 10, 5, 2.5]

**Expected:** US calculations correct

#### Test: Metric Mode

1. Set to Metric kg
2. Verify all weights in kg
3. Verify plates: [20, 15, 10, 5, 2.5, 1.25]
4. Verify 20 kg bar used

**Expected:** Metric calculations correct

### 8. Alternative Suggestions

#### Test: Missing Plate Suggestion

1. Remove 2.5 lb plates
2. Enter target requiring 2.5s
3. Verify suggests alternative loading
4. Verify uses closest achievable combination

**Expected:** Helpful alternatives when plates missing

#### Test: Multiple Missing Plates

1. Remove 2.5 and 5 lb plates
2. Enter various targets
3. Verify still calculates achievable loads
4. Verify never suggests unavailable plates

**Expected:** Works even with limited plates

## Definition of Done Checklist

### Core Functionality

- [ ] Exact loads calculated with all plates available
- [ ] Rounding works when exact match impossible
- [ ] Equipment availability honored
- [ ] Alternative suggestions provided
- [ ] No decimal weights in display

### Format

- [ ] All weights show as "Load X bar + plates per side → total"
- [ ] Consistent format across all exercises
- [ ] Clear and readable instructions
- [ ] Total weight always displayed

### Edge Cases

- [ ] Handles weights below bar
- [ ] Handles exactly bar weight
- [ ] Handles very heavy loads
- [ ] Handles missing equipment gracefully

### Integration

- [ ] Works in workout view
- [ ] Updates with equipment changes
- [ ] No stale data
- [ ] Seamless user experience

### Metric/US Support

- [ ] US calculations correct
- [ ] Metric calculations correct
- [ ] Proper unit display
- [ ] Correct plate sets for each

## Expected Outcomes

### Scenario 1: Exact Load

- **Target**: 135 lbs with all plates available
- **Output**: "Load 45 lb bar + 45 per side → 135 lb total"
- **Exact**: true

### Scenario 2: Rounded Load

- **Target**: 137.5 lbs without 2.5 lb plates
- **Output**: "Load 45 lb bar + 45 per side → 135 lb total" or "140 lb total"
- **Note**: "Rounded from 137.5 lbs to [actual]"
- **Exact**: false

### Scenario 3: Heavy Load

- **Target**: 315 lbs (3 plates per side)
- **Output**: "Load 45 lb bar + 45 + 35 + 25 per side → 315 lb total"
- **Exact**: true

### Scenario 4: Minimal Equipment

- **Target**: 135 lbs
- **Available**: [45, 25, 10] only
- **Output**: "Load 45 lb bar + 45 per side → 135 lb total"
- **Note**: "Alternative plate combination used"

## Known Issues

None at this time.

## Future Enhancements

- Save favorite plate combinations
- Quick plate calculator tool
- Plate inventory tracking
- Suggested plate purchases for gyms
