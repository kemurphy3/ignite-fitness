# Cursor Prompt: Upgrade Ignite-Fitness with Expert AI Balance

## Task Overview
Update the ignite-fitness tracker (tracker.html) to implement a sophisticated multi-expert AI model that balances perspectives from different fitness professionals for optimal soccer performance and aesthetics.

## Expert System to Implement

### 1. Add Expert Weighting System
Replace the current plan generation with an expert consensus model:

```javascript
// Add this configuration object near line 1600
const EXPERT_SYSTEM = {
  weights: {
    soccerStrengthCoach: 0.30,    // Programming, periodization, game readiness
    physicalTherapist: 0.25,      // Injury prevention, movement quality, recovery
    personalTrainer: 0.20,        // Progressive overload, exercise form
    eliteSoccerCoach: 0.10,       // Performance transfer, energy systems
    nutritionist: 0.10,           // Recovery nutrition, game-day fueling
    aestheticsCoach: 0.05         // Hypertrophy methods, symmetry
  },
  
  priorities: {
    soccerStrengthCoach: ['power', 'rsa', 'fatigue_management', 'periodization'],
    physicalTherapist: ['acl_prevention', 'mobility', 'bilateral_balance', 'recovery'],
    personalTrainer: ['progressive_overload', 'form', 'consistency', 'adaptation'],
    eliteSoccerCoach: ['explosiveness', 'agility', 'endurance', 'game_readiness'],
    nutritionist: ['protein_timing', 'hydration', 'game_fuel', 'recovery_meals'],
    aestheticsCoach: ['hypertrophy', 'symmetry', 'definition', 'proportions']
  }
};
```

### 2. Fix Weight Progression Logic
Replace the current `calculateRealisticWeight` function (around line 3750) with:

```javascript
function calculateSmartWeightProgression(exerciseName, currentWeight, exerciseType, performance) {
  // Determine exercise equipment type
  const equipmentType = getEquipmentType(exerciseName);
  
  if (equipmentType === 'BARBELL') {
    return calculateBarbellProgression(currentWeight, performance);
  } else if (equipmentType === 'DUMBBELL') {
    return calculateDumbbellProgression(currentWeight, performance);
  } else if (equipmentType === 'CABLE' || equipmentType === 'MACHINE') {
    return calculateMachineProgression(currentWeight, performance);
  } else {
    return currentWeight; // Bodyweight exercises
  }
}

function getEquipmentType(exerciseName) {
  const barbellExercises = ['squat', 'deadlift', 'bench press', 'overhead press', 'barbell row', 'romanian deadlift', 'front squat'];
  const dumbbellExercises = ['db press', 'db row', 'dumbbell', 'db shoulder', 'db curl', 'db fly'];
  const cableExercises = ['cable', 'pulldown', 'pushdown', 'face pull'];
  const machineExercises = ['leg press', 'hack squat', 'smith machine'];
  
  const nameLower = exerciseName.toLowerCase();
  
  if (barbellExercises.some(ex => nameLower.includes(ex))) return 'BARBELL';
  if (dumbbellExercises.some(ex => nameLower.includes(ex))) return 'DUMBBELL';
  if (cableExercises.some(ex => nameLower.includes(ex))) return 'CABLE';
  if (machineExercises.some(ex => nameLower.includes(ex))) return 'MACHINE';
  if (nameLower.includes('bodyweight') || nameLower.includes('pull-up') || nameLower.includes('push-up')) return 'BODYWEIGHT';
  
  return 'BARBELL'; // Default
}

function calculateBarbellProgression(currentWeight, performance) {
  const barWeight = 45;
  
  // Ensure we start at minimum bar weight
  if (currentWeight < barWeight) currentWeight = barWeight;
  
  // Calculate weight on each side
  let perSide = (currentWeight - barWeight) / 2;
  
  // Standard plate combinations (per side)
  const plateCombos = {
    0: [],                    // 45 lbs (just bar)
    2.5: [2.5],              // 50 lbs 
    5: [5],                  // 55 lbs
    10: [10],                // 65 lbs
    12.5: [10, 2.5],         // 70 lbs
    15: [10, 5],             // 75 lbs
    20: [10, 10],            // 85 lbs
    25: [25],                // 95 lbs
    30: [25, 5],             // 105 lbs
    35: [35],                // 115 lbs
    40: [35, 5],             // 125 lbs
    45: [45],                // 135 lbs
    50: [45, 5],             // 145 lbs
    55: [45, 10],            // 155 lbs
    60: [45, 10, 5],         // 165 lbs
    65: [45, 10, 10],        // 175 lbs
    70: [45, 25],            // 185 lbs
    75: [45, 25, 5],         // 195 lbs
    80: [45, 35],            // 205 lbs
    85: [45, 35, 5],         // 215 lbs
    90: [45, 45],            // 225 lbs
  };
  
  // Find current plate setup
  const sortedWeights = Object.keys(plateCombos).map(Number).sort((a, b) => a - b);
  
  if (performance === 'ALL_REPS_COMPLETED') {
    // Find next weight up
    for (let i = 0; i < sortedWeights.length; i++) {
      if (sortedWeights[i] > perSide) {
        return barWeight + (sortedWeights[i] * 2);
      }
    }
    // If maxed out our combinations, add 10 lbs (5 per side)
    return currentWeight + 10;
  } else if (performance === 'MISSED_REPS') {
    // Find next weight down
    for (let i = sortedWeights.length - 1; i >= 0; i--) {
      if (sortedWeights[i] < perSide) {
        return barWeight + (sortedWeights[i] * 2);
      }
    }
    return barWeight; // Minimum is just the bar
  }
  
  return currentWeight; // No change
}

function calculateDumbbellProgression(currentWeight, performance) {
  // Dumbbells typically available: 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60...
  const availableWeights = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  
  if (performance === 'ALL_REPS_COMPLETED') {
    // Find next weight up
    for (let weight of availableWeights) {
      if (weight > currentWeight) return weight;
    }
    return currentWeight + 5; // If beyond our list, go up by 5
  } else if (performance === 'MISSED_REPS') {
    // Find next weight down
    for (let i = availableWeights.length - 1; i >= 0; i--) {
      if (availableWeights[i] < currentWeight) return availableWeights[i];
    }
    return 5; // Minimum
  }
  
  return currentWeight;
}

function calculateMachineProgression(currentWeight, performance) {
  // Most machines go in 10-15 lb increments
  const increment = 10;
  
  if (performance === 'ALL_REPS_COMPLETED') {
    return currentWeight + increment;
  } else if (performance === 'MISSED_REPS') {
    return Math.max(10, currentWeight - increment);
  }
  
  return currentWeight;
}
```

