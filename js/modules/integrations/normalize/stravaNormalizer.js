/**
 * Strava Normalizer
 * Normalizes Strava activity data to internal format with async yielding
 */

class StravaNormalizer {
  constructor() {
    this.asyncYielder = new AsyncYielder({
      maxBlockTime: 50,
      yieldInterval: 16,
    });
  }

  /**
   * Normalize multiple Strava activities with yielding
   * @param {Array} stravaActivities - Raw Strava activities
   * @param {number} userId - User ID
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Normalized activities
   */
  async normalizeActivities(stravaActivities, userId, options = {}) {
    const { onProgress = null, onError = null, batchSize = 10 } = options;

    this.logger = window.SafeLogger || console;
    this.logger.info(`Normalizing ${stravaActivities.length} Strava activities`);

    // Process activities with yielding
    const result = await this.asyncYielder.processArray(
      stravaActivities,
      activity => this.normalizeActivity(activity, userId),
      {
        batchSize,
        onProgress,
        onError,
      }
    );

    this.logger.info(`Normalized ${result.results.length} activities`);
    return result.results;
  }

  /**
   * Normalize Strava activity to internal format
   * @param {Object} stravaActivity - Raw Strava activity data
   * @param {number} userId - User ID
   * @returns {Object} Normalized activity
   */
  normalizeActivity(stravaActivity, userId) {
    const normalized = {
      userId,
      canonicalSource: 'strava',
      canonicalExternalId: stravaActivity.id?.toString(),
      type: this.mapActivityType(stravaActivity.type),
      name: stravaActivity.name || 'Untitled Activity',
      startTs: stravaActivity.start_date,
      endTs: stravaActivity.start_date
        ? new Date(
            new Date(stravaActivity.start_date).getTime() + (stravaActivity.moving_time || 0) * 1000
          ).toISOString()
        : null,
      durationS: stravaActivity.moving_time || stravaActivity.elapsed_time || 0,
      device: this.extractDeviceInfo(stravaActivity),
      hasHr: !!stravaActivity.has_heartrate,
      hasGps: !!stravaActivity.start_latlng,
      hasPower: !!stravaActivity.device_watts,
      distanceM: stravaActivity.distance || 0,
      avgHr: stravaActivity.average_heartrate || null,
      maxHr: stravaActivity.max_heartrate || null,
      caloriesKcal: stravaActivity.calories || null,
      sourceSet: {
        strava: {
          id: stravaActivity.id?.toString(),
          richness: this.calculateRichness(stravaActivity),
        },
      },
      isExcluded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Generate deduplication hash
    if (typeof window !== 'undefined' && window.DedupRules) {
      normalized.dedupHash = window.DedupRules.buildDedupHash(normalized);
    }

    return normalized;
  }

  /**
   * Map Strava activity type to internal type
   * @param {string} stravaType - Strava activity type
   * @returns {string} Internal activity type
   */
  static mapActivityType(stravaType) {
    const typeMap = {
      Run: 'Run',
      Ride: 'Ride',
      VirtualRide: 'Ride',
      Swim: 'Swim',
      Walk: 'Walk',
      Hike: 'Hike',
      WeightTraining: 'Strength',
      Workout: 'Strength',
      Yoga: 'Yoga',
      Pilates: 'Yoga',
      CrossTraining: 'Other',
      Elliptical: 'Other',
      StairStepper: 'Other',
      Rowing: 'Other',
      Kitesurf: 'Other',
      Windsurf: 'Other',
      Surfing: 'Other',
      Snowboard: 'Other',
      AlpineSki: 'Other',
      NordicSki: 'Other',
      IceSkate: 'Other',
      InlineSkate: 'Other',
      RockClimbing: 'Other',
      RollerSki: 'Other',
      Skateboarding: 'Other',
      Snowshoe: 'Other',
      Soccer: 'Soccer',
      Tennis: 'Other',
      Basketball: 'Other',
      Golf: 'Other',
      Handball: 'Other',
      Rugby: 'Other',
      Volleyball: 'Other',
      Badminton: 'Other',
      TableTennis: 'Other',
      Squash: 'Other',
      Racquetball: 'Other',
      Lacrosse: 'Other',
      Cricket: 'Other',
      Boxing: 'Other',
      MartialArts: 'Other',
      Diving: 'Other',
      Fencing: 'Other',
      Gymnastics: 'Other',
      Dance: 'Other',
      Climbing: 'Other',
      Canoeing: 'Other',
      Kayaking: 'Other',
      Sailing: 'Other',
      StandUpPaddling: 'Other',
      Surfing: 'Other',
      Windsurfing: 'Other',
      Kitesurfing: 'Other',
      Windsurfing: 'Other',
      Wakeboarding: 'Other',
      WaterSkiing: 'Other',
      Snorkeling: 'Other',
      ScubaDiving: 'Other',
      WhitewaterRafting: 'Other',
      RockClimbing: 'Other',
      IceClimbing: 'Other',
      Mountaineering: 'Other',
      Hiking: 'Hike',
      TrailRunning: 'Run',
      TrackRunning: 'Run',
      RoadRunning: 'Run',
      TreadmillRunning: 'Run',
      Cycling: 'Ride',
      RoadCycling: 'Ride',
      MountainBiking: 'Ride',
      Cyclocross: 'Ride',
      BMX: 'Ride',
      TrackCycling: 'Ride',
      IndoorCycling: 'Ride',
      VirtualRun: 'Run',
      VirtualRide: 'Ride',
      VirtualSwim: 'Swim',
      VirtualWorkout: 'Strength',
      VirtualHike: 'Hike',
      VirtualWalk: 'Walk',
      VirtualYoga: 'Yoga',
      VirtualPilates: 'Yoga',
      VirtualCrossTraining: 'Other',
      VirtualElliptical: 'Other',
      VirtualStairStepper: 'Other',
      VirtualRowing: 'Other',
      VirtualKitesurf: 'Other',
      VirtualWindsurf: 'Other',
      VirtualSurfing: 'Other',
      VirtualSnowboard: 'Other',
      VirtualAlpineSki: 'Other',
      VirtualNordicSki: 'Other',
      VirtualIceSkate: 'Other',
      VirtualInlineSkate: 'Other',
      VirtualRockClimbing: 'Other',
      VirtualRollerSki: 'Other',
      VirtualSkateboarding: 'Other',
      VirtualSnowshoe: 'Other',
      VirtualSoccer: 'Soccer',
      VirtualTennis: 'Other',
      VirtualBasketball: 'Other',
      VirtualGolf: 'Other',
      VirtualHandball: 'Other',
      VirtualRugby: 'Other',
      VirtualVolleyball: 'Other',
      VirtualBadminton: 'Other',
      VirtualTableTennis: 'Other',
      VirtualSquash: 'Other',
      VirtualRacquetball: 'Other',
      VirtualLacrosse: 'Other',
      VirtualCricket: 'Other',
      VirtualBoxing: 'Other',
      VirtualMartialArts: 'Other',
      VirtualDiving: 'Other',
      VirtualFencing: 'Other',
      VirtualGymnastics: 'Other',
      VirtualDance: 'Other',
      VirtualClimbing: 'Other',
      VirtualCanoeing: 'Other',
      VirtualKayaking: 'Other',
      VirtualSailing: 'Other',
      VirtualStandUpPaddling: 'Other',
      VirtualSurfing: 'Other',
      VirtualWindsurfing: 'Other',
      VirtualKitesurfing: 'Other',
      VirtualWakeboarding: 'Other',
      VirtualWaterSkiing: 'Other',
      VirtualSnorkeling: 'Other',
      VirtualScubaDiving: 'Other',
      VirtualWhitewaterRafting: 'Other',
      VirtualRockClimbing: 'Other',
      VirtualIceClimbing: 'Other',
      VirtualMountaineering: 'Other',
    };

    return typeMap[stravaType] || 'Other';
  }

  /**
   * Extract device information from Strava activity
   * @param {Object} stravaActivity - Raw Strava activity data
   * @returns {Object} Device information
   */
  static extractDeviceInfo(stravaActivity) {
    const device = {};

    if (stravaActivity.device_name) {
      device.name = stravaActivity.device_name;
    }

    if (stravaActivity.device_type) {
      device.type = stravaActivity.device_type;
    }

    if (stravaActivity.manufacturer) {
      device.manufacturer = stravaActivity.manufacturer;
    }

    if (stravaActivity.model) {
      device.model = stravaActivity.model;
    }

    return Object.keys(device).length > 0 ? device : null;
  }

  /**
   * Calculate richness score for Strava activity
   * @param {Object} stravaActivity - Raw Strava activity data
   * @returns {number} Richness score (0.0 to 1.0)
   */
  static calculateRichness(stravaActivity) {
    let score = 0.0;

    // Heart rate data (+0.4)
    if (
      stravaActivity.has_heartrate ||
      stravaActivity.average_heartrate ||
      stravaActivity.max_heartrate
    ) {
      score += 0.4;
    }

    // GPS data (+0.2)
    if (stravaActivity.start_latlng || stravaActivity.end_latlng || stravaActivity.distance) {
      score += 0.2;
    }

    // Power data (+0.2)
    if (stravaActivity.device_watts || stravaActivity.average_watts || stravaActivity.max_watts) {
      score += 0.2;
    }

    // Per-second data (+0.1)
    if (stravaActivity.has_kudoed || stravaActivity.achievement_count > 0) {
      score += 0.1;
    }

    // Device information (+0.1)
    if (stravaActivity.device_name || stravaActivity.device_type) {
      score += 0.1;
    }

    // Additional data quality indicators
    if (stravaActivity.calories && stravaActivity.calories > 0) {
      score += 0.05;
    }

    if (stravaActivity.total_elevation_gain && stravaActivity.total_elevation_gain > 0) {
      score += 0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Normalize Strava activity streams
   * @param {Object} stravaStreams - Raw Strava stream data
   * @param {number} activityId - Internal activity ID
   * @returns {Array} Normalized stream data
   */
  static normalizeStreams(stravaStreams, activityId) {
    const normalizedStreams = [];

    if (!stravaStreams || typeof stravaStreams !== 'object') {
      return normalizedStreams;
    }

    // Process each stream type
    const streamTypes = ['heartrate', 'time', 'latlng', 'altitude', 'watts', 'cadence', 'temp'];

    for (const streamType of streamTypes) {
      if (stravaStreams[streamType]) {
        const normalizedStream = this.normalizeStream(
          stravaStreams[streamType],
          streamType,
          activityId
        );
        if (normalizedStream) {
          normalizedStreams.push(normalizedStream);
        }
      }
    }

    return normalizedStreams;
  }

  /**
   * Normalize individual stream
   * @param {Array} streamData - Raw stream data
   * @param {string} streamType - Stream type
   * @param {number} activityId - Internal activity ID
   * @returns {Object} Normalized stream
   */
  static normalizeStream(streamData, streamType, activityId) {
    if (!Array.isArray(streamData) || streamData.length === 0) {
      return null;
    }

    const normalizedType = this.mapStreamType(streamType);
    const samples = this.normalizeSamples(streamData, streamType);

    return {
      activityId,
      streamType: normalizedType,
      samples,
      sampleRateHz: this.calculateSampleRate(samples),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Map Strava stream type to internal type
   * @param {string} stravaStreamType - Strava stream type
   * @returns {string} Internal stream type
   */
  static mapStreamType(stravaStreamType) {
    const typeMap = {
      heartrate: 'hr',
      time: 'time',
      latlng: 'gps',
      altitude: 'alt',
      watts: 'power',
      cadence: 'cadence',
      temp: 'temp',
      velocity_smooth: 'pace',
      grade_smooth: 'grade',
    };

    return typeMap[stravaStreamType] || stravaStreamType;
  }

  /**
   * Normalize stream samples
   * @param {Array} samples - Raw samples
   * @param {string} streamType - Stream type
   * @returns {Array} Normalized samples
   */
  static normalizeSamples(samples, streamType) {
    return samples.map((sample, index) => {
      const normalized = { t: index }; // Time in seconds

      switch (streamType) {
        case 'heartrate':
          normalized.v = sample;
          break;
        case 'latlng':
          normalized.lat = sample[0];
          normalized.lng = sample[1];
          break;
        case 'altitude':
          normalized.v = sample;
          break;
        case 'watts':
          normalized.v = sample;
          break;
        case 'cadence':
          normalized.v = sample;
          break;
        case 'temp':
          normalized.v = sample;
          break;
        case 'velocity_smooth':
          normalized.v = sample;
          break;
        case 'grade_smooth':
          normalized.v = sample;
          break;
        default:
          normalized.v = sample;
      }

      return normalized;
    });
  }

  /**
   * Calculate sample rate from samples
   * @param {Array} samples - Sample data
   * @returns {number} Sample rate in Hz
   */
  static calculateSampleRate(samples) {
    if (samples.length < 2) {
      return 0;
    }

    const timeSpan = samples[samples.length - 1].t - samples[0].t;
    return samples.length / timeSpan;
  }

  /**
   * Validate normalized activity
   * @param {Object} normalizedActivity - Normalized activity
   * @returns {Object} Validation result
   */
  static validateNormalizedActivity(normalizedActivity) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!normalizedActivity.userId) {
      errors.push('Missing userId');
    }
    if (!normalizedActivity.canonicalSource) {
      errors.push('Missing canonicalSource');
    }
    if (!normalizedActivity.type) {
      errors.push('Missing type');
    }
    if (!normalizedActivity.startTs) {
      errors.push('Missing startTs');
    }
    if (!normalizedActivity.durationS) {
      errors.push('Missing durationS');
    }

    // Data quality warnings
    if (normalizedActivity.durationS && normalizedActivity.durationS < 60) {
      warnings.push('Very short duration (< 1 minute)');
    }

    if (normalizedActivity.durationS && normalizedActivity.durationS > 86400) {
      warnings.push('Very long duration (> 24 hours)');
    }

    if (
      normalizedActivity.avgHr &&
      (normalizedActivity.avgHr < 40 || normalizedActivity.avgHr > 220)
    ) {
      warnings.push('Unusual average heart rate');
    }

    if (normalizedActivity.distanceM && normalizedActivity.distanceM < 0) {
      errors.push('Negative distance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Batch normalize multiple Strava activities
   * @param {Array} stravaActivities - Array of raw Strava activities
   * @param {number} userId - User ID
   * @returns {Object} Batch normalization results
   */
  static batchNormalize(stravaActivities, userId) {
    const results = {
      normalized: [],
      errors: [],
      total: stravaActivities.length,
    };

    for (const stravaActivity of stravaActivities) {
      try {
        const normalized = this.normalizeActivity(stravaActivity, userId);
        const validation = this.validateNormalizedActivity(normalized);

        if (validation.isValid) {
          results.normalized.push(normalized);
        } else {
          results.errors.push({
            activity: stravaActivity,
            errors: validation.errors,
            warnings: validation.warnings,
          });
        }
      } catch (error) {
        results.errors.push({
          activity: stravaActivity,
          error: error.message,
        });
      }
    }

    results.successCount = results.normalized.length;
    results.errorCount = results.errors.length;

    return results;
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StravaNormalizer;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.StravaNormalizer = StravaNormalizer;
}
