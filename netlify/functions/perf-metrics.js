/**
 * Performance Metrics Collection Endpoint
 * Collects and stores RUM data from clients
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body);
    const { metrics, timestamp, sessionId, userId } = payload;

    if (!metrics || !Array.isArray(metrics)) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid metrics data' }),
      };
    }

    console.log(`Received ${metrics.length} metrics from session ${sessionId}`);

    // Process and store metrics
    const processedMetrics = await processMetrics(metrics, sessionId, userId);

    // Store in database
    const { error } = await supabase.from('rum_metrics').insert(processedMetrics);

    if (error) {
      console.error('Database error:', error);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Failed to store metrics' }),
      };
    }

    // Check for performance regressions
    await checkPerformanceRegressions(processedMetrics);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        processed: processedMetrics.length,
      }),
    };
  } catch (error) {
    console.error('Error processing metrics:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

/**
 * Process raw metrics data
 * @param {Array} metrics - Raw metrics
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @returns {Array} Processed metrics
 */
async function processMetrics(metrics, sessionId, userId) {
  const processedMetrics = [];

  for (const metric of metrics) {
    try {
      const processedMetric = {
        session_id: sessionId,
        user_id: userId,
        metric_type: metric.type,
        metric_data: metric.data,
        timestamp: new Date(metric.timestamp).toISOString(),
        url: metric.url,
        user_agent: metric.userAgent,
        created_at: new Date().toISOString(),
      };

      // Add specific processing based on metric type
      switch (metric.type) {
        case 'lcp':
          processedMetric.lcp_value = metric.data.value;
          processedMetric.lcp_element = metric.data.element;
          break;

        case 'fid':
          processedMetric.fid_value = metric.data.value;
          processedMetric.fid_event_type = metric.data.eventType;
          break;

        case 'cls':
          processedMetric.cls_value = metric.data.value;
          processedMetric.cls_entries = metric.data.entries;
          break;

        case 'ttfb':
          processedMetric.ttfb_value = metric.data.value;
          processedMetric.ttfb_url = metric.data.url;
          break;

        case 'error':
          processedMetric.error_type = metric.data.type;
          processedMetric.error_message = metric.data.message;
          processedMetric.error_stack = metric.data.stack;
          break;

        case 'memory':
          processedMetric.memory_used = metric.data.usedJSHeapSize;
          processedMetric.memory_total = metric.data.totalJSHeapSize;
          processedMetric.memory_limit = metric.data.jsHeapSizeLimit;
          break;

        case 'device':
          processedMetric.device_info = metric.data;
          break;

        case 'network':
          processedMetric.network_type = metric.data.effectiveType;
          processedMetric.network_downlink = metric.data.downlink;
          processedMetric.network_rtt = metric.data.rtt;
          break;
      }

      processedMetrics.push(processedMetric);
    } catch (error) {
      console.error('Error processing metric:', error);
    }
  }

  return processedMetrics;
}

/**
 * Check for performance regressions
 * @param {Array} metrics - Processed metrics
 */
async function checkPerformanceRegressions(metrics) {
  try {
    // Get recent baseline metrics
    const { data: baseline, error } = await supabase
      .from('rum_metrics')
      .select('*')
      .in('metric_type', ['lcp', 'fid', 'cls', 'ttfb'])
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('Error fetching baseline metrics:', error);
      return;
    }

    // Calculate baseline averages
    const baselines = calculateBaselines(baseline);

    // Check current metrics against baselines
    for (const metric of metrics) {
      if (baselines[metric.metric_type]) {
        const regression = checkRegression(metric, baselines[metric.metric_type]);

        if (regression.isRegression) {
          await alertPerformanceRegression(metric, regression);
        }
      }
    }
  } catch (error) {
    console.error('Error checking performance regressions:', error);
  }
}

/**
 * Calculate baseline metrics
 * @param {Array} metrics - Historical metrics
 * @returns {Object} Baseline averages
 */
function calculateBaselines(metrics) {
  const baselines = {};

  // Group by metric type
  const grouped = metrics.reduce((acc, metric) => {
    if (!acc[metric.metric_type]) {
      acc[metric.metric_type] = [];
    }
    acc[metric.metric_type].push(metric);
    return acc;
  }, {});

  // Calculate averages
  Object.entries(grouped).forEach(([type, typeMetrics]) => {
    const values = typeMetrics
      .map(m => {
        switch (type) {
          case 'lcp':
            return m.lcp_value;
          case 'fid':
            return m.fid_value;
          case 'cls':
            return m.cls_value;
          case 'ttfb':
            return m.ttfb_value;
          default:
            return null;
        }
      })
      .filter(v => v !== null);

    if (values.length > 0) {
      baselines[type] = {
        average: values.reduce((a, b) => a + b, 0) / values.length,
        p95: values.sort((a, b) => a - b)[Math.floor(values.length * 0.95)],
        count: values.length,
      };
    }
  });

  return baselines;
}

/**
 * Check if metric indicates regression
 * @param {Object} metric - Current metric
 * @param {Object} baseline - Baseline data
 * @returns {Object} Regression analysis
 */
function checkRegression(metric, baseline) {
  const currentValue = getMetricValue(metric);
  const threshold = baseline.p95 * 1.2; // 20% above P95

  return {
    isRegression: currentValue > threshold,
    currentValue,
    baselineValue: baseline.average,
    threshold,
    deviation: ((currentValue - baseline.average) / baseline.average) * 100,
  };
}

/**
 * Get metric value based on type
 * @param {Object} metric - Metric object
 * @returns {number} Metric value
 */
function getMetricValue(metric) {
  switch (metric.metric_type) {
    case 'lcp':
      return metric.lcp_value;
    case 'fid':
      return metric.fid_value;
    case 'cls':
      return metric.cls_value;
    case 'ttfb':
      return metric.ttfb_value;
    default:
      return 0;
  }
}

/**
 * Alert on performance regression
 * @param {Object} metric - Regressed metric
 * @param {Object} regression - Regression data
 */
async function alertPerformanceRegression(metric, regression) {
  try {
    // Store regression alert
    const { error } = await supabase.from('performance_alerts').insert({
      metric_type: metric.metric_type,
      current_value: regression.currentValue,
      baseline_value: regression.baselineValue,
      deviation_percent: regression.deviation,
      session_id: metric.session_id,
      user_id: metric.user_id,
      url: metric.url,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error storing performance alert:', error);
    } else {
      console.warn(`Performance regression detected: ${metric.metric_type}`, regression);
    }
  } catch (error) {
    console.error('Error alerting performance regression:', error);
  }
}
