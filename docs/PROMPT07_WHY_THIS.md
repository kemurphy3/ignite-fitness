# Prompt 7 - Transparency Layer: "Why This Today?" ✅

## ✅ **COMPLETION STATUS: 100%**

### **Done Means Checklist**

✅ Every rendered block has an attached reason  
✅ Reasons include: game timing, readiness inference, injury flags, goal priorities, time limits, user dislikes  
✅ Compact "Why?" chip on each block  
✅ Tap to expand to show 1-2 sentence rationale  
✅ Log reasons to progression_events for audit  
✅ Cypress test verifies reasons render in both Simple and Advanced modes  

---

## 📋 **Implementation Summary**

### **Enhanced WhyThisDecider** ✅

**New Methods Added:**
- `generateWhyToday(block, context)` - Generates "Why This Today?" for each block
- `getGameDayModification(exercise)` - Game timing modifications
- `isRelevantToExercise(injuryFlag, exercise)` - Injury relevance checking
- `isGoalRelevant(goal, exercise)` - Goal relevance checking

**Reason Factors Checked:**

1. **Game Timing** ✅
   ```javascript
   if (context.schedule?.isGameDay) {
       reasons.push('Game tomorrow - upper body focus only');
   }
   ```

2. **Readiness Inference** ✅
   ```javascript
   if (context.readiness <= 4) {
       reasons.push('Low readiness (3/10) - reduced volume');
   }
   ```

3. **Injury Flags** ✅
   ```javascript
   if (injuryFlag.location === 'knee' && exercise.includes('squat')) {
       reasons.push('Avoiding knee stress from recent flag');
   }
   ```

4. **Goal Priorities** ✅
   ```javascript
   if (goal === 'muscle_building') {
       reasons.push('Priority: muscle building');
   }
   ```

5. **Time Limits** ✅
   ```javascript
   if (context.constraints?.sessionLength === 30) {
       reasons.push('Limited time (30min) - focused selection');
   }
   ```

6. **User Dislikes** ✅
   ```javascript
   if (dislikes.includes('bulgarian split squat')) {
       reasons.push('Replaced disliked exercise');
   }
   ```

---

## **WhyThis UI Component** ✅

### **Compact Chip**
```html
<button class="why-chip-button">
    <span class="why-icon">💡</span>
    <span class="why-label">Why?</span>
</button>
```

### **Expanded View**
```html
<div class="why-expansion">
    <div class="why-reason">
        Low readiness (6/10) - reduced volume. Priority: muscle building.
    </div>
</div>
```

### **Interaction:**
- Tap to expand/collapse
- Logs view to `progression_events`
- Smooth animation
- Accessible (ARIA)

---

## **Example Reasons** ✅

### **Game Day:**
```
"Game tomorrow - upper body focus only. Low readiness (3/10) - reduced volume."
```

### **Low Readiness:**
```
"Low readiness (4/10) - reduced volume. Avoiding knee stress from recent flag."
```

### **Goal Priority:**
```
"High readiness (8/10) - progressive load. Priority: muscle building."
```

### **Time Constraint:**
```
"Limited time (30min) - focused selection. Standard progression aligned with your goals."
```

### **Dislike:**
```
"Replaced disliked exercise. Game -2 days - no heavy legs."
```

---

## **Event Logging** ✅

**Event Structure:**
```javascript
{
    userId: 'user123',
    eventType: 'WHY_REASON_VIEWED',
    reason: 'Low readiness (6/10) - reduced volume. Priority: muscle building.',
    timestamp: '2024-01-15T10:30:00Z',
    metadata: {
        source: 'why_this_chip',
        userAction: 'tapped_expand'
    }
}
```

**Logged to:** `progression_events` table

**Audit Trail:**
- Every reason view logged
- Trackable trust metrics
- Analytics on which reasons users expand

---

## **Simple vs Advanced Modes** ✅

### **Simple Mode:**
- Compact chip shows "Why?" always visible
- Expands inline on tap
- Simplified reasoning

**Example:**
```
Why? → "Low readiness (4/10) - reduced volume."
```

### **Advanced Mode:**
- Same chip format
- More detailed reasoning
- Multiple factors shown

**Example:**
```
Why? → "Low readiness (4/10) - reduced volume. Avoiding knee stress from recent flag. Priority: muscle building."
```

---

## **Integration** ✅

### **Attach to Workout:**
```javascript
const whyThis = new WhyThis();

// Render for all blocks
const chips = whyThis.renderForBlocks(blocks, context);

// Attach to existing elements
whyThis.attachToWorkout(container, blocks, context);
```

### **Single Block:**
```javascript
const chip = whyThis.render(block, context);
element.appendChild(chip);
```

---

## **Responsive Design** ✅

**Desktop:**
- Chip visible with icon + text
- Smooth expansion animation

**Mobile (< 400px):**
- Icon only (hides "Why?" text)
- Larger tap target
- Full-width expansion

---

## ✅ **PROMPT 7: COMPLETE**

**Summary**: Transparency layer builds trust by always showing short reasons for every exercise and adjustment.

**Key Features:**
- ✅ Every block has attached reason
- ✅ 6 factor types checked (game, readiness, injuries, goals, time, dislikes)
- ✅ Compact "Why?" chip
- ✅ Expands to 1-2 sentences on tap
- ✅ Logs views to progression_events
- ✅ Works in Simple and Advanced modes
- ✅ Accessible (ARIA states)
- ✅ Mobile-responsive

**Users now always know "Why This Today?" - building trust through transparency.** 💡
