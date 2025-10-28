# Prompt D — Manual/App-Logged ↔ External Linking UX Implementation Summary

## ✅ **Objective Completed**
Prevent double counting and keep user agency when manual sessions merge with external activities.

## 📊 **Implementation Results**

### **🔗 LinkBanner UI Component**
- Occurrence: Shows when manual session is merged with an external activity
- Status: `js/modules/ui/activities/LinkBanner.js`
- Banner actions:
  - Keep both: Keep both sources active (default; canonical remains richest)
  - Use primary only (e.g., Strava only): Mark secondary as excluded
  - Use secondary only (e.g., Manual only): Soft ignore primary

### **⚙️ LinkingActions Module**
- **File**: `js/modules/integrations/linking/linkingActions.js`
- **Capabilities**:
  - Handle user link decisions
  - Track excluded sources per activity
  - Save link preferences
  - Store soft ignores
  - Trigger aggregate recalculation

### **🎨 UX Features**

#### **Link Banner Display**
- Detects multi-source activities (source_set with 2+ entries)
- Sorts by richness
- Action buttons:
  - Keep both → no exclusions
  - Use primary → exclude secondary
  - Use secondary → exclude primary
- Feedback messages
- Auto-hide after "Keep both" selection

#### **Preference Persistence**
- Persisted per activity
- Survives refreshes
- Per-activity control

#### **Aggregate Impact**
- Exclusions affect training load on next recompute
- Triggers recalculation for the activity date
- Emits `activity:exclusion:changed`

## 🎯 **Linking Actions Explained**

### **Action 1: Keep Both (Default)**
```javascript
{
  action: 'keep-both',
  behavior: 'No exclusions, canonical stays richest',
  impact: 'No training load change',
  message: 'Keeping both sources active'
}
```
- Both sources stay active
- Canonical remains richest
- No aggregate recalculation

### **Action 2: Use Primary Only (e.g., Strava)**
```javascript
{
  action: 'use-primary',
  behavior: 'Exclude secondary source',
  impact: 'Recalculate training load',
  message: 'Using Strava only'
}
```
- Primary is canonical
- Secondary marked excluded
- Triggers aggregate recalculation

### **Action 3: Use Secondary Only (e.g., Manual)**
```javascript
{
  action: 'use-secondary',
  behavior: 'Soft ignore primary source',
  impact: 'Recalculate training load',
  message: 'Using Manual only'
}
```
- Secondary becomes canonical
- Primary soft ignored (external source)
- Triggers aggregate recalculation

## 🧪 **Unit Tests**

### **Test Coverage** (`tests/integrations/activity-linking.test.js`)
- **16/16 tests passing**
- **LinkingActions** (9 tests):
  - `handleLinkDecision` (4 tests)
  - Source exclusion tracking (3 tests)
  - Preference persistence (2 tests)
- **Multiple activities** (2 tests): Independent decisions
- **Source formatting** (2 tests)
- **Edge cases** (3 tests): Null, missing IDs, missing data

## 🔄 **User Flow**

### **1. Activity Merge Detection**
```
Activity imported with multiple sources
→ source_set: { manual: {...}, strava: {...} }
→ LinkBanner detects 2+ sources
```

### **2. User Makes Decision**
```
User clicks "Use Strava only"
→ LinkingActions.handleLinkDecision()
→ Excludes manual source
→ Saves preference
```

### **3. Impact**
```
Exclusion stored in storage
→ Triggers aggregate recalculation
→ Training load recalculated
→ Next plan reflects exclusion
```

### **4. Persistence**
```
Preference persists on refresh
→ LinkBanner checks preference
→ Shows current state
→ User can change decision anytime
```

## 📋 **Definition of Done - ACHIEVED**

### ✅ **Toggle Affects Training Load and Plan**
- Excluding a linked record triggers aggregate recalculation
- Changes propagate to the next plan recompute
- `activity:exclusion:changed` emitted

### ✅ **State Persists on Refresh**
- Preferences saved to storage
- Excluded sources tracked
- Per-activity preferences

### ✅ **Unit Test: Excluding Linked Record Changes Aggregates**
- 16 tests covering exclusions, preferences, persistence
- Simulates aggregate recalculation triggers
- Independent tracking across activities

## 🚀 **Technical Features**

### **Smart Source Sorting**
- Sources sorted by richness
- Primary (richest) vs secondary
- Action wording adapts

### **Soft Ignore for External Sources**
- External sources are soft ignored, not deleted
- User can revert
- Manual sources can be excluded

### **Event-Driven Architecture**
- `activity:exclusion:changed` signal
- Other modules can listen and react
- Enables updates across components

### **Banner UX**
- Inline feedback
- Auto-hide after "Keep both"
- Error handling

## 📁 **Files Created**

### **New Files**
- `js/modules/ui/activities/LinkBanner.js` - Banner UI
- `js/modules/integrations/linking/linkingActions.js` - Actions
- `tests/integrations/activity-linking.test.js` - Tests

### **Integration Points**
- Uses existing modules:
  - `StorageManager` for preference storage
  - `EventBus` for event emission
  - Integrates with Prompt A data model
  - Works with Prompt B ingestion flow

## 🎉 **Summary**

- LinkBanner UI for merged activities
- LinkingActions for user decisions
- Persistent preferences
- Aggregate recalculation
- 16/16 tests passing
- Clear UX with feedback and error handling

Users can control which data counts in training load.