### 3. Implement Mandatory Core Work
Update the `getGoalOrientedExercises` function (around line 3507) to ALWAYS include core:

```javascript
function getGoalOrientedExercises(sessionType, goals, baseline, weekNum) {
  const exercises = getBaseExercises(sessionType, goals, baseline, weekNum);
  
  // ALWAYS add core work (not optional)
  const coreWork = generateCoreWork(sessionType, weekNum);
  
  // Core goes at the end of the session
  return [...exercises, ...coreWork];
}

function generateCoreWork(sessionType, weekNum) {
  const coreRotations = [
    // Week 1: Stability focus
    [
      { name: 'Plank', sets: 3, reps: '30-45 sec', weight: 'Bodyweight', notes: 'Keep hips level' },
      { name: 'Dead Bugs', sets: 3, reps: '10 each side', weight: 'Bodyweight', notes: 'Slow and controlled' },
      { name: 'Bird Dogs', sets: 3, reps: '10 each side', weight: 'Bodyweight', notes: 'No rotation' }
    ],
    // Week 2: Anti-rotation focus
    [
      { name: 'Pallof Press', sets: 3, reps: '12 each side', weight: 'Light band', notes: 'Resist rotation' },
      { name: 'Side Plank', sets: 3, reps: '20-30 sec each', weight: 'Bodyweight', notes: 'Stack hips' },
      { name: 'Anti-Rotation Holds', sets: 3, reps: '20 sec each', weight: 'Light', notes: 'Stay square' }
    ],
    // Week 3: Dynamic/strength focus
    [
      { name: 'Russian Twists', sets: 3, reps: '20 total', weight: '10-15 lbs', notes: 'Control the movement' },
      { name: 'Hanging Knee Raises', sets: 3, reps: '10-12', weight: 'Bodyweight', notes: 'No swinging' },
      { name: 'Mountain Climbers', sets: 3, reps: '20 total', weight: 'Bodyweight', notes: 'Quick but controlled' }
    ],
    // Week 4: Power/athletic focus
    [
      { name: 'Medicine Ball Slams', sets: 3, reps: '10', weight: '15-20 lbs', notes: 'Full power' },
      { name: 'Bicycle Crunches', sets: 3, reps: '20 total', weight: 'Bodyweight', notes: 'Elbow to knee' },
      { name: 'Hollow Body Hold', sets: 3, reps: '20-30 sec', weight: 'Bodyweight', notes: 'Lower back pressed' }
    ]
  ];
  
  // Select based on week number
  const coreExercises = coreRotations[(weekNum - 1) % 4];
  
  // For lower body days, emphasize stability
  if (sessionType.toLowerCase().includes('lower')) {
    // Prioritize anti-rotation and stability
    return coreExercises.filter(ex => 
      ex.name.includes('Plank') || 
      ex.name.includes('Pallof') || 
      ex.name.includes('Dead Bug')
    ).slice(0, 2);
  }
  
  // For upper body days, can do more dynamic work
  return coreExercises.slice(0, 2);
}
```

