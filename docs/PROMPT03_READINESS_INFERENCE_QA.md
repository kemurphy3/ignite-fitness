# Prompt 3 - Readiness Inference Manual QA Guide

## Overview
This document provides manual QA instructions for testing the Readiness Inference feature (Prompt 3).

## Implementation Summary

### Files Modified
- `js/modules/readiness/ReadinessInference.js` - Updated to new API signature
- `js/modules/ai/ExpertCoordinator.js` - Integrated readiness inference
- `tests/readiness/readiness-inference.test.js` - Unit tests

### Key Features
1. **Passive Readiness Inference**: Infers readiness when user skips check-in
2. **Multi-Factor Analysis**: Considers RPE, volume, schedule, back-to-back days
3. **Intensity Scaling**: Applies 0.85x intensity when readiness inferred as low
4. **Rationale Included**: Explains why readiness was inferred
5. **Zero-Input Friendly**: Works without manual check-in

## Manual QA Instructions

### 1. Basic Inference Test

#### Test: Inference with No Check-In
1. Skip daily check-in
2. Generate workout plan
3. Verify plan includes "Readiness inferred" message
4. Verify readiness score is provided (1-10)
5. Verify rationale explains the inference

**Expected:** Plan generates successfully with inferred readiness score

#### Test: High RPE Lowers Readiness
1. Complete workout yesterday with RPE 9
2. Skip today's check-in
3. Generate new plan
4. Verify readiness score is lower (5-6 instead of 7)
5. Verify rationale mentions "intense session"

**Expected:** Lower readiness after hard session

#### Test: Light Session Increases Readiness
1. Complete workout yesterday with RPE 4
2. Skip today's check-in
3. Generate new plan
4. Verify readiness score is higher (8 instead of 7)
5. Verify rationale mentions "light session"

**Expected:** Higher readiness after easy session

### 2. Schedule-Based Inference

#### Test: Game Soon Reduces Readiness
1. Set schedule with game tomorrow
2. Skip check-in
3. Generate plan
4. Verify readiness score reduced
5. Verify rationale mentions "Game very soon"

**Expected:** Lower readiness before important game

#### Test: Normal Schedule = Normal Readiness
1. No upcoming games
2. Skip check-in
3. Generate plan
4. Verify default moderate readiness (7)
5. Verify no game-related rationale

**Expected:** Default moderate readiness when nothing special

### 3. Intensity Scaling

#### Test: Inferred Low Readiness Scales Intensity
1. Provide context with no readiness (undefined)
2. Mock history with high RPE sessions
3. Generate plan
4. Verify intensityScale is reduced (0.85x of normal)
5. Verify rationale includes "Intensity reduced due to inferred low readiness"

**Expected:** Intensity automatically scaled down for safety

#### Test: Inferred Normal Readiness Uses Normal Intensity
1. Provide context with no readiness
2. Mock history with moderate RPE sessions
3. Generate plan
4. Verify intensityScale is normal (not reduced)
5. Verify normal program execution

**Expected:** Normal intensity when readiness is moderate

### 4. Rationale Generation

#### Test: Multi-Factor Rationale
1. Skip check-in
2. Provide context with:
   - High RPE yesterday (8+)
   - Game in 2 days
   - Back-to-back training
3. Generate plan
4. Verify rationale includes multiple factors
5. Verify rationale is clear and actionable

**Expected:** Comprehensive rationale with all relevant factors

#### Test: Single Factor Rationale
1. Skip check-in
2. Provide context with only moderate RPE
3. Generate plan
4. Verify rationale is concise
5. Verify no unnecessary factors

**Expected:** Simple rationale when only one factor applies

### 5. Edge Cases

#### Test: No History Data
1. Skip check-in with no workout history
2. Generate plan
3. Verify uses default moderate readiness (7)
4. Verify rationale says "default"

**Expected:** Graceful fallback to default

#### Test: Very High RPE History
1. History shows RPE 10 for last 3 sessions
2. Skip check-in
3. Generate plan
4. Verify readiness very low (3-4)
5. Verify significant intensity reduction

**Expected:** Conservative approach to high fatigue

#### Test: Very Low RPE History
1. History shows RPE 3-4 for last week
2. Skip check-in
3. Generate plan
4. Verify readiness higher than normal (8-9)
5. Verify can handle higher intensity

**Expected:** Optimistic approach when well-rested

### 6. Integration with Expert Coordinator

#### Test: Coordinator Uses Inference
1. Call ExpertCoordinator.planToday() without readiness in context
2. Verify inference is automatically called
3. Verify plan uses inferred readiness
4. Verify plan is scaled appropriately

**Expected:** Seamless integration with planning system

#### Test: Coordinator Prefers Explicit Check-In
1. Provide context with explicit readiness (e.g., 8)
2. Call planToday()
3. Verify inference is NOT called
4. Verify uses provided readiness value

**Expected:** Explicit check-in always takes precedence

### 7. Performance

#### Test: Inference Speed
1. Measure time to infer readiness with 7 days of history
2. Verify completes in < 100ms
3. Verify no UI lag

**Expected:** Fast inference, no perceptible delay

#### Test: Memory Usage
1. Run inference multiple times in session
2. Monitor memory usage
3. Verify no memory leaks

**Expected:** Stable memory usage

## Definition of Done Checklist

### Inference Functionality
- [ ] Returns readiness score (1-10)
- [ ] Returns inferred: true flag
- [ ] Provides rationale
- [ ] Considers yesterday's RPE
- [ ] Considers volume trends
- [ ] Considers game proximity
- [ ] Considers back-to-back days

### Integration
- [ ] ExpertCoordinator calls inference when needed
- [ ] Intensity scaling applied for low inferred readiness
- [ ] Rationale added to plan output
- [ ] Explicit check-in takes precedence

### Edge Cases
- [ ] Handles no history gracefully
- [ ] Handles missing data gracefully
- [ ] Clamps scores to 1-10 range
- [ ] Returns sensible defaults

### Performance
- [ ] Fast execution (<100ms)
- [ ] No memory leaks
- [ ] No UI blocking

## Expected Outcomes

### Scenario 1: High RPE Yesterday
- **Input**: RPE 9 yesterday, no check-in today
- **Expected Readiness**: 5-6
- **Rationale**: "Yesterday's session was intense (RPE ≥8)"
- **Intensity Scale**: Reduced (0.85x if < 7)

### Scenario 2: Game Tomorrow
- **Input**: Game in 1 day, no check-in
- **Expected Readiness**: 6
- **Rationale**: "Game very soon"
- **Intensity Scale**: May be reduced

### Scenario 3: Light Week
- **Input**: RPE 4-5 for past week, no check-in
- **Expected Readiness**: 8
- **Rationale**: "Yesterday's session was light"
- **Intensity Scale**: Normal or slightly higher

### Scenario 4: No Data
- **Input**: No history, no check-in
- **Expected Readiness**: 7
- **Rationale**: "Default moderate readiness"
- **Intensity Scale**: Normal (0.9-1.0)

## Known Issues

None at this time.

## Future Enhancements

- Learn from user patterns over time
- Incorporate weather/external factors
- Consider meal timing for readiness
- Predict readiness multiple days ahead

