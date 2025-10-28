# Prompt B — Strava Ingest QA Guide

## Manual QA Instructions

### **Prerequisites**
- Local development server running
- Database migration applied (`2025_10_28_ingest.sql`)
- Test Strava activities in JSON format

### **Test 1: Basic Import**
**Objective**: Verify basic Strava activity import

**Steps**:
1. Prepare sample Strava activity JSON
2. Send POST request to `/.netlify/functions/ingest-strava`
3. Verify response status 200
4. Check activity in database

**Expected Results**:
- Status: `imported`
- Activity appears in `activities` table
- Richness score calculated
- Dedup hash generated

**Sample Request**:
```json
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
        "has_heartrate": true
      }
    ]
  }
}
```

### **Test 2: Duplicate Import**
**Objective**: Verify no double counting on second import

**Steps**:
1. Import same activity twice (same dedup hash)
2. Check activity count in database
3. Verify response statuses

**Expected Results**:
- First import: `status: "imported"`
- Second import: `status: "skipped_dup"`
- Activity count unchanged
- No aggregate recalculation

**Verification**:
```sql
SELECT COUNT(*) FROM activities WHERE canonical_external_id = '12345';
-- Should return 1
```

### **Test 3: Richer Update**
**Objective**: Verify update with richer data triggers recalculation

**Steps**:
1. Import activity without HR data
2. Import same activity with HR data
3. Check for update and aggregate recalculation

**Expected Results**:
- First import: `status: "imported"`, `richness: 0.2`
- Second import: `status: "updated"`, `richness: 0.6`
- Activity updated with HR data
- Aggregate recalculation triggered

**Sample Activities**:
```javascript
// First import (low richness)
{
  "id": 12345,
  "type": "Run",
  "start_date": "2024-01-15T07:00:00Z",
  "moving_time": 3600
  // No HR data
}

// Second import (higher richness)
{
  "id": 12345,
  "type": "Run",
  "start_date": "2024-01-15T07:00:00Z",
  "moving_time": 3600,
  "average_heartrate": 150,
  "has_heartrate": true
}
```

### **Test 4: Manual + Strava Merge**
**Objective**: Verify manual data preserved when merging

**Steps**:
1. Create manual activity with notes
2. Import Strava activity in same time window
3. Check merged result

**Expected Results**:
- Manual activity preserved
- Strava HR data added
- Notes maintained
- Status: `merged`

**Verification**:
```sql
SELECT name, avg_hr, source_set 
FROM activities 
WHERE id = <merged_activity_id>;

-- Should show:
-- name: "Morning Run - Felt Great"
-- avg_hr: 150
-- source_set: {"manual": {...}, "strava": {...}, "merged_from": [...]}
```

### **Test 5: Stream Attachment**
**Objective**: Verify stream data attached correctly

**Steps**:
1. Import activity with stream data
2. Check `activity_streams` table
3. Verify sample rate calculation

**Expected Results**:
- Streams inserted for activity
- Correct stream type
- Samples stored as JSONB
- Sample rate calculated

**Sample Request**:
```json
{
  "userId": 123,
  "payload": {
    "activities": [...],
    "streams": {
      "12345": {
        "heartrate": [
          {"t": 0, "v": 120},
          {"t": 1, "v": 125},
          {"t": 2, "v": 130}
        ]
      }
    }
  }
}
```

## Database Verification Queries

### **Check Activity Import**
```sql
SELECT id, type, name, start_ts, duration_s, richness_score
FROM activities
WHERE user_id = 123
ORDER BY start_ts DESC
LIMIT 10;
```

### **Check Deduplication Hash**
```sql
SELECT dedup_hash, COUNT(*)
FROM activities
WHERE user_id = 123
GROUP BY dedup_hash
HAVING COUNT(*) > 1;
-- Should return 0 rows if no duplicates
```

### **Check Ingest Log**
```sql
SELECT external_id, status, created_at
FROM ingest_log
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;
```

### **Check Source Sets**
```sql
SELECT id, type, source_set
FROM activities
WHERE user_id = 123
AND source_set IS NOT NULL
LIMIT 10;
```

### **Check Merged Activities**
```sql
SELECT id, type, source_set, merged_from
FROM activities
WHERE user_id = 123
AND merged_from IS NOT NULL;
```

## Common Issues

### **Issue 1: Duplicate Not Detected**
**Symptoms**: Same activity imported twice with status `imported`

**Possible Causes**:
- Dedup hash calculation issue
- Database query not finding existing activity
- Time zone differences

**Debug**:
```sql
SELECT dedup_hash, start_ts, duration_s
FROM activities
WHERE id = <activity_id>;
```

### **Issue 2: Richness Score Not Updating**
**Symptoms**: Activity not updated with richer data

**Possible Causes**:
- Richness calculation incorrect
- Update query failing
- Richness comparison logic issue

**Debug**:
```javascript
// Calculate richness manually
calculateRichness(activity);
```

### **Issue 3: Streams Not Attached**
**Symptoms**: Activity imported but no streams in `activity_streams`

**Possible Causes**:
- Stream payload format incorrect
- Activity ID mismatch
- Insert query failing

**Debug**:
```sql
SELECT * FROM activity_streams WHERE activity_id = <activity_id>;
```

## Performance Tests

### **Test Large Import**
**Objective**: Verify performance with 100+ activities

**Steps**:
1. Import 100 Strava activities
2. Measure response time
3. Check database performance

**Expected Results**:
- Response time < 5 seconds
- All activities processed
- No database timeouts

### **Test Concurrent Imports**
**Objective**: Verify idempotency under concurrent requests

**Steps**:
1. Send same import request 3 times simultaneously
2. Check final activity count
3. Verify deduplication worked

**Expected Results**:
- Only 1 activity created
- Other requests return `skipped_dup`
- No race conditions

## Browser DevTools Monitoring

### **Network Tab**
- Watch for 200 responses
- Check response body for results array
- Verify no 500 errors

### **Console Logs**
- Import progress
- Error messages
- Richness calculations

## Success Criteria

✅ All tests pass  
✅ No duplicate activities in database  
✅ Richness scoring works correctly  
✅ Manual data preserved in merges  
✅ Aggregates recalculated appropriately  
✅ Performance acceptable (< 5s for 100 activities)  
✅ Concurrent imports handled correctly  

## Notes

- Richness scores are approximate (0.0-1.0)
- Time tolerance is ±6 minutes
- Duration tolerance is ±10%
- Sample rate calculated from stream data
- Aggregates recalculated asynchronously
