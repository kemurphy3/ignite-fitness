# DebugManager - Ignite Fitness Debugging Utilities

## Overview
The DebugManager provides comprehensive debugging tools for the Ignite Fitness application. It's designed to be a permanent, reusable solution for debugging localStorage, data validation, and system diagnostics.

## Features

### 🔍 **Data Inspection**
- **`checkSavedData()`** - Comprehensive localStorage analysis
- **`debugUsers()`** - User data specific debugging
- **`debugStorage()`** - Storage performance and health checks

### 📊 **Performance Monitoring**
- **`debugPerformance()`** - Memory usage and performance metrics
- **`validateDataIntegrity()`** - Data consistency validation

### 🛠️ **Utility Functions**
- **`clearDebugData()`** - Clean up debug/test data
- **`exportDebugData()`** - Export debug data for analysis
- **`setDebugMode(enabled)`** - Enable/disable debug mode

## Usage

### Basic Usage
```javascript
// Check all saved data
checkSavedData();

// Debug user data specifically
debugUsers();

// Check storage performance
debugStorage();

// Monitor performance
debugPerformance();
```

### Advanced Usage
```javascript
// Access the DebugManager directly
const debugManager = window.DebugManager;

// Enable debug mode programmatically
debugManager.setDebugMode(true);

// Validate data integrity
const validation = debugManager.validateDataIntegrity();

// Export debug data
debugManager.exportDebugData();
```

### Debug Mode
Debug mode can be enabled in several ways:
1. **URL Parameter**: Add `?debug=true` to the URL
2. **localStorage**: Set `ignitefitness_debug_mode` to `'true'`
3. **Programmatically**: Call `DebugManager.setDebugMode(true)`

## Available Global Functions

When DebugManager is loaded, these functions become globally available:

- `checkSavedData()` - Main data inspection function
- `debugStorage()` - Storage performance analysis
- `debugUsers()` - User data debugging
- `debugPerformance()` - Performance monitoring
- `clearDebugData()` - Clean debug data
- `exportDebugData()` - Export debug information

## Output Format

The debug functions provide structured console output with:
- 📁 **Grouped data** by localStorage key
- 📊 **Size information** for each data item
- ✅/❌ **Status indicators** for data health
- 🔍 **Detailed analysis** of data integrity
- 📈 **Performance metrics** and storage usage

## Benefits

### ✅ **Permanent Solution**
- No more copying/pasting debug code
- Centralized debugging utilities
- Consistent debugging interface

### 🔧 **Enhanced Features**
- Better error handling
- Data integrity validation
- Performance monitoring
- Export capabilities

### 🎯 **Developer Friendly**
- Easy to use global functions
- Comprehensive logging
- Structured output format
- Debug mode control

## Integration

The DebugManager is automatically loaded with the core modules and initializes itself. No additional setup is required - the debug functions are immediately available in the browser console.

## File Location
- **Source**: `js/modules/debug/DebugManager.js`
- **Integration**: Automatically loaded in `index.html`
- **Global Access**: Available as `window.DebugManager` and individual functions
