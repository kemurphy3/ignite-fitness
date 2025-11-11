# Prompt 3 - Simple vs Advanced Modes + Instant Overrides ✅

## ✅ **COMPLETION STATUS: 100%**

### **Done Means Checklist**

✅ Mode toggle in Profile with immediate UI switch  
✅ Simple Mode: "Start Workout" with warmup + circuit + finisher  
✅ Advanced Mode: Full plan, RPE entry, substitutions, timers  
✅ OverrideBar on every screen (Change exercise, Less time, Swap equipment,
Reduce intensity)  
✅ CoachChat provides short suggestions  
✅ ExpertCoordinator called for re-plan with new constraints  
✅ Any override updates current plan without reloading  
✅ Snapshot tests for Simple and Advanced routes

---

## 📋 **Implementation Summary**

### **Mode System** ✅

**Simple Mode:**

- One-tap workout start
- Minimal controls (no RPE sliders)
- Pre-built circuits (warmup + 3-5 exercise circuit + finisher)
- ~30 minute sessions
- Focus on in-gym execution

**Advanced Mode:**

- Full workout plans
- RPE entry after each exercise
- Detailed timers (session + rest)
- Exercise substitutions
- Equipment swaps
- Volume/intensity adjustments
- Complete customization

**Mode Toggle:**

- Switch in Profile settings
- Immediate UI update (no reload)
- Preference persisted
- Event-driven updates

---

## **Override System** ✅

### **OverrideBar Actions** ✅

**Change Exercise:**

- Shows similar exercises
- One-tap swap
- Updates plan instantly
- Tracks swap history

**Less Time:**

- Skip finisher (-20%)
- Reduce sets (-25%)
- Superset pairs (-30%)
- Quick time savings

**Swap Equipment:**

- Machines vs free weights
- Dumbbells vs barbell
- Cables vs bands
- Home gym alternatives

**Reduce Intensity:**

- Instant -15% load reduction
- Safer progression
- Adjusts RPE targets

**Ask Coach (Chat):**

- Conversational interface
- Quick suggestions
- Calls ExpertCoordinator
- Re-plans with new constraints

---

## **Coach Chat Integration** ✅

**Chat Features:**

- Simple pattern matching
- Contextual responses
- Quick suggestions (preset options)
- Calls ExpertCoordinator for re-planning

**Common Queries:**

- "Too tired" → Reduce intensity 20%
- "Too hard" → Lower RPE target
- "Less time" → 20-min circuit
- "Equipment missing" → Suggest alternatives
- "Something hurts" → Trigger injury check

**Re-planning Flow:**

```javascript
User: "Too tired today"
  ↓
Coach Chat recognizes pattern
  ↓
Calls ExpertCoordinator with modifications
  ↓
Generates new plan with reduced intensity
  ↓
Updates current workout instantly
  ↓
No page reload - seamless transition
```

---

## **Simple Mode Workout** ✅

**Structure:**

```
Warmup (5 min)
  - Leg swings
  - Bodyweight squats
  - Hip mobility

Circuit × 3 rounds (20 min)
  1. Squat
  2. Push-ups
  3. Rows
  4. Core work

Finisher (5 min)
  - Quick conditioning or stretch
```

**No Required:**

- RPE tracking
- Detailed timers
- Exercise modifications
- Equipment swaps
- Volume adjustments

**Just:**

- Tap "Start"
- Follow the circuit
- Done in 30 minutes

---

## **Advanced Mode Workout** ✅

**Features:**

- Full workout plan from ExpertCoordinator
- RPE input after each exercise
- Session timer + rest countdown
- Exercise substitutions
- Equipment alternatives
- Volume/intensity adjustments
- Progress tracking
- Detailed analytics

**Customization:**

- Swap any exercise
- Adjust sets/reps on fly
- Modify rest periods
- Change equipment
- Scale intensity up/down

---

## **Instant Overrides** ✅

**No Page Reload:**

- Overrides update DOM directly
- Use React-like state updates
- EventBus coordination
- UI updates without navigation

**Example Flow:**

```javascript
User taps "Reduce Intensity"
  ↓
OverrideBar applies -15% multiplier
  ↓
EventBus emits 'PLAN_UPDATED'
  ↓
WorkoutTracker updates display
  ↓
UI reflects change immediately
  ↓
No refresh, no reload, seamless
```

---

## **Snapshot Tests** ✅

**Test Coverage:**

1. ✅ Simple mode shows quick start button
2. ✅ Simple mode hides advanced controls
3. ✅ Advanced mode shows RPE input, timers
4. ✅ Advanced mode shows all controls
5. ✅ Override updates plan without reload
6. ✅ Quick start generates simplified plan
7. ✅ Coach chat integration works
8. ✅ Mode switch persists preferences

**Run Tests:**

```javascript
const test = new ModeSnapshotTest();
await test.runAllTests();
```

---

## **Usage** ✅

### **Switch Modes** ✅

```javascript
// In Profile settings
await ModeManager.switchMode('simple'); // Instant UI change
await ModeManager.switchMode('advanced'); // Full controls
```

### **Quick Start** ✅

```javascript
// Simple mode - one tap
QuickStart.startQuickWorkout();
// → Shows: Warmup + Circuit + Finisher
// → 30 minutes, no customization needed
```

### **Apply Override** ✅

```javascript
// From any screen during workout
OverrideBar.handleOverride('reduce-intensity');
// → Plan updated immediately, no reload
```

### **Chat with Coach** ✅

```javascript
CoachChat.openChat();
// User: "Too tired"
// Coach: "No problem! Reducing intensity 20%..."
// → Re-plans workout with adjustments
```

---

## 📁 **Files Created**

1. ✅ `js/modules/ui/ModeManager.js` - Mode switching
2. ✅ `js/modules/ui/QuickStart.js` - One-tap workout start
3. ✅ `js/modules/ui/OverrideBar.js` - Instant overrides
4. ✅ `js/modules/ai/CoachChat.js` - Conversational modifications
5. ✅ `test-mode-snapshots.js` - Snapshot tests

---

## ✅ **PROMPT 3: COMPLETE**

**Summary**: Simple vs Advanced modes with instant overrides make the app
pleasant to use.

**Key Features:**

- ✅ Mode toggle in Profile (immediate UI switch)
- ✅ Simple Mode: One-tap start, warmup + circuit + finisher
- ✅ Advanced Mode: Full control, RPE, timers, substitutions
- ✅ OverrideBar: 5 quick actions on every screen
- ✅ CoachChat: Conversational workout modifications
- ✅ Instant updates without app reload
- ✅ Snapshot tests for both mode routes

**The app now provides both simplicity and powerful customization - user chooses
their experience.** 🎯
