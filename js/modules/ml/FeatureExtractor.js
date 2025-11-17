import TrendAnalyzer from './TrendAnalyzer.js';

/**
 * FeatureExtractor - transforms raw training/performance logs into
 * statistical features for machine learning models.
 */
class FeatureExtractor {
  constructor(options = {}) {
    this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
    this.trendAnalyzer = options.trendAnalyzer || new TrendAnalyzer(this.logger);
    this.windows = options.windows || [7, 14, 30];
  }

  validateSeries(series = [], requiredKeys = []) {
    if (!Array.isArray(series) || series.length === 0) {
      throw new Error('Feature extraction requires non-empty series');
    }
    return series
      .map(entry => {
        const normalized = { ...entry };
        normalized.timestamp = Number(
          entry.timestamp ?? (entry.date ? new Date(entry.date).getTime() : NaN)
        );
        if (!Number.isFinite(normalized.timestamp)) {
          throw new Error('Entries require numeric timestamp (ms)');
        }
        requiredKeys.forEach(key => {
          const value = Number(entry[key]);
          if (!Number.isFinite(value)) {
            throw new Error(`Missing numeric value for ${key}`);
          }
          normalized[key] = value;
        });
        return normalized;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  addRollingStatistics(series, metricKeys = []) {
    const sorted = this.validateSeries(series, metricKeys);
    const features = sorted.map(entry => ({ ...entry }));

    metricKeys.forEach(key => {
      this.windows.forEach(window => {
        const windowKey = `${key}_ma_${window}`;
        const stdKey = `${key}_std_${window}`;
        for (let i = 0; i < sorted.length; i++) {
          const start = Math.max(0, i - window + 1);
          const windowSlice = sorted.slice(start, i + 1);
          const values = windowSlice.map(item => item[key]);
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
          const variance =
            values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            Math.max(values.length - 1, 1);
          features[i][windowKey] = mean;
          features[i][stdKey] = Math.sqrt(variance);
        }
      });
    });

    return features;
  }

  addRateOfChange(series, metricKeys = []) {
    const sorted = this.validateSeries(series, metricKeys);
    const features = sorted.map(entry => ({ ...entry }));
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      const deltaTime = (current.timestamp - previous.timestamp) / dayMs;
      metricKeys.forEach(key => {
        const deltaValue = current[key] - previous[key];
        const rateKey = `${key}_roc`;
        const accelKey = `${key}_accel`;
        const previousRate = features[i - 1][rateKey] ?? 0;

        features[i][rateKey] = deltaTime > 0 ? deltaValue / deltaTime : 0;
        features[i][accelKey] =
          deltaTime > 0 ? (features[i][rateKey] - previousRate) / deltaTime : 0;
      });
    }

    return features;
  }

  addSeasonalDecomposition(series, metricKey) {
    const sorted = this.validateSeries(series, [metricKey]);
    const weekly = {};
    const monthly = {};

    sorted.forEach(entry => {
      const date = new Date(entry.timestamp);
      const weekKey = `${date.getUTCFullYear()}-W${this.#weekNumber(date)}`;
      const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
      weekly[weekKey] = weekly[weekKey] || [];
      monthly[monthKey] = monthly[monthKey] || [];
      weekly[weekKey].push(entry[metricKey]);
      monthly[monthKey].push(entry[metricKey]);
    });

    const weeklyMean = this.#groupMean(weekly);
    const monthlyMean = this.#groupMean(monthly);

    return sorted.map(entry => {
      const date = new Date(entry.timestamp);
      const weekKey = `${date.getUTCFullYear()}-W${this.#weekNumber(date)}`;
      const monthKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
      return {
        ...entry,
        [`${metricKey}_weekly`]: weeklyMean[weekKey] ?? entry[metricKey],
        [`${metricKey}_monthly`]: monthlyMean[monthKey] ?? entry[metricKey],
        [`${metricKey}_seasonal_residual`]:
          entry[metricKey] - ((weeklyMean[weekKey] ?? 0) + (monthlyMean[monthKey] ?? 0)) / 2,
      };
    });
  }

  correlationAnalysis(series, xKey, yKey) {
    const sorted = this.validateSeries(series, [xKey, yKey]);
    const values = sorted.map(entry => ({ x: entry[xKey], y: entry[yKey] }));
    const regression = this.trendAnalyzer.linearRegression(
      values.map((point, index) => ({ x: index, y: point.y }))
    );
    const { slope, r2 } = regression;

    const meanX = values.reduce((sum, v) => sum + v.x, 0) / values.length;
    const meanY = values.reduce((sum, v) => sum + v.y, 0) / values.length;
    const numerator = values.reduce((sum, v) => sum + (v.x - meanX) * (v.y - meanY), 0);
    const denominatorX = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.x - meanX, 2), 0));
    const denominatorY = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.y - meanY, 2), 0));
    const correlation =
      denominatorX > 0 && denominatorY > 0 ? numerator / (denominatorX * denominatorY) : 0;

    const tStatistic =
      correlation * Math.sqrt((values.length - 2) / Math.max(1 - Math.pow(correlation, 2), 1e-6));
    const pValue = this.#twoTailedPValue(tStatistic, values.length - 2);

    return {
      slope,
      r2,
      correlation,
      pValue,
    };
  }

  #groupMean(groups) {
    const result = {};
    Object.entries(groups).forEach(([key, values]) => {
      result[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
    });
    return result;
  }

  #weekNumber(date) {
    const temp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = temp.getUTCDay() || 7;
    temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
    return Math.ceil(((temp - yearStart) / 86400000 + 1) / 7);
  }

  #twoTailedPValue(tStatistic, degreesOfFreedom) {
    const df = Math.max(1, degreesOfFreedom);
    const x = Math.abs(tStatistic);
    const cdf = this.#studentTCdf(x, df);
    return Math.max(0, Math.min(1, 2 * (1 - cdf)));
  }

  #studentTCdf(x, df) {
    if (x === 0) {
      return 0.5;
    }
    const density = t => {
      const numerator = this.#gamma((df + 1) / 2);
      const denominator = Math.sqrt(df * Math.PI) * this.#gamma(df / 2);
      return (numerator / denominator) * Math.pow(1 + (t * t) / df, -((df + 1) / 2));
    };
    const integrate = (a, b, n = 200) => {
      const h = (b - a) / n;
      let sum = density(a) + density(b);
      for (let i = 1; i < n; i++) {
        const tValue = a + i * h;
        sum += density(tValue) * (i % 2 === 0 ? 2 : 4);
      }
      return (h / 3) * sum;
    };
    const area = integrate(0, x);
    return 0.5 + area;
  }

  #gamma(z) {
    const coefficients = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * this.#gamma(1 - z));
    }
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < coefficients.length; i++) {
      x += coefficients[i] / (z + i + 1);
    }
    const t = z + coefficients.length - 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  #logGamma(z) {
    const coefficients = [
      // eslint-disable-next-line no-loss-of-precision
      76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
      // eslint-disable-next-line no-loss-of-precision
      0.1208650973866179e-2, -0.5395239384953e-5,
    ];
    const x = z;
    let y = z;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < coefficients.length; j++) {
      y += 1;
      ser += coefficients[j] / y;
    }
    // eslint-disable-next-line no-loss-of-precision
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }
}

if (typeof window !== 'undefined') {
  window.FeatureExtractor = FeatureExtractor;
}

export default FeatureExtractor;
