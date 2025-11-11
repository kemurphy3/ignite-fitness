# Prompt 9 - Strava Ingest MVP Manual QA Guide

## Overview

This document provides manual QA instructions for testing the Strava Ingest MVP
feature (Prompt 9).

## Implementation Summary

### Files Created/Modified

- `js/modules/integration/StravaProcessor.js` - MVP parser for Strava activities
- `js/modules/ui/StravaImportUI.js` - Simple import UI with file upload
- `styles/strava-import.css` - Styling for import interface
- `tests/integration/strava-processor.test.js` - Unit tests for parser
- `index.html` - Added Strava modules and styles

### Key Features

1. **Manual File Upload**: Import Strava JSON export files
2. **Activity Processing**: Map to internal format with training load
3. **Deduplication**: Prevent duplicate imports by (type, start_time, duration)
4. **Training Load**: Simple scoring algorithm (0-100)
5. **Storage**: Save external_activities array
6. **UI Integration**: Import button and last import time display
7. **Activity Management**: Remove bad imports

## Manual QA Instructions

### 1. Basic File Upload

#### Test: Upload Valid Strava Export

1. Export activities from Strava (see help instructions)
2. Navigate to dashboard or settings
3. Find Strava Import section
4. Click "Choose Strava Export File"
5. Select your exported activities.json file
6. Verify file uploads successfully
7. Verify activities appear in recent activities list

**Expected:** File uploads and processes without errors

#### Test: Upload Invalid File

1. Try uploading a non-JSON file
2. Try uploading an empty JSON file
3. Try uploading malformed JSON
4. Verify appropriate error messages shown

**Expected:** Graceful error handling with clear messages

#### Test: Upload Large File

1. Export a large number of activities (100+)
2. Upload the file
3. Verify processing completes
4. Verify only last 100 activities kept

**Expected:** Large files processed efficiently

### 2. Activity Processing

#### Test: Activity Type Mapping

1. Upload file with various activity types:
   - Run, TrailRun, Treadmill → run
   - Ride, VirtualRide, IndoorRide → cycle
   - Swim → swim
   - WeightTraining, Workout → strength
   - Yoga, Stretching → recovery
2. Verify correct mapping in processed activities

**Expected:** All activity types mapped correctly

#### Test: Data Extraction

1. Upload file with activities containing:
   - Duration (moving_time, elapsed_time)
   - Distance
   - Heart rate (average_heartrate)
   - Start time (start_date_local)
2. Verify all data extracted correctly
3. Verify duration converted to minutes
4. Verify distance in meters
5. Verify heart rate in BPM

**Expected:** All relevant data extracted and converted

#### Test: Training Load Calculation

1. Upload activities with different characteristics:
   - Long run (60+ min, high HR)
   - Short recovery (30 min, low HR)
   - Strength training (45 min, moderate HR)
2. Verify training load scores calculated
3. Verify scores are 0-100 range
4. Verify higher intensity = higher load

**Expected:** Training load reflects activity intensity

### 3. Deduplication

#### Test: Duplicate Detection

1. Upload same activities.json file twice
2. Verify second upload shows duplicates skipped
3. Verify no duplicate activities in storage
4. Verify success message shows duplicate count

**Expected:** Duplicates detected and skipped

#### Test: Different Activities Not Duplicated

1. Upload activities with:
   - Same type, different time
   - Same time, different type
   - Same type/time, different duration
2. Verify all activities processed (not marked as duplicates)

**Expected:** Only true duplicates are skipped

### 4. Storage and Persistence

#### Test: Activities Saved

1. Upload activities
2. Refresh page
3. Verify activities still visible
4. Verify last import time preserved

**Expected:** Data persists across page refreshes

#### Test: User Isolation

1. Upload activities as User A
2. Switch to User B
3. Verify User B sees no activities
4. Upload activities as User B
5. Switch back to User A
6. Verify User A's activities still there

**Expected:** Activities isolated per user

### 5. UI Integration

#### Test: Import Button Visibility

1. Navigate to dashboard
2. Verify Strava Import section visible
3. Verify "Not Connected" status shown
4. Verify file upload area present

**Expected:** Import UI visible and functional

#### Test: Last Import Time Display

1. Upload activities
2. Verify "Last import: [timestamp]" shown
3. Verify timestamp is readable format
4. Upload again
5. Verify timestamp updates

**Expected:** Import time displayed and updated

#### Test: Recent Activities List

