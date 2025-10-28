# Prompt 5 - Workout Flow & Timer Manual QA Guide

## Overview
This document provides manual QA instructions for testing the Workout Flow & Timer feature (Prompt 5).

## Implementation Summary

### Files Created/Modified
- `js/modules/ui/components/WorkoutTimer.js` - Session and rest timer functionality
- `styles/workout-timer.css` - Timer styling
- `js/modules/workout/WorkoutTracker.js` - Integrated timer rendering and session management
- `index.html` - Added WorkoutTimer script and CSS links
- `tests/workout/workout-timer.test.js` - Unit tests for timer logic

### Key Features
1. **Session Timer**: Overall workout duration tracking with pause/resume
2. **Rest Countdown**: Per-set rest periods with +15s and skip controls
3. **State Persistence**: Survives page refresh and app backgrounding
4. **Offline-First**: No network required during workout
5. **Touch-Friendly**: Large buttons optimized for mobile

## Manual QA Instructions

### 1. Session Timer Functionality

#### Test: Start Session
1. Navigate to workout view
2. Start a new workout session
3. Verify "Session" timer starts counting from 00:00
4. Verify timer increments by 1 second each second

**Expected:** Timer displays and counts up continuously

#### Test: Pause Session
1. Session timer running
2. Click ⏸ (pause) button
3. Verify timer stops counting
4. Verify button changes to ▶ (play)

**Expected:** Timer pauses immediately on button click

#### Test: Resume Session
1. Session paused
2. Click ▶ (resume) button
3. Verify timer resumes from where it paused
4. Verify no time was lost

**Expected:** Timer resumes without losing time

#### Test: Stop Session
1. Session running
2. Click ⏹ (stop) button
3. Verify timer stops and resets to 00:00
4. Verify timer state cleared

**Expected:** Timer stops completely and resets

### 2. Rest Timer Functionality

#### Test: Start Rest Period
1. Complete a set (or manually trigger rest)
2. Verify "Rest" timer appears
3. Verify countdown starts from configured duration (e.g., 90 seconds)
4. Verify timer counts down to 0

**Expected:** Rest timer displays and counts down

#### Test: Rest Timer Completion
1. Rest timer counting down
2. Wait for timer to reach 0
3. Verify timer disappears
4. Verify rest period ends

**Expected:** Timer auto-completes and hides when reaching 0

#### Test: Add Time to Rest
1. Rest timer active
2. Click "+15s" button
3. Verify timer adds 15 seconds
4. Verify countdown resumes

**Expected:** Rest time increases by 15 seconds

#### Test: Skip Rest
1. Rest timer active
2. Click "Skip" button
3. Verify rest timer stops and disappears

**Expected:** Rest period ends immediately

### 3. Session Persistence

#### Test: Page Refresh Persistence
1. Start workout session with timer running
2. Wait 10-15 seconds
3. Note the current session time
4. Refresh the page (F5 or Ctrl+R)
5. Verify session timer resumes
6. Verify time is approximately correct (within 1-2 seconds)

**Expected:** Session state survives page refresh

#### Test: Background App Resumption
1. Start workout on mobile device
2. Let timer run for 10-15 seconds
3. Note the current time
4. Press Home button to background app
5. Wait 5-10 seconds
6. Return to app
7. Verify session timer continues

**Expected:** Timer continues where it left off

#### Test: Data Loss Prevention
1. Start workout and complete 1-2 sets
2. Force close the app (swipe away)
3. Reopen the app
4. Navigate back to workout view
5. Verify previous sets are still recorded
6. Verify session timer shows correct elapsed time

**Expected:** No data loss on app close/reopen

### 4. Rest Timer Accuracy

#### Test: Timer Accuracy
1. Start a 90-second rest timer
2. Use external clock/timer to verify
3. Monitor countdown over full period
4. Verify timer reaches 0 within ±1 second

**Expected:** Timer accurate to within 1 second

#### Test: Precision Over Time
1. Start session timer
2. Let it run for 5 minutes (300 seconds)
3. Compare with external timer
4. Verify difference is ≤ 1 second

**Expected:** Timer maintains accuracy over time

### 5. Mobile Optimization

#### Test: Touch Targets
1. Open on mobile device (≤ 390px width)
2. Verify all timer buttons are at least 44px × 44px
3. Verify buttons are easily tappable
4. Verify spacing between buttons is adequate

**Expected:** All buttons meet 44px minimum touch target size

#### Test: UI Responsiveness
1. Start workout on mobile viewport
2. Interact with timers
3. Verify no lag or jank
4. Verify animations are smooth (60fps)

**Expected:** Smooth, responsive UI with no lag

#### Test: Visual Hierarchy
1. View workout screen on mobile
2. Verify session timer is prominent
3. Verify rest timer stands out when active
4. Verify timer displays are readable (large font)

