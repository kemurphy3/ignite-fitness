/**
 * Recompute Aggregates Job
 * Recalculates daily aggregates and rolling metrics for affected dates
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Recompute daily aggregates for specified dates
 * @param {number} userId - User ID
 * @param {Array<string>} dates - Array of dates in YYYY-MM-DD format
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} Recompute results
 */
async function recomputeAggregates(userId, dates, supabase) {
  try {
    console.log(`Recomputing aggregates for user ${userId} on dates:`, dates);

    const results = {
      userId,
      dates,
      processed: [],
      errors: [],
    };

    for (const date of dates) {
      try {
        const aggregates = await computeDailyAggregates(userId, date, supabase);
        results.processed.push({ date, aggregates, success: true });
        console.log(`Successfully recomputed aggregates for ${date}`);
      } catch (error) {
        console.error(`Error recomputing aggregates for ${date}:`, error);
        results.errors.push({ date, error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Error in recomputeAggregates:', error);
    throw error;
  }
}

/**
 * Compute daily aggregates for a specific date
 * @param {number} userId - User ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} Daily aggregates
 */
async function computeDailyAggregates(userId, date, supabase) {
  try {
    // Query activities for this date
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(`${date}T23:59:59Z`);

    const { data: activities, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .eq('is_excluded', false)
      .gte('start_ts', startOfDay.toISOString())
      .lte('start_ts', endOfDay.toISOString());

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    // Calculate aggregates
    const aggregates = {
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

    // Aggregate activities
    for (const activity of activities || []) {
      aggregates.durationS += activity.duration_s || 0;
      aggregates.distanceM += activity.distance_m || 0;

      // Count by type
      switch (activity.type) {
        case 'Run':
          aggregates.runCount++;
          break;
        case 'Ride':
          aggregates.rideCount++;
          break;
        case 'Strength':
          aggregates.strengthCount++;
          break;
      }

      // Aggregate HR zones (would need streams table in real implementation)
      // For now, estimate from avg_hr if available
      if (activity.avg_hr) {
        // Simple zone estimation
        const zoneMinutes = estimateZoneMinutes(activity);
        aggregates.z1Min += zoneMinutes.z1;
        aggregates.z2Min += zoneMinutes.z2;
        aggregates.z3Min += zoneMinutes.z3;
        aggregates.z4Min += zoneMinutes.z4;
        aggregates.z5Min += zoneMinutes.z5;
      }
    }

    // Calculate TRIMP and TSS (simplified)
    aggregates.trimp = calculateTRIMP(aggregates);
    aggregates.tss = calculateTSS(aggregates);
    aggregates.loadScore = aggregates.trimp; // Simplified

    // Upsert into daily_aggregates table
    const { data: upserted, error: upsertError } = await supabase
      .from('daily_aggregates')
      .upsert(
        {
          user_id: userId,
          date,
          trimp: aggregates.trimp,
          tss: aggregates.tss,
          load_score: aggregates.loadScore,
          z1_min: aggregates.z1Min,
          z2_min: aggregates.z2Min,
          z3_min: aggregates.z3Min,
          z4_min: aggregates.z4Min,
          z5_min: aggregates.z5Min,
          distance_m: aggregates.distanceM,
          duration_s: aggregates.durationS,
          run_count: aggregates.runCount,
          ride_count: aggregates.rideCount,
          strength_count: aggregates.strengthCount,
          last_recalc_ts: aggregates.lastRecalcTs,
        },
        {
          onConflict: 'user_id,date',
        }
      )
      .select()
      .single();

    if (upsertError) {
      throw new Error(`Failed to upsert aggregates: ${upsertError.message}`);
    }

    // Recompute rolling metrics
    const rollingMetrics = await computeRollingMetrics(userId, date, supabase);

    return {
      ...aggregates,
      rollingMetrics,
    };
  } catch (error) {
    console.error('Error computing daily aggregates:', error);
    throw error;
  }
}

/**
 * Estimate zone minutes from activity
 * @param {Object} activity - Activity data
 * @returns {Object} Zone minutes
 */
function estimateZoneMinutes(activity) {
  // Simplified zone estimation - would use actual HR streams in production
  const durationMinutes = (activity.duration_s || 0) / 60;

  // Assume 30% in Z2, 40% in Z3, 20% in Z4, 10% in Z5
  return {
    z1: durationMinutes * 0,
    z2: durationMinutes * 0.3,
    z3: durationMinutes * 0.4,
    z4: durationMinutes * 0.2,
    z5: durationMinutes * 0.1,
  };
}

/**
 * Calculate TRIMP for aggregates
 * @param {Object} aggregates - Daily aggregates
 * @returns {number} TRIMP score
 */
function calculateTRIMP(aggregates) {
  // Simplified TRIMP calculation
  return (aggregates.z4Min + aggregates.z5Min) * 2 + aggregates.z3Min;
}

/**
 * Calculate TSS for aggregates
 * @param {Object} aggregates - Daily aggregates
 * @returns {number} TSS score
 */
function calculateTSS(aggregates) {
  // Simplified TSS calculation
  return aggregates.z4Min * 5 + aggregates.z5Min * 8;
}

/**
 * Compute rolling metrics (ATL, CTL, monotony, strain)
 * @param {number} userId - User ID
 * @param {string} date - Current date
 * @param {Object} supabase - Supabase client
 * @returns {Promise<Object>} Rolling metrics
 */
async function computeRollingMetrics(userId, date, supabase) {
  try {
    // Get last 35 days of aggregates
    const currentDate = new Date(date);
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - 35);

    const { data: aggregates, error } = await supabase
      .from('daily_aggregates')
      .select('date, trimp, tss')
      .eq('user_id', userId)
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', date)
      .order('date', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch aggregates: ${error.message}`);
    }

    // Calculate rolling metrics
    const dailyLoads = (aggregates || []).map(a => a.trimp || 0);

    const atl7 = calculateATL(dailyLoads.slice(-7)); // Last 7 days
    const ctl28 = calculateCTL(dailyLoads.slice(-28)); // Last 28 days
    const monotony = calculateMonotony(dailyLoads.slice(-7));
    const strain = calculateStrain(monotony, dailyLoads.slice(-7));

    // Update last day's aggregates with rolling metrics
    if (aggregates && aggregates.length > 0) {
      const lastAggregate = aggregates[aggregates.length - 1];

      await supabase
        .from('daily_aggregates')
        .update({
          atl7,
          ctl28,
          monotony,
          strain,
        })
        .eq('user_id', userId)
        .eq('date', lastAggregate.date);
    }

    return { atl7, ctl28, monotony, strain };
  } catch (error) {
    console.error('Error computing rolling metrics:', error);
    throw error;
  }
}

/**
 * Calculate Acute Training Load (ATL)
 * @param {Array<number>} dailyLoads - Last 7 days of loads
 * @returns {number} ATL score
 */
function calculateATL(dailyLoads) {
  if (dailyLoads.length === 0) {
    return 0;
  }

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
 * @param {Array<number>} dailyLoads - Last 28 days of loads
 * @returns {number} CTL score
 */
function calculateCTL(dailyLoads) {
  if (dailyLoads.length === 0) {
    return 0;
  }

  const timeConstant = 28;
  let ctl = 0;

  for (let i = 0; i < dailyLoads.length; i++) {
    const alpha = 1 - Math.exp(-1 / timeConstant);
    ctl = alpha * dailyLoads[i] + (1 - alpha) * ctl;
  }

  return ctl;
}

/**
 * Calculate training monotony
 * @param {Array<number>} dailyLoads - Daily load values
 * @returns {number} Monotony score
 */
function calculateMonotony(dailyLoads) {
  if (dailyLoads.length === 0) {
    return 1.0;
  }

  const mean = dailyLoads.reduce((sum, load) => sum + load, 0) / dailyLoads.length;
  const variance =
    dailyLoads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / dailyLoads.length;
  const stdDev = Math.sqrt(variance);

  return mean / (stdDev + 1);
}

/**
 * Calculate training strain
 * @param {number} monotony - Monotony score
 * @param {Array<number>} dailyLoads - Daily load values
 * @returns {number} Strain score
 */
function calculateStrain(monotony, dailyLoads) {
  if (dailyLoads.length === 0) {
    return 0;
  }

  const weeklyLoad = dailyLoads.reduce((sum, load) => sum + load, 0);
  return weeklyLoad * monotony;
}

/**
 * Netlify Function Handler
 */
exports.handler = async function (event, context) {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { userId, dates } = JSON.parse(event.body || '{}');

    if (!userId || !dates || !Array.isArray(dates)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing userId or dates array' }),
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Database configuration missing' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Recompute aggregates
    const results = await recomputeAggregates(userId, dates, supabase);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(results),
    };
  } catch (error) {
    console.error('Error in recompute-aggregates handler:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Export for direct calls (e.g., from ingest handler)
exports.recomputeAggregates = recomputeAggregates;
exports.computeDailyAggregates = computeDailyAggregates;
exports.computeRollingMetrics = computeRollingMetrics;
