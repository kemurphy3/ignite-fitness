# Prompt 8 - Progress & Trends Manual QA Guide

## Overview

This document provides manual QA instructions for testing the Progress & Trends
feature (Prompt 8).

## Implementation Summary

### Files Created/Modified

- `js/modules/ui/charts/Trends.js` - Chart rendering with lazy loading
- `styles/charts.css` - Chart styling and skeleton states
- `tests/ui/charts-trends.test.js` - Unit tests for aggregation
- `index.html` - Added Trends.js and charts.css
- `package.json` - Added Chart.js dependency

### Key Features

1. **Lazy Loading**: Charts load only when scrolled into viewport
2. **Chart.js Integration**: Dynamic import of Chart.js library
3. **Three Chart Types**: Strength PRs, Volume Trend, Readiness Consistency
4. **Caching**: Last 30 days data cached for 5 minutes
5. **Skeleton Loading**: Shows loading state while fetching data
6. **No Placeholders**: All `.chart-placeholder` elements replaced with real
   charts

## Manual QA Instructions

### 1. Chart Library Loading

#### Test: Charts Load on Page Load

1. Navigate to dashboard
2. Scroll to progress section
3. Verify Chart.js loads dynamically
4. Verify no network errors for Chart.js CDN
5. Verify charts begin rendering

**Expected:** Charts load via CDN without blocking main thread

#### Test: Lazy Loading Behavior

1. Open browser DevTools
2. Navigate to dashboard
3. Don't scroll to charts yet
4. Verify Chart.js NOT loaded yet (check Network tab)
5. Scroll to charts
6. Verify Chart.js loads as user scrolls
7. Verify charts appear

**Expected:** Charts only load when scrolled near

#### Test: Performance (>100ms Limit)

1. Open browser DevTools Performance tab
2. Start recording
3. Navigate to dashboard and scroll to charts
4. Stop recording
5. Verify chart initialization takes <100ms for first paint
6. Verify main thread not blocked

**Expected:** Chart loading is non-blocking

### 2. Strength Progress Chart (PRs)

#### Test: PR Detection

1. Complete workout with heavy lifts (1-5 reps)
2. Navigate to progress section
3. Verify strength chart shows recent PRs
4. Verify exercise names displayed
5. Verify estimated 1RM shown

**Expected:** Chart shows actual PR data

#### Test: No Data State

1. New profile with no workouts
2. Navigate to progress section
3. Verify chart shows "No PRs yet"
4. Verify no errors

**Expected:** Graceful handling of no data

#### Test: Multiple Exercises

1. Complete workouts with 3+ different exercises
2. Navigate to progress section
3. Verify all exercises shown in chart
4. Verify correct 1RM for each

**Expected:** Multi-exercise PR display

#### Test: PR Updates Over Time

1. Complete workout with 185x5 bench press
2. View chart, note 1RM
3. Complete workout with 225x3 bench press
4. View chart again
5. Verify new higher 1RM displayed

**Expected:** PRs update with better lifts

### 3. Volume Trend Chart (Weekly Load)

#### Test: Weekly Aggregation

1. Complete 3+ workouts across different weeks
2. Navigate to progress section
3. Verify volume chart shows weekly data
4. Verify weeks grouped correctly
5. Verify date labels on x-axis

**Expected:** Weekly volume aggregated by week

#### Test: Category Breakdown

1. Complete workouts with upper, lower, core, cardio
2. Navigate to progress section
3. Verify volume chart has 4 lines (one per category)
4. Verify colors: red (upper), blue (lower), green (core), yellow (cardio)
5. Hover over data points
6. Verify tooltip shows category and volume

**Expected:** Volume broken down by exercise category

#### Test: No Data State

1. New profile with no workouts
2. Navigate to progress section
3. Verify chart shows flat line at zero
4. Verify legend still visible

**Expected:** Graceful handling of no data

#### Test: Trend Over Time

1. Complete workouts for 3-4 weeks
2. Navigate to progress section
3. Verify volume increases or decreases over time
4. Verify trend is visible in chart

**Expected:** Volume trends displayed

### 4. Readiness Trend Chart (Consistency)

#### Test: Readiness Scores Tracked

1. Complete workouts with readiness scores
2. Navigate to progress section
3. Verify consistency chart shows readiness over time
4. Verify scores are out of 10 (0-10 scale)
5. Verify dates on x-axis

**Expected:** Readiness trend displayed

#### Test: Score Range

1. Complete workouts with readiness 5-10 range
2. Navigate to progress section
3. Verify chart y-axis shows 0-10
4. Verify scores plotted correctly

**Expected:** Correct 0-10 scale

#### Test: Inferred Readiness

1. Complete workouts without explicit readiness
2. Navigate to progress section
3. Verify chart still attempts to show some trend
4. Verify no errors if readiness missing

**Expected:** Graceful handling of missing readiness

#### Test: Recovery Pattern Visualization

1. Track readiness for 2 weeks
2. Navigate to progress section
3. Verify pattern shows recovery/readiness trends
4. Verify can identify good/bad days

**Expected:** Readiness patterns visible

### 5. Lazy Loading & Performance

