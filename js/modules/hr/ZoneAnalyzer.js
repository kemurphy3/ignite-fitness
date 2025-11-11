class ZoneAnalyzer {
  constructor(options = {}) {
    const defaultLogger =
      typeof window !== 'undefined' && window.SafeLogger ? window.SafeLogger : console;
    this.logger = options.logger || defaultLogger;
    this.driftWindow = options.driftWindow || 30; // seconds for moving average
    this.driftThreshold = options.driftThreshold || 12; // bpm change considered drift
    this.anomalyThreshold = options.anomalyThreshold || 40; // bpm sudden jump indicates anomaly
  }

  classifySample(heartRate, zones) {
    if (!Number.isFinite(heartRate)) {
      return { zone: null, reason: 'invalid_hr' };
    }
    for (const [zone, range] of Object.entries(zones)) {
      if (heartRate >= range.min && heartRate <= range.max) {
        return { zone, reason: 'in_zone' };
      }
    }
    if (heartRate > zones.Z5.max) {
      return { zone: 'maximal', reason: 'above_max' };
    }
    if (heartRate < zones.Z1.min) {
      return { zone: 'below', reason: 'below_zone' };
    }
    return { zone: null, reason: 'unclassified' };
  }

  computeTimeInZones(series = [], zones) {
    if (!Array.isArray(series) || series.length === 0) {
      return { totals: this.#emptyTotals(zones), anomalies: [] };
    }

    const totals = this.#emptyTotals(zones);
    const anomalies = [];
    let previousSample = null;

    for (const sample of series) {
      const normalized = this.#normalizeSample(sample);
      if (!normalized) {
        anomalies.push({ sample, reason: 'invalid_sample' });
        continue;
      }

      if (previousSample) {
        const deltaHr = Math.abs(normalized.hr - previousSample.hr);
        if (deltaHr >= this.anomalyThreshold) {
          anomalies.push({ sample: normalized, previous: previousSample, reason: 'sudden_change' });
        }
      }

      const zoneInfo = this.classifySample(normalized.hr, zones);
      const key = zoneInfo.zone || 'unclassified';
      totals[key] = (totals[key] || 0) + normalized.delta;
      previousSample = normalized;
    }
    return { totals, anomalies };
  }

  computeZoneDistribution(series = [], zones) {
    const { totals, anomalies } = this.computeTimeInZones(series, zones);
    const totalTime = Object.values(totals).reduce((sum, seconds) => sum + seconds, 0);
    const distribution = {};

    Object.entries(totals).forEach(([zone, seconds]) => {
      distribution[zone] = totalTime > 0 ? seconds / totalTime : 0;
    });

    return { totals, distribution, anomalies };
  }

  detectDrift(series = []) {
    if (!Array.isArray(series) || series.length === 0) {
      return { driftEvents: [] };
    }

    const normalizedSeries = series.map(sample => this.#normalizeSample(sample)).filter(Boolean);
    const driftEvents = [];
    for (let i = this.driftWindow; i < normalizedSeries.length; i++) {
      const windowSlice = normalizedSeries.slice(i - this.driftWindow, i + 1);
      const startHr = windowSlice[0].hr;
      const endHr = windowSlice[windowSlice.length - 1].hr;
      if (Math.abs(endHr - startHr) >= this.driftThreshold) {
        driftEvents.push({
          start: windowSlice[0].time,
          end: windowSlice[windowSlice.length - 1].time,
          delta: endHr - startHr,
        });
      }
    }
    return { driftEvents };
  }

  detectSensorAnomalies(series = []) {
    if (!Array.isArray(series) || series.length === 0) {
      return [];
    }
    const anomalies = [];
    let previous = null;
    for (const sample of series) {
      const current = this.#normalizeSample(sample);
      if (!current) {
        anomalies.push({ sample, reason: 'invalid_sample' });
        continue;
      }
      if (previous) {
        const timeGap = current.time - previous.time;
        const hrGap = Math.abs(current.hr - previous.hr);
        if (timeGap > 30 && hrGap < 3) {
          anomalies.push({ sample: current, reason: 'sensor_disconnect' });
        }
      }
      if (current.hr < 30 || current.hr > 230) {
        anomalies.push({ sample: current, reason: 'physiologically_implausible' });
      }
      previous = current;
    }
    return anomalies;
  }

  #normalizeSample(sample) {
    if (!sample) {
      return null;
    }
    if (typeof sample === 'number') {
      return { hr: sample, delta: 1, time: 0 };
    }
    const hr = Number(sample.hr ?? sample.heartRate);
    const time = Number(sample.time ?? sample.timestamp ?? 0);
    const delta = Number(sample.delta ?? sample.duration ?? 1);
    if (!Number.isFinite(hr) || hr <= 0) {
      return null;
    }
    if (!Number.isFinite(delta) || delta <= 0) {
      return null;
    }
    return { hr, time, delta };
  }

  #emptyTotals(zones) {
    const totals = { below: 0, maximal: 0, unclassified: 0 };
    Object.keys(zones).forEach(zone => (totals[zone] = 0));
    return totals;
  }
}

if (typeof window !== 'undefined') {
  window.ZoneAnalyzer = ZoneAnalyzer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZoneAnalyzer;
  module.exports.default = ZoneAnalyzer;
}
