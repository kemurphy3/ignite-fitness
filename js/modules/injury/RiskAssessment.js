/**
 * RiskAssessment - Daily injury risk assessment system
 * Calculates injury risk based on multiple factors and provides recommendations
 */
class RiskAssessment {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.riskFactors = this.initializeRiskFactors();
    this.sportSpecificRisk = this.initializeSportSpecificRisk();
  }

  /**
   * Initialize risk factor definitions
   * @returns {Object} Risk factors
   */
  initializeRiskFactors() {
    return {
      sleep_quality: {
        weight: 0.2,
        inverse: false, // Higher sleep = lower risk
        thresholds: {
          low: 8,
          moderate: 6,
          high: 4,
        },
      },
      muscle_soreness: {
        weight: 0.15,
        inverse: true, // Higher soreness = higher risk
        thresholds: {
          low: 2,
          moderate: 4,
          high: 6,
        },
      },
      stress_level: {
        weight: 0.1,
        inverse: true, // Higher stress = higher risk
        thresholds: {
          low: 3,
          moderate: 5,
          high: 7,
        },
      },
      training_load: {
        weight: 0.25,
        inverse: false, // Higher load = higher risk (within limits)
        thresholds: {
          low: 50,
          moderate: 150,
          high: 300,
        },
      },
      movement_quality: {
        weight: 0.15,
        inverse: true, // Lower quality = higher risk
        thresholds: {
          low: 3,
          moderate: 2,
          high: 1,
        },
      },
      injury_history: {
        weight: 0.15,
        inverse: true, // More history = higher risk
        thresholds: {
          low: 0,
          moderate: 1,
          high: 2,
        },
      },
    };
  }

  /**
   * Initialize sport-specific risk factors
   * @returns {Object} Sport-specific risk
   */
  initializeSportSpecificRisk() {
    return {
      soccer: {
        commonInjuries: [
          'acl_tears',
          'ankle_sprains',
          'hamstring_strains',
          'groin_pulls',
          'concussions',
        ],
        riskFactors: {
          high_speed: 'High running speeds increase ACL risk',
          cutting: 'Direction changes increase ankle and knee injury risk',
          fatigue: 'Fatigue increases all injury risks',
          surface: 'Artificial surfaces increase ACL injury risk',
          previous_injury: 'Previous injury is strong predictor',
        },
      },
      basketball: {
        commonInjuries: ['ankle_sprains', 'knee_injuries', 'back_injuries'],
        riskFactors: {
          jumping: 'High jumping volume increases injury risk',
          landing: 'Poor landing mechanics increase injury risk',
          fatigue: 'Fatigue reduces landing quality',
        },
      },
      running: {
        commonInjuries: ['stress_fractures', 'itb_syndrome', 'plantar_fasciitis'],
        riskFactors: {
          training_load: 'Rapid load increase increases injury risk',
          surface: 'Hard surfaces increase impact stress',
          footwear: 'Improper footwear increases injury risk',
        },
      },
    };
  }

  /**
   * Calculate daily injury risk
   * @param {Object} userData - User data
   * @returns {Object} Risk assessment
   */
  calculateDailyRisk(userData) {
    const sportId = userData.sport || 'soccer';
    const factors = this.calculateFactors(userData);
    const riskScore = this.calculateRiskScore(factors);
    const riskLevel = this.determineRiskLevel(riskScore);

    const assessment = {
      score: riskScore,
      level: riskLevel,
      factors,
      weightedScore: this.calculateWeightedScore(factors),
      sportSpecificRisk: this.assessSportSpecificRisk(sportId, userData),
      recommendations: this.generateRecommendations(riskLevel, userData, sportId),
      protocol: this.generateRiskProtocol(riskLevel, userData, sportId),
      actionItems: this.generateActionItems(riskLevel, userData),
    };

    this.logger.audit('RISK_ASSESSMENT_CALCULATED', {
      userId: userData.userId,
      riskLevel,
      score: riskScore,
    });

    return assessment;
  }

  /**
   * Calculate risk factors
   * @param {Object} userData - User data
   * @returns {Object} Factor values
   */
  calculateFactors(userData) {
    return {
      sleep_quality: userData.sleep || 8,
      muscle_soreness: userData.soreness || 3,
      stress_level: userData.stress || 4,
      training_load: userData.weeklyLoad || 150,
      movement_quality: userData.lastScreenScore || 2.5,
      injury_history: userData.injuryRisk || 0,
    };
  }

  /**
   * Calculate risk score
   * @param {Object} factors - Factor values
   * @returns {number} Risk score (0-10)
   */
  calculateRiskScore(factors) {
    let score = 0;

    Object.entries(this.riskFactors).forEach(([key, config]) => {
      const value = factors[key];
      let contribution;

      if (config.inverse) {
        // Higher value = higher risk
        contribution = (value / 10) * config.weight * 10;
      } else {
        // Lower value = higher risk
        contribution = ((10 - value) / 10) * config.weight * 10;
      }

      score += contribution;
    });

    return Math.min(10, Math.max(0, score));
  }

  /**
   * Calculate weighted score
   * @param {Object} factors - Factor values
   * @returns {Object} Weighted score breakdown
   */
  calculateWeightedScore(factors) {
    const breakdown = {};

    Object.entries(this.riskFactors).forEach(([key, config]) => {
      const value = factors[key];
      let contribution;

      if (config.inverse) {
        contribution = (value / 10) * config.weight * 10;
      } else {
        contribution = ((10 - value) / 10) * config.weight * 10;
      }

      breakdown[key] = {
        value,
        contribution,
        weight: config.weight,
        threshold: this.checkThreshold(value, config.thresholds),
      };
    });

    return breakdown;
  }

  /**
   * Determine risk level
   * @param {number} riskScore - Risk score
   * @returns {string} Risk level
   */
  determineRiskLevel(riskScore) {
    if (riskScore >= 7) {
      return 'very_high';
    }
    if (riskScore >= 5) {
      return 'high';
    }
    if (riskScore >= 3) {
      return 'moderate';
    }
    if (riskScore >= 1) {
      return 'low_moderate';
    }
    return 'low';
  }

  /**
   * Check threshold level
   * @param {number} value - Value to check
   * @param {Object} thresholds - Threshold values
   * @returns {string} Threshold level
   */
  checkThreshold(value, thresholds) {
    if (value <= thresholds.low) {
      return 'low';
    }
    if (value <= thresholds.moderate) {
      return 'moderate';
    }
    return 'high';
  }

  /**
   * Assess sport-specific risk
   * @param {string} sportId - Sport ID
   * @param {Object} userData - User data
   * @returns {Object} Sport-specific risk
   */
  assessSportSpecificRisk(sportId, userData) {
    const sportRisk = this.sportSpecificRisk[sportId] || this.sportSpecificRisk.soccer;

    const riskFactors = [];

    if (userData.weeklyLoad > 250) {
      riskFactors.push('high_training_load');
    }

    if (userData.soreness >= 6) {
      riskFactors.push('high_muscle_soreness');
    }

    if (userData.lastScreenScore <= 1) {
      riskFactors.push('poor_movement_quality');
    }

    if (userData.injuryRisk >= 2) {
      riskFactors.push('previous_injury_history');
    }

    return {
      sport: sportId,
      commonInjuries: sportRisk.commonInjuries,
      activeRiskFactors: riskFactors,
      preventionPriorities: this.getPreventionPriorities(sportId, riskFactors),
    };
  }

  /**
   * Get prevention priorities for sport
   * @param {string} sportId - Sport ID
   * @param {Array} riskFactors - Active risk factors
   * @returns {Array} Prevention priorities
   */
  getPreventionPriorities(sportId, riskFactors) {
    const priorities = [];

    if (riskFactors.includes('high_training_load')) {
      priorities.push({
        type: 'training',
        message: 'Reduce training load to allow recovery',
        priority: 'high',
      });
    }

    if (riskFactors.includes('poor_movement_quality')) {
      priorities.push({
        type: 'movement',
        message: 'Address movement dysfunction before increasing load',
        priority: 'critical',
      });
    }

    // Sport-specific priorities
    const sportRisk = this.sportSpecificRisk[sportId] || this.sportSpecificRisk.soccer;
    sportRisk.commonInjuries.forEach(injury => {
      priorities.push({
        type: 'injury_prevention',
        injury,
        message: `Implement ${injury} prevention strategies`,
        priority: 'medium',
      });
    });

    return priorities;
  }

  /**
   * Generate recommendations based on risk level
   * @param {string} riskLevel - Risk level
   * @param {Object} userData - User data
   * @param {string} sportId - Sport ID
   * @returns {Array} Recommendations
   */
  generateRecommendations(riskLevel, userData, sportId) {
    const recommendations = [];

    if (riskLevel === 'very_high' || riskLevel === 'high') {
      recommendations.push({
        type: 'immediate',
        message: 'Injury risk is significantly elevated. Immediate action required.',
        priority: 'critical',
        actions: [
          'Reduce training load by 50-70%',
          'Focus on active recovery only',
          'Address movement quality issues',
          'Consider rest day',
          'Consult healthcare professional if pain present',
        ],
      });
    } else if (riskLevel === 'moderate') {
      recommendations.push({
        type: 'caution',
        message: 'Elevated injury risk. Proceed with caution.',
        priority: 'high',
        actions: [
          'Reduce training intensity',
          'Increase recovery time',
          'Incorporate corrective exercises',
          'Monitor closely',
          'Adjust training if symptoms develop',
        ],
      });
    } else if (riskLevel === 'low_moderate') {
      recommendations.push({
        type: 'monitoring',
        message: 'Slightly elevated risk. Maintain current approach with monitoring.',
        priority: 'medium',
        actions: [
          'Continue training with attention to recovery',
          'Monitor for any changes',
          'Incorporate injury prevention work',
        ],
      });
    } else {
      recommendations.push({
        type: 'optimal',
        message: 'Low injury risk. Continue current training approach.',
        priority: 'low',
        actions: [
          'Maintain current training load',
          'Continue injury prevention strategies',
          'Monitor for any changes',
        ],
      });
    }

    // Add specific recommendations based on factors
    if (userData.sleep < 6) {
      recommendations.push({
        type: 'sleep',
        message: `Sleep quality is poor (${userData.sleep} hours). Aim for 7-9 hours.`,
        priority: 'high',
        actions: [
          'Improve sleep hygiene',
          'Create sleep schedule',
          'Reduce screen time before bed',
        ],
      });
    }

    if (userData.soreness >= 6) {
      recommendations.push({
        type: 'recovery',
        message: 'High muscle soreness indicates insufficient recovery.',
        priority: 'high',
        actions: ['Increase recovery time', 'Active recovery day', 'Hydration and nutrition'],
      });
    }

    if (userData.lastScreenScore <= 1) {
      recommendations.push({
        type: 'movement',
        message: 'Movement quality needs improvement before training intensification.',
        priority: 'critical',
        actions: ['Focus on corrective exercises', 'Reduce load until quality improves'],
      });
    }

    if (sportId === 'soccer' || sportId === 'football') {
      recommendations.push({
        type: 'sport_specific',
        message: 'Emphasize ankle stability and deceleration drills tailored to pitch demands.',
        priority: 'medium',
      });
    } else if (sportId === 'running') {
      recommendations.push({
        type: 'sport_specific',
        message: 'Introduce cadence work and low-impact cross-training to reduce repetitive stress.',
        priority: 'medium',
      });
    }

    return recommendations;
  }

  /**
   * Generate risk protocol
   * @param {string} riskLevel - Risk level
   * @param {Object} userData - User data
   * @param {string} sportId - Sport ID
   * @returns {Object} Risk protocol
   */
  generateRiskProtocol(riskLevel, userData, sportId) {
    const protocols = {
      very_high: {
        trainingLoad: 'light',
        intensity: 'very_low',
        duration: 'short',
        focus: 'active_recovery',
        activities: ['gentle_mobility', 'breathing_exercises', 'light_walking'],
      },
      high: {
        trainingLoad: 'light_moderate',
        intensity: 'low',
        duration: 'short',
        focus: 'recovery',
        activities: ['light_training', 'corrective_exercises', 'mobility_work'],
      },
      moderate: {
        trainingLoad: 'moderate',
        intensity: 'moderate',
        duration: 'standard',
        focus: 'maintenance',
        activities: ['normal_training', 'injury_prevention', 'corrective_exercises'],
      },
      low_moderate: {
        trainingLoad: 'normal',
        intensity: 'normal',
        duration: 'standard',
        focus: 'performance',
        activities: ['normal_training', 'injury_prevention'],
      },
      low: {
        trainingLoad: 'normal',
        intensity: 'normal',
        duration: 'standard',
        focus: 'performance',
        activities: ['normal_training', 'injury_prevention'],
      },
    };

    const protocol = { ...(protocols[riskLevel] || protocols.moderate) };

    if (sportId === 'soccer' || sportId === 'football') {
      protocol.activities = [...protocol.activities, 'low_intensity_ball_work'];
    } else if (sportId === 'running') {
      protocol.activities = [...protocol.activities, 'technique_drills'];
    }

    if (userData.sleep < 6) {
      protocol.recovery = [...(protocol.recovery || []), 'sleep_extension_protocol'];
    }
    if (userData.soreness >= 6) {
      protocol.recovery = [...(protocol.recovery || []), 'contrast_therapy'];
    }

    return protocol;
  }

  /**
   * Generate action items
   * @param {string} riskLevel - Risk level
   * @param {Object} userData - User data
   * @returns {Array} Action items
   */
  generateActionItems(riskLevel, userData) {
    const actionItems = [];

    actionItems.push({
      priority: 1,
      action: 'Complete daily readiness assessment',
      description: 'Continue monitoring readiness markers daily',
    });

    if (userData.lastScreenScore <= 2) {
      actionItems.push({
        priority: 2,
        action: 'Schedule movement screen',
        description: 'Assess movement quality this week',
      });
    }

    if (riskLevel === 'very_high' || riskLevel === 'high') {
      actionItems.push({
        priority: 1,
        action: 'Consult healthcare professional if symptoms present',
        description: 'Seek professional advice if experiencing pain',
      });
    }

    return actionItems;
  }

  /**
   * Get risk trend
   * @param {Array} recentAssessments - Recent risk assessments
   * @returns {Object} Trend analysis
   */
  getRiskTrend(recentAssessments) {
    if (recentAssessments.length < 2) {
      return { available: false, message: 'Insufficient data' };
    }

    const scores = recentAssessments.map(ass => ass.score);
    const trend = this.calculateTrend(scores);
    const latestScore = scores[scores.length - 1];

    return {
      available: true,
      trend,
      latestScore,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      recommendation: this.getTrendRecommendation(trend),
    };
  }

  /**
   * Calculate trend from scores
   * @param {Array} scores - Score history
   * @returns {string} Trend direction
   */
  calculateTrend(scores) {
    if (scores.length < 2) {
      return 'insufficient_data';
    }

    const recent = scores.slice(-3);
    const latest = recent[recent.length - 1];
    const previous = recent[0];

    if (latest > previous) {
      return 'increasing';
    }
    if (latest < previous) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Get recommendation based on trend
   * @param {string} trend - Trend direction
   * @returns {string} Recommendation
   */
  getTrendRecommendation(trend) {
    const recommendations = {
      increasing:
        'Injury risk is increasing. Consider reducing training load and increasing recovery.',
      decreasing: 'Injury risk is decreasing. Maintain current approach.',
      stable: 'Injury risk is stable. Continue monitoring.',
      insufficient_data: 'Continue monitoring to establish trend.',
    };

    return recommendations[trend] || recommendations.insufficient_data;
  }
}

// Create global instance
window.RiskAssessment = new RiskAssessment();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RiskAssessment;
}
