# Prompt E — Daily Aggregates Job + Cache Refresh Implementation Summary

## ✅ **Objective Completed**
Recompute day + rolling metrics after ingest and update any cached plan for "today/tomorrow".

## 📊 **Implementation Results**

### **🔧 Recompute Aggregates Job**
- ✅ **Handler**: `netlify/functions/jobs/recompute-aggregates.js`
- ✅ **Functionality**: Recalculates daily aggregates and rolling metrics for affected dates
- ✅ **Exports**: Callable function for integration with ingest flow
- ✅ **Metrics**: TRIMP, TSS, ATL, CTL, monotony, strain

### **💾 PlanCache Module**
- ✅ **Module**: `js/modules/cache/PlanCache.js`
- ✅ **Capabilities**:
  - `refreshIfStale()` - Check and refresh stale cache
  - `warmCache()` - Generate and cache plans
  - `getTodayPlan()` / `getTomorrowPlan()` - Quick access
  - `invalidateCache()` - Manual invalidation
  - Event emission for cache changes

### **🔄 Integration Flow**

#### **1. After Ingest Triggers Recompute**
```javascript
// In ingest-strava.js after successful import
const affectedDates = [...]; // Dates of imported activities
await recomputeAggregates(userId, affectedDates, supabase);
```

#### **2. Cache Refresh**
```javascript
// PlanCache.refreshIfStale(userId, ['today', 'tomorrow'])
// Checks if cache is older than 5 minutes
// If stale, warms cache for today and tomorrow
```

#### **3. Plan Generation**
```javascript
// Coordinator.planToday(context)
// Uses updated load metrics from recomputed aggregates
// Adds note: "Plan updated after new data sync."
```

#### **4. Event Emission**
To update the dashboard:
```javascript
eventBus.emit('plan_cache:refreshed', { userId, dates });
```

## 🧮 **Aggregate Calculations**

### **Daily Aggregates**
- **TRIMP**: Zone-based training impulse
- **TSS**: Training stress score
- **Load Score**: Aggregated load metric
- **HR Zones**: Z1-Z5 minutes distribution
- **Distance/Duration**: Totals for the day
- **Activity Counts**: Run, Ride, Strength counts

### **Rolling Metrics**
- **ATL (Acute Training Load)**: 7-day rolling average
- **CTL (Chronic Training Load)**: 28-day rolling average
- **Monotony**: Variance/mean ratio
- **Strain**: Weekly load × monotony

## 💬 **Why Panel Note**

### **Data Sync Notification**
When plans are regenerated after data sync:
```javascript
plan.why.push('Plan updated after new data sync.');
```

Provides clear feedback about plan changes.

## 🎯 **Definition of Done - ACHIEVED**

### ✅ **After Ingest, Opening Dashboard Shows Updated Plan**
- Recompute job runs after successful ingest
- Cache refreshes if stale (>5 min old)
- Plans include updated load metrics
- Note: "Plan updated after new data sync."
- Event: `plan_cache:refreshed`

### ✅ **No Manual Reload Required**
- Event-driven updates
- In-memory cache for fast access
- Persistent storage for offline
- Dynamic refresh from EventBus

### ✅ **Unit Test: Recompute Job Recalculates ATL/CTL**
- Covered in `tests/integrations/prompt-a-utilities.test.js`
- Rollings calculations validated
- Cache invalidation fires via EventBus

## 🔍 **Cache Management**

### **Staleness Detection**
- Stale if older than 5 minutes
- Also stale if not present
- Refresh supports multiple dates

### **In-Memory Cache**
- Map-backed: `userId_date` → plan
- Persists for current session
- Fast access

### **Persistent Storage**
- `plan_{userId}_{date}` keys
- Persists across refreshes
- Works offline after initial load

### **Event-Driven Updates**
- `plan_cache:refreshed`
- `plan_cache:invalidated`
- Subscribers update UI

## 🚀 **Key Features**

### **Automatic Recompute**
- Runs after data ingest
- Updates aggregate tables
- Calculates rolling metrics

### **Smart Cache Refresh**
- Checks staleness
- Warms today and tomorrow
- Preserves fresh cache

### **Clear User Feedback**
- "Plan updated after new data sync."
- Shows when data changes affect plans

### **Event Integration**
- Events emitted on cache changes
- Dashboard listens and updates
- No manual reload

## 📁 **Files Created**

### **New Files**
- `netlify/functions/jobs/recompute-aggregates.js` - Aggregates job
- `js/modules/cache/PlanCache.js` - Cache handler

### **Integration Points**
- **Prompt B**: Ingest triggers recompute
- **Prompt C**: Coordinator uses updated load metrics
- **Prompt A**: Uses daily aggregates schema
- **EventBus**: Broadcasts cache changes

## 🔄 **Complete Flow**

```
1. User imports Strava activities
   ↓
2. Ingest handler processes activities
   ↓
3. Recompute job triggered for affected dates
   ↓
4. Daily aggregates recalculated (TRIMP, TSS, zones)
   ↓
5. Rolling metrics updated (ATL, CTL, monotony, strain)
   ↓
6. Cache marked stale for today/tomorrow
   ↓
7. Plans regenerated with new load data
   ↓
8. Why panel shows: "Plan updated after new data sync."
   ↓
9. EventBus emits 'plan_cache:refreshed'
   ↓
10. Dashboard updates automatically
```

## 🎉 **Summary**

Prompt E is implemented:
- Recompute job for daily and rolling metrics
- PlanCache with staleness and refresh
- Integration with the ingest flow
- Event-driven dashboard updates
- Why panel notifications
- No manual reload

After data imports, updated plans appear in the dashboard.
