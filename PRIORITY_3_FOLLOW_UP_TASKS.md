# Priority 3: Follow-Up Tasks

## 🔴 HIGH PRIORITY

### Task 1: UI Integration for Recovery Day Override

**Status**: ⏳ Pending  
**Priority**: HIGH  
**Estimated Time**: 2-3 hours

**Description**: Implement UI components to display the recovery day
notification and allow users to override with a normal workout.

**Files to Create/Modify**:

- Identify workout display component (likely in `js/modules/ui/`)
- Add notification banner for `overrideAvailable: true`
- Add "Prefer normal workout" button
- Handle user choice and update workout plan accordingly

**Acceptance Criteria**:

- [ ] Notification appears when `plan.notes` contains `overrideAvailable: true`
- [ ] User can click "Prefer normal workout" button
- [ ] Workout plan updates when override is selected
- [ ] Preference is saved for future use

---

### Task 2: User Preference Storage for Recovery Day

**Status**: ⏳ Pending  
**Priority**: HIGH  
**Estimated Time**: 1 hour

**Description**: Store user preference for recovery day handling when Simple
Mode creates minimal workouts.

**Files to Modify**:

- `js/modules/ui/SimpleModeManager.js` or
- `js/modules/data/StorageManager.js`

**Implementation**:

```javascript
// Add preference key
const RECOVERY_DAY_PREFERENCE_KEY = 'ignite.ui.recoveryDayPreference';

// Store preference
saveRecoveryDayPreference(preference) {
    // preference: 'accept' | 'override' | 'ask'
}

// Retrieve preference
getRecoveryDayPreference() {
    // Returns stored preference or 'ask' as default
}
```

**Acceptance Criteria**:

- [ ] Preference stored in localStorage/StorageManager
- [ ] Preference retrieved on workout generation
- [ ] Preference used to auto-handle recovery day conflicts
- [ ] Default is 'ask' (show notification)

---

### Task 3: Integration Tests

**Status**: ⏳ Pending  
**Priority**: HIGH  
**Estimated Time**: 3-4 hours

**Description**: Create actual unit tests (Vitest) for the new functionality,
not just conceptual verification scripts.

**Files to Create**:

- `tests/unit/load-calculator-bounds.test.js`
- `tests/unit/exercise-adapter-fallbacks.test.js`
- `tests/unit/expert-coordinator-validation.test.js`

**Test Coverage Needed**:

- LoadCalculator bounds checking with negative values
- LoadCalculator division by zero protection
- LoadCalculator ratio capping
- ExerciseAdapter fallback chain progression
- ExerciseAdapter body-part-specific fallbacks
- ExerciseAdapter never returns empty alternatives
- ExpertCoordinator mandatory validation
- ExpertCoordinator graceful degradation
- ExpertCoordinator validation caching

**Acceptance Criteria**:

- [ ] All tests pass
- [ ] Edge cases covered
- [ ] Test coverage > 80% for new code

---

## 🟡 MEDIUM PRIORITY

### Task 4: Documentation Updates

**Status**: ⏳ Pending (implementation doc created)  
**Priority**: MEDIUM  
**Estimated Time**: 1 hour

**Description**: Update main README and component documentation to explain new
fallback behaviors.

**Files to Update**:

- `README.md` - Add section on safety enhancements
- Component docs - Document fallback behaviors

**Acceptance Criteria**:

- [ ] README updated with Priority 3 enhancements
- [ ] Fallback behaviors documented
- [ ] Examples provided

---

### Task 5: Edge Case Testing

**Status**: ⏳ Pending  
**Priority**: MEDIUM  
**Estimated Time**: 2-3 hours

**Description**: Manual testing of all edge cases to ensure robustness.

**Test Cases**:

- [ ] Negative load values
- [ ] Zero load values
- [ ] Extreme ratios (>10.0, <0.1)
- [ ] Unknown injury locations
- [ ] Missing validator (graceful degradation)
- [ ] Validation cache eviction
- [ ] Simple Mode + Recovery Day interaction
- [ ] Multiple injuries simultaneously

**Acceptance Criteria**:

- [ ] All edge cases tested
- [ ] No crashes observed
- [ ] Appropriate fallbacks triggered

---

### Task 6: Monitoring Dashboard Updates

**Status**: ⏳ Pending  
**Priority**: MEDIUM  
**Estimated Time**: 1-2 hours

**Description**: Add visibility for new logging events in monitoring/analytics.

**Events to Monitor**:

- `LOAD_BOUNDS_CHECK` - Track when bounds checking is triggered
- `EXERCISE_FALLBACK` - Track fallback usage patterns
- `VALIDATION_WARNINGS` - Track validation issues
- `RECOVERY_DAY_SIMPLE_MODE_COLLISION` - Track collision frequency

**Acceptance Criteria**:

- [ ] Events visible in monitoring dashboard
- [ ] Alerts configured for high frequency events
- [ ] Analytics track fallback usage

---

## 🟢 LOW PRIORITY

### Task 7: Performance Metrics

**Status**: ⏳ Pending  
**Priority**: LOW  
**Estimated Time**: 1 hour

**Description**: Measure and report on validation cache hit rate and performance
improvements.

**Metrics to Track**:

- Validation cache hit rate
- Average validation time (with vs without cache)
- Memory usage of validation cache
- Cache eviction frequency

**Acceptance Criteria**:

- [ ] Metrics collected
- [ ] Performance report generated
- [ ] Cache size optimized if needed

---

### Task 8: User Education

**Status**: ⏳ Pending  
**Priority**: LOW  
**Estimated Time**: 1 hour

**Description**: Create help text/tooltips explaining recovery day behavior in
Simple Mode.

**Content Needed**:

- Help text for recovery day notification
- Tooltip explaining Simple Mode + Recovery Day interaction
- FAQ entry about overriding recovery days

**Acceptance Criteria**:

- [ ] Help text added to UI
- [ ] Tooltips implemented
- [ ] FAQ updated

---

## 📊 Summary

**Total Tasks**: 8  
**High Priority**: 3  
**Medium Priority**: 3  
**Low Priority**: 2

**Estimated Total Time**: 12-16 hours

**Recommendation**: Start with High Priority tasks (Tasks 1-3) before moving to
Medium/Low priority items.
