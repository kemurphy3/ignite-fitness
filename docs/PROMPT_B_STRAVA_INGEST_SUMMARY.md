# Prompt B — Strava Ingest Function + Idempotent Dedup/Merge Implementation Summary

## ✅ **Objective Completed**

Accept Strava payload or token-pull later; normalize → dedup → merge; trigger
aggregates.

## 📊 **Implementation Results**

### **🔧 Ingest Handler**

- ✅ **Handler**: `netlify/functions/ingest-strava.js`
- ✅ **Input**: `{ userId, payload: { activities: [rawActivity...], streams } }`
- ✅ **Processing**: Normalize → dedup → merge → aggregate trigger
- ✅ **Edge Cases**: Duplicate imports, richer updates, manual+Strava merges

### **🧹 Deduplication Logic**

- ✅ **Hash-Based Dedup**: SHA256 hash on (userId, startTs, durationMinutes,
  type)
- ✅ **Likely Duplicates**: Time tolerance ±6min, duration tolerance ±10%
- ✅ **Richness Comparison**: Prioritize activities with more data (HR, GPS,
  power, device)
- ✅ **Status Tracking**: `imported`, `updated`, `merged`, `skipped_dup`,
  `error`

### **🔄 Merging System**

- ✅ **Richness-Based Priority**: Automatically select primary activity by data
  quality
- ✅ **Manual Preservation**: Preserve manual notes and RPE when merging with
  Strava
- ✅ **Source Tracking**: Maintain audit trail in `source_set` and `merged_from`
- ✅ **Multi-Source Support**: Handle manual, Strava, and other sources

### **📊 Aggregate Recalculation**

- ✅ **Affected Date Tracking**: Collect dates for recalculation
- ✅ **Trigger Mechanism**: Recompute daily aggregates for affected dates
- ✅ **No Double Counting**: Duplicate imports don't trigger recalculation
- ✅ **Richer Updates**: Updates with higher richness trigger recalculation

## 🔍 **Key Features Implemented**

### **Processing Flow**

1. **Normalize**: Convert Strava activity to internal format
2. **Dedup Hash**: Generate SHA256 hash for exact duplicate detection
3. **Existing Check**: Query by dedup hash for exact matches
4. **Likely Duplicates**: Query within ±6min time window for fuzzy matches
5. **Merge Decision**: Compare richness scores to determine primary activity
6. **Stream Attachment**: Attach HR/GPS/power streams if provided
7. **Log Results**: Record ingestion status in `ingest_log`
8. **Trigger Aggregates**: Recompute daily aggregates for affected dates

### **Richness Scoring**

- **Heart Rate Data**: +0.4 (highest value)
- **GPS Data**: +0.2
- **Power Data**: +0.2
- **Device Info**: +0.1
- **Calories**: +0.05
- **Cap**: 1.0 maximum

### **Deduplication Rules**

- **Exact Match**: Same dedup hash → `skipped_dup`
- **Richer Version**: Same hash, higher richness → `updated`
- **Likely Duplicate**: ±6min, ±10% duration → `merged`
- **New Activity**: No matches → `imported`

### **Edge Case Handling**

#### **1. Second Import of Same File**

```javascript
// First import
{ id: 1, externalId: '12345', status: 'imported' }

// Second import (same hash)
{ id: 1, externalId: '12345', status: 'skipped_dup' }
```

- ✅ No double counting of activities
- ✅ Status reflects deduplication
- ✅ No aggregate recalculation

#### **2. Late Richer Version**

```javascript
// Original (richness: 0.5)
{ avg_hr: 140, max_hr: 160, has_hr: true }

// Richer update (richness: 0.8)
{ avg_hr: 150, max_hr: 170, has_hr: true, has_gps: true, has_power: true }
// Status: 'updated'
```

- ✅ Updates activity with richer data
- ✅ Triggers aggregate recalculation
- ✅ Preserves original timestamp

#### **3. Manual + Strava Same Window**

```javascript
// Manual activity
{ canonical_source: 'manual', name: 'Morning Run - Felt Great' }

// Strava activity (same time window)
{ canonical_source: 'strava', avg_hr: 150, has_hr: true }

// Merged result
{
  canonical_source: 'manual',  // Manual preserved as primary
  name: 'Morning Run - Felt Great',  // Manual notes preserved
  avg_hr: 150,  // Strava HR added
  has_hr: true,
  source_set: {
    manual: { id: 'm_1', richness: 0.3 },
    strava: { id: '12345', richness: 0.6 },
    merged_from: [...]
  }
}
// Status: 'merged'
```

