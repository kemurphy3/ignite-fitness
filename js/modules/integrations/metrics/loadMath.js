/**
 * Load Math Utilities
 * Handles training load calculations, heart rate zones, and rolling metrics
 */

class LoadMath {
  /**
   * Compute heart rate zones from HR stream
   * @param {Array} hrStream - Heart rate stream data
   * @param {Object} userProfile - User profile with HR zones
   * @returns {Object} Zone distribution in minutes
   */
  static computeZonesFromHR(hrStream, userProfile) {
    if (!hrStream || hrStream.length === 0) {
      return { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
    }

    const zones = this.getHRZones(userProfile);
    const zoneMinutes = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

    // Process HR stream (assuming 1-second intervals)
    for (let i = 0; i < hrStream.length; i++) {
      const hr = hrStream[i];
      const zone = this.getHRZone(hr, zones);

      // Add 1 second (1/60 minute) to appropriate zone
      zoneMinutes[zone] += 1 / 60;
    }

    return zoneMinutes;
  }

  /**
   * Get heart rate zones for user
   * @param {Object} userProfile - User profile
   * @returns {Object} HR zone thresholds
   */
  static getHRZones(userProfile) {
    const maxHR = userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender);
    const restHR = userProfile.restHR || 60;

    // Karvonen method zones
    const hrReserve = maxHR - restHR;

    return {
      z1: restHR + hrReserve * 0.5, // 50-60% HRR
      z2: restHR + hrReserve * 0.6, // 60-70% HRR
      z3: restHR + hrReserve * 0.7, // 70-80% HRR
      z4: restHR + hrReserve * 0.8, // 80-90% HRR
      z5: restHR + hrReserve * 0.9, // 90-100% HRR
    };
  }

  /**
   * Determine HR zone for given heart rate
   * @param {number} hr - Heart rate
   * @param {Object} zones - HR zone thresholds
   * @returns {string} Zone name
   */
  static getHRZone(hr, zones) {
    if (hr < zones.z1) {
      return 'z1';
    }
    if (hr < zones.z2) {
      return 'z2';
    }
    if (hr < zones.z3) {
      return 'z3';
    }
    if (hr < zones.z4) {
      return 'z4';
    }
    return 'z5';
  }

  /**
   * Estimate max HR using age and gender
   * @param {number} age - User age
   * @param {string} gender - User gender
   * @returns {number} Estimated max HR
   */
  static estimateMaxHR(age, gender) {
    if (gender === 'female') {
      return 206 - 0.88 * age;
    } else {
      return 220 - age;
    }
  }

  /**
   * Compute TRIMP (Training Impulse) using Banister formula
   * TRIMP = duration × 0.64 × e^(1.92 × HRR)
   * @param {Object} activity - Activity data
   * @param {Object} userProfile - User profile
   * @returns {number} TRIMP score
   */
  static computeTRIMP(activity, userProfile) {
    const { durationS, avgHr, hrStream } = activity;

    if (!durationS || durationS === 0) {
      return 0;
    }

    const durationMinutes = durationS / 60;
    const maxHR = userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender);
    const restHR = userProfile.restHR || 60;

    // Method 1: Using average HR (Banister TRIMP formula)
    if (avgHr && !hrStream) {
      const hrReserve = maxHR - restHR;
      const hrReservePercent = (avgHr - restHR) / hrReserve;

      // Banister TRIMP formula: duration × 0.64 × e^(1.92 × HRR)
      const trimpFactor = 0.64 * Math.exp(1.92 * hrReservePercent);
      return durationMinutes * trimpFactor;
    }

    // Method 2: Using HR stream (more accurate Banister TRIMP)
    if (hrStream && hrStream.length > 0) {
      let totalTRIMP = 0;

      for (let i = 0; i < hrStream.length; i++) {
        const hr = hrStream[i];
        const hrReserve = maxHR - restHR;
        const hrReservePercent = (hr - restHR) / hrReserve;

        // Banister TRIMP formula: 0.64 × e^(1.92 × HRR) per minute
        const trimpFactor = 0.64 * Math.exp(1.92 * hrReservePercent);
        totalTRIMP += trimpFactor;
      }

      return totalTRIMP;
    }

