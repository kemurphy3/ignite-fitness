import TrendAnalyzer from './TrendAnalyzer.js';

/**
 * PredictionEngine - statistical forecasting for performance metrics.
 * Implements Holt-Winters triple exponential smoothing, residual variance,
 * directional-accuracy scoring, and normalization utilities.
 */
class PredictionEngine {
  constructor(options = {}) {
    this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
    this.alpha = this.#clamp(options.alpha ?? 0.3, 0.01, 0.99);
    this.beta = this.#clamp(options.beta ?? 0.1, 0.01, 0.99);
    this.gamma = this.#clamp(options.gamma ?? 0.05, 0.01, 0.99);
    this.seasonLength = Number.isFinite(options.seasonLength)
      ? Math.max(3, options.seasonLength)
      : 7;
    this.minDataPoints = Math.max(this.seasonLength * 2, options.minDataPoints || 12);
    this.trendAnalyzer = new TrendAnalyzer(this.logger);
    this.directionalEpsilon = options.directionalEpsilon ?? 0.5;
  }

  preprocessSeries(series = []) {
    if (!Array.isArray(series) || series.length === 0) {
      throw new Error('Performance history is required');
    }

    const cleaned = series
      .map(entry => {
        if (entry === null || entry === undefined) {
          return null;
        }
        if (typeof entry === 'number') {
          return { timestamp: null, value: entry };
        }
        const value = Number(entry.value ?? entry.metric ?? entry.performance);
        if (!Number.isFinite(value)) {
          return null;
        }
        const timestamp = entry.date ? new Date(entry.date).getTime() : null;
        return { timestamp, value };
      })
      .filter(Boolean);

    if (cleaned.length < this.minDataPoints) {
      throw new Error(`At least ${this.minDataPoints} data points are required for forecasting`);
    }

    const sorted = cleaned
      .map((entry, index) => ({ ...entry, index }))
      .sort((a, b) => {
        if (!Number.isFinite(a.timestamp) || !Number.isFinite(b.timestamp)) {
          return a.index - b.index;
        }
        return a.timestamp - b.timestamp;
      });

    return sorted.map(entry => entry.value);
  }

  predictPerformance(historicalData, horizon = 30) {
    const values = this.preprocessSeries(historicalData);
    if (!Number.isFinite(horizon) || horizon <= 0) {
      throw new Error('Forecast horizon must be positive');
    }

    const { alpha, beta, gamma, seasonLength } = this;
    const { initialLevel, initialTrend, seasonalFactors } = this.#initializeComponents(values);
    let level = initialLevel;
    let trend = initialTrend;
    const seasonal = [...seasonalFactors];
    const fitted = [];

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const seasonIndex = i % seasonLength;
      const seasonalFactor = seasonal[seasonIndex];

      const newLevel = alpha * (value - seasonalFactor) + (1 - alpha) * (level + trend);
      const newTrend = beta * (newLevel - level) + (1 - beta) * trend;
      const newSeasonal = gamma * (value - newLevel) + (1 - gamma) * seasonalFactor;

      level = newLevel;
      trend = newTrend;
      seasonal[seasonIndex] = newSeasonal;

      fitted.push(level + trend + seasonalFactor);
    }

    const residuals = values.map((value, index) => value - fitted[index]);
    const varianceBase = this.#residualVariance(residuals);
    const forecasts = [];

    for (let h = 1; h <= horizon; h++) {
      const seasonIndex = (values.length + h - 1) % seasonLength;
      const forecast = level + h * trend + seasonal[seasonIndex];
      const variance = this.calculateForecastVariance(residuals, h, varianceBase);
      const margin = 1.96 * Math.sqrt(variance);
      forecasts.push({
        value: forecast,
        lower_ci: forecast - margin,
        upper_ci: forecast + margin,
        variance,
        horizon: h,
      });
    }

