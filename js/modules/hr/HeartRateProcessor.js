class HeartRateProcessor {
    constructor(options = {}) {
        const defaultLogger = (typeof window !== 'undefined' && window.SafeLogger) ? window.SafeLogger : console;
        this.logger = options.logger || defaultLogger;
    }

    parseData(source, payload) {
        switch (source.toLowerCase()) {
        case 'strava':
            return this.#parseStrava(payload);
        case 'apple_health':
            return this.#parseAppleHealth(payload);
        case 'garmin':
            return this.#parseGarmin(payload);
        default:
            throw new Error(`Unsupported HR data source: ${source}`);
        }
    }

    calculateTRIMP(session, zones, context = {}) {
        if (!session || !Array.isArray(session.samples)) {
            throw new Error('Session must include HR samples');
        }
        const normalizedZones = zones || {};
        const genderFactor = context.gender === 'female' ? 1.67 : 1.92;
        const maxHR = context.maxHeartRate;
        const restHR = context.restingHeartRate;
        if (!Number.isFinite(maxHR) || !Number.isFinite(restHR) || maxHR <= restHR) {
            throw new Error('Valid max and resting heart rate are required for TRIMP');
        }
        let trimp = 0;
        let totalSeconds = 0;
        const zoneTotals = { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0, maximal: 0, below: 0, unclassified: 0 };

        for (const sample of session.samples) {
            const hr = Number(sample.hr);
            const duration = Number(sample.delta || sample.duration || 1);
            if (!Number.isFinite(hr) || hr <= restHR || !Number.isFinite(duration) || duration <= 0) {
                continue;
            }
            const hrrFraction = (hr - restHR) / (maxHR - restHR);
            const clampedFraction = Math.max(0, Math.min(hrrFraction, 1));
            const zone = this.#classifyZone(hr, normalizedZones);
            if (!Object.prototype.hasOwnProperty.call(zoneTotals, zone)) {
                zoneTotals.unclassified += duration;
            } else {
                zoneTotals[zone] = (zoneTotals[zone] || 0) + duration;
            }

            const load = duration * clampedFraction * (genderFactor ** clampedFraction);
            trimp += load;
            totalSeconds += duration;
        }

        return {
            trimp: Number(trimp.toFixed(2)),
            totalSeconds,
            zoneDistribution: zoneTotals
        };
    }

    #classifyZone(hr, zones) {
        for (const [zone, range] of Object.entries(zones)) {
            if (hr >= range.min && hr <= range.max) {
                return zone;
            }
        }
        return hr > (zones.Z5?.max || 999) ? 'maximal' : 'below';
    }

    #parseStrava(payload) {
        if (!payload || !payload.heartRateSeries) {
            throw new Error('Strava payload missing heart rate data');
        }
        return {
            samples: payload.heartRateSeries.map(point => ({
                hr: point.hr,
                delta: point.delta || 1
            }))
        };
    }

    #parseAppleHealth(payload) {
        if (!payload || !Array.isArray(payload.samples)) {
            throw new Error('Apple Health payload invalid');
        }
        return {
            samples: payload.samples.map(sample => ({
                hr: sample.heartRate,
                delta: sample.durationSeconds || 1
            }))
        };
    }

    #parseGarmin(payload) {
        if (!payload || !Array.isArray(payload.points)) {
            throw new Error('Garmin payload invalid');
        }
        return {
            samples: payload.points.map(point => ({
                hr: point.hrValue,
                delta: point.duration || 1
            }))
        };
    }
}

if (typeof window !== 'undefined') {
    window.HeartRateProcessor = HeartRateProcessor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeartRateProcessor;
    module.exports.default = HeartRateProcessor;
}