### 4. Add Proper Warmup/Cooldown Templates
Add this before the workout display (around line 4000):

```javascript
function generateWarmupRoutine(sessionType, exercises) {
  const warmup = {
    general: [
      '🚶 Walk or bike: 3-5 minutes at easy pace',
      '💓 Goal: Elevate heart rate to 100-120 bpm'
    ],
    dynamic: [],
    activation: []
  };
  
  if (sessionType.toLowerCase().includes('upper')) {
    warmup.dynamic = [
      '🔄 Arm circles: 10 forward, 10 backward',
      '🏊 Arm swings: 10 across body each arm',
      '🤸 Band pull-aparts: 15-20 reps',
      '💪 Scapular wall slides: 10 reps'
    ];
    warmup.activation = [
      '🏋️ Empty bar bench press: 10 reps',
      '🚣 Light lat pulldowns: 10 reps',
      '⬆️ Light shoulder press: 10 reps'
    ];
  } else if (sessionType.toLowerCase().includes('lower')) {
    warmup.dynamic = [
      '🦵 Leg swings: 10 forward/back, 10 side to side each leg',
      '🔄 Hip circles: 10 each direction',
      '🚶 Walking knee hugs: 10 steps',
      '🦩 Walking quad stretch: 10 steps'
    ];
    warmup.activation = [
      '🦵 Bodyweight squats: 10 reps',
      '🌉 Glute bridges: 15 reps',
      '🎯 Clamshells: 10 each side',
      '🏋️ Empty bar squats: 10 reps (if squatting)'
    ];
  }
  
  // Add injury prevention
  warmup.injuryPrevention = [
    '⚠️ ACL Prevention: 5 single-leg balance holds (30 sec each)',
    '🦵 Ankle mobility: 10 circles each direction',
    '🔥 Core activation: 2×10 dead bugs'
  ];
  
  return warmup;
}

function generateCooldownRoutine(sessionType, exercises) {
  const cooldown = {
    immediate: [
      '🚶 Walk: 2-3 minutes at easy pace',
      '💨 Deep breathing: 5 breaths, 4 counts in, 6 counts out'
    ],
    stretches: [],
    optional: []
  };
  
  if (sessionType.toLowerCase().includes('upper')) {
    cooldown.stretches = [
      '🙆 Chest doorway stretch: 30 sec each side',
      '🦅 Eagle arms stretch: 30 sec each side',
      '🔄 Shoulder cross-body stretch: 30 sec each',
      '🙏 Tricep overhead stretch: 30 sec each'
    ];
    cooldown.optional = [
      '📍 Foam roll lats: 1 min each side',
      '📍 Foam roll upper back: 2 minutes',
      '🔨 Lacrosse ball shoulders: 1 min each'
    ];
  } else if (sessionType.toLowerCase().includes('lower')) {
    cooldown.stretches = [
      '🦵 Standing quad stretch: 30 sec each',
      '🦿 Standing hamstring stretch: 30 sec each',
      '🦴 Seated figure-4 stretch: 30 sec each',
      '📐 90-90 hip stretch: 30 sec each side'
    ];
    cooldown.optional = [
      '📍 Foam roll quads: 1 min each',
      '📍 Foam roll IT band: 1 min each',
      '📍 Foam roll calves: 1 min each',
      '🔨 Lacrosse ball glutes: 1 min each'
    ];
  }
  
  return cooldown;
}
```