    // Fallback: Estimate based on activity type
    return this.estimateTRIMP(activity, userProfile);
  }

  /**
   * Estimate TRIMP based on activity type and duration
   * @param {Object} activity - Activity data
   * @param {Object} userProfile - User profile
   * @returns {number} Estimated TRIMP
   */
  static estimateTRIMP(activity, userProfile) {
    const { durationS, type } = activity;
    const durationMinutes = durationS / 60;

    // Base TRIMP factors by activity type
    const trimpFactors = {
      Run: 1.0,
      Ride: 0.8,
      Swim: 1.2,
      Strength: 0.6,
      Soccer: 1.1,
      Walk: 0.3,
      Hike: 0.7,
      Yoga: 0.4,
      Other: 0.5,
    };

    const factor = trimpFactors[type] || 0.5;
    return durationMinutes * factor;
  }

  /**
   * Compute Training Stress Score (TSS) for cycling
   * @param {Object} activity - Activity data
   * @param {Object} userProfile - User profile
   * @returns {number} TSS score
   */
  static computeTSS(activity, userProfile) {
    const { durationS, avgHr, hrStream } = activity;

    if (!durationS || durationS === 0) {
      return 0;
    }

    const durationHours = durationS / 3600;
    const zones = this.getHRZones(userProfile);
    const maxHR = userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender);
    const restHR = userProfile.restHR || 60;

    // Using average HR
    if (avgHr && !hrStream) {
      const hrReserve = maxHR - restHR;
      const intensityFactor = (avgHr - restHR) / hrReserve;
      return durationHours * Math.pow(intensityFactor, 2) * 100;
    }

    // Using HR stream
    if (hrStream && hrStream.length > 0) {
      let totalTSS = 0;

      for (let i = 0; i < hrStream.length; i++) {
        const hr = hrStream[i];
        const hrReserve = maxHR - restHR;
        const intensityFactor = (hr - restHR) / hrReserve;
        totalTSS += Math.pow(intensityFactor, 2);
      }

      return (totalTSS / hrStream.length) * durationHours * 100;
    }

    return 0;
  }

  /**
   * Recompute daily aggregates for affected dates
   * @param {number} userId - User ID
   * @param {Array} affectedDates - Array of dates to recompute
   * @returns {Object} Recompute results
   */
  static async recomputeDailyAggregates(userId, affectedDates) {
    const results = [];

    for (const date of affectedDates) {
      try {
        const aggregates = await this.computeDailyAggregates(userId, date);
        results.push({ date, aggregates, success: true });
      } catch (error) {
        results.push({ date, error: error.message, success: false });
      }
    }

    return results;
  }

  /**
   * Compute daily aggregates for a specific date
   * @param {number} userId - User ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Object} Daily aggregates
   */
  static async computeDailyAggregates(userId, date) {
    // This would typically query the database for activities on this date
    // For now, return a mock structure
    return {
      userId,
      date,
      trimp: 0,
      tss: 0,
      loadScore: 0,
      z1Min: 0,
      z2Min: 0,
      z3Min: 0,
      z4Min: 0,
      z5Min: 0,
      distanceM: 0,
      durationS: 0,
      runCount: 0,
      rideCount: 0,
      strengthCount: 0,
      lastRecalcTs: new Date().toISOString(),
    };
  }

  /**
   * Recompute rolling metrics (ATL, CTL, monotony, strain)
   * @param {number} userId - User ID
   * @param {string} startDate - Start date
   * @param {number} days - Number of days to compute (default 35)
   * @returns {Object} Rolling metrics
   */
  static async recomputeRolling(userId, startDate, days = 35) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    // This would typically query daily aggregates from the database
    // For now, return mock rolling metrics
    return {
      userId,
      startDate,
      days,
      atl7: 0, // Acute Training Load (7-day)
      ctl28: 0, // Chronic Training Load (28-day)
      monotony: 0, // Training monotony
      strain: 0, // Training strain
      lastRecalcTs: new Date().toISOString(),
    };
  }

  /**
   * Calculate training monotony
   * @param {Array} dailyLoads - Array of daily load values
   * @returns {number} Monotony score
   */
  static calculateMonotony(dailyLoads) {
    if (dailyLoads.length === 0) {
      return 0;
    }

    const mean = dailyLoads.reduce((sum, load) => sum + load, 0) / dailyLoads.length;
    const variance =
      dailyLoads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / dailyLoads.length;
    const stdDev = Math.sqrt(variance);

    return mean / (stdDev + 1); // Add 1 to avoid division by zero
  }

  /**
   * Calculate training strain
   * @param {number} monotony - Monotony score
   * @param {number} weeklyLoad - Weekly training load
   * @returns {number} Strain score
   */
  static calculateStrain(monotony, weeklyLoad) {
    return weeklyLoad * monotony;
  }

  /**
   * Calculate Acute Training Load (ATL)
   * @param {Array} dailyLoads - Array of daily load values (7 days)
   * @returns {number} ATL score
   */
  static calculateATL(dailyLoads) {
    if (dailyLoads.length === 0) {
      return 0;
    }

    // Exponential moving average with 7-day time constant
    const timeConstant = 7;
    let atl = 0;

    for (let i = 0; i < dailyLoads.length; i++) {
      const alpha = 1 - Math.exp(-1 / timeConstant);
      atl = alpha * dailyLoads[i] + (1 - alpha) * atl;
    }

    return atl;
  }

  /**
   * Calculate Chronic Training Load (CTL)
   * @param {Array} dailyLoads - Array of daily load values (28 days)
   * @returns {number} CTL score
   */
  static calculateCTL(dailyLoads) {
    if (dailyLoads.length === 0) {
      return 0;
    }

    // Exponential moving average with 28-day time constant
    const timeConstant = 28;
    let ctl = 0;

    for (let i = 0; i < dailyLoads.length; i++) {
      const alpha = 1 - Math.exp(-1 / timeConstant);
      ctl = alpha * dailyLoads[i] + (1 - alpha) * ctl;
    }

    return ctl;
  }

  /**
   * Calculate Training Stress Balance (TSB)
   * @param {number} ctl - Chronic Training Load
   * @param {number} atl - Acute Training Load
   * @returns {number} TSB score
   */
  static calculateTSB(ctl, atl) {
    return ctl - atl;
  }

  /**
   * Calculate training load using Banister TRIMP formula
   * This is the main method that replaces mock load calculations
   * @param {Object} activity - Activity data with HR information
   * @param {Object} userProfile - User profile with HR zones
   * @returns {Object} Load calculation results
   */
  static calculateLoad(activity, userProfile) {
    const { durationS, avgHr, hrStream, type, date } = activity;

    if (!durationS || durationS === 0) {
      return {
        trimp: 0,
        loadScore: 0,
        intensityRecommendation: 'rest',
        weeklyLoad: 0,
        calculationMethod: 'no_duration',
      };
    }

    // Calculate TRIMP using Banister formula
    const trimp = this.computeTRIMP(activity, userProfile);

    // Calculate load score (normalized TRIMP)
    const loadScore = this.normalizeLoadScore(trimp, userProfile);

    // Get intensity recommendation based on load
    const intensityRecommendation = this.getIntensityRecommendation(trimp, userProfile);

    // Calculate weekly load (would typically sum daily TRIMP values)
    const weeklyLoad = this.calculateWeeklyLoad(userProfile, date);

    return {
      trimp: Math.round(trimp * 100) / 100, // Round to 2 decimal places
      loadScore: Math.round(loadScore * 100) / 100,
      intensityRecommendation,
      weeklyLoad: Math.round(weeklyLoad * 100) / 100,
      calculationMethod: hrStream ? 'hr_stream' : avgHr ? 'avg_hr' : 'estimated',
      formula: 'Banister TRIMP: duration × 0.64 × e^(1.92 × HRR)',
      hrData: {
        avgHr: avgHr || null,
        hrStreamLength: hrStream ? hrStream.length : 0,
        maxHR: userProfile.maxHR || this.estimateMaxHR(userProfile.age, userProfile.gender),
        restHR: userProfile.restHR || 60,
      },
    };
  }

  /**
   * Normalize load score based on user's fitness level
   * @param {number} trimp - TRIMP value
   * @param {Object} userProfile - User profile
   * @returns {number} Normalized load score (0-100)
   */
  static normalizeLoadScore(trimp, userProfile) {
    // Base normalization on user's fitness level
    const fitnessLevel = userProfile.fitnessLevel || 'intermediate';
    const normalizationFactors = {
      beginner: 1.5, // Higher factor for beginners (lower fitness)
      intermediate: 1.0, // Standard factor
      advanced: 0.7, // Lower factor for advanced (higher fitness)
    };

    const factor = normalizationFactors[fitnessLevel];
    const normalizedScore = (trimp * factor) / 10; // Scale to 0-100 range

    return Math.min(100, Math.max(0, normalizedScore));
  }

  /**
   * Get intensity recommendation based on TRIMP load
   * @param {number} trimp - TRIMP value
   * @param {Object} userProfile - User profile
   * @returns {string} Intensity recommendation
   */
  static getIntensityRecommendation(trimp, userProfile) {
    const fitnessLevel = userProfile.fitnessLevel || 'intermediate';

    // Adjust thresholds based on fitness level
    const thresholds = {
      beginner: { low: 30, moderate: 60, high: 100 },
      intermediate: { low: 50, moderate: 100, high: 150 },
      advanced: { low: 70, moderate: 140, high: 200 },
    };

    const threshold = thresholds[fitnessLevel];

    if (trimp < threshold.low) {
      return 'easy'; // Easy recovery workout
    } else if (trimp < threshold.moderate) {
      return 'moderate'; // Moderate intensity workout
    } else if (trimp < threshold.high) {
      return 'hard'; // Hard intensity workout
    } else {
      return 'very_hard'; // Very hard intensity workout
    }
  }

  /**
   * Calculate weekly load by summing daily TRIMP values
   * @param {Object} userProfile - User profile
   * @param {string} date - Current date (YYYY-MM-DD)
   * @returns {number} Weekly TRIMP total
   */
  static calculateWeeklyLoad(userProfile, date) {
    // This would typically query the database for activities in the past 7 days
    // For now, return a calculated estimate based on user's training frequency

    const trainingFrequency = userProfile.trainingFrequency || 3; // workouts per week
    const avgTrimpPerWorkout = 80; // Average TRIMP per workout

    return trainingFrequency * avgTrimpPerWorkout;
  }

  /**
   * Get training load interpretation
   * @param {number} load - Training load value
   * @param {string} metric - Load metric type ('trimp', 'tss', 'atl', 'ctl')
   * @returns {Object} Load interpretation
   */
  static interpretLoad(load, metric) {
    const interpretations = {
      trimp: {
        low: { min: 0, max: 50, description: 'Easy recovery' },
        moderate: { min: 50, max: 100, description: 'Moderate training' },
        high: { min: 100, max: 200, description: 'Hard training' },
        veryHigh: { min: 200, max: Infinity, description: 'Very hard training' },
      },
      tss: {
        low: { min: 0, max: 50, description: 'Easy recovery' },
        moderate: { min: 50, max: 100, description: 'Moderate training' },
        high: { min: 100, max: 200, description: 'Hard training' },
        veryHigh: { min: 200, max: Infinity, description: 'Very hard training' },
      },
    };

    const ranges = interpretations[metric] || interpretations.trimp;

    for (const [level, range] of Object.entries(ranges)) {
      if (load >= range.min && load < range.max) {
        return { level, description: range.description };
      }
    }

    return { level: 'unknown', description: 'Unknown load level' };
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LoadMath;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.LoadMath = LoadMath;
}
