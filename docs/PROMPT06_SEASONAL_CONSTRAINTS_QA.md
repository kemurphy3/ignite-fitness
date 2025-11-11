# Prompt 6 - Seasonal Constraints Manual QA Guide

## Overview

This document provides manual QA instructions for testing the Seasonal
Constraints feature (Prompt 6).

## Implementation Summary

### Files Modified

- `js/modules/sports/SeasonalPrograms.js` - Added getSeasonContext() and
  seasonal rules
- `js/modules/ai/ExpertCoordinator.js` - Integrated seasonal context into
  planning
- `tests/sports/seasonal-constraints.test.js` - Unit tests

### Key Features

1. **Seasonal Phase Detection**: Off, Pre, In, Post seasons
2. **Weekly Deload**: Every 4th week deload (-20% volume)
3. **Game Proximity Rules**: Suppress heavy lower 24-48h pre-game
4. **Phase-Specific Emphasis**: Off-season strength, pre-season prep, in-season
   maintenance
5. **Context-Driven Planning**: Plans adjust based on season and game schedule

## Manual QA Instructions

### 1. Seasonal Phase Detection

#### Test: Off-Season Detection

1. Set user profile season to "off" or current date to winter (Dec-Feb)
2. Generate workout plan
3. Verify phase shows "Off-Season"
4. Verify emphasis is "strength power development"
5. Verify rationale mentions "Off-season: Emphasize strength blocks"

**Expected:** Phase detected and emphasis applied

#### Test: Pre-Season Detection

1. Set season to "pre" or current date to spring (Mar-May)
2. Generate workout plan
3. Verify phase shows "Pre-Season"
4. Verify emphasis is "sport-specific preparation"
5. Verify rationale mentions pre-season prep

**Expected:** Pre-season phase detected

#### Test: In-Season Detection

1. Set season to "in" or current date to fall/summer
2. Generate workout plan
3. Verify phase shows "In-Season"
4. Verify emphasis is "performance maintenance"
5. Verify rationale mentions in-season focus

**Expected:** In-season phase detected

#### Test: Post-Season Detection

1. Set season to "post"
2. Generate workout plan
3. Verify phase shows "Post-Season"
4. Verify emphasis is "recovery regeneration"
5. Verify rationale mentions recovery and reduced intensity

**Expected:** Post-season phase detected

### 2. Deload Week Detection

#### Test: Deload Week 4

1. Set calendar to week 4 of block
2. Generate workout plan
3. Verify "Deload week: -20% volume for recovery" in rationale
4. Verify volume is reduced (intensityScale < 1.0)
5. Verify exercises are lighter

**Expected:** Deload applied automatically

#### Test: Progressive Weeks 1-3

1. Set calendar to week 1-3
2. Generate workout plan
3. Verify NO deload message
4. Verify normal volume (intensityScale = 1.0)
5. Verify progressive loading

**Expected:** Normal progression weeks 1-3

### 3. Game Proximity Rules

#### Test: Game Tomorrow in In-Season

1. Set season to in-season
2. Set calendar with game tomorrow
3. Generate workout plan
4. Verify "Game tomorrow: Reduced lower body volume" in rationale
5. Verify no heavy lower body exercises
6. Verify only upper body light work
7. Verify intensity is reduced

**Expected:** Heavy lower body suppressed 24h before game

#### Test: Game Day After Tomorrow in In-Season

1. Set season to in-season
2. Set calendar with game in 2 days
3. Generate workout plan
4. Verify "Game within 48h: Lightening load" in rationale
5. Verify lower body volume reduced
6. Verify less intense exercises

**Expected:** Load lightened within 48h of game

#### Test: No Game in Off-Season

1. Set season to off-season
2. Set calendar with game tomorrow
3. Generate workout plan
4. Verify game proximity rules NOT applied
5. Verify normal heavy lower body work
6. Verify NO game-related rationale

**Expected:** Game rules only apply in-season