### 5. Update Exercise Display
Modify the workout display function (around line 2600) to show warmup/cooldown:

```javascript
// In the displayDetailedWorkoutPlan function, add warmup/cooldown display:
dayHTML += `
  <div class="warmup-section" style="background: #1a4d2e; padding: 10px; border-radius: 5px; margin-bottom: 10px;">
    <h5 style="color: #4ade80;">🔥 Warmup (8-10 min)</h5>
    <div id="warmup-${dayId}"></div>
    <button onclick="showDetailedWarmup('${dayId}', '${session.sessionType}')" class="btn btn-small">Show Full Warmup</button>
  </div>
`;

// After exercises list
dayHTML += `
  <div class="cooldown-section" style="background: #1a3d4d; padding: 10px; border-radius: 5px; margin-top: 10px;">
    <h5 style="color: #60a5fa;">❄️ Cooldown (5-8 min)</h5>
    <div id="cooldown-${dayId}"></div>
    <button onclick="showDetailedCooldown('${dayId}', '${session.sessionType}')" class="btn btn-small">Show Full Cooldown</button>
  </div>
`;
```

### 6. Expert Consensus for Exercise Selection
Update exercise selection to use expert input:

```javascript
function selectExercisesWithExpertConsensus(sessionType, goals, week) {
  const expertVotes = {};
  
  // Each expert votes for exercises
  const votes = {
    soccerStrengthCoach: getSoccerCoachExercises(sessionType, week),
    physicalTherapist: getPhysioExercises(sessionType, week),
    personalTrainer: getPTExercises(sessionType, week),
    eliteSoccerCoach: getEliteCoachExercises(sessionType, week),
    aestheticsCoach: getAestheticsExercises(sessionType, week)
  };
  
  // Weight the votes
  const finalExercises = [];
  const exerciseScores = {};
  
  for (const [expert, exercises] of Object.entries(votes)) {
    const weight = EXPERT_SYSTEM.weights[expert];
    exercises.forEach(ex => {
      if (!exerciseScores[ex.name]) {
        exerciseScores[ex.name] = {
          score: 0,
          exercise: ex
        };
      }
      exerciseScores[ex.name].score += weight;
    });
  }
  
  // Sort by score and select top exercises
  const sorted = Object.values(exerciseScores).sort((a, b) => b.score - a.score);
  
  // Take top 4-5 main exercises + accessories
  const mainExercises = sorted.slice(0, 4);
  const accessories = sorted.slice(4, 6);
  
  return [...mainExercises.map(e => e.exercise), ...accessories.map(e => e.exercise)];
}
```

### 7. Remove Sprint/Agility from Gym Sessions
Update the gym workout generation to exclude field work:

```javascript
// In generateGymWorkout function, remove any exercises that require space:
function filterGymAppropriateExercises(exercises) {
  const fieldExercises = ['sprint', 'agility ladder', 'cone drills', 'shuttle run', 't-drill', 'broad jump'];
  
  return exercises.filter(ex => {
    const nameLower = ex.name.toLowerCase();
    return !fieldExercises.some(field => nameLower.includes(field));
  });
}

// Add separate field session generator
function generateFieldSession(goals, week) {
  return {
    type: 'Field Work',
    location: 'Track or field',
    exercises: [
      { name: 'Dynamic Warmup', sets: 1, reps: '5 min', notes: 'A-skips, B-skips, high knees' },
      { name: '20m Sprints', sets: 5, reps: '1', rest: '90 sec', notes: '75-85% effort' },
      { name: 'T-Drill', sets: 3, reps: '1', rest: '60 sec', notes: 'Focus on deceleration' },
      { name: '5-10-5 Shuttle', sets: 3, reps: '1', rest: '90 sec', notes: 'Change of direction' },
      { name: 'Cool down jog', sets: 1, reps: '5 min', notes: 'Easy pace' }
    ]
  };
}
```

## Implementation Instructions

1. **Backup current tracker.html** first
2. Apply these changes section by section
3. Test weight progression with different equipment types
4. Verify warmup/cooldown displays properly
5. Confirm core work appears in every session
6. Test that field work is separated from gym work

## Testing Checklist
- [ ] Barbell exercises only suggest achievable plate combinations
- [ ] Dumbbell exercises follow available weight increments
- [ ] Every session includes 2-3 core exercises
- [ ] Warmup appears before main work
- [ ] Cooldown appears after exercises
- [ ] No sprints/agility in gym sessions
- [ ] Expert consensus affects exercise selection
- [ ] Weight progression is realistic for each equipment type