#### Test: Intersection Observer

1. Open browser DevTools
2. Monitor Network tab
3. Navigate to dashboard
4. Don't scroll to charts
5. Verify Chart.js not loaded
6. Scroll to charts
7. Verify Chart.js loads when visible

**Expected:** Lazy loading works correctly

#### Test: Multiple Chart Updates

1. Have charts on screen
2. Complete new workout
3. Navigate away from progress
4. Return to progress
5. Verify charts update or remain cached
6. Verify performance good on return

**Expected:** Efficient chart updates

#### Test: Cache Behavior

1. View charts on progress section
2. Note chart data
3. Navigate away (< 5 minutes)
4. Return to progress section
5. Verify charts appear instantly (no loading)
6. Verify data is cached

**Expected:** 5-minute cache works

#### Test: Cache Invalidation

1. View charts on progress section
2. Navigate away
3. Wait > 5 minutes
4. Return to progress section
5. Verify charts reload with fresh data

**Expected:** Cache expires after 5 minutes

### 6. Skeleton Loading States

#### Test: Skeleton Shown During Load

1. Navigate to progress section
2. Scroll quickly to charts
3. Verify skeleton appears while loading
4. Verify skeleton has animated lines
5. Verify transitions to chart smoothly

**Expected:** Skeleton loading states displayed

#### Test: Error Handling

1. Simulate network error (offline mode)
2. Navigate to progress section
3. Verify error message shown
4. Verify no broken charts

**Expected:** Graceful error handling

### 7. Mobile Responsiveness

#### Test: Mobile Layout

1. Open on mobile device or resize to mobile
2. Navigate to progress section
3. Verify charts fit on screen
4. Verify charts are scrollable
5. Verify text readable

**Expected:** Charts work on mobile

#### Test: Touch Interactions

1. Open on touch device
2. Swipe on charts
3. Pinch to zoom (if supported)
4. Verify interactions work smoothly

**Expected:** Touch-friendly charts

### 8. Navigation & State

#### Test: Navigate Away and Back

1. View charts on progress section
2. Navigate to workout tab
3. Return to progress section
4. Verify charts still rendered
5. Verify no re-loading delay

**Expected:** Charts persist on navigation

#### Test: Page Refresh

1. View charts on progress section
2. Refresh page
3. Return to progress section
4. Verify charts load again
5. Verify cache used if available

**Expected:** Charts reload on refresh

### 9. Chart Placeholders Removed

#### Test: No Placeholders Exist

1. Search codebase for `.chart-placeholder`
2. Verify no placeholder text remains
3. Verify all charts have real content

**Expected:** Zero chart placeholders in UI

#### Test: All Charts Render

1. Navigate to progress section
2. Count visible charts
3. Verify all 3 chart types render
4. Verify no "Chart will appear here" text

**Expected:** All placeholders replaced

### 10. Integration with StorageManager

#### Test: Data Retrieval

1. Complete workouts over 30 days
2. Navigate to progress section
3. Verify charts show last 30 days only
4. Verify older data not included

**Expected:** Only last 30 days shown

#### Test: Data Updates

1. View charts
2. Complete new workout
3. Navigate away and back
4. Verify charts update with new data

**Expected:** Charts reflect new data

## Definition of Done Checklist

### Core Functionality

- [ ] Chart.js lazy loads on scroll
- [ ] Strength PRs chart renders with real data
- [ ] Volume trend chart shows weekly aggregates
- [ ] Readiness trend chart displays scores over time
- [ ] All chart placeholders replaced

### Performance

- [ ] Charts load in <100ms (non-blocking)
- [ ] Main thread not blocked during loading
- [ ] IntersectionObserver used for lazy loading
- [ ] Cache reduces redundant loads

### Display

- [ ] Skeleton loading states shown
- [ ] Error handling works
- [ ] No data states handled gracefully
- [ ] Tooltips show correct data

### Integration

- [ ] StorageManager provides session data
- [ ] 30-day window respected
- [ ] Data updates on navigation
- [ ] Cache expires after 5 minutes

### User Experience

- [ ] Charts don't block main thread
- [ ] Smooth scrolling with charts
- [ ] Mobile responsive
- [ ] Touch interactions work

## Expected Behaviors

### Scenario 1: First Time User

- **State**: No workouts yet
- **Expected**: Charts show "No data" states gracefully
- **Performance**: Charts still load but show empty states

### Scenario 2: Active User with 30 Days Data

- **State**: 30 days of varied workouts
- **Expected**: All charts populated with real data
- **Performance**: Charts load instantly from cache

### Scenario 3: Heavy Week

- **State**: 7 workouts in one week
- **Expected**: Volume chart shows spike
- **Rationale**: Weekly aggregation shows training load

### Scenario 4: PR Achieved

- **State**: New personal record lift
- **Expected**: Strength chart updates with new max 1RM
- **Tooltip**: Shows weight × reps → estimated 1RM

## Known Issues

None at this time.

## Future Enhancements

- Export charts as images
- Custom date range selection
- Additional chart types (RPE trends, load distribution)
- Chart interactions (click to filter, zoom)
