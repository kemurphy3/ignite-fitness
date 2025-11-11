/**
 * AI Context Database Utilities
 * Real Supabase queries for load metrics, activities, and data confidence
 */

const { createClient } = require('@supabase/supabase-js');

class AIContextDatabase {
  constructor() {
    this.supabase = null;
    this.initializeClient();
  }

  /**
   * Initialize Supabase client
   */
  initializeClient() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_KEY;

      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('AI Context Database initialized with Supabase');
      } else {
        console.warn('Supabase credentials not found, using fallback mode');
      }
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
    }
  }

  /**
   * Get load metrics from daily aggregates
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Load metrics (atl7, ctl28, monotony, strain)
   */
  async getLoadMetrics(userId) {
    if (!this.supabase) {
      return this.getFallbackLoadMetrics();
    }

    try {
      // Get last 28 days of daily aggregates
      const { data, error } = await this.supabase
        .from('daily_aggregates')
        .select('date, trimp, tss, zone_minutes')
        .eq('user_id', userId)
        .gte('date', this.getDateNDaysAgo(28))
        .order('date', { ascending: false })
        .limit(28);

      if (error) {
        console.error('Error fetching load metrics:', error);
        return this.getFallbackLoadMetrics();
      }

      if (!data || data.length === 0) {
        return this.getFallbackLoadMetrics();
      }

      // Calculate ATL (7-day) and CTL (28-day)
      const atl7 = this.calculateATL(data.slice(0, 7));
      const ctl28 = this.calculateCTL(data.slice(0, 28));

      // Calculate monotony and strain
      const monotony = this.calculateMonotony(data.slice(0, 7));
      const strain = this.calculateStrain(data.slice(0, 7));

      return {
        atl7,
        ctl28,
        monotony,
        strain,
        dataPoints: data.length,
        lastUpdated: data[0]?.date,
      };
    } catch (error) {
      console.error('Error calculating load metrics:', error);
      return this.getFallbackLoadMetrics();
    }
  }

  /**
   * Get yesterday's activity data
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Yesterday's activity summary
   */
  async getYesterdayActivity(userId) {
    if (!this.supabase) {
      return this.getFallbackYesterdayActivity();
    }

    try {
      const yesterday = this.getYesterdayDate();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get activities from yesterday
      const { data, error } = await this.supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .gte('start_ts', yesterday.toISOString())
        .lt('start_ts', today.toISOString())
        .eq('is_excluded', false);

      if (error) {
        console.error('Error fetching yesterday activities:', error);
        return this.getFallbackYesterdayActivity();
      }

      if (!data || data.length === 0) {
        return this.getFallbackYesterdayActivity();
      }

      return this.aggregateYesterdayActivity(data);
    } catch (error) {
      console.error('Error getting yesterday activity:', error);
      return this.getFallbackYesterdayActivity();
    }
  }

  /**
   * Calculate data confidence scores
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Confidence metrics
   */
  async calculateDataConfidence(userId) {
    if (!this.supabase) {
      return this.getFallbackDataConfidence();
    }

    try {
      const sevenDaysAgo = this.getDateNDaysAgo(7);

      // Get activities from last 7 days
      const { data, error } = await this.supabase
        .from('activities')
        .select('start_ts, has_hr, avg_hr, source_set, type')
        .eq('user_id', userId)
        .gte('start_ts', sevenDaysAgo.toISOString())
        .eq('is_excluded', false);

      if (error) {
        console.error('Error fetching confidence data:', error);
        return this.getFallbackDataConfidence();
      }

      if (!data || data.length === 0) {
        return this.getFallbackDataConfidence();
      }

      // Calculate confidence metrics
      const daysWithHR = new Set();
      let totalRichness = 0;
      let totalActivities = 0;

      for (const activity of data) {
        const date = new Date(activity.start_ts).toISOString().split('T')[0];

        if (activity.has_hr || activity.avg_hr) {
          daysWithHR.add(date);
        }

        // Calculate richness from source_set
        if (activity.source_set && Object.keys(activity.source_set).length > 0) {
          const sources = Object.values(activity.source_set);
          const avgRichness =
            sources.reduce((sum, s) => sum + (s.richness || 0), 0) / sources.length;
          totalRichness += avgRichness;
        }

        totalActivities++;
      }

      const recent7days = daysWithHR.size / 7;
      const sessionDetail = totalActivities > 0 ? totalRichness / totalActivities : 0;

      // Determine trend based on activity consistency
      const trend = this.calculateTrend(data);

      return {
        recent7days: Math.min(recent7days, 1),
        sessionDetail: Math.min(sessionDetail, 1),
        trend,
        dataPoints: totalActivities,
        daysWithData: daysWithHR.size,
      };
    } catch (error) {
      console.error('Error calculating data confidence:', error);
      return this.getFallbackDataConfidence();
    }
  }

  /**
   * Get recent activity summary for context
   * @param {number} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Activity summary
   */
  async getRecentActivitySummary(userId, days = 7) {
    if (!this.supabase) {
      return this.getFallbackActivitySummary();
    }

    try {
      const startDate = this.getDateNDaysAgo(days);

      const { data, error } = await this.supabase
        .from('activities')
        .select('type, duration_s, avg_hr, max_hr, start_ts')
        .eq('user_id', userId)
        .gte('start_ts', startDate.toISOString())
        .eq('is_excluded', false)
        .order('start_ts', { ascending: false });

      if (error) {
        console.error('Error fetching recent activity:', error);
        return this.getFallbackActivitySummary();
      }

      if (!data || data.length === 0) {
        return this.getFallbackActivitySummary();
      }

      return this.summarizeRecentActivity(data, days);
    } catch (error) {
      console.error('Error getting recent activity summary:', error);
      return this.getFallbackActivitySummary();
    }
  }

  // Helper methods

  /**
   * Calculate ATL (Acute Training Load) - 7-day weighted average
   */
  calculateATL(data) {
    if (!data || data.length === 0) {
      return 0;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < data.length; i++) {
      const weight = Math.exp(-i * 0.1); // Exponential decay
      const load = (data[i].trimp || 0) + (data[i].tss || 0);
      weightedSum += load * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate CTL (Chronic Training Load) - 28-day weighted average
   */
  calculateCTL(data) {
    if (!data || data.length === 0) {
      return 0;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (let i = 0; i < data.length; i++) {
      const weight = Math.exp(-i * 0.05); // Slower decay for CTL
      const load = (data[i].trimp || 0) + (data[i].tss || 0);
      weightedSum += load * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate monotony (variability of training load)
   */
  calculateMonotony(data) {
    if (!data || data.length < 2) {
      return 1.0;
    }

    const loads = data.map(d => (d.trimp || 0) + (d.tss || 0));
    const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
    const stdDev = Math.sqrt(variance);

    return stdDev > 0 ? mean / stdDev : 1.0;
  }

  /**
   * Calculate strain (load * monotony)
   */
  calculateStrain(data) {
    const monotony = this.calculateMonotony(data);
    const totalLoad = data.reduce((sum, d) => sum + (d.trimp || 0) + (d.tss || 0), 0);
    return totalLoad * monotony;
  }

  /**
   * Calculate trend from activity data
   */
  calculateTrend(data) {
    if (!data || data.length < 3) {
      return 'flat';
    }

    // Simple trend analysis based on activity frequency
    const recent = data.slice(0, 3).length;
    const older = data.slice(3, 6).length;

    if (recent > older * 1.2) {
      return 'increasing';
    }
    if (recent < older * 0.8) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Aggregate yesterday's activities
   */
  aggregateYesterdayActivity(activities) {
    const aggregated = {
      type: null,
      duration_s: 0,
      avg_hr: null,
      max_hr: null,
      z4_min: 0,
      z5_min: 0,
      activities: activities.length,
      totalLoad: 0,
    };

    let totalHR = 0;
    let hrCount = 0;
    let maxHR = 0;

    for (const activity of activities) {
      aggregated.duration_s += activity.duration_s || 0;

      if (activity.avg_hr) {
        totalHR += activity.avg_hr;
        hrCount++;
      }

      if (activity.max_hr && activity.max_hr > maxHR) {
        maxHR = activity.max_hr;
      }

      // Estimate zone minutes (simplified)
      if (activity.avg_hr && activity.max_hr) {
        const hrReserve = (activity.avg_hr - 60) / (activity.max_hr - 60);
        if (hrReserve > 0.8) {
          aggregated.z4_min += (activity.duration_s / 60) * 0.5;
          aggregated.z5_min += (activity.duration_s / 60) * 0.3;
        }
      }
    }

    if (hrCount > 0) {
      aggregated.avg_hr = totalHR / hrCount;
    }
    aggregated.max_hr = maxHR;

    // Determine primary activity type
    const typeCounts = {};
    for (const activity of activities) {
      typeCounts[activity.type] = (typeCounts[activity.type] || 0) + (activity.duration_s || 0);
    }

    const primaryType = Object.keys(typeCounts).reduce(
      (a, b) => (typeCounts[a] > typeCounts[b] ? a : b),
      null
    );
    aggregated.type = primaryType;

    return aggregated;
  }

  /**
   * Summarize recent activity
   */
  summarizeRecentActivity(data, days) {
    const summary = {
      totalActivities: data.length,
      totalDuration: 0,
      avgDuration: 0,
      activityTypes: {},
      avgHR: null,
      maxHR: 0,
      daysActive: new Set(),
    };

    let totalHR = 0;
    let hrCount = 0;

    for (const activity of data) {
      summary.totalDuration += activity.duration_s || 0;

      const type = activity.type || 'unknown';
      summary.activityTypes[type] = (summary.activityTypes[type] || 0) + 1;

      if (activity.avg_hr) {
        totalHR += activity.avg_hr;
        hrCount++;
      }

      if (activity.max_hr && activity.max_hr > summary.maxHR) {
        summary.maxHR = activity.max_hr;
      }

      const date = new Date(activity.start_ts).toISOString().split('T')[0];
      summary.daysActive.add(date);
    }

    summary.avgDuration =
      summary.totalActivities > 0 ? summary.totalDuration / summary.totalActivities : 0;
    summary.avgHR = hrCount > 0 ? totalHR / hrCount : null;
    summary.daysActiveCount = summary.daysActive.size;
    summary.activityFrequency = summary.daysActiveCount / days;

    return summary;
  }

  // Utility methods

  getDateNDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return yesterday;
  }

  // Fallback methods for when Supabase is not available

  getFallbackLoadMetrics() {
    return {
      atl7: 0,
      ctl28: 0,
      monotony: 1.0,
      strain: 0,
      dataPoints: 0,
      lastUpdated: null,
    };
  }

  getFallbackYesterdayActivity() {
    return {
      type: null,
      duration_s: 0,
      avg_hr: null,
      max_hr: null,
      z4_min: 0,
      z5_min: 0,
      activities: 0,
      totalLoad: 0,
    };
  }

  getFallbackDataConfidence() {
    return {
      recent7days: 0,
      sessionDetail: 0,
      trend: 'flat',
      dataPoints: 0,
      daysWithData: 0,
    };
  }

  getFallbackActivitySummary() {
    return {
      totalActivities: 0,
      totalDuration: 0,
      avgDuration: 0,
      activityTypes: {},
      avgHR: null,
      maxHR: 0,
      daysActiveCount: 0,
      activityFrequency: 0,
    };
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIContextDatabase;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.AIContextDatabase = AIContextDatabase;
}