## Visual Improvements to Add
```css
.expert-contribution {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #a0aec0;
  margin-top: 5px;
}

.expert-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.soccer-coach { background: #2563eb; }
.physio { background: #059669; }
.trainer { background: #7c3aed; }
.nutrition { background: #ea580c; }
.aesthetics { background: #e11d48; }
```

This will show which expert contributed each exercise, helping users understand the reasoning.

## 8. Add Adaptive Weight Progression Based on Performance
Add RPE (Rate of Perceived Exertion) tracking to each exercise:

```javascript
// Add to the exercise logging section (around line 5160)
function logExerciseWithPerformance(exerciseName, weight, reps, rpe) {
  const exerciseData = {
    name: exerciseName,
    weight: weight,
    reps: reps,
    rpe: rpe, // 1-10 scale
    timestamp: new Date()
  };
  
  // Calculate next session's weight based on performance
  const nextWeight = calculateAdaptiveProgression(exerciseData);
  
  return {
    current: exerciseData,
    nextRecommended: nextWeight
  };
}

function calculateAdaptiveProgression(exerciseData) {
  const { name, weight, reps, rpe } = exerciseData;
  const equipment = getEquipmentType(name);
  
  // RPE-based progression logic
  // RPE 6-7: Perfect, increase weight
  // RPE 8: Keep same weight
  // RPE 9-10: Too hard, decrease weight
  // RPE < 6: Too easy, bigger increase
  
  let adjustment = 'MAINTAIN';
  
  if (rpe <= 5) {
    adjustment = 'BIG_INCREASE'; // Was too easy
  } else if (rpe <= 7) {
    adjustment = 'SMALL_INCREASE'; // Sweet spot for progression
  } else if (rpe === 8) {
    adjustment = 'MAINTAIN'; // Good working weight
  } else {
    adjustment = 'DECREASE'; // Too heavy
  }
  
  // Also factor in whether they hit their reps
  const targetReps = getTargetReps(name); // From the program
  const repsAchieved = parseInt(reps);
  
  if (repsAchieved < targetReps && adjustment !== 'DECREASE') {
    adjustment = 'MAINTAIN'; // Missed reps, don't increase
  } else if (repsAchieved > targetReps && rpe < 8) {
    adjustment = 'SMALL_INCREASE'; // Did extra reps easily
  }
  
  return applyWeightAdjustment(weight, equipment, adjustment);
}

function applyWeightAdjustment(currentWeight, equipment, adjustment) {
  const adjustments = {
    BARBELL: {
      BIG_INCREASE: 10,    // 5 lbs per side
      SMALL_INCREASE: 5,   // 2.5 lbs per side (if available) or 10
      MAINTAIN: 0,
      DECREASE: -10
    },
    DUMBBELL: {
      BIG_INCREASE: 10,    // Jump 2 dumbbell sizes
      SMALL_INCREASE: 5,   // Next dumbbell up
      MAINTAIN: 0,
      DECREASE: -5
    },
    CABLE: {
      BIG_INCREASE: 20,    // 2 plates up
      SMALL_INCREASE: 10,  // 1 plate up
      MAINTAIN: 0,
      DECREASE: -10
    }
  };
  
  const change = adjustments[equipment][adjustment];
  let newWeight = currentWeight + change;
  
  // Ensure it's achievable with available equipment
  if (equipment === 'BARBELL') {
    newWeight = roundToPlateableWeight(newWeight);
  } else if (equipment === 'DUMBBELL') {
    newWeight = roundToDumbbellWeight(newWeight);
  }
  
  return Math.max(newWeight, getMinimumWeight(equipment));
}
```

Add RPE input to the workout logging interface:

