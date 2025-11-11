# Auth Router & Boot Hardening Implementation

## Summary

This document describes the comprehensive boot hardening and authentication
routing fixes implemented to resolve "login flashes then disappears and I can't
get back" bugs.

## Key Changes

### 1. Auth State Source of Truth (`js/modules/auth/AuthManager.js`)

**New Methods:**

- `getAuthState()`: Returns `{ isAuthenticated, token, user }` strictly from
  memory
- `readFromStorage()`: Validates tokens (expires >30 days), clears invalid
  storage
- `writeToStorage(state)`: Writes validated token + minimal user data
- `clearStorage()`: Clears all namespaced auth keys

**Defaults:**

- `isAuthenticated` defaults to `false` until `readFromStorage()` completes
- Constructor no longer auto-loads - waits for explicit `readFromStorage()` call

**Storage Keys:**

- `ignite.auth.token` - Token with metadata (`created_at`, `username`)
- `ignite.user` - User preferences
- `ignite.prefs` - Additional preferences
- `ignitefitness_current_user` - Legacy compatibility
- `ignitefitness_users` - User database

### 2. Router Guards (`js/modules/ui/Router.js`)

**Hardened Guards:**

- `init(authState)`: Must be called explicitly after auth loads
- `resolveInitialRoute(authState)`: Routes based on auth state
  - Authenticated → `#/dashboard` or `lastKnownRoute`
  - Not authenticated → `#/login`
- `navigate()`: Checks auth before protected routes, stores `lastKnownRoute`

**Loop Prevention:**

- If already on `#/login`, does not redirect
- Unknown routes → safe default (authed: `#/dashboard`, else: `#/login`)
- All redirects logged with reason (`guard: not authed → /login`)

### 3. Return to Login Affordance

**Header Sign-In Button:**

- Added to `PersistentHeader.js`
- Shows when `!isAuthenticated`
- Click navigates to `#/login`
- Auto-updates on login/logout events

**Error States:**

- Router `showErrorState()` includes "Back to Sign In" button
- ErrorBoundary includes "Back to Sign In" button

### 4. Error Boundary (`js/modules/core/ErrorBoundary.js`)

**Enhanced Actions:**

- "Retry" button (reloads page)
- "Sign out and retry" button (calls `AuthManager.clearStorage()` then routes
  `#/login`)
- "Back to Sign In" button (routes `#/login`)

### 5. Service Worker Cache Busting (`sw.js`)

**Versioning:**

- `CACHE_VERSION` constant (increment to bust caches)
- All caches named with version: `ignite-fitness-v${CACHE_VERSION}`

**Update Notifications:**

- New SW installed → postMessage to app
- App shows toast: "Update available — Reload."
- Clicking reload calls
  `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` then
  `window.location.reload()`

### 6. Deterministic Boot Sequence (`js/boot-sequence.js`)

**Order:**

1. `await initServiceWorker()` (optional, non-blocking)
2. `await initStorage()`
3. `await initAuth()` - **CRITICAL - must complete**
4. `initRouter(authState)` - Only after auth loaded
5. `initUIShell()`

**Integration:**

- `app-modular.js` now calls `await BootSequence.boot()` before other
  initialization
- Fallback if `BootSequence` not available

### 7. LoginView Resilience

**Prevent Unmount:**

- Login form does not unmount unless:
  - `login()` returns success
  - User explicitly navigates away
- Errors show inline, stay on login screen
- Success navigates to `lastKnownRoute` or `#/dashboard`

### 8. Dev Debug Panel (`js/modules/debug/AuthDebugPanel.js`)

**Features:**

- Only loads in development (`NODE_ENV !== 'production'`)
- Shows: `isAuthenticated`, token present, current route, last redirect reason
- Hotkeys: `Alt+Shift+L` = Force route `#/login`, `Ctrl+Shift+D` = Toggle panel
- Access via: `window.__IGNITE__.auth.debugPanel()`

### 9. Tests (`tests/auth-router.spec.js`)

**Coverage:**

- No token → lands on `#/login`
- Bad token → cleared → on `#/login`
- Valid token → lands on `#/dashboard`
- Protected route when not authed → redirects to `#/login` without loop
- Login success → navigates to intended route
- SW update notification handling

## Usage

### Fresh Browser Profile

```
1. Visit app → AuthManager.readFromStorage() completes → isAuthenticated = false
2. Router.init(authState) → routes to #/login
3. User stays on login until successful auth
```

### Stale/Bad Token

```
1. Token in storage but expired/invalid
2. readFromStorage() validates → fails → clears storage
3. isAuthenticated = false → routes to #/login
4. No flicker-to-blank (no default to true)
```

### Successful Login

```
1. User enters credentials
2. AuthManager.login() → writeToStorage()
3. Router.navigate(lastKnownRoute || '#/dashboard')
```

## Files Modified

- `js/modules/auth/AuthManager.js` - Auth state management
- `js/modules/ui/Router.js` - Routing guards
- `js/modules/ui/PersistentHeader.js` - Sign In button
- `js/modules/core/ErrorBoundary.js` - Enhanced error recovery
- `js/boot-sequence.js` - New deterministic boot sequence
- `js/app-modular.js` - Updated to use boot sequence
- `sw.js` - Cache versioning and update notifications
- `js/modules/debug/AuthDebugPanel.js` - Dev tools
- `js/modules/ui/Router.js` - LoginView resilience
- `index.html` - Script loading order
- `tests/auth-router.spec.js` - Test suite

## Definition of Done ✅

- ✅ Fresh browser profile → stays on login until successful auth
- ✅ Stale/bad token → app clears it and shows login (no flicker)
- ✅ No infinite redirects
- ✅ No blank screen states
- ✅ "Back to Sign In" reliably shows login from any error state
- ✅ Tests in `auth-router.spec.js` pass
