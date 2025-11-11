# Cursor Execution Prompts for Ignite Fitness

_Strategic fixes and improvements identified through comprehensive workflow
analysis_

## Priority 1: Critical Syntax Bug Fix

### PROMPT A1: Fix Function Redeclaration Error

```
CRITICAL BUG FIX NEEDED:

File: js/core/auth.js
Error: Identifier 'hideLoginForm' has already been declared
Line: ~200

ISSUE: The function `hideLoginForm` is declared multiple times in the same scope, causing a syntax error.

TASK:
1. Find all instances of `hideLoginForm` declarations in js/core/auth.js
2. Remove duplicate declarations while preserving functionality
3. Ensure the function is only declared once but can be accessed where needed
4. Test that login/logout flow still works after fix

VERIFICATION: Run `node -c js/core/auth.js` to ensure no syntax errors
```

## Priority 2: Boot Sequence Integration Issues

### PROMPT A2: Fix Boot Sequence Integration

```
INTEGRATION ISSUE:

Problem: index.html has conflicting initialization patterns. Both old manual initialization and new BootSequence are present, causing potential race conditions.

Files to examine:
- index.html (lines 4098-4130)
- js/app-modular.js
- js/boot-sequence.js

TASK:
1. Remove legacy initialization code from index.html that conflicts with BootSequence
2. Ensure only one initialization pathway exists
3. Fix the function redefinition where `initializeApp()` calls itself recursively
4. Ensure DOMContentLoaded only triggers BootSequence.boot(), not legacy functions

SPECIFIC FIXES NEEDED:
- Remove duplicate initializeApp() calls in index.html
- Clean up the recursive call on line 4102: `initializeApp();` inside `initializeApp()`
- Ensure BootSequence handles all initialization properly
```

## Priority 3: Authentication Flow Optimization

### PROMPT A3: Streamline Authentication Router Integration

```
ENHANCEMENT TASK:

The auth system has been refactored but needs final integration cleanup:

ANALYSIS NEEDED:
1. Verify AuthManager.getAuthState() is called correctly throughout
2. Ensure Router.init(authState) happens after auth is loaded
3. Check that SimpleModeManager integrates with the auth flow
4. Validate that login/logout properly updates router state

FILES TO REVIEW:
- js/modules/auth/AuthManager.js
- js/modules/ui/Router.js
- js/modules/ui/SimpleModeManager.js
- js/boot-sequence.js

IMPROVEMENTS:
1. Add error boundaries around auth state transitions
2. Ensure auth events properly trigger router updates
3. Add debug logging for auth state changes in development
4. Validate that logout clears all relevant storage keys
```

## Priority 4: Simple Mode UX Enhancement

### PROMPT A4: Enhance Simple Mode User Experience

```
UX IMPROVEMENT TASK:

Current state: SimpleModeManager exists but needs better integration with the UI.

OBJECTIVES:
1. Create a visible Simple Mode toggle in the UI
2. Hide complex features when Simple Mode is enabled
3. Add onboarding hints for new users in Simple Mode
4. Ensure smooth transitions between Simple and Advanced modes

IMPLEMENTATION:
1. Add Simple Mode toggle to the header/settings
2. Create CSS classes: .simple-mode-hide, .advanced-mode-only
3. Update components to respect Simple Mode state
4. Add contextual help for Simple Mode users

FEATURES TO HIDE IN SIMPLE MODE:
- Advanced AI coaching panels
- Complex analytics charts
- Strava integration (initially)
- Advanced workout customization
- Technical metrics and data

FEATURES TO EMPHASIZE IN SIMPLE MODE:
- Clear goal setting
- Basic workout tracking
- Simple progress visualization
- Easy-to-understand feedback
```

## Priority 5: Workflow Enhancement

### PROMPT A5: Complete First-Time User Journey

```
END-TO-END FLOW IMPLEMENTATION:

Create a seamless first-time user experience from landing to first workout completion.

WORKFLOW TO IMPLEMENT:
1. Landing → Clear value proposition
2. Registration → Simple 2-field form
3. Goal Setting → 3-5 simple options (lose weight, gain muscle, get fit, etc.)
4. Quick Setup → Time availability, basic equipment
5. First Workout → Generated immediately, beginner-friendly
6. Workout Tracking → Simple RPE + completion tracking
7. Progress View → Basic metrics (workouts completed, consistency)

SPECIFIC TASKS:
1. Create a streamlined onboarding flow (3-4 steps max)
2. Generate immediate first workout based on goals
3. Add workout completion tracking with simple feedback
4. Create basic progress dashboard showing consistency
5. Add achievement system (completed first workout, 1 week streak, etc.)

TECHNICAL REQUIREMENTS:
- Should work in Simple Mode by default
- Mobile-first responsive design
- Offline capability
- Clear progress indicators
```

## Priority 6: Error Handling & Debug Tools

### PROMPT A6: Robust Error Handling and Debug Tools

```
RELIABILITY IMPROVEMENT:

Add comprehensive error handling and debug tools for better development and user experience.

ERROR HANDLING NEEDED:
1. Network failure handling (offline mode)
2. Storage quota exceeded handling
3. Authentication token expiration
4. Workout generation failures
5. Data sync conflicts

DEBUG TOOLS TO ADD:
1. Development mode debug panel (already partially exists)
2. Auth state inspector
3. Storage inspector
4. Network request monitor
5. Performance metrics

IMPLEMENTATION:
1. Wrap critical functions in try-catch with user-friendly messages
2. Add retry mechanisms for network requests
3. Implement fallback behaviors when AI services are unavailable
4. Create debug panel accessible via konami code or ?debug=1
5. Add performance monitoring for slow operations

USER-FACING IMPROVEMENTS:
- Loading states for all async operations
- Graceful degradation when features are unavailable
- Clear error messages with suggested actions
- Offline mode indicators and capabilities
```

## Priority 7: Performance & Mobile Optimization

### PROMPT A7: Mobile and Performance Optimization

```
PERFORMANCE ENHANCEMENT:

Optimize the app for mobile devices and improve loading performance.

CURRENT ISSUES IDENTIFIED:
- Multiple CSS files loaded (could be concatenated)
- Large JavaScript bundle on initial load
- No lazy loading for advanced features
- Service worker could be more aggressive with caching

MOBILE OPTIMIZATIONS:
1. Implement touch-friendly interactions
2. Add haptic feedback for key actions
3. Optimize layout for various screen sizes
4. Implement pull-to-refresh for data updates
5. Add gesture navigation where appropriate

PERFORMANCE IMPROVEMENTS:
1. Code splitting - load Simple Mode features first
2. Lazy load advanced features only when needed
3. Implement service worker caching strategy
4. Optimize image sizes and formats
5. Add resource hints (preload, prefetch)

METRICS TO TRACK:
- First Contentful Paint (FCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)
- Bundle size analysis
```

## Priority 8: Testing & Quality Assurance

### PROMPT A8: Comprehensive Testing Strategy

```
TESTING IMPLEMENTATION:

Create comprehensive test coverage for critical user flows.

CRITICAL PATHS TO TEST:
1. Authentication flow (login, logout, session persistence)
2. Onboarding process (goal setting, preferences)
3. Workout generation and tracking
4. Simple Mode toggle and feature hiding
5. Offline functionality
6. Data persistence and sync

TEST TYPES NEEDED:
1. Unit tests for core business logic
2. Integration tests for API endpoints
3. End-to-end tests for user workflows
4. Visual regression tests for UI consistency
5. Performance tests for key operations

SPECIFIC TEST SCENARIOS:
- New user completes onboarding and first workout
- Existing user switches between Simple and Advanced modes
- Network interruption during workout tracking
- Storage quota exceeded scenarios
- Token expiration and refresh
- Cross-browser compatibility

TOOLING:
- Expand existing Vitest configuration
- Add Playwright for E2E testing
- Implement visual testing with Percy or similar
- Add performance testing with Lighthouse CI
```

---

## Execution Strategy for Cursor

### Phase 1: Critical Fixes (Do First)

- A1: Fix function redeclaration bug
- A2: Clean up boot sequence integration

### Phase 2: Core Functionality

- A3: Streamline authentication
- A5: Complete first-time user journey

### Phase 3: User Experience

- A4: Enhance Simple Mode UX
- A7: Mobile optimization

### Phase 4: Reliability & Quality

- A6: Error handling and debug tools
- A8: Testing strategy

### Notes for Cursor Execution:

1. **Test after each change** - Run the app in browser to verify
2. **Preserve existing functionality** - Don't break working features
3. **Mobile-first approach** - Test on mobile viewport sizes
4. **Simple Mode priority** - Default to simpler experiences
5. **Progressive enhancement** - Advanced features should be additive

Each prompt is designed to be self-contained and can be executed independently
while building on the previous improvements.