### 4. Phase-Specific Emphasis

#### Test: Off-Season Emphasis

1. Set season to off-season
2. Generate workout plan
3. Verify strength-focused exercises
4. Verify higher volume allowed
5. Verify rationale mentions "strength power development"

**Expected:** Strength focus in off-season

#### Test: Pre-Season Emphasis

1. Set season to pre-season
2. Generate workout plan
3. Verify sport-specific exercises
4. Verify balance of strength and conditioning
5. Verify rationale mentions "sport specific preparation"

**Expected:** Sport-specific prep in pre-season

#### Test: In-Season Emphasis

1. Set season to in-season
2. Generate workout plan
3. Verify maintenance-focused plan
4. Verify respect for game schedule
5. Verify rationale mentions "performance maintenance"

**Expected:** Maintenance focus in-season

### 5. Integration with ExpertCoordinator

#### Test: Coordinator Uses Season Context

1. Generate workout with profile and calendar
2. Verify plan includes seasonal rationale
3. Verify seasonal constraints applied
4. Verify no console errors

**Expected:** Seamless integration

#### Test: Seasonal + Readiness Combined

1. Set readiness low (4)
2. Set season context in-season
3. Generate plan
4. Verify BOTH factors in rationale
5. Verify appropriate volume reduction

**Expected:** Multiple factors combined correctly

### 6. Edge Cases

#### Test: Week 4 + Game Tomorrow

1. Set to week 4 of block
2. Set game tomorrow
3. Generate workout
4. Verify deload still applied
5. Verify game proximity still respected
6. Verify rationale mentions both

**Expected:** All rules applied simultaneously

#### Test: Post-Season + Low Readiness

1. Set season to post-season
2. Set readiness to 4
3. Generate workout
4. Verify recovery-focused plan
5. Verify significant volume reduction
6. Verify rationale explains recovery priority

**Expected:** Maximum recovery in post-season

## Definition of Done Checklist

### Seasonal Phase

- [ ] Off-season detected and applied
- [ ] Pre-season detected and applied
- [ ] In-season detected and applied
- [ ] Post-season detected and applied
- [ ] Phase-specific emphasis correct

### Deload Week

- [ ] Week 4 triggers deload
- [ ] -20% volume applied on deload
- [ ] Week 1-3 no deload
- [ ] Rationale includes deload note

### Game Proximity

- [ ] Game tomorrow suppresses heavy lower
- [ ] Game within 48h suppresses heavy lower
- [ ] Game rules only apply in-season
- [ ] Rationale mentions game proximity

### Integration

- [ ] ExpertCoordinator uses season context
- [ ] Rationale includes phase and week
- [ ] Volume modifiers applied correctly
- [ ] No console errors

## Expected Behaviors

### Scenario 1: In-Season Week 4 with Game Tomorrow

- **Phase**: In-Season
- **Week**: 4 (Deload)
- **Game**: Tomorrow
- **Expected**:
  - Deload: -20% volume
  - Game proximity: Suppress heavy lower
  - Rationale: "In-Season (Week 4 of 4)", "Deload week: -20% volume for
    recovery", "Game tomorrow: Reduced lower body volume"

### Scenario 2: Off-Season Week 2

- **Phase**: Off-Season
- **Week**: 2 (No deload)
- **Expected**:
  - Normal or higher volume
  - Strength emphasis
  - Rationale: "Off-Season (Week 2 of 4)", "Focus: strength power development"

### Scenario 3: Pre-Season Week 1

- **Phase**: Pre-Season
- **Week**: 1 (No deload)
- **Expected**:
  - Sport-specific exercises
  - Balanced load
  - Rationale: "Pre-Season (Week 1 of 4)", "Focus: sport specific preparation"

## Known Issues

None at this time.

## Future Enhancements

- Custom season calendars per sport
- Multi-sport athlete support
- Competition peaking protocols
- Return-to-play progression schedules
