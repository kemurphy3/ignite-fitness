# Cursor Prompt: Complete All Pending Fixes for Ignite Fitness

## Critical Security Fixes (DO THESE FIRST)

### 1. Remove Exposed API Secrets from config.js
The current `config.js` file has hardcoded API secrets that are exposed in the repository. This is a critical security vulnerability.

**Files to fix:**
- `/config.js` - Contains exposed Strava client secret and admin key

**Required actions:**
1. Create a `.env.local` file with all sensitive keys
2. Add `.env.local` to `.gitignore` immediately
3. Replace `config.js` with a template file that reads from environment variables
4. Remove the hardcoded Strava client secret: `8d502e2d7f16d70bc03f75cafdef3fa0fc541be6`
5. Update all references to use `process.env` variables
6. For Netlify deployment, set environment variables in Netlify dashboard

```javascript
// config.js should become:
const STRAVA_TOKENS = {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET
};

const API_CONFIG = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    admin: {
        key: process.env.ADMIN_KEY
    }
};
```

## Core Implementation Fixes

### 2. Complete Level 2 AI Context-Aware System Integration
The AI system is documented but not fully connected to the UI.

**Files to complete:**
- `/js/ai/context-aware-ai.js` - File is truncated, missing critical methods
- Connect AI to main UI in `/index.html`

**Required implementations:**
- Complete the `buildUserContext()` method
- Implement `detectPatterns()` for workout analysis
- Add `selectOptimalModel()` for cost-effective AI routing
- Create AI chat interface in the main dashboard
- Connect pattern detection to workout logging
- Implement success/failure tracking system
- Add context caching to reduce API calls

### 3. Implement Seasonal Training Phase Selection
The seasonal training system is fully designed in prompts but not implemented.

**Create new file:**
- `/js/training/seasonal-training.js`

**Required features:**
- Season phase modal on sport selection (Off-season, Pre-season, In-season, Playoffs)
- Pre-season countdown to first game date
- In-season game day scheduling
- Automatic workout adjustment based on phase
- Volume and intensity multipliers per phase
- Integration with workout generator

### 4. Fix Database Connection and Sync
The database schema exists but needs proper connection setup.

**Files to fix:**
- `/netlify/functions/save-user-data.js` - Create this function
- `/netlify/functions/get-user-data.js` - Implement database queries
- `/js/core/data-store.js` - Complete sync methods

**Required implementations:**
- Add Neon database connection using `@neondatabase/serverless`
- Implement user data save/load functions
- Create workout session persistence
- Add Strava activity deduplication
- Implement conflict resolution for offline/online sync

### 5. Complete Strava OAuth Flow
Strava integration is partially implemented but needs completion.

**Files to fix:**
- Create `/callback.html` for OAuth callback
- Update `/js/core/auth.js` to handle Strava tokens

**Required implementations:**
- Complete OAuth authorization flow
- Store refresh tokens securely
- Implement automatic token refresh
- Add activity sync scheduler (every 4 hours)
- Create manual sync button in UI

### 6. Implement Workout Generation Logic
The workout generator is referenced but not fully implemented.

**Create new file:**
- `/js/training/workout-generator.js`

**Required features:**
- Generate workouts based on user profile and goals
- Apply seasonal training adjustments
- Integrate pattern detection results
- Account for recent RPE scores
- Schedule around games/practices
- Include exercise substitutions for injuries

### 7. Complete Pattern Detection System
Pattern detection is designed but needs implementation.

**Create new file:**
- `/js/ai/pattern-detector.js`

**Required patterns to detect:**
- Day-of-week performance patterns
- Exercise progression/regression
- Volume tolerance thresholds
- Recovery time requirements
- RPE accuracy calibration
- Game performance correlation

### 8. Add Missing UI Components
Several UI elements are referenced but not implemented.

**Files to update:**
- `/index.html` - Add missing sections
- `/styles/main.css` - Add styles for new components

