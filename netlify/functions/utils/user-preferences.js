// User Preferences Validation and Utility Functions
const moment = require('moment-timezone');

// Standard error response
const errorResponse = (statusCode, code, message, details = null) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS'
  },
  body: JSON.stringify({
    error: code,
    message,
    code,
    ...(details && { details })
  })
});

// Success response
const successResponse = (data, statusCode = 200) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS'
  },
  body: JSON.stringify(data)
});

// No content response
const noContentResponse = () => ({
  statusCode: 204,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS'
  },
  body: ''
});

// Validation functions
const isValidTimezone = (tz) => {
  if (!tz || tz === null) return true; // NULL is valid
  if (typeof tz !== 'string') return false;
  if (tz.length > 100) return false;
  
  try {
    // Use moment-timezone to validate IANA timezone
    return moment.tz.names().includes(tz);
  } catch (e) {
    return false;
  }
};

const isValidUnits = (units) => {
  if (!units || typeof units !== 'string') return false;
  return ['metric', 'imperial'].includes(units.toLowerCase());
};

const isValidSleepGoal = (hours) => {
  if (hours === null || hours === undefined) return true; // NULL is valid
  const n = Number(hours);
  if (isNaN(n)) return false;
  return n >= 0 && n <= 14;
};

const isValidWorkoutGoal = (weeks) => {
  if (weeks === null || weeks === undefined) return true; // NULL is valid
  const n = Number(weeks);
  if (!Number.isInteger(n)) return false;
  return n >= 0 && n <= 14;
};

const isValidNotificationsEnabled = (enabled) => {
  if (enabled === null || enabled === undefined) return true; // NULL is valid
  return typeof enabled === 'boolean' || 
         enabled === 'true' || enabled === 'false' ||
         enabled === 1 || enabled === 0;
};

const isValidTheme = (theme) => {
  if (!theme || typeof theme !== 'string') return false;
  return ['system', 'light', 'dark'].includes(theme.toLowerCase());
};

// Coercion functions
const coerceUnits = (units) => {
  if (!units) return null;
  return units.toLowerCase();
};

const coerceSleepGoal = (hours) => {
  if (hours === null || hours === undefined) return null;
  const n = Number(hours);
  if (isNaN(n)) return null;
  // Round to 0.1 precision
  return Math.round(n * 10) / 10;
};

const coerceWorkoutGoal = (weeks) => {
  if (weeks === null || weeks === undefined) return null;
  const n = Number(weeks);
  if (!Number.isInteger(n)) return null;
  return n;
};

const coerceNotificationsEnabled = (enabled) => {
  if (enabled === null || enabled === undefined) return null;
  if (typeof enabled === 'boolean') return enabled;
  if (enabled === 'true' || enabled === 1) return true;
  if (enabled === 'false' || enabled === 0) return false;
  return Boolean(enabled);
};

const coerceTheme = (theme) => {
  if (!theme) return null;
  return theme.toLowerCase();
};

// Validate all preferences fields
const validatePreferences = (preferences) => {
  const errors = [];
  
  if (preferences.timezone !== undefined && !isValidTimezone(preferences.timezone)) {
    errors.push('Invalid timezone');
  }
  
  if (preferences.units !== undefined && !isValidUnits(preferences.units)) {
    errors.push('Invalid units');
  }
  
  if (preferences.sleep_goal_hours !== undefined && !isValidSleepGoal(preferences.sleep_goal_hours)) {
    errors.push('Invalid sleep goal hours');
  }
  
  if (preferences.workout_goal_per_week !== undefined && !isValidWorkoutGoal(preferences.workout_goal_per_week)) {
    errors.push('Invalid workout goal per week');
  }
  
  if (preferences.notifications_enabled !== undefined && !isValidNotificationsEnabled(preferences.notifications_enabled)) {
    errors.push('Invalid notifications enabled');
  }
  
  if (preferences.theme !== undefined && !isValidTheme(preferences.theme)) {
    errors.push('Invalid theme');
  }
  
  return errors;
};

// Coerce all preferences fields
const coercePreferences = (preferences) => {
  const coerced = {};
  
  if (preferences.timezone !== undefined) {
    coerced.timezone = preferences.timezone;
  }
  
  if (preferences.units !== undefined) {
    coerced.units = coerceUnits(preferences.units);
  }
  
  if (preferences.sleep_goal_hours !== undefined) {
    coerced.sleep_goal_hours = coerceSleepGoal(preferences.sleep_goal_hours);
  }
  
  if (preferences.workout_goal_per_week !== undefined) {
    coerced.workout_goal_per_week = coerceWorkoutGoal(preferences.workout_goal_per_week);
  }
  
  if (preferences.notifications_enabled !== undefined) {
    coerced.notifications_enabled = coerceNotificationsEnabled(preferences.notifications_enabled);
  }
  
  if (preferences.theme !== undefined) {
    coerced.theme = coerceTheme(preferences.theme);
  }
  
  return coerced;
};

// Filter out unknown fields
const filterKnownFields = (preferences) => {
  const knownFields = [
    'timezone',
    'units',
    'sleep_goal_hours',
    'workout_goal_per_week',
    'notifications_enabled',
    'theme'
  ];
  
  const filtered = {};
  for (const [key, value] of Object.entries(preferences)) {
    if (knownFields.includes(key)) {
      filtered[key] = value;
    }
  }
  
  return filtered;
};

// Check request size limit
const checkRequestSize = (body) => {
  if (body && body.length > 10240) { // 10KB limit
    return false;
  }
  return true;
};

// Sanitize data for logging
const sanitizeForLog = (data) => {
  const sanitized = { ...data };
  
  // Remove any potential PII
  delete sanitized.user_id;
  delete sanitized.external_id;
  
  // Truncate long strings
  if (sanitized.timezone && sanitized.timezone.length > 50) {
    sanitized.timezone = sanitized.timezone.substring(0, 50) + '...';
  }
  
  return sanitized;
};

// Default preferences
const getDefaultPreferences = () => ({
  timezone: null,
  units: 'imperial',
  sleep_goal_hours: 8.0,
  workout_goal_per_week: 3,
  notifications_enabled: true,
  theme: 'system'
});

module.exports = {
  errorResponse,
  successResponse,
  noContentResponse,
  isValidTimezone,
  isValidUnits,
  isValidSleepGoal,
  isValidWorkoutGoal,
  isValidNotificationsEnabled,
  isValidTheme,
  coerceUnits,
  coerceSleepGoal,
  coerceWorkoutGoal,
  coerceNotificationsEnabled,
  coerceTheme,
  validatePreferences,
  coercePreferences,
  filterKnownFields,
  checkRequestSize,
  sanitizeForLog,
  getDefaultPreferences
};
