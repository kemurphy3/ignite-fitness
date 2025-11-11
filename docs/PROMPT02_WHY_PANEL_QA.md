# Prompt 2 - WhyPanel Implementation & Manual QA Guide

## Overview

This document provides manual QA instructions for testing the "Why" Panel +
Overrides feature (Prompt 2).

## Implementation Summary

### Files Created/Modified

- `js/modules/ui/components/WhyPanel.js` - Main component for rationale display
  and overrides
- `styles/why-panel.css` - Styling for the why panel and override modal
- `js/modules/workout/WorkoutTracker.js` - Integrated WhyPanel rendering and
  plan updates
- `index.html` - Added WhyPanel script and CSS links

### Key Features

1. **WhyPanel Rendering**: Expandable panel showing AI rationale for workout
   plan
2. **Exercise Overrides**: One-tap button on each exercise to override with
   alternatives
3. **Override Modal**: Shows suggested alternates and quick actions
   (regression/progression/pattern change)
4. **Event Logging**: Logs all override events for audit trail
5. **Accessibility**: Full keyboard navigation and ARIA support

## Manual QA Instructions

### 1. WhyPanel Rendering

#### Test: Expand/Collapse Panel

1. Open workout view with a plan that has rationale
2. Look for "💡 Why this plan?" button at top of workout
3. Click the button
4. Verify panel expands showing rationale list
5. Click again to collapse
6. Verify smooth animation

**Expected:** Panel toggles smoothly, shows rationale in numbered list

#### Test: Rationale Content

1. Expand the why panel
2. Verify each rationale point is numbered (1., 2., etc.)
3. Verify content is readable and relevant

**Expected:** Each why item displays with marker and clear explanation

#### Test: Warnings Display

1. If plan has warnings (e.g., "Low readiness")
2. Expand why panel
3. Verify warnings section appears with ⚠️ icon
4. Verify warnings are clearly visible

**Expected:** Warnings appear in yellow/alert color, above rationale list

### 2. Override Button Visibility

#### Test: Button on Each Exercise

1. View workout plan
2. Scroll through exercises
3. Verify "🔄 Override" button appears on each exercise row
4. Verify button is clearly visible and not obscured

**Expected:** Every exercise has an override button on the right side

### 3. Override Modal

#### Test: Open Modal

1. Click "🔄 Override" button on any exercise
2. Verify modal appears centered on screen
3. Verify modal has dark overlay background
4. Verify modal shows exercise name in header

**Expected:** Modal opens smoothly, centered, with exercise name

#### Test: Suggested Alternates

1. Open override modal
2. Verify "Suggested Alternatives" section appears
3. Verify alternates show:
   - Exercise name (bold)
   - Rationale (smaller text below)
4. If no alternates, verify "No alternatives available" message

**Expected:** Alternates listed with explanations

#### Test: Quick Actions

1. Open override modal
2. Verify three quick action buttons:
   - 📉 Regression (reduce difficulty)
   - 📈 Progression (increase difficulty)
   - 🔄 Different pattern (change movement)

**Expected:** All three actions visible and labeled

#### Test: Close Modal

1. Open override modal
2. Click the × button in top-right
3. Verify modal closes

**Expected:** Modal closes immediately

4. Open modal again
5. Press `Escape` key
6. Verify modal closes

**Expected:** Escape key closes modal

6. Open modal again
7. Click on dark overlay (outside modal)
8. Verify modal closes

**Expected:** Click outside closes modal

### 4. Exercise Override Flow

#### Test: Select Alternate Exercise

1. Open workout with Bulgarian Split Squats
2. Click Override button
3. Click on an alternate (e.g., Walking Lunges)
4. Verify exercise name changes in workout
5. Verify notes show "(Overridden from Bulgarian Split Squat)"
6. Verify plan still has same structure

**Expected:** Exercise swaps, note added, structure maintained

#### Test: Apply Regression

1. Open override modal on 3-set exercise
2. Click "📉 Regression" quick action
3. Verify sets reduced to 2
4. Verify notes show "(Regression applied)"

**Expected:** Sets reduce by 1, note added

#### Test: Apply Progression

1. Open override modal on 3-set exercise
2. Click "📈 Progression" quick action
3. Verify sets increased to 4
4. Verify notes show "(Progression applied)"

**Expected:** Sets increase by 1, note added

#### Test: Different Pattern

1. Open override modal
2. Click "🔄 Different pattern" quick action
3. Verify exercise changes to different pattern

**Expected:** Exercise changes to alternate pattern

### 5. Plan Persistence

#### Test: Override Persists

1. Override an exercise
2. Close workout view
3. Reopen workout view
4. Verify overridden exercise persists

**Expected:** Override persists across views

#### Test: Structure Maintained

1. Override multiple exercises
2. Verify plan still has:
   - Same number of blocks
   - Same intensity scale
   - Same why rationale

**Expected:** Plan structure intact after overrides

### 6. Accessibility

#### Test: Keyboard Navigation

1. Open workout view
2. Tab to "Why this plan?" button
3. Press Enter to expand
4. Verify focus remains on button
5. Tab through exercises
6. Tab to Override buttons
7. Press Enter to open modal
8. Tab through modal buttons
9. Press Enter to select

**Expected:** All elements focusable and activatable via keyboard

#### Test: Screen Reader Support

1. Enable screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
2. Navigate to why panel
3. Verify reads "Why this plan, button, collapsed"
4. Toggle panel
5. Verify reads "expanded"
6. Verify reads rationale list with numbers

**Expected:** Screen reader announces all states and content

#### Test: ARIA Attributes

1. Inspect why panel button
2. Verify `aria-expanded` attribute
3. Verify `aria-controls` points to content
4. Inspect modal
5. Verify `role="dialog"`
6. Verify `aria-labelledby` points to title
7. Verify `aria-modal="true"`

**Expected:** All ARIA attributes present and correct

### 7. Console & Events

#### Test: No Console Errors

1. Open browser DevTools Console
2. Load workout with why panel
3. Expand/collapse panel
4. Open close modal
5. Override exercises
6. Verify no errors in console

**Expected:** Clean console, no errors

#### Test: Event Logging

1. Override an exercise
2. Check console for:
   - "Exercise override applied" log
   - Override data with timestamp
3. Open Network tab
4. Verify event emitted to EventBus

**Expected:** All overrides logged with full data

## Definition of Done Checklist

- [x] WhyPanel renders rationale
- [x] Override buttons visible on each exercise
- [x] Modal opens/closes smoothly
- [x] Alternative exercises listed
- [x] Quick actions work (regression/progression/pattern)
- [x] Override updates plan
- [x] Plan re-renders after override
- [x] Override logs to console and EventBus
- [x] Keyboard navigation works
- [x] Screen reader announces states
- [x] ARIA attributes present
- [x] No console errors

## Browser Testing

Test on:

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (if available)
- Mobile viewport (320px-768px)

## Known Issues

None at this time.

## Future Enhancements

- Add exercise video demos to modal
- Save override preferences for future workouts
- Track override frequency in analytics
- Add "Why was this exercise removed?" explanation