**Required UI elements:**
- AI Coach chat interface (floating button + chat window)
- Pattern insights display panel
- Seasonal phase indicator
- Sync status indicator (already styled but not functional)
- Workout history view
- Progress charts section
- Quick action buttons for common tasks

### 9. Implement Smart Model Selection
The AI should choose between different models based on query complexity.

**Update file:**
- `/js/ai/context-aware-ai.js`

**Model routing logic:**
```javascript
// Simple queries → Claude Haiku ($0.0008/1k tokens)
// Standard workouts → GPT-3.5 ($0.002/1k tokens)  
// Injury/health → Claude Sonnet ($0.015/1k tokens)
// Complex analysis → Claude Opus ($0.075/1k tokens)
```

### 10. Fix PWA Service Worker
The service worker exists but needs proper cache management.

**File to fix:**
- `/sw.js`

**Required implementations:**
- Add proper cache versioning
- Implement cache-first strategy for static assets
- Network-first for API calls
- Background sync for offline changes
- Push notification support (future)

## Data Flow Fixes

### 11. Complete User Data Persistence
Users can register but data doesn't persist properly.

**Required fixes:**
- Connect localStorage to database sync
- Implement proper user session management
- Add data migration for existing localStorage users
- Create backup/restore functionality

### 12. Implement Workout Logging Flow
The workout logging system needs completion.

**Required features:**
- Exercise check-off during workout
- Real-time RPE tracking
- Auto-fill from previous sessions
- Weight plate calculator
- Rest timer between sets
- Session summary generation

## Testing & Validation

### 13. Add Error Handling
Many functions lack proper error handling.

**All files need:**
- Try-catch blocks for async operations
- User-friendly error messages
- Fallback behaviors for API failures
- Validation for user inputs
- Network error recovery

### 14. Implement Data Validation
Add validation for all user inputs.

**Required validations:**
- Age, weight, height ranges
- Exercise weight limits
- RPE scale (1-10)
- Date/time formats
- Username/password requirements

## Performance Optimizations

### 15. Implement Lazy Loading
Load components only when needed.

**Optimizations needed:**
- Lazy load AI modules
- Defer non-critical scripts
- Code splitting for large modules
- Image optimization
- Minimize initial bundle size

## Final Integration Tasks

### 16. Connect All Modules
Ensure all modules work together properly.

**Integration checklist:**
- [ ] Auth system connects to database
- [ ] AI system receives user context
- [ ] Pattern detection triggers on workout completion
- [ ] Seasonal adjustments apply to workout generation
- [ ] Strava sync updates user patterns
- [ ] Cache invalidation works correctly
- [ ] Offline/online sync handles conflicts

### 17. Update Documentation
Create user and developer documentation.

**Documentation needed:**
- User guide for app features
- API documentation for Netlify functions
- Deployment guide for self-hosting
- Contributing guidelines
- Security best practices

## Testing Checklist

After implementing all fixes, test:
1. New user registration flow
2. Strava OAuth connection
3. Workout generation for different phases
4. AI chat responses with context
5. Pattern detection after 5+ workouts
6. Offline mode and sync
7. PWA installation
8. Database persistence
9. Security (no exposed keys)
10. Performance on mobile devices

## Priority Order

1. **CRITICAL**: Fix security (remove exposed secrets)
2. **HIGH**: Complete database connection
3. **HIGH**: Finish Level 2 AI integration
4. **MEDIUM**: Implement seasonal training
5. **MEDIUM**: Complete Strava OAuth
6. **MEDIUM**: Add pattern detection
7. **LOW**: UI polish and optimizations
8. **LOW**: Documentation

## Success Criteria

The app is ready when:
- No security vulnerabilities exist
- User can register and data persists
- AI provides contextual responses
- Workouts adapt to user patterns
- Seasonal training adjusts programs
- Strava activities sync automatically
- App works offline and syncs when online
- All prompts features are implemented

Use this checklist to systematically complete the Ignite Fitness platform. Start with security fixes, then core functionality, and finally optimizations.