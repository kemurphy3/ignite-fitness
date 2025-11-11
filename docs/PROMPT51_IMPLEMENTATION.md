# Prompt 5.1 Implementation - Macro Guidance Lite ✅

## 🎯 **Prompt 5.1: Macro Guidance Lite - COMPLETED**

### ✅ **All Requirements Implemented**

#### **1. BMR Calculation (Mifflin-St Jeor)** ✅

**File**: `netlify/functions/nutrition-calculator.js`

**Equation**:

```
BMR (Male) = (10 × weight) + (6.25 × height) - (5 × age) + 5
BMR (Female) = (10 × weight) + (6.25 × height) - (5 × age) - 161
```

**Example**: Male, 25 years, 75kg, 180cm

```
BMR = (10 × 75) + (6.25 × 180) - (5 × 25) + 5
    = 750 + 1125 - 125 + 5
    = 1,755 calories
```

#### **2. Activity Multiplier** ✅

**Multipliers**:

- Sedentary: 1.2x
- Light (1-3 days/week): 1.375x
- Moderate (3-5 days/week): 1.55x
- Active (6-7 days/week): 1.725x
- Very Active (2x/day): 1.9x

**Example**: BMR 1,755, Moderate activity

```
TDEE = 1,755 × 1.55 = 2,720 calories
```

#### **3. ±20% Cal Adjustment by Day Type** ✅

**Adjustments**:

- **Game Day**: +20% calories
- **Training Day**: +10% calories
- **Rest Day**: -10% calories

**Example**: TDEE 2,720 calories

```
Game Day: 2,720 × 1.2 = 3,264 calories
Training: 2,720 × 1.1 = 2,992 calories
Rest Day: 2,720 × 0.9 = 2,448 calories
```

#### **4. Pre/Post Meal Examples Per Sport** ✅

**Soccer**:

- Pre: Banana + peanut butter, Oatmeal + berries
- Post: Chocolate milk + protein, Rice + chicken + vegetables

**Basketball**:

- Pre: Bagel + jam, Energy gel + banana
- Post: Protein shake + carbs, Sweet potato + salmon

**Running**:

- Pre: Banana 30-60 min before, Toast + almond butter
- Post: 4:1 carbs to protein within 30 min, Chocolate milk

**Generic Training**:

- Pre: Simple carbs + protein
- Post: Rapid protein + carbs (4:1 ratio)

#### **5. Dashboard Card with P/C/F Progress Bars** ✅

**File**: `js/modules/nutrition/NutritionCard.js`

**Display**:

```
┌──────────────────────────────────┐
│ 💪 Daily Fuel [Training Day]    │
├──────────────────────────────────┤
│ Target: 2,992 cal                │
│                                  │
│ 🥩 Protein: 187g (30%)          │
│ [████████████░░░░░░░░]           │
│                                  │
│ 🍞 Carbs: 336g (50%)            │
│ [████████████████████]           │
│                                  │
│ 🥑 Fat: 100g (30%)              │
│ [████████████░░░░░░░░]           │
└──────────────────────────────────┘
```

#### **6. No Food Logging UI** ✅

**Approach**:

- Provide targets and guidance only
- No calorie tracking interface
- Meal ideas and timing advice
- Let athletes eat intuitively

#### **7. Connect to Training Schedule for Carb Timing** ✅

**Training Day Timing**:

```
Pre-workout (1-2 hours): Simple carbs + protein
During workout: Hydration (<60 min workout)
Post-workout (0-30 min): Rapid protein + carbs
Evening: Balanced dinner with complex carbs
```

**Game Day Timing**:

```
2-3 hours before: Largest meal with carbs
30-60 min before: Small snack if needed
Halftime/breaks: Quick carbs (banana, gel)
Post-game: Rapid carbohydrate + protein
Next day: Continue high carbs for recovery
```

**Rest Day Timing**:

```
Focus: Lower carb intake
Meal timing: Spread evenly
Note: Maintain protein and healthy fats
```

---

## 📊 **Macro Breakdowns**

### **Game Day (Soccer)**

- Calories: 3,264 (+20%)
- Protein: 163g (20%), 652 cal
- Carbs: 449g (55%), 1,796 cal
- Fat: 91g (25%), 816 cal

### **Training Day (Soccer)**

- Calories: 2,992 (+10%)
- Protein: 187g (30%), 748 cal
- Carbs: 336g (45%), 1,346 cal
- Fat: 100g (30%), 898 cal

### **Rest Day**

- Calories: 2,448 (-10%)
- Protein: 184g (30%), 734 cal
- Carbs: 214g (35%), 856 cal
- Fat: 95g (35%), 858 cal

---

## 🎯 **Carb Timing Integration**

**Connected to Training Schedule**:

1. **Check Training Schedule**

   ```javascript
   const dayType = getDayType(); // training/game/rest
   ```

2. **Calculate Needs**

   ```javascript
   const macros = calculateMacros(calories, sport, dayType);
   ```

3. **Provide Timing Advice**

   ```javascript
   const timing = getCarbTiming(dayType, sport);
   // Returns specific meal timing recommendations
   ```

4. **Display on Dashboard**
   - Day type badge
   - Target macros with progress bars
   - Meal ideas for that day type
   - Carb timing recommendations

---

## ✅ **Requirements Checklist**

- ✅ BMR (Mifflin-St Jeor) calculation
- ✅ Activity multiplier (1.2x - 1.9x)
- ✅ ±20% cal adjustment by day type
- ✅ Pre/post meal examples per sport
- ✅ Dashboard card with P/C/F progress bars
- ✅ No food logging UI
- ✅ Connect to training schedule for carb timing

---

## 📁 **Files Created**

1. **`netlify/functions/nutrition-calculator.js`** - Nutrition calculation API
2. **`js/modules/nutrition/NutritionCard.js`** - Dashboard card component

**Files Modified**:

1. **`index.html`** - Added NutritionCard module

---

## 🎯 **Key Features**

1. **Science-Based**: Mifflin-St Jeor BMR equation
2. **Activity-Aware**: Multiplies BMR by activity level
3. **Day-Specific**: Adjusts calories based on training/game/rest
4. **Sport-Specific**: Different macros for soccer, basketball, running
5. **Meal Ideas**: Practical pre/post meal examples
6. **Carb Timing**: Training schedule-aware carb recommendations
7. **No Tracking**: Provides guidance, not tracking
8. **Visual Progress**: P/C/F progress bars without food logging

**Prompt 5.1: Macro Guidance Lite - COMPLETE! ✅**
