# Prompt 10 - Periodization + Soccer Calendar ✅

## ✅ **COMPLETION STATUS: 100%**

### **Done Means Checklist**

✅ 4-week blocks (W1-3 progressive, W4 deload)  
✅ Pre-season bias strength and power  
✅ In-season bias maintenance and sprint/agility  
✅ User can flag important matches  
✅ Taper auto-applies (volume -30%, intensity -10%)  
✅ Periodization view shows current block, next block  
✅ Phase pill persists in header  
✅ Marking a key match in 10 days updates next 2 weeks with rationale

---

## 📋 **Implementation Summary**

### **4-Week Block Pattern** ✅

**Progressive Loading (Weeks 1-3):**

```javascript
Week 1: 80% volume, 93% intensity
Week 2: 90% volume, 97% intensity
Week 3: 100% volume, 100% intensity
Week 4: 60% volume, 85% intensity (deload)
```

**Deload Week Logic:**

- 40% volume reduction
- 15% intensity reduction
- Allows supercompensation

---

### **Season-Specific Biases** ✅

**Pre-Season:**

- Focus: Strength and power
- Intensity: High
- Volume: Progressive loading
- Goal: Build base

**In-Season:**

- Focus: Maintenance and sprint/agility
- Intensity: Moderate
- Volume: Moderate (avoid fatigue)
- Goal: Maintain performance

**Off-Season:**

- Focus: Strength development
- Intensity: High
- Volume: High
- Goal: Build strength

---

### **Key Match Flagging** ✅

**Flag a Match:**

```javascript
await SeasonalPrograms.flagKeyMatch(
    new Date('2024-06-15'),
    'Liverpool'
);

// Returns:
{
    date: '2024-06-15T00:00:00Z',
    opponent: 'Liverpool',
    type: 'key_match',
    flagged: true,
    taperApplied: true,
    taperDays: 10
}
```

**Storage:** `key_matches` table  
**Auto-Update:** Next 2 blocks recalculated

---

### **Automatic Tapering** ✅

**Taper Rules:**

- Trigger: 10 days before key match
- Volume reduction: -30%
- Intensity reduction: -10%
- Duration: 1 week taper

**Example:**

```javascript
Normal Week 2: volume 90%, intensity 97%
Tapered Week 2: volume 63%, intensity 87%
Rationale: "Tapering for Liverpool (June 15)"
```

---

### **Periodization View** ✅

**Components:**

1. **Phase Pill** (header)
   - Shows current phase (In-Season, Pre-Season, etc.)
   - Color-coded
   - Emoji indicator

2. **Progress Bar**
   - Current block progress
   - Week X of 4

3. **Training Blocks**
   - Current block details
   - Next block preview

4. **Recommendations**
   - Taper alerts
   - Deload reminders

---

## **Example Flow** ✅

### **Flag a Key Match:**

**Step 1: User Flags Match**

```javascript
User: 'Flag June 15 vs Liverpool';
System: flagsKeyMatch(new Date('2024-06-15'), 'Liverpool');
```

**Step 2: System Updates Next 2 Weeks**

```javascript
Block 2, Week 2:
  Before: volume 90%, intensity 97%
  After:  volume 63%, intensity 87%
  Reason: "Tapering for Liverpool (June 15)"
```

**Step 3: View Shows Taper**

```javascript
Periodization View:
  Current Block: Block 2 (50% complete)
  Next Block: Block 3 (starts in 14 days)
  Alert: "Tapering scheduled for Liverpool match"
```

---

### **Seasonal Biases Applied:**

**Pre-Season (Jan-Feb):**

```javascript
Week 1: Heavy squats (strength focus)
Week 2: Power cleans (power focus)
Week 3: Max effort sprints (power focus)
Week 4: Deload (recovery)
```

**In-Season (Mar-Aug):**

```javascript
Week 1: Maintenance lifting (maintenance)
Week 2: Sprint work (agility focus)
Week 3: Light upper body (maintenance)
Week 4: Deload (recovery)
```

---

## **Rationale Generation** ✅

**Taper Week Rationale:**

```
"Tapering for key match (Liverpool, June 15). Volume reduced 30%, intensity reduced 10% to optimize performance. Training focus shifts to sprint/agility to maintain match fitness."
```

**Deload Week Rationale:**

```
"Deload week - 40% volume reduction, 15% intensity reduction. Allows supercompensation and prevents overreaching."
```

---

## **Phase Pill Persistence** ✅

**Header Display:**

```html
<div class="phase-pill" style="--phase-color: #00a651">
  <span class="phase-emoji">⚽</span>
  <span class="phase-label">In-Season</span>
  <span class="phase-subtitle">Maintenance</span>
</div>
```

**Always Visible:** Yes (persists in header)  
**Updates:** Based on current date and phase

---

## ✅ **PROMPT 10: COMPLETE**

**Summary**: Integrated microcycles with soccer season and automatic tapering
for key matches.

**Key Features:**

- ✅ 4-week block pattern (progressive → deload)
- ✅ Season-specific training biases
- ✅ Key match flagging
- ✅ Auto-taper 10 days before (volume -30%, intensity -10%)
- ✅ Periodization view with phase pill
- ✅ Rationale generated for all adjustments
- ✅ Next 2 blocks auto-update when match flagged

**Soccer players now have automatic tapering for important matches built into
their periodization.** ⚽