1. Upload activities
2. Verify recent activities list shows:
   - Activity type icon
   - Activity name
   - Time ago (Today, Yesterday, X days ago)
   - Duration and training load
3. Verify only last 5 activities shown
4. Verify remove button (×) present

**Expected:** Recent activities displayed correctly

### 6. Activity Management

#### Test: Remove Activity

1. Upload activities
2. Click remove button (×) on an activity
3. Verify activity removed from list
4. Verify activity removed from storage
5. Verify list updates immediately

**Expected:** Activities can be removed successfully

#### Test: Remove Non-existent Activity

1. Try to remove activity with invalid ID
2. Verify graceful handling
3. Verify no errors thrown

**Expected:** Graceful handling of invalid removals

### 7. Integration with Coordinator

#### Test: Activities Affect Readiness

1. Upload high-intensity activities (high training load)
2. Generate workout plan
3. Verify plan reflects reduced intensity/volume
4. Verify rationale mentions external activities

**Expected:** External activities influence AI decisions

#### Test: Weekly Load Calculation

1. Upload activities from last 7 days
2. Check weekly load calculation
3. Verify only last 7 days included
4. Verify load accumulates correctly

**Expected:** Weekly load calculated from recent activities

### 8. Error Handling

#### Test: Network Errors

1. Simulate network failure during upload
2. Verify error message shown
3. Verify UI returns to normal state
4. Verify no partial data saved

**Expected:** Network errors handled gracefully

#### Test: Storage Errors

1. Simulate storage failure
2. Verify error message shown
3. Verify activities not partially saved

**Expected:** Storage errors handled gracefully

### 9. File Format Support

#### Test: Different Export Formats

1. Test with direct activities array
2. Test with wrapped format { activities: [...] }
3. Test with additional metadata
4. Verify all formats processed correctly

**Expected:** Multiple export formats supported

#### Test: Missing Fields

1. Upload activities missing:
   - Duration
   - Distance
   - Heart rate
   - Start time
2. Verify activities still processed
3. Verify missing fields handled gracefully

**Expected:** Missing fields don't break processing

### 10. Performance

#### Test: Large File Processing

1. Upload file with 100+ activities
2. Verify processing completes in reasonable time
3. Verify UI remains responsive
4. Verify memory usage reasonable

**Expected:** Large files processed efficiently

#### Test: Multiple Uploads

1. Upload multiple files in succession
2. Verify each processed correctly
3. Verify no memory leaks
4. Verify UI remains responsive

**Expected:** Multiple uploads handled efficiently

## Definition of Done Checklist

### Core Functionality

- [ ] File upload works for valid Strava exports
- [ ] Activities processed and mapped correctly
- [ ] Training load calculated (0-100 range)
- [ ] Deduplication works by (type, start_time, duration)
- [ ] Activities saved to external_activities array

### UI Integration

- [ ] Import button visible and functional
- [ ] Last import time displayed
- [ ] Recent activities list shows correctly
- [ ] Remove activity functionality works
- [ ] Error states handled gracefully

### Data Management

- [ ] Activities persist across page refreshes
- [ ] User data isolated correctly
- [ ] Only last 100 activities kept
- [ ] Recent activities (7 days) calculated correctly

### Integration

- [ ] Activities affect coordinator decisions
- [ ] Weekly load calculation includes external activities
- [ ] Readiness inference considers external load

### Error Handling

- [ ] Invalid files handled gracefully
- [ ] Network errors handled
- [ ] Storage errors handled
- [ ] Missing fields handled

## Expected Behaviors

### Scenario 1: First Import

- **State**: No previous imports
- **Expected**: Clean import, all activities processed
- **UI**: Shows "No imports yet" initially

### Scenario 2: Duplicate Import

- **State**: Same file uploaded twice
- **Expected**: Duplicates skipped, success message shows count
- **UI**: Shows duplicate count in success message

### Scenario 3: High Load Week

- **State**: Many high-intensity activities imported
- **Expected**: Next workout plan shows reduced intensity
- **Rationale**: Mentions external training load

### Scenario 4: Mixed Activity Types

- **State**: Run, cycle, strength activities imported
- **Expected**: All types processed with appropriate training loads
- **UI**: Shows variety of activity icons

## Known Issues

None at this time.

## Future Enhancements

- Automatic token-based sync
- Real-time activity import
- Advanced training load algorithms
- Activity categorization and tagging
- Export processed data