**Expected:** Clear visual hierarchy and readable text

### 6. Offline Functionality

#### Test: No Network Required
1. Enable airplane mode on device
2. Start workout session
3. Complete several sets
4. Verify all timers work
5. Verify data saves locally
6. Disable airplane mode
7. Verify data syncs when network returns

**Expected:** Full functionality without network

#### Test: Network Reconnection
1. Complete workout offline
2. Reconnect to network
3. Verify session data syncs
4. Verify no data loss

**Expected:** Data syncs successfully after reconnection

### 7. Integration with Workout Flow

#### Test: Timer with Exercise Completion
1. Complete a set of exercises
2. Verify rest timer starts automatically
3. Verify session timer continues
4. Mark next set complete
5. Verify rest timer restarts

**Expected:** Timers work seamlessly with exercise flow

#### Test: Multiple Set Rest Periods
1. Complete set 1, verify 90s rest timer
2. Wait or skip rest
3. Complete set 2, verify 90s rest timer again
4. Repeat for set 3

**Expected:** Rest timer works for each set

#### Test: Timer with Exercise Substitution
1. During workout, substitute an exercise
2. Verify session timer continues uninterrupted
3. Verify no timer reset
4. Complete substituted exercise
5. Verify rest timer works normally

**Expected:** Exercise substitutions don't reset timers

### 8. Edge Cases

#### Test: Rapid Start/Stop
1. Start session
2. Immediately stop
3. Start again
4. Verify no timer errors

**Expected:** No errors with rapid state changes

#### Test: Very Long Session
1. Start session
2. Let run for 60+ minutes
3. Verify timer displays correctly (01:00:00 format)
4. Verify no overflow or display issues

**Expected:** Timer handles long sessions gracefully

#### Test: Browser Tab Switching
1. Start workout in browser tab
2. Switch to another tab for 30 seconds
3. Return to workout tab
4. Verify timer continued

**Expected:** Timer continues in background tab

### 9. Performance

#### Test: CPU Usage
1. Open DevTools Performance tab
2. Start workout
3. Monitor CPU usage for 1 minute
4. Verify CPU usage is reasonable (< 10% idle state)

**Expected:** Low CPU usage

#### Test: Memory Usage
1. Open DevTools Memory tab
2. Start workout
3. Monitor memory usage for 5 minutes
4. Verify no memory leaks

**Expected:** Stable memory usage, no leaks

#### Test: Battery Impact
1. Start workout on mobile device
2. Monitor battery usage for 10 minutes
3. Verify reasonable power consumption

**Expected:** Efficient power usage

### 10. Accessibility

#### Test: Screen Reader Support
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate to workout timers
3. Verify timer values are announced
4. Verify button labels are read
5. Verify timer updates are announced

**Expected:** Complete screen reader support

#### Test: Keyboard Navigation
1. Tab to session timer controls
2. Verify focus indicators visible
3. Press Space or Enter to activate buttons
4. Verify timers respond to keyboard

**Expected:** Full keyboard navigation support

#### Test: High Contrast Mode
1. Enable high contrast mode in OS
2. View workout timers
3. Verify text is readable
4. Verify buttons are distinguishable

**Expected:** Works with high contrast themes

## Definition of Done Checklist

### Timer Functionality
- [ ] Session timer starts and counts accurately
- [ ] Rest timer counts down and auto-completes
- [ ] Pause/resume works correctly
- [ ] Stop resets timers
- [ ] +15s adds time to rest
- [ ] Skip stops rest timer

### State Persistence
- [ ] Session survives page refresh
- [ ] Session survives app backgrounding
- [ ] Rest state persists across refresh
- [ ] No data loss on reload

### Offline Functionality
- [ ] Works without network connection
- [ ] Data syncs when network returns
- [ ] All features work offline

### Performance
- [ ] Timer accurate to ±1 second
- [ ] No UI jank on mobile
- [ ] Smooth animations (60fps)
- [ ] Low CPU/battery usage

### Mobile Optimization
- [ ] Touch targets ≥ 44px
- [ ] Responsive on ≤ 390px width
- [ ] Large, readable fonts
- [ ] No horizontal scrolling

### Integration
- [ ] Works with exercise flow
- [ ] Handles exercise substitutions
- [ ] No timer reset on overrides

## Browser Testing

Test on:
- Chrome/Edge (latest) - Desktop and mobile
- Firefox (latest)
- Safari (iOS) - if available
- Mobile viewport (320px-768px)

## Known Issues

None at this time.

## Future Enhancements

- Visual rest timer with progress bar animation
- Custom rest period settings per exercise
- Timer sound alerts for rest completion
- Volume control for audio alerts
- Ambient mode (keep screen on during workout)

