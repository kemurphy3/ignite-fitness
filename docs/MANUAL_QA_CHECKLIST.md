# Manual QA Checklist

## Overview
This checklist verifies the complete data ingestion and plan adjustment system across prompts A-F.

---

## 📋 **Test Scenario 1: Import Deduplication**

### Steps:
1. Import the same Strava file twice using the "Import Strava" button
2. Check the activity list
3. Navigate to `/#/admin/ingest` to inspect detailed activity information

### Expected Results:
✅ **First import**: Activity appears as `imported` status
✅ **Second import**: Activity appears as `skipped_dup` (or `updated_or_linked` if richer version)
✅ **Activity list**: Shows only one entry
✅ **Admin view**: Shows canonical source, richness score, and source set

### Verification Points:
- No duplicate activities in the database
- Ingest log shows correct status for both imports
- Richness score reflects data quality (HR, GPS, power)

---

## 📋 **Test Scenario 2: Manual + Strava Merge**

### Steps:
1. Log a manual run with notes and RPE (e.g., "Felt great", RPE: 7)
2. Import matching Strava activity (same time window, ±6 min, ±10% duration)
3. Check the activity list
4. Verify HR chart presence
5. Check for preserved manual notes

### Expected Results:
✅ **Activity list**: Shows single merged entry
✅ **Canonical source**: Strava (richer with HR data)
✅ **Source set**: Shows both manual and Strava sources
✅ **HR chart**: Present if Strava has HR data
✅ **Manual notes**: Preserved in activity data
✅ **RPE**: Preserved in activity data

### Verification Points:
- Richness-based canonical selection (Strava wins due to HR data)
- Manual data preserved as scalar fields (notes, RPE)
- Source set shows both sources with their richness scores
- No duplicate activities

---

## 📋 **Test Scenario 3: Plan Updates After Import**

### Steps:
1. Import an activity from yesterday with HR data (high Z4 time)
2. Wait for aggregates to recompute
3. Open tomorrow's plan
4. Check the "Why" panel

### Expected Results:
✅ **Why panel**: References synced HR data
✅ **Strain mentions**: High weekly strain if applicable
✅ **Swaps/caps**: Lower-body volume reduced if high Z4 yesterday
✅ **Specific metrics**: Shows actual Z4 minutes (e.g., "34 min in Z4 yesterday")

### Verification Points:
- Plan adjusts based on new data
- Why panel shows concrete explanations
- References to "synced HR" or "rolling load"
- Specific metrics displayed (Z4 min, strain, etc.)

---

## 📋 **Test Scenario 4: Manual-Only Preference**

### Steps:
1. Import a manual + Strava activity (merged)
2. Open activity details
3. Toggle "Use manual only"
4. Check tomorrow's plan

### Expected Results:
✅ **Toggle**: Works correctly
✅ **State persists**: On refresh, preference maintained
✅ **Plan ignores external**: Plan doesn't use Strava HR data
✅ **Training load drops**: Rolling load recalculated without external activity
✅ **Plan adjusts**: Plan reflects reduced load

### Verification Points:
- Activity marked with manual-only preference
- Strava data excluded from aggregate calculation
- Rolling load (ATL/CTL) recalculated
- Plan uses manual activity data only

---

## 📋 **Test Scenario 5: Exclude Activity**

### Steps:
1. Locate an activity in the list
2. Click "Exclude" button
3. Check rolling load changes
4. Open tomorrow's plan
5. Check "Why" panel

### Expected Results:
✅ **Activity excluded**: Marked as `is_excluded=true`
✅ **Rolling load drops**: ATL/CTL recalculated lower
✅ **Plan adjusts**: Plan reflects reduced load
✅ **Why panel**: Mentions exclusion if relevant (e.g., "Lower load due to excluded high-intensity session")

### Verification Points:
- Activity marked as excluded
- Aggregates recalculated
- Plan adjusts accordingly
- Why panel explains changes if relevant

---

## 📋 **Test Scenario 6: Low Data Confidence**

### Steps:
1. Import activities with minimal HR data (no HR streams, low richness)
2. Wait a few days with limited HR data
3. Open tomorrow's plan
4. Check the "Why" panel

### Expected Results:
✅ **Why panel**: Shows low confidence message
✅ **Conservative mode**: Plan is more conservative
✅ **Intensity scaling**: Reduced intensity recommendations
✅ **Message**: "Limited HR data this week (confidence X%) → conservative recommendation"

### Verification Points:
- Confidence score < 0.5
- Conservative recommendations in plan
- Why panel explains low confidence
- Intensity scaled appropriately

---

## 🔍 **Admin View Verification**

### Access Admin View:
Navigate to: `/#/admin/ingest`

### Check:
✅ **Activity table**: Lists all activities
✅ **Filtering**: Date, source, type filters work
✅ **Canonical source**: Color-coded badges (yellow=manual, orange=Strava, blue=Garmin)
✅ **Richness score**: Color-coded (green=high, orange=medium, red=low)
✅ **Source set**: Shows all sources with richness scores
✅ **Merged count**: Statistics show merged activities
✅ **Actions**: View, include/exclude buttons work

### Button Actions:
✅ **"Recompute Today"**: Triggers aggregate recalculation
✅ **"Open Why for Tomorrow"**: Shows plan rationale
✅ **"Refresh Activities"**: Reloads activity list

---

## 🧪 **Unit Test Verification**

### Run Tests:
```bash
npm test -- tests/integrations/dedup.spec.js
npm test -- tests/integrations/aggregates.spec.js
npm test -- tests/ai/coordinator-load-adjustments.test.js
```

### Expected Results:
✅ **Dedup tests**: All pass (stable hash, ±6 min tolerance, richness selection, merge)
✅ **Aggregates tests**: All pass (recompute day + rolling, affected dates, ATL/CTL/monotony/strain)
✅ **Coordinator tests**: All pass (Z4 caps, strain deload, data confidence)

---

## 🎯 **Success Criteria**

### All tests must:
✅ Pass unit tests with coverage > 70%
✅ Show visual confirmation in admin view
✅ Persist state across refreshes
✅ Update plans dynamically based on data changes
✅ Provide clear "Why" explanations for adjustments

---

## 📝 **Example "Why" Panel Messages**

### High Intensity Yesterday:
```
Synced HR shows 34 min in Z4 yesterday → dialing back lower-body volume.
```

### High Strain:
```
High weekly strain detected (185) → adding mobility emphasis.
```

### Low Data Confidence:
```
Limited HR data this week (confidence 42%) → conservative recommendation.
```

### Rolling Load:
```
Rolling load suggests lower readiness → scaling intensity to 72%.
```

---

## 🚀 **End-to-End Flow**

```
1. User imports Strava activities
   ↓
2. Ingest handler processes and deduplicates
   ↓
3. Recompute job updates aggregates
   ↓
4. Cache refreshes for today/tomorrow
   ↓
5. Coordinator uses updated load metrics
   ↓
6. Plan adjusted based on new data
   ↓
7. Why panel shows rationale
   ↓
8. Dashboard updates without manual reload
```

---

## 🔧 **Troubleshooting**

### If tests fail:
1. Check database connection
2. Verify Supabase environment variables
3. Check for duplicate entries in activities table
4. Verify ingest log status
5. Check browser console for errors

### If admin view doesn't show:
1. Navigate to `/#/admin/ingest`
2. Check browser console for route errors
3. Verify `DataInspector.js` is loaded
4. Check for CSS conflicts

### If plans don't update:
1. Check cache staleness (should refresh if >5 min old)
2. Verify EventBus is emitting events
3. Check coordinator context building
4. Verify aggregate recalculation ran

