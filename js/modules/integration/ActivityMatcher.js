/**
 * ActivityMatcher - deterministic matching and stream extraction for Strava activities
 * Matches Strava activities to internal sessions within a configurable window
 * and normalizes heart-rate stream data for downstream processing.
 */
class ActivityMatcher {
  constructor(options = {}) {
    const defaultLogger =
      typeof window !== 'undefined' && window.SafeLogger ? window.SafeLogger : console;
    this.logger = options.logger || defaultLogger;
    this.matchWindowMs = Number.isFinite(options.matchWindowMs)
      ? options.matchWindowMs
      : 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Match Strava activities against existing sessions.
   * @param {Array} stravaActivities - Raw Strava activity payloads.
   * @param {Array} sessions - Internal workout/session objects.
   * @returns {Array} Array of match objects { activityId, sessionId, deltaMs }
   */
  matchActivities(stravaActivities = [], sessions = []) {
    if (!Array.isArray(stravaActivities) || !Array.isArray(sessions)) {
      return [];
    }

    const sessionIndex = sessions
      .filter(session => session && session.startTime)
      .map(session => ({
        ...session,
        startTs: new Date(session.startTime).getTime(),
      }))
      .filter(session => Number.isFinite(session.startTs));

    return stravaActivities
      .filter(activity => activity && activity.start_date)
      .map(activity => this.findBestMatch(activity, sessionIndex))
      .filter(match => !!match);
  }

  findBestMatch(activity, sessionIndex) {
    const activityTs = new Date(activity.start_date).getTime();
    if (!Number.isFinite(activityTs)) {
      return null;
    }

    let bestMatch = null;
    let bestDelta = Infinity;

    for (const session of sessionIndex) {
      const delta = Math.abs(session.startTs - activityTs);
      if (delta <= this.matchWindowMs && delta < bestDelta) {
        bestDelta = delta;
        bestMatch = {
          activityId: activity.id?.toString() || null,
          sessionId: session.id || session.sessionId || null,
          deltaMs: delta,
        };
      }
    }

    if (!bestMatch) {
      return null;
    }

    this.logger.debug?.('ActivityMatcher: found match', bestMatch);
    return bestMatch;
  }

  /**
   * Build a normalized heart rate series using Strava stream payload.
   * @param {Object} streams - Strava stream response (keyed by stream type).
   * @returns {Array} Array of { time, hr } pairs.
   */
  static buildHeartRateSeries(streams) {
    if (!streams || !streams.heartrate || !Array.isArray(streams.heartrate.data)) {
      return [];
    }

    const hrData = streams.heartrate.data;
    const timeData = Array.isArray(streams.time?.data) ? streams.time.data : null;

    return hrData
      .map((hr, index) => ({
        time: timeData ? (timeData[index] ?? index) : index,
        hr,
      }))
      .filter(point => Number.isFinite(point.hr));
  }

  /**
   * Determine whether a Strava activity should be deduplicated based on existing activity metadata.
   * @param {Object} existing - Existing stored activity (with external_id).
   * @param {Object} candidate - Incoming Strava activity payload.
   * @returns {boolean} True when the incoming activity is already stored.
   */
  static isDuplicate(existing, candidate) {
    if (!existing || !candidate) {
      return false;
    }
    const existingId = existing.external_id || existing.stravaId || existing.canonicalExternalId;
    const candidateId = candidate.id?.toString?.() || candidate.external_id || candidate.stravaId;
    return existingId !== undefined && candidateId !== undefined && existingId === candidateId;
  }
}

if (typeof window !== 'undefined') {
  window.ActivityMatcher = ActivityMatcher;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ActivityMatcher;
  module.exports.default = ActivityMatcher;
}
