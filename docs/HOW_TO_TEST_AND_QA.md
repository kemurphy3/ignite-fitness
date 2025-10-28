# How to Test and QA the Expert Coordinator

## Quick Commands

### Run Automated Tests
```bash
# Windows
npm test

# Or use the script
run-expert-coordinator-tests.bat

# Mac/Linux
./run-expert-coordinator-tests.sh
```

### Run Manual QA in Browser
1. Open `index.html` in your browser
2. Open browser console (F12)
3. Run: `runExpertCoordinatorTests()`

## Test Coverage

### ✅ Automated Tests (10 tests total)

All tests in `tests/ai/expertCoordinator.spec.js`:
1. Game tomorrow removes heavy lower body
2. Low readiness scales intensity
3. Time-crunched uses supersets
4. Knee pain provides safe alternatives
5. Simple mode has minimal blocks (1-2)
6. Plan structure validation
7. Priority order enforcement
8. Warnings generation
9. Aesthetic focus integration
10. SafeLogger calls

### ✅ Manual QA Scenarios

#### Scenario 1: Game Tomorrow
**Test:** Heavy lower body removed, rationale mentions game
**How:** Set `schedule.daysUntilGame = 1`

#### Scenario 2: Low Readiness
**Test:** Volume and intensity reduced
**How:** Set `readiness = 3`

#### Scenario 3: Time-Crunched
**Test:** Plan shrinks, supersets appear
**How:** Set `constraints.timeLimit = 20`

#### Scenario 4: Knee Pain
**Test:** No BSS, safe alternatives provided
**How:** Set `constraints.flags = ['knee_pain']`

#### Scenario 5: Simple Mode
**Test:** 1-2 blocks maximum
**How:** Set `preferences.trainingMode = 'simple'`

## Expected Output

### Valid Plan Structure
```javascript
{
    blocks: [
        {
            name: 'Warm-up',
            items: [
                {
                    name: 'Dynamic Stretches',
                    sets: 1,
                    reps: '10',
                    targetRPE: 5,
                    notes: 'Light movement preparation',
                    category: 'warmup'
                }
            ],
            durationMin: 10
        },
        {
            name: 'Main',
            items: [
                {
                    name: 'Back Squat',
                    sets: 3,
                    reps: '8-10',
                    targetRPE: 7,
                    notes: 'Main strength movement',
                    category: 'squat'
                }
            ],
            durationMin: 24
        }
    ],
    intensityScale: 0.9,  // Between 0.6 and 1.1
    why: [
        'Dynamic warm-up prepares movement patterns',
        'Main movements target strength and power'
    ],
    warnings: undefined  // Or array of warnings if constraints exist
}
```

## SafeLogger Output

Each planToday() call emits:
```javascript
SafeLogger.info('Coordinator decision', {
    readiness: 8,
    mode: 'simple',
    gameDay: false
})
```

## Troubleshooting

### Tests Fail
- Ensure all modules loaded: `ExpertCoordinator`, `ExerciseAdapter`, `SafeLogger`
- Check browser console for errors
- Verify context object has all required fields

### No Plans Generated
- Check expert coaches are loaded (`StrengthCoach`, `SportsCoach`, etc.)
- Verify `gatherProposals()` returns valid data
- Check conflict resolution logic

### Incorrect Constraints
- Verify `resolveConflicts()` handles all constraint types
- Check that alternates are being called from `ExerciseAdapter.getAlternates()`
- Ensure priority order is respected

## CI/CD Integration

Tests run automatically in CI:
```yaml
# Example GitHub Actions
- name: Run tests
  run: npm test
```

## Coverage Report

View coverage report:
```bash
npm run test:coverage
# Open: coverage/index.html
```