- ✅ Preserves manual notes and RPE
- ✅ Adds Strava data where richer
- ✅ Maintains full audit trail

## 🧪 **Unit Tests**

### **Test Coverage** (`tests/netlify/functions/ingest-strava.test.js`)

- ✅ **Duplicate Detection** (3 tests)
  - Exact duplicates by hash
  - Likely duplicates within tolerance
  - Reject large time differences
- ✅ **Richness Promotion** (3 tests)
  - Update with richer version
  - Skip equal or lower richness
  - Preserve manual data when merging
- ✅ **Stream Attachment** (3 tests)
  - HR stream attachment
  - GPS stream attachment
  - Empty stream handling
- ✅ **Aggregates Recalculation** (4 tests)
  - Trigger for affected dates
  - No trigger for duplicates
  - Trigger for richer updates
  - Multiple activities same day
- ✅ **Edge Cases** (3 tests)
  - Second import handling
  - Activities without HR data
  - Missing fields handling

## 📈 **API Specification**

### **Request**

```javascript
POST /.netlify/functions/ingest-strava
Content-Type: application/json

{
  "userId": 123,
  "payload": {
    "activities": [
      {
        "id": 12345,
        "type": "Run",
        "name": "Morning Run",
        "start_date": "2024-01-15T07:00:00Z",
        "moving_time": 3600,
        "distance": 10000,
        "average_heartrate": 150,
        "has_heartrate": true,
        "start_latlng": [37.7749, -122.4194]
      }
    ],
    "streams": {
      "12345": {
        "heartrate": [
          { "t": 0, "v": 120 },
          { "t": 1, "v": 125 }
        ]
      }
    }
  }
}
```

### **Response**

```javascript
{
  "results": [
    {
      "id": 1,
      "externalId": "12345",
      "status": "imported",  // or "updated", "merged", "skipped_dup", "error"
      "richness": 0.6
    }
  ]
}
```

## 🎯 **Definition of Done - ACHIEVED**

### ✅ **New endpoint returns 200 for sample Strava JSON**

- Handler created with proper error handling
- CORS headers for cross-origin requests
- 200 status code with results array

### ✅ **Manual QA: import same feed twice → activity count stable**

- Deduplication by hash prevents double counting
- Status reflects `skipped_dup` for duplicates
- No aggregate recalculation for duplicates

### ✅ **Aggregates for the day update when a richer re-import arrives**

- Richness comparison triggers updates
- Affected dates tracked and recalculated
- Status reflects `updated` for richer versions

### ✅ **Unit tests for duplicate detection, richness promotion, stream attach, aggregates recalculation**

- **16 tests** covering all critical functionality
- Edge cases covered for malformed data
- Mock Supabase client for isolated testing

## 🚀 **Next Steps**

The foundation is now in place for:

1. **Real Strava API Integration**: Token-based authentication and API calls
2. **Stream Processing**: Full time-series data handling
3. **Aggregate Calculation**: TRIMP, TSS, rolling metrics computation
4. **Webhook Support**: Real-time Strava webhook handling
5. **Multi-Source Merging**: Garmin, Polar, Fitbit integration

## 📁 **Files Created**

### **New Files**

- `netlify/functions/ingest-strava.js` - Main ingest handler
- `tests/netlify/functions/ingest-strava.test.js` - Unit tests

### **Integration**

- Uses existing modules from Prompt A:
  - `js/modules/integrations/utils/hash.js`
  - `js/modules/integrations/dedup/dedupRules.js`
  - `js/modules/integrations/metrics/loadMath.js`
  - `js/modules/integrations/normalize/stravaNormalizer.js`

## 🎉 **Summary**

Prompt B has been successfully implemented with:

- **Complete ingest handler** for Strava activities
- **Idempotent deduplication** preventing double counting
- **Richness-based merging** for data quality
- **Aggregate triggers** for affected dates
- **Comprehensive unit tests** covering all edge cases
- **Production-ready code** with proper error handling

The system is now ready for Strava API integration and real-world data
ingestion!