    return forecasts;
  }

  calculateForecastVariance(residuals, horizon, baselineVariance = null) {
    if (!Array.isArray(residuals) || residuals.length === 0) {
      return 0;
    }
    const baseVariance = baselineVariance ?? this.#residualVariance(residuals);
    const h = Math.max(1, horizon);
    return baseVariance * h;
  }

  computeDirectionalAccuracy(actualSeries, forecastSeries) {
    const actual = this.preprocessSeries(actualSeries);
    if (!Array.isArray(forecastSeries) || forecastSeries.length === 0) {
      return 0;
    }
    const comparisons = Math.min(actual.length - 1, forecastSeries.length);
    if (comparisons <= 0) {
      return 0;
    }
    const epsilon = this.directionalEpsilon;
    let correct = 0;
    let considered = 0;
    for (let i = 1; i <= comparisons; i++) {
      const actualDelta = actual[i] - actual[i - 1];
      const predictedDelta = forecastSeries[i - 1].value - actual[i - 1];
      const actualSign = Math.abs(actualDelta) <= epsilon ? 0 : Math.sign(actualDelta);
      const predictedSign = Math.abs(predictedDelta) <= epsilon ? 0 : Math.sign(predictedDelta);
      if (actualSign === 0 && predictedSign === 0) {
        correct += 1;
        considered += 1;
        continue;
      }
      if (actualSign === predictedSign) {
        correct += 1;
      }
      considered += 1;
    }
    return considered > 0 ? correct / considered : 0;
  }

  backtestPerformance(series, horizon = 7) {
    const values = this.preprocessSeries(series);
    const windowSize = this.minDataPoints;
    const accuracyScores = [];
    const history = [];

    for (let start = 0; start + windowSize + horizon <= values.length; start++) {
      const trainWindow = values.slice(start, start + windowSize);
      const actual = values.slice(start + windowSize, start + windowSize + horizon);
      const forecasts = this.predictPerformance(trainWindow, horizon);
      const accuracy = this.computeDirectionalAccuracy([...trainWindow, ...actual], forecasts);
      accuracyScores.push(accuracy);
      history.push({
        startIndex: start,
        training: trainWindow,
        actual,
        forecasts,
        accuracy,
      });
    }

    const meanAccuracy =
      accuracyScores.reduce((sum, score) => sum + score, 0) / (accuracyScores.length || 1);

    return {
      accuracy: meanAccuracy,
      history,
    };
  }

  calculateMAPE(actualSeries, forecastSeries) {
    const actual = this.preprocessSeries(actualSeries);
    if (!Array.isArray(forecastSeries) || forecastSeries.length === 0) {
      return Infinity;
    }
    const comparisons = Math.min(actual.length, forecastSeries.length);
    let total = 0;
    let count = 0;
    for (let i = 0; i < comparisons; i++) {
      const actualValue = actual[i];
      if (actualValue === 0) {
        continue;
      }
      const error = Math.abs((actualValue - forecastSeries[i].value) / actualValue);
      total += error;
      count += 1;
    }
    return count > 0 ? (total / count) * 100 : Infinity;
  }

  normalizeSeries(series) {
    const values = this.preprocessSeries(series);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
      Math.max(values.length - 1, 1);
    const stdDev = Math.sqrt(variance);
    return values.map(value => (stdDev === 0 ? 0 : (value - mean) / stdDev));
  }

  #initializeComponents(values) {
    const { seasonLength } = this;
    const seasonCount = Math.floor(values.length / seasonLength);
    if (seasonCount < 2) {
      return {
        initialLevel: values[0],
        initialTrend: values[1] - values[0],
        seasonalFactors: new Array(seasonLength).fill(0),
      };
    }

    const seasonAverages = [];
    for (let s = 0; s < seasonCount; s++) {
      const start = s * seasonLength;
      const seasonValues = values.slice(start, start + seasonLength);
      const average = seasonValues.reduce((sum, value) => sum + value, 0) / seasonLength;
      seasonAverages.push({ average, seasonValues });
    }

    const initialLevel = seasonAverages[0].average;
    const secondLevel = seasonAverages[1].average;
    const initialTrend = (secondLevel - initialLevel) / seasonLength;

    const seasonalFactors = new Array(seasonLength).fill(0);
    for (let i = 0; i < seasonLength; i++) {
      let sum = 0;
      for (const season of seasonAverages) {
        sum += season.seasonValues[i] - season.average;
      }
      seasonalFactors[i] = sum / seasonCount;
    }

    return { initialLevel, initialTrend, seasonalFactors };
  }

  #residualVariance(residuals) {
    const meanResidual = residuals.reduce((sum, r) => sum + r, 0) / residuals.length;
    return (
      residuals.reduce((sum, r) => sum + Math.pow(r - meanResidual, 2), 0) /
      Math.max(residuals.length - 1, 1)
    );
  }

  #clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}

if (typeof window !== 'undefined') {
  window.PredictionEngine = PredictionEngine;
}

export default PredictionEngine;
