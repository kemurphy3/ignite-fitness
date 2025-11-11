# Special Phase Configuration Example

## Overview

The seasonal system supports custom date-based phases for playoffs, tournaments,
and other special periods. This allows fine-tuned periodization even within the
main season.

## Configuration Example

### User Profile with Season Calendar

```javascript
const userProfile = {
  seasonPhase: 'in', // Main phase: In-Season

  seasonCalendar: {
    // Define special sub-phases
    specialPhases: [
      {
        name: 'Playoff Run',
        start: '2025-04-01',
        end: '2025-04-30',
        peakPerformance: true,
        tapering: false,
      },
      {
        name: 'Championship Tournament',
        start: '2025-05-15',
        end: '2025-05-21',
        peakPerformance: true,
        tapering: true, // Peak taper
      },
    ],
  },
};
```

## How It Works

### During Regular In-Season

- Normal game proximity rules apply
- Weekly deload on week 4
- Standard maintenance focus

### During Playoff Run (April 1-30)

- System detects custom phase
- Peak performance mode activated
- Volume modifier: 0.85 (slightly reduced)
- Emphasizes readiness over volume
- Rationale: "Playoff Run: Peak performance focus"

### During Championship Tournament (May 15-21)

- System detects custom phase
- Peak performance + tapering
- Volume modifier: 0.7 (more aggressive taper)
- Maximizes recovery and readiness
- Rationale: "Championship Tournament: Tapering protocol"
- Regular deload week skipped if in special phase

## Benefits

1. **Flexibility**: Works within any main season phase
2. **Peak Performance**: Automatically reduces volume when it matters most
3. **No Manual Override**: System automatically detects and applies
4. **Clear Rationale**: User always knows why adjustments were made

## Example Usage

```javascript
// In ExpertCoordinator
const context = await seasonalPrograms.getSeasonContext(
  today,
  userProfile,
  calendar
);

// Returns:
// {
//   phase: 'In-Season',
//   phaseKey: 'in',
//   isSpecialPhase: true,
//   specialPhaseInfo: {
//     name: 'Playoff Run',
//     peakPerformance: true,
//     tapering: false
//   },
//   volumeModifier: 0.85,
//   rules: [
//     'Playoff Run: Peak performance focus',
//     'Maximize readiness without fatigue'
//   ]
// }
```

## Special Phase Properties

- `name`: Display name for user
- `start` / `end`: ISO date strings
- `peakPerformance`: When true, prioritize recovery and readiness
- `tapering`: When true, aggressive volume reduction (0.7 modifier)

## Implementation Status

✅ Special phase detection ✅ Peak performance mode ✅ Tapering protocol  
✅ Volume modifier adjustment ✅ Rationale generation ✅ Skips regular deload in
special phase ✅ Works within any base phase (off/pre/in/post)
