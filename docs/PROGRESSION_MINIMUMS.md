# Exercise Progression Minimums

## Overview

Realistic weight progressions are exercise-specific. This system enforces
minimum progression increments per exercise type.

## Why This Matters

Different exercises require different progression increments:

- **Bench Press**: 2.5 lbs per side (one 2.5 plate each side) is realistic
- **Squat**: Minimum 5 lbs per side (even that's small - 10 lbs is more common)
- **Deadlift**: Minimum 10 lbs per side (difficult to control smaller
  increments)

## Current Rules

**IMPORTANT**: All minimums are **per side** (not total). Total change is always
2x the per-side amount.

### Lower Body Exercises (5-10 lbs minimum PER SIDE)

- **Squat**: 5 lbs per side = **10 lbs total** minimum
- **Back Squat**: 5 lbs per side = **10 lbs total** minimum
- **Front Squat**: 5 lbs per side = **10 lbs total** minimum
- **Bulgarian Split Squat**: 5 lbs per side = **10 lbs total** minimum
- **Deadlift**: 10 lbs per side = **20 lbs total** minimum
- **Romanian Deadlift**: 10 lbs per side = **20 lbs total** minimum
- **RDL**: 10 lbs per side = **20 lbs total** minimum
- **Leg Press**: 10 lbs per side = **20 lbs total** minimum

### Upper Body Exercises (2.5 lbs PER SIDE)

- **Bench Press**: 2.5 lbs per side = **5 lbs total** minimum
- **Bench**: 2.5 lbs per side = **5 lbs total** minimum
- **Overhead Press**: 2.5 lbs per side = **5 lbs total** minimum
- **OHP**: 2.5 lbs per side = **5 lbs total** minimum
- **Shoulder Press**: 2.5 lbs per side = **5 lbs total** minimum
- **Incline Bench**: 2.5 lbs per side = **5 lbs total** minimum
- **Dumbbell Press**: 2.5 lbs per side = **5 lbs total** minimum

### Accessory Exercises (2.5 lbs PER SIDE)

- **Curl**: 2.5 lbs per side = **5 lbs total** minimum
- **Bicep Curl**: 2.5 lbs per side = **5 lbs total** minimum
- **Tricep Extension**: 2.5 lbs per side = **5 lbs total** minimum
- **Lateral Raise**: 2.5 lbs per side = **5 lbs total** minimum
- **Rear Delt**: 2.5 lbs per side = **5 lbs total** minimum

### Default: 5 lbs per side = **10 lbs total**

## Examples

### Valid Progressions ✅

- **Bench Press**: 185 → 190 lbs = **5 lbs total** (2.5 per side × 2) ✅
- **Back Squat**: 225 → 235 lbs = **10 lbs total** (5 per side × 2) ✅
- **Deadlift**: 315 → 335 lbs = **20 lbs total** (10 per side × 2) ✅

### Invalid Progressions ❌

- **Back Squat**: 225 → 230 lbs = **5 lbs total** (only 2.5 per side) ❌
  - Too small for squat. Suggests 235 lbs instead (5 per side = 10 total).
- **Deadlift**: 315 → 325 lbs = **10 lbs total** (only 5 per side) ❌
  - Too small for deadlift. Suggests 335 lbs instead (10 per side = 20 total).

### Note on Squat Progression

- Minimum **5 lbs per side** = 10 lbs total
- This means at least one 5 lb plate on each side, or two 2.5 lb plates on each
  side
- Never add just one 2.5 lb plate total (1.25 lbs per side) for a squat

## Usage

```javascript
// Validate progression
const validation = weightMath.validateProgression(225, 235, 'Back Squat');
if (validation.isValid) {
  console.log('Valid!');
} else {
  console.log('Invalid:', validation.message);
  console.log('Suggestion:', validation.suggestion);
}

// Get minimum for exercise
const minProg = weightMath.getProgressionMin('Back Squat'); // Returns 5

// Suggest next realistic weight
const nextWeight = weightMath.suggestNextWeight(
  225,
  'Back Squat',
  availablePlates
);
```

## Future Improvements

- Learn from user behavior
- Adjust for experience level (beginners can use smaller increments)
- Support for custom plate sets
- Consider RPE in progression decisions
