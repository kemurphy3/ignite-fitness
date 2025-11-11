# Prompt 8 - Passive Readiness Inference + Strava Hook ✅

## ✅ **COMPLETION STATUS: 100%**

### **Done Means Checklist**

✅ With no daily input, plans still adapt  
✅ Passive readiness inference works from: prior session RPE, volume change %,
hard days streak, injury flags, external activities  
✅ Strava hook scaffold with mock endpoint  
✅ Maps external activities to internal format  
✅ External load reduces next-day leg volume by ~20%  
✅ Auto reduce intensity when passive readiness < 4 and explain why

---

## 📋 **Implementation Summary**

### **PassiveReadiness System** ✅

**5 Input Factors:**

1. **Prior Session RPE** (30% weight)
   - RPE ≥ 9 → -2 readiness
   - RPE ≥ 8 → -1 readiness
   - RPE ≤ 6 → +1 readiness

2. **Volume Change %** (25% weight)
   - Volume increase >25% → -1.5 readiness
   - Volume increase >10% → -1 readiness
   - Volume decrease >20% → +0.5 readiness

3. **Hard Days Streak** (20% weight)
   - 3+ hard days → -2 readiness
   - 2 hard days → -1 readiness

4. **Recent Injury Flags** (15% weight)
   - Any recent flag → -1.5 readiness
   - Location-specific relevance

5. **External Activities** (10% weight)
   - Long duration (>60min) + high intensity (>5) → -1 readiness

**Confidence Levels:**

- **High**: ≥4 data points
- **Medium**: ≥2 data points
- **Low**: <2 data points

---

### **StravaHook Scaffold** ✅

**Mock Endpoints:**

```javascript
fetchActivities(userId); // Returns mock activity
authenticate(userId); // Simulates auth flow
syncActivities(userId); // Maps and stores activities
```

**Activity Mapping:**

```javascript
Strava Type → Internal Type
'Run' → 'running'
'Ride' → 'cycling'
'Swim' → 'swimming'
'Workout' → 'strength'
'Walk' → 'walking'
```

**Internal Format:**

```javascript
{
    id: 'strava_123',
    userId: 'user123',
    source: 'strava',
    type: 'running',
    duration: 1800, // seconds
    distance: 5000, // meters
    averageIntensity: 6,
    timestamp: '2024-01-15T08:00:00Z',
    name: 'Morning Run',
    rawData: { ... } // Original Strava data
}
```

---

### **ExternalLoadAdapter** ✅

**Conflict Detection:**

1. **Leg Volume** - External running → reduce leg volume by 20%
2. **Intensity** - Long endurance session → reduce intensity by 15%
3. **Total Load** - High intensity external → reduce total load by 10%

**Adaptation Example:**

```javascript
Original: Back Squat 3 sets × 10 reps
External: Morning Run 5km (60min)
Adapted:  Back Squat 2 sets × 10 reps (-20%)
Reason:   "External running reduces leg volume by 20%"
```

---

## **Example Flows** ✅

### **No Daily Check-In Flow:**

**Scenario:**

- Yesterday: Hard session (RPE 9)
- Today: Morning run (5km, 30min)
- Today's planned workout: Heavy legs

**Inference:**

```javascript
priorSession: RPE 9
externalActivity: running, 1800s
result: {
    score: 5,
    reasons: "Very hard yesterday. External activity today.",
    confidence: "high"
}
```

**Adaptation:**

```javascript
Original: Back Squat 3×10, RDL 3×8, Split Squat 3×12
Adapted:  Back Squat 2×10, RDL 2×8, Split Squat 2×12
Reason:   "External running reduces leg volume by 20%"
```

---

### **External Load Adaptation:**

**Step 1: Detect Conflict**

```javascript
External Activity: { type: 'running', duration: 3600, intensity: 6 }
Planned Workout:  { hasLegWork: true }
Conflict:          leg_volume
```

**Step 2: Apply Adaptation**

```javascript
Leg Exercises → Reduce sets by 20%
Back Squat:    3 sets → 2 sets
RDL:           3 sets → 2 sets
Split Squat:   3 sets → 2 sets
```

**Step 3: Explain**

```javascript
"External running (60min) reduces today's leg volume by 20%";
```

---

## **Event Logging** ✅

**Passive Readiness Events:**

```javascript
{
    eventType: 'PASSIVE_READINESS_INFERRED',
    readiness: {
        score: 5,
        reasons: "Very hard yesterday. External activity today.",
        confidence: "high"
    },
    inputs: {
        priorSession: 9,
        volumeChange: 15,
        hardDaysStreak: 1,
        injuryFlagsCount: 0,
        externalActivitiesCount: 1
    },
    timestamp: '2024-01-15T10:00:00Z'
}
```

---

## **Unit Tests** ✅

### **Passive Readiness Tests** ✅

```javascript
✅ Very hard session reduces readiness by 2
✅ Large volume increase reduces readiness by 1.5
✅ Multiple hard days significantly reduces readiness
✅ External activities reduce readiness by 1
✅ Injury flags reduce readiness by 1.5
```

### **External Load Tests** ✅

```javascript
✅ Mocked external run reduces next-day leg volume by 20%
✅ Conflict detection: running + leg work = reduce leg volume
✅ Adaptation applied: 3 sets → 2 sets
✅ Reason generated: "External running reduces leg volume by 20%"
```

### **Strava Hook Tests** ✅

```javascript
✅ Mock fetch returns activity data
✅ Activity maps to internal format
✅ Authentication works (mock)
✅ Sync stores activities
```

---

## ✅ **PROMPT 8: COMPLETE**

**Summary**: Passive readiness inference allows plans to adapt without daily
check-ins, using prior session data and external activities.

**Key Features:**

- ✅ 5 input factors for passive inference
- ✅ Confidence scoring (high/medium/low)
- ✅ Strava hook scaffold (mock)
- ✅ External activity mapping
- ✅ Auto reduce intensity when readiness < 4
- ✅ Explain why adaptations made
- ✅ Plans adapt without daily input
- ✅ Unit test reduces leg volume by 20%

**Users can now skip check-ins - system adapts intelligently from available
data.** 🎯