```html
<!-- Add this to each exercise input section -->
<div class="rpe-input" style="margin-top: 10px;">
  <label style="font-size: 12px; color: #a0aec0;">How hard was this? (RPE)</label>
  <div style="display: flex; gap: 5px; margin-top: 5px;">
    <button onclick="setRPE(this, 6)" class="rpe-btn">6<br><span style="font-size: 10px;">Easy</span></button>
    <button onclick="setRPE(this, 7)" class="rpe-btn">7<br><span style="font-size: 10px;">Moderate</span></button>
    <button onclick="setRPE(this, 8)" class="rpe-btn">8<br><span style="font-size: 10px;">Hard</span></button>
    <button onclick="setRPE(this, 9)" class="rpe-btn">9<br><span style="font-size: 10px;">V.Hard</span></button>
    <button onclick="setRPE(this, 10)" class="rpe-btn">10<br><span style="font-size: 10px;">Max</span></button>
  </div>
  <small style="color: #68d391;">Next recommended: <span class="next-weight">Calculating...</span></small>
</div>

<style>
.rpe-btn {
  padding: 8px;
  background: #2d3748;
  border: 2px solid transparent;
  border-radius: 8px;
  color: #e2e8f0;
  cursor: pointer;
  text-align: center;
  flex: 1;
}
.rpe-btn:hover {
  background: #4a5568;
}
.rpe-btn.selected {
  border-color: #68d391;
  background: #22543d;
}
</style>
```

## 9. Add Smart Macro Calculator

Add a comprehensive macro calculator based on user stats and activity:

