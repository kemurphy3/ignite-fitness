# Expert Coordinator Testing Guide

## Quick Start

### 1. Run NPM Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run in UI mode (interactive)
npm run test:ui
```

## Manual QA Checklist

### Setup

1. Open `index.html` in browser
2. Open browser console (F12)
3. Ensure all modules are loaded

### Test: Game Tomorrow

**Steps:**

1. In browser console, run:

```javascript
const coordinator = new ExpertCoordinator();
const context = {
  user: { sport: 'soccer', position: 'midfielder' },
  season: 'in-season',
  schedule: {
    upcomingGames: [
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
    ],
    daysUntilGame: 1,
  },
  readiness: 8,
  preferences: { trainingMode: 'simple' },
  constraints: { timeLimit: 45, flags: ['game_safety'] },
};

const plan = await coordinator.planToday(context);
console.log(plan);
```

**Expected:**

- ✅ No heavy lower body exercises (squats, deadlifts)
- ✅ Rationale mentions "game tomorrow" or similar
- ✅ Intensity or volume reduced
- ✅ Warnings include game-related note

### Test: Low Readiness

**Steps:**

```javascript
const context = {
  user: { sport: 'soccer', position: 'midfielder' },
  season: 'in-season',
  schedule: { upcomingGames: [] },
  readiness: 3, // Low readiness
  preferences: { trainingMode: 'simple' },
  constraints: { timeLimit: 45, flags: [] },
};

const plan = await coordinator.planToday(context);
console.log(plan);
```

**Expected:**

- ✅ `intensityScale < 0.85` (reduced intensity)
- ✅ Rationale mentions "readiness" or "recovery"
- ✅ Warnings include "Low readiness" message
- ✅ Volume reduced (fewer sets/exercises)

### Test: Time-Crunched (20 min)

**Steps:**

```javascript
const context = {
  user: { sport: 'soccer', position: 'midfielder' },
  season: 'in-season',
  schedule: { upcomingGames: [] },
  readiness: 8,
  preferences: { trainingMode: 'simple', sessionLength: 20 },
  constraints: { timeLimit: 20, flags: [] },
};

const plan = await coordinator.planToday(context);
console.log(plan);
```

**Expected:**

- ✅ Total duration ≤ 25 minutes
- ✅ Superset mentioned in notes or rationale
- ✅ Reduced accessories/finishers
- ✅ Rationale mentions "time" or "efficient"

### Test: Knee Pain

**Steps:**

```javascript
const context = {
  user: { sport: 'soccer', position: 'midfielder' },
  season: 'in-season',
  schedule: { upcomingGames: [] },
  readiness: 8,
  preferences: { trainingMode: 'simple' },
  constraints: { timeLimit: 45, flags: ['knee_pain'], painLocation: 'knee' },
};

const plan = await coordinator.planToday(context);
console.log(plan);
```

**Expected:**

- ✅ NO Bulgarian Split Squats in any block
- ✅ Exercises include safe alternatives (Walking Lunges, etc.)
- ✅ Rationale mentions "safe" or "knee"
- ✅ Notes mention alternative exercises

### Test: Simple Mode

**Steps:**

```javascript
const context = {
  user: { sport: 'soccer', position: 'midfielder' },
  season: 'in-season',
  schedule: { upcomingGames: [] },
  readiness: 8,
  preferences: { trainingMode: 'simple' },
  constraints: { timeLimit: 45, flags: [] },
};

const plan = await coordinator.planToday(context);
console.log(plan);
```

**Expected:**

- ✅ `plan.blocks.length <= 2`
- ✅ Only Warm-up + Main (or just Main)
- ✅ No complex accessories
- ✅ Streamlined for quick execution

### Test: Aesthetic Focus

**Steps:**

```javascript
const context = {
  user: { sport: 'soccer', position: 'midfielder' },
  season: 'in-season',
  schedule: { upcomingGames: [] },
  readiness: 8,
  preferences: { trainingMode: 'advanced', aestheticFocus: 'v_taper' },
  constraints: { timeLimit: 45, flags: [] },
};

const plan = await coordinator.planToday(context);
console.log(plan);
```

**Expected:**

- ✅ Accessories block present
- ✅ Exercises include V-taper work (lateral raises, lat pulldowns, etc.)
- ✅ Rationale mentions aesthetic focus

## Using the Standalone Test Script

1. Open `index.html` in browser
2. Open browser console (F12)
3. The test script should be loaded automatically
4. Run:

```javascript
runExpertCoordinatorTests();
```

This will run all 5 tests automatically and report results.

## Checking SafeLogger Output

In browser console, you should see:

```
SafeLogger.info('Coordinator decision', {
    readiness: 8,
    mode: 'simple',
    gameDay: false
})
```

## Definition of Done Checklist

- [ ] All automated tests pass (`npm test`)
- [ ] Coordinator returns valid plan with non-empty `why` in all contexts
- [ ] No console errors
- [ ] SafeLogger emits 1 info line per planning call
- [ ] Blocks render without UI changes elsewhere
- [ ] Manual QA confirms all constraint scenarios work correctly

## Troubleshooting

### "ExpertCoordinator not loaded"

**Solution:** Ensure `ExpertCoordinator.js` is included in `index.html`

### "ExerciseAdapter not loaded"

**Solution:** Ensure `ExerciseAdapter.js` is included in `index.html`

### "TypeError: Cannot read property..."

**Solution:** Check that context object has all required fields (user, schedule,
readiness, preferences, constraints)

### "Plan has empty blocks"

**Solution:** Verify expert coaches (StrengthCoach, SportsCoach, etc.) are
loaded and returning valid proposals