```javascript
// Add this new function for macro calculation
function calculatePersonalizedMacros(userData) {
  const {
    weight,        // in lbs
    height,        // in inches
    age,
    sex,
    activityLevel, // from workout frequency
    goals,         // primary goal
    soccerFrequency,
    liftingFrequency
  } = userData;
  
  // Calculate BMR using Mifflin-St Jeor equation
  let bmr;
  if (sex === 'male') {
    bmr = (10 * (weight * 0.453592)) + (6.25 * (height * 2.54)) - (5 * age) + 5;
  } else {
    bmr = (10 * (weight * 0.453592)) + (6.25 * (height * 2.54)) - (5 * age) - 161;
  }
  
  // Calculate TDEE with activity multiplier
  const activityMultipliers = {
    sedentary: 1.2,      // Little to no exercise
    light: 1.375,        // 1-3 days/week
    moderate: 1.55,      // 3-5 days/week
    active: 1.725,       // 6-7 days/week
    veryActive: 1.9      // Twice daily or very intense
  };
  
  // Calculate actual activity level from workouts
  const totalSessions = parseInt(soccerFrequency || 0) + parseInt(liftingFrequency || 0);
  let activityMultiplier;
  
  if (totalSessions <= 2) activityMultiplier = activityMultipliers.light;
  else if (totalSessions <= 4) activityMultiplier = activityMultipliers.moderate;
  else if (totalSessions <= 6) activityMultiplier = activityMultipliers.active;
  else activityMultiplier = activityMultipliers.veryActive;
  
  // Account for soccer's higher calorie burn
  const soccerBonus = (soccerFrequency || 0) * 100; // Extra 100 cal per soccer session
  
  const tdee = (bmr * activityMultiplier) + soccerBonus;
  
  // Adjust calories based on goal
  let targetCalories = tdee;
  const goalAdjustments = {
    'muscle_gain': tdee + 300,      // Lean bulk
    'strength': tdee + 200,          // Slight surplus
    'endurance': tdee,               // Maintenance
    'fat_loss': tdee - 400,          // Moderate deficit
    'athletic_performance': tdee + 100, // Small surplus for recovery
    'acl_prevention': tdee,          // Maintenance for recovery
    'general_fitness': tdee
  };
  
  targetCalories = goalAdjustments[goals.primary] || tdee;
  
  // Calculate macros with expert input
  const macros = calculateMacroSplit(targetCalories, weight, goals, soccerFrequency);
  
  return {
    calories: Math.round(targetCalories),
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    fiber: macros.fiber,
    water: macros.water,
    timing: generateMealTiming(soccerFrequency, liftingFrequency),
    notes: generateNutritionNotes(goals, soccerFrequency)
  };
}

function calculateMacroSplit(calories, bodyweight, goals, soccerFrequency) {
  // Expert consensus on macro splits
  const expertRecommendations = {
    soccerCoach: {
      proteinPerLb: 0.8,  // Adequate for recovery
      carbPercent: 0.50,  // High for performance
      fatPercent: 0.25
    },
    strengthCoach: {
      proteinPerLb: 1.0,  // Higher for muscle
      carbPercent: 0.40,
      fatPercent: 0.30
    },
    nutritionist: {
      proteinPerLb: 0.9,
      carbPercent: 0.45,
      fatPercent: 0.28
    },
    aesthetics: {
      proteinPerLb: 1.1,  // Highest for lean mass
      carbPercent: 0.35,
      fatPercent: 0.30
    }
  };
  
  // Weight the recommendations
  let proteinPerLb = 0;
  let carbPercent = 0;
  
  // Soccer players need more carbs
  if (soccerFrequency >= 2) {
    proteinPerLb = 0.9;
    carbPercent = 0.45;
  } else {
    proteinPerLb = 1.0;
    carbPercent = 0.40;
  }
  
  // Goal adjustments
  if (goals.primary === 'muscle_gain' || goals.secondary?.includes('aesthetics')) {
    proteinPerLb = Math.min(proteinPerLb + 0.1, 1.2);
    carbPercent -= 0.05;
  }
  
  // Calculate grams
  const proteinGrams = Math.round(bodyweight * proteinPerLb);
  const proteinCalories = proteinGrams * 4;
  
  const carbCalories = calories * carbPercent;
  const carbGrams = Math.round(carbCalories / 4);
  
  const fatCalories = calories - proteinCalories - carbCalories;
  const fatGrams = Math.round(fatCalories / 9);
  
  // Additional recommendations
  const fiberGrams = Math.round(calories / 1000 * 14); // 14g per 1000 calories
  const waterOz = Math.round(bodyweight * 0.75); // 0.75 oz per lb for athletes
  
  return {
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    fiber: fiberGrams,
    water: waterOz
  };
}

function generateMealTiming(soccerFrequency, liftingFrequency) {
  return {
    preworkout: {
      timing: '1-2 hours before',
      macros: '30-40g carbs, 20g protein, minimal fat',
      examples: ['Banana + protein shake', 'Rice cakes + turkey', 'Oatmeal + egg whites']
    },
    postworkout: {
      timing: 'Within 30 minutes',
      macros: '40-60g carbs, 25-35g protein',
      examples: ['Protein shake + white rice', 'Chicken + sweet potato', 'Greek yogurt + fruit']
    },
    gameDay: {
      timing: '3-4 hours before match',
      macros: '100-150g carbs, moderate protein, low fat',
      examples: ['Pasta + lean meat', 'Rice bowl', 'Pancakes + eggs']
    }
  };
}

function generateNutritionNotes(goals, soccerFrequency) {
  const notes = [];
  
  if (soccerFrequency >= 2) {
    notes.push('🥣 Prioritize carb intake on game days and night before');
    notes.push('💧 Add electrolytes to water during/after soccer');
    notes.push('🍌 Keep quick carbs (fruit) available for halftime');
  }
  
  if (goals.primary === 'muscle_gain') {
    notes.push('🥩 Spread protein intake across 4-5 meals');
    notes.push('🥛 Consider casein protein before bed');
    notes.push('🍚 Time carbs around workouts');
  }
  
  if (goals.primary === 'acl_prevention' || goals.secondary?.includes('injury_prevention')) {
    notes.push('🐟 Include omega-3 rich foods (salmon, walnuts)');
    notes.push('🥬 Emphasize anti-inflammatory foods');
    notes.push('🦴 Ensure adequate calcium and vitamin D');
  }
  
  // General athlete recommendations
  notes.push('⏰ Never skip post-workout nutrition');
  notes.push('🧂 Don\'t fear sodium - athletes need more');
  notes.push('😴 Last meal 2-3 hours before bed');
  
  return notes;
}

// Add UI component for displaying macros
function displayMacroRecommendations(userData) {
  const macros = calculatePersonalizedMacros(userData);
  
  return `
    <div class="macro-display" style="background: #2d3748; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <h3 style="color: #68d391; margin-bottom: 15px;">📊 Your Personalized Macros</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div class="macro-card" style="background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${macros.calories}</div>
          <div style="color: #a0aec0; font-size: 12px;">Daily Calories</div>
        </div>
        
        <div class="macro-card" style="background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${macros.protein}g</div>
          <div style="color: #a0aec0; font-size: 12px;">Protein</div>
          <div style="font-size: 10px; color: #6b7280;">${(macros.protein * 4 / macros.calories * 100).toFixed(0)}%</div>
        </div>
        
        <div class="macro-card" style="background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${macros.carbs}g</div>
          <div style="color: #a0aec0; font-size: 12px;">Carbs</div>
          <div style="font-size: 10px; color: #6b7280;">${(macros.carbs * 4 / macros.calories * 100).toFixed(0)}%</div>
        </div>
        
        <div class="macro-card" style="background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #10b981;">${macros.fat}g</div>
          <div style="color: #a0aec0; font-size: 12px;">Fat</div>
          <div style="font-size: 10px; color: #6b7280;">${(macros.fat * 9 / macros.calories * 100).toFixed(0)}%</div>
        </div>
        
        <div class="macro-card" style="background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${macros.fiber}g</div>
          <div style="color: #a0aec0; font-size: 12px;">Fiber</div>
        </div>
        
        <div class="macro-card" style="background: #1a1a1a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #06b6d4;">${macros.water}oz</div>
          <div style="color: #a0aec0; font-size: 12px;">Water</div>
        </div>
      </div>
      
      <div class="meal-timing" style="background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="color: #e2e8f0; margin-bottom: 10px;">⏰ Meal Timing</h4>
        <div style="color: #a0aec0; font-size: 14px;">
          <strong>Pre-Workout:</strong> ${macros.timing.preworkout.macros}<br>
          <strong>Post-Workout:</strong> ${macros.timing.postworkout.macros}<br>
          <strong>Game Days:</strong> ${macros.timing.gameDay.macros}
        </div>
      </div>
      
      <div class="nutrition-notes" style="background: #1a1a1a; padding: 15px; border-radius: 8px;">
        <h4 style="color: #e2e8f0; margin-bottom: 10px;">💡 Personalized Tips</h4>
        <ul style="color: #a0aec0; font-size: 14px; margin: 0; padding-left: 20px;">
          ${macros.notes.map(note => `<li>${note}</li>`).join('')}
        </ul>
      </div>
      
      <button onclick="recalculateMacros()" class="btn" style="margin-top: 15px;">🔄 Recalculate Based on Progress</button>
    </div>
  `;
}

// Function to adjust macros based on progress
function recalculateMacros() {
  const userData = getUserData(); // Get current user data
  const recentWorkouts = getRecentWorkouts(7); // Last 7 days
  const avgEnergy = calculateAverageEnergy(recentWorkouts);
  const weightTrend = getWeightTrend();
  
  // Adjust calories based on progress
  if (avgEnergy < 6 && weightTrend === 'stable') {
    // Low energy, not losing weight = need more calories
    userData.calorieAdjustment = 200;
  } else if (weightTrend === 'gaining_fast' && userData.goals.primary !== 'muscle_gain') {
    // Gaining too fast when not trying to bulk
    userData.calorieAdjustment = -200;
  }
  
  const adjustedMacros = calculatePersonalizedMacros(userData);
  displayMacroRecommendations(userData);
}
```

## 10. Add Integration with Performance Data

Add function to pull data from connected services:

```javascript
// Integrate with Strava and other services for validation
async function validateWithExternalData() {
  const connections = getUserConnections();
  let validatedData = {};
  
  if (connections.strava) {
    validatedData.strava = await fetchStravaActivities();
    // Cross-reference logged workouts with Strava activities
    crossValidateWorkouts(validatedData.strava);
  }
  
  if (connections.garmin) {
    validatedData.garmin = await fetchGarminData();
    // Use heart rate data to validate RPE
    validateRPEWithHR(validatedData.garmin.heartRate);
  }
  
  return validatedData;
}

function adjustMacrosBasedOnActivity(externalData) {
  // If Strava shows more activity than logged
  const actualCaloriesBurned = externalData.strava?.calories || 0;
  const loggedCaloriesBurned = calculateLoggedCalories();
  
  if (actualCaloriesBurned > loggedCaloriesBurned) {
    // User is doing extra activity not logged in app
    const difference = actualCaloriesBurned - loggedCaloriesBurned;
    return {
      additionalCalories: difference,
      additionalCarbs: Math.round(difference * 0.6 / 4), // 60% from carbs
      additionalProtein: Math.round(difference * 0.2 / 4) // 20% from protein
    };
  }
  
  return { additionalCalories: 0, additionalCarbs: 0, additionalProtein: 0 };
}
```

## Final Note
After implementing these changes, the app will provide:
- Intelligent weight progression based on RPE and performance
- Personalized macro calculations using expert consensus
- Adaptive nutrition based on actual activity levels
- Cross-validation with external fitness trackers
- Real-time adjustments based on progress
- Respect for real gym constraints
- Mandatory core work every session  
- Proper warmup/cooldown protocols
- Expert-balanced programming for optimal results