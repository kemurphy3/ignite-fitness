/**
 * Substitution Engine v1
 * Suggests workout substitutions across modalities with load equivalence
 */

import LoadCalculationEngine from '../load/LoadCalculationEngine.js';
import EquivalenceRules from './EquivalenceRules.js';

class SubstitutionEngine {
  constructor(workoutCatalog, guardrailManager) {
    this.workoutCatalog = workoutCatalog;
    this.guardrailManager = guardrailManager;
    this.logger = window.SafeLogger || console;
  }

  /**
   * Suggest workout substitutions for planned session
   * @param {Object} planned_session - Original planned session
   * @param {string} target_modality - Desired substitution modality
   * @param {Object} user_context - User preferences and constraints
   * @returns {Promise<Array>} Top 3 substitution options with reasoning
   */
  async suggest_substitutions(planned_session, target_modality, user_context) {
    try {
      // Step 1: Parse planned session and compute target load
      const sessionAnalysis = this.parsePlannedSession(planned_session);
      const targetLoad = LoadCalculationEngine.compute_load(sessionAnalysis);

      this.logger.info('Substitution request:', {
        source: `${planned_session.modality} ${sessionAnalysis.primary_zone}`,
        target: target_modality,
        target_load: targetLoad.total_load,
        method: targetLoad.method_used,
      });

      // Step 2: Find candidate templates in target modality
      const candidates = await this.findCandidateTemplates(
        target_modality,
        sessionAnalysis.adaptation,
        user_context
      );

      if (candidates.length === 0) {
        throw new Error(
          `No suitable ${target_modality} workouts found for ${sessionAnalysis.adaptation}`
        );
      }

      // Step 3: Scale candidates to match target load
      const scaledCandidates = candidates.map(candidate =>
        this.scaleWorkoutForEquivalence(
          candidate,
          sessionAnalysis,
          targetLoad.total_load,
          planned_session.modality,
          target_modality,
          user_context
        )
      );

      // Step 4: Apply guardrails and filter valid options
      const validCandidates = [];
      for (const candidate of scaledCandidates) {
        const guardrailCheck = await this.applyGuardrails(candidate, user_context);
        if (guardrailCheck.valid) {
          candidate.guardrail_status = 'passed';
          candidate.warnings = guardrailCheck.warnings;
          validCandidates.push(candidate);
        } else {
          this.logger.debug('Candidate filtered by guardrails:', {
            workout: candidate.name,
            reason: guardrailCheck.reason,
          });
        }
      }

      if (validCandidates.length === 0) {
        throw new Error('No substitutions pass safety guardrails');
      }

      // Step 5: Rank and return top 3 options
      const rankedOptions = this.rankSubstitutionOptions(validCandidates, targetLoad.total_load);
      const top3Options = rankedOptions.slice(0, 3).map(option => ({
        ...option,
        reasoning: this.generateReasoning(planned_session, option, targetLoad.total_load),
      }));

      return top3Options;
    } catch (error) {
      this.logger.error('Substitution generation failed:', error);
      throw error;
    }
  }

  /**
   * Parse planned session to extract zones, duration, and adaptation
   * @param {Object} planned_session - Planned session object
   * @returns {Object} Parsed session analysis
   */
  parsePlannedSession(planned_session) {
    const analysis = {
      modality: planned_session.modality,
      duration_minutes: planned_session.duration_minutes || 0,
      adaptation: planned_session.adaptation || 'general',
      zone_distribution: {},
      primary_zone: 'Z2',
      intensity_profile: 'moderate',
    };

    // Parse zone information from structure or explicit zones
    if (planned_session.structure) {
      let totalWorkMinutes = 0;
      const zoneMinutes = {};

      planned_session.structure.forEach(block => {
        if (block.block_type === 'main' && block.intensity) {
          const blockMinutes = block.sets
            ? (block.work_duration * block.sets) / 60
            : block.duration || 0;

          zoneMinutes[block.intensity] = (zoneMinutes[block.intensity] || 0) + blockMinutes;
          totalWorkMinutes += blockMinutes;
        }
      });

      analysis.zone_distribution = zoneMinutes;

      // Determine primary zone (zone with most minutes)
      if (totalWorkMinutes > 0) {
        analysis.primary_zone = Object.entries(zoneMinutes).reduce((a, b) =>
          zoneMinutes[a[0]] > zoneMinutes[b[0]] ? a : b
        )[0];
      }
    } else if (planned_session.intensity) {
      // Simple intensity-based parsing
      analysis.primary_zone = planned_session.intensity;
      analysis.zone_distribution[planned_session.intensity] = analysis.duration_minutes;
    } else {
      const fallbackZone = planned_session.primary_zone || 'Z2';
      analysis.primary_zone = fallbackZone;
      if (analysis.duration_minutes > 0) {
        analysis.zone_distribution[fallbackZone] = analysis.duration_minutes;
      }
    }

    // Determine intensity profile
    if (['Z4', 'Z5'].includes(analysis.primary_zone)) {
      analysis.intensity_profile = 'high';
    } else if (analysis.primary_zone === 'Z3') {
      analysis.intensity_profile = 'moderate_high';
    } else {
      analysis.intensity_profile = 'moderate';
    }

    return analysis;
  }

  /**
   * Find candidate workout templates in target modality
   * @param {string} target_modality - Target modality
   * @param {string} adaptation - Training adaptation
   * @param {Object} user_context - User context and constraints
   * @returns {Promise<Array>} Candidate workout templates
   */
  async findCandidateTemplates(target_modality, adaptation, user_context) {
    // Get all workouts for target modality
    const modalityWorkouts = await this.workoutCatalog.getWorkoutsByModality(target_modality);

    if (!modalityWorkouts || modalityWorkouts.length === 0) {
      return [];
    }

    const candidates = [];

    // Filter by adaptation compatibility
    for (const workout of modalityWorkouts) {
      const adaptationCheck = EquivalenceRules.checkAdaptationCompatibility(
        adaptation,
        workout.adaptation
      );

      if (adaptationCheck.compatible) {
        candidates.push({
          ...workout,
          adaptation_match: adaptationCheck.match,
          adaptation_confidence: adaptationCheck.confidence_bonus,
        });
      }
    }

    // Filter by equipment availability
    const availableWorkouts = candidates.filter(workout => {
      if (!workout.equipment_required || workout.equipment_required.length === 0) {
        return true;
      }

      const userEquipment = user_context.equipment || [];
      return workout.equipment_required.every(equipment => userEquipment.includes(equipment));
    });

    // Filter by time constraints
    const timeConstrainedWorkouts = availableWorkouts.filter(workout => {
      const maxTime = user_context.available_time || 180; // Default 3 hours
      return workout.time_required <= maxTime;
    });

    return timeConstrainedWorkouts;
  }

  /**
   * Scale workout duration and intensity to match target load
   * @param {Object} candidate - Candidate workout template
   * @param {Object} sessionAnalysis - Parsed session analysis
   * @param {number} targetLoad - Target load to match
   * @param {string} sourceModality - Source modality
   * @param {string} targetModality - Target modality
   * @returns {Object} Scaled workout with load calculations
   */
  scaleWorkoutForEquivalence(
    candidate,
    sessionAnalysis,
    targetLoad,
    sourceModality,
    targetModality,
    userContext = {}
  ) {
    const primaryZone = sessionAnalysis.primary_zone;

    // Get time conversion factor
    const timeFactor = EquivalenceRules.getTimeFactor(sourceModality, targetModality, primaryZone);
    if (!Number.isFinite(timeFactor) || timeFactor <= 0) {
      throw new Error(
        `Invalid time conversion factor for ${sourceModality} -> ${targetModality} in ${primaryZone}`
      );
    }

    // Calculate scaled duration
    const scaledStructure = this.scaleStructure(candidate.structure, timeFactor);
    let metrics = this.calculateStructureMetrics(scaledStructure, primaryZone);

    // Calculate load for scaled workout
    let scaledSession = {
      modality: targetModality,
      duration_minutes: metrics.totalMinutes,
      structure: scaledStructure,
      adaptation: candidate.adaptation,
      zone_distribution: metrics.zoneDistribution,
    };

    let scaledLoad = LoadCalculationEngine.compute_load(scaledSession);
    let loadVariance = Math.abs(scaledLoad.total_load - targetLoad) / Math.max(targetLoad, 1);

    // If outside acceptable variance, apply corrective scaling once
    if (scaledLoad.total_load > 0) {
      const correctionFactor = targetLoad / scaledLoad.total_load;
      if (Math.abs(1 - correctionFactor) > 0.05) {
        const boundedCorrection = Math.max(0.8, Math.min(1.2, correctionFactor));
        const correctedStructure = this.scaleStructure(scaledStructure, boundedCorrection);
        const correctedMetrics = this.calculateStructureMetrics(correctedStructure, primaryZone);
        const correctedSession = {
          modality: targetModality,
          duration_minutes: correctedMetrics.totalMinutes,
          structure: correctedStructure,
          adaptation: candidate.adaptation,
          zone_distribution: correctedMetrics.zoneDistribution,
        };
        const correctedLoad = LoadCalculationEngine.compute_load(correctedSession);
        const correctedVariance =
          Math.abs(correctedLoad.total_load - targetLoad) / Math.max(targetLoad, 1);
        if (correctedVariance < loadVariance) {
          scaledLoad = correctedLoad;
          loadVariance = correctedVariance;
          metrics = correctedMetrics;
          scaledSession = correctedSession;
        }
      }
    }

    // Calculate confidence score
    const confidence = EquivalenceRules.calculateConfidence({
      sourceAdaptation: sessionAnalysis.adaptation,
      targetAdaptation: candidate.adaptation,
      sourceModality,
      targetModality,
      zone: primaryZone,
      duration: metrics.totalMinutes,
      loadVariance,
      userProfile: userContext.user_profile || {},
    });

    return {
      ...candidate,
      scaled_duration: Math.round(metrics.totalMinutes),
      scaled_structure: scaledSession.structure,
      scaling_factor: timeFactor,
      calculated_load: scaledLoad.total_load,
      load_equivalence_target: targetLoad,
      load_variance: loadVariance,
      load_variance_percentage: Math.round(loadVariance * 1000) / 10, // One decimal place
      confidence_score: Math.round(confidence * 100) / 100,
      is_substitution: true,
      substitution_method: 'time_factor_scaling',
    };
  }

  /**
   * Scale workout structure by factor without mutating original
   * @param {Array} structure - Workout structure blocks
   * @param {number} factor - Scaling factor
   * @returns {Array} Scaled structure
   */
  scaleStructure(structure = [], factor = 1) {
    if (!Array.isArray(structure) || structure.length === 0) {
      return [];
    }

    return structure.map(block => {
      if (!block || block.block_type !== 'main') {
        return { ...block };
      }

      const scaledBlock = { ...block };

      if (block.sets && block.work_duration) {
        const scaledWork = Math.max(10, Math.round(Number(block.work_duration) * factor));
        scaledBlock.work_duration = scaledWork;
        if (block.rest_duration) {
          const scaledRest = Math.max(
            5,
            Math.round(Number(block.rest_duration) * Math.min(1.2, factor))
          );
          scaledBlock.rest_duration = scaledRest;
        }
      } else if (block.duration) {
        const scaledDuration = Math.max(1, Math.round(Number(block.duration) * factor));
        scaledBlock.duration = scaledDuration;
      }

      return scaledBlock;
    });
  }

  /**
   * Calculate total duration and zone distribution from structure
   * @param {Array} structure - Workout structure blocks
   * @returns {Object} Metrics { totalMinutes, zoneDistribution }
   */
  calculateStructureMetrics(structure = [], fallbackZone = null) {
    let totalMinutes = 0;
    const zoneDistribution = {};

    structure.forEach(block => {
      if (!block) {
        return;
      }

      let blockMinutes = 0;

      if (block.sets && block.work_duration) {
        const workSeconds = Number(block.work_duration);
        const restSeconds = Number(block.rest_duration || 0);
        const sets = Number(block.sets);
        if (Number.isFinite(workSeconds) && Number.isFinite(sets) && sets > 0) {
          blockMinutes += (workSeconds * sets) / 60;
          if (Number.isFinite(restSeconds) && restSeconds > 0) {
            blockMinutes += (restSeconds * sets) / 60;
          }
        }
      } else if (block.duration) {
        const durationMinutes = Number(block.duration);
        if (Number.isFinite(durationMinutes) && durationMinutes > 0) {
          blockMinutes += durationMinutes;
        }
      }

      totalMinutes += blockMinutes;

      if (block.intensity) {
        const zone = (block.intensity || '').toString().toUpperCase();
        if (zone) {
          const workMinutes =
            block.sets && block.work_duration
              ? (Number(block.work_duration) * Number(block.sets || 0)) / 60
              : Number(block.duration || 0);

          if (Number.isFinite(workMinutes) && workMinutes > 0) {
            zoneDistribution[zone] = (zoneDistribution[zone] || 0) + workMinutes;
          }
        }
      }
    });

    if (Object.keys(zoneDistribution).length === 0 && fallbackZone) {
      zoneDistribution[fallbackZone] = Math.max(totalMinutes, 1);
    }

    return {
      totalMinutes: Math.max(totalMinutes, 1),
      zoneDistribution: Object.fromEntries(
        Object.entries(zoneDistribution).map(([zone, minutes]) => [
          zone,
          Number(minutes.toFixed(2)),
        ])
      ),
    };
  }

  /**
   * Apply guardrails to validate substitution safety
   * @param {Object} candidate - Candidate substitution
   * @param {Object} user_context - User context and recent training
   * @returns {Promise<Object>} Guardrail validation result
   */
  async applyGuardrails(candidate, user_context) {
    if (!this.guardrailManager) {
      return { valid: true, warnings: [] };
    }

    try {
      const guardrailResult = await this.guardrailManager.validateWorkout(
        candidate,
        user_context.user_profile,
        user_context.recent_sessions || [],
        user_context.readiness_data || {}
      );

      return {
        valid: guardrailResult.isAllowed,
        warnings: guardrailResult.warnings || [],
        modifications: guardrailResult.autoAdjustments || [],
        reason: guardrailResult.isAllowed ? null : 'Safety guardrails triggered',
      };
    } catch (error) {
      this.logger.warn('Guardrail check failed:', error);
      return { valid: true, warnings: ['Guardrail check unavailable'] };
    }
  }

  /**
   * Rank substitution options by quality and suitability
   * @param {Array} candidates - Valid candidate substitutions
   * @param {number} targetLoad - Target load to match
   * @returns {Array} Ranked substitution options
   */
  rankSubstitutionOptions(candidates, targetLoad) {
    return candidates
      .map(candidate => ({
        ...candidate,
        quality_score: this.calculateQualityScore(candidate, targetLoad),
      }))
      .sort((a, b) => b.quality_score - a.quality_score);
  }

  /**
   * Calculate quality score for ranking substitutions
   * @param {Object} candidate - Candidate substitution
   * @param {number} targetLoad - Target load
   * @returns {number} Quality score (0-100)
   */
  calculateQualityScore(candidate, targetLoad) {
    let score = 50; // Base score

    // Load accuracy (40 points max)
    const loadAccuracy = 1 - Math.min(candidate.load_variance, 0.25);
    score += loadAccuracy * 40;

    // Confidence score (30 points max)
    score += candidate.confidence_score * 30;

    // Adaptation match bonus (20 points max)
    if (candidate.adaptation_match === 'exact') {
      score += 20;
    } else if (candidate.adaptation_match === 'compatible') {
      score += 10;
    }

    // Equipment preference bonus (5 points max)
    if (!candidate.equipment_required || candidate.equipment_required.length === 0) {
      score += 5; // Bodyweight/minimal equipment bonus
    }

    // Duration reasonableness (5 points max)
    if (candidate.scaled_duration >= 15 && candidate.scaled_duration <= 120) {
      score += 5;
    }

    return Math.round(score * 10) / 10;
  }

  /**
   * Generate human-readable reasoning for substitution
   * @param {Object} originalSession - Original planned session
   * @param {Object} substitution - Substitution option
   * @param {number} targetLoad - Target load
   * @returns {string} Reasoning explanation
   */
  generateReasoning(originalSession, substitution, targetLoad) {
    const reasons = [];

    // Duration explanation
    const durationChange = substitution.scaled_duration - originalSession.duration_minutes;
    const durationPercent = Math.round((durationChange / originalSession.duration_minutes) * 100);

    if (Math.abs(durationPercent) >= 10) {
      const direction = durationPercent > 0 ? 'longer' : 'shorter';
      reasons.push(
        `${Math.abs(durationPercent)}% ${direction} duration for equivalent training stress`
      );
    } else {
      reasons.push('Similar duration to original workout');
    }

    // Load equivalence
    const loadDiff = Math.abs(substitution.load_variance_percentage);
    if (loadDiff <= 5) {
      reasons.push(`Equivalent training load (${loadDiff}% difference)`);
    } else if (loadDiff <= 10) {
      reasons.push(`Very similar training load (${loadDiff}% difference)`);
    } else {
      reasons.push(`Comparable training load (${loadDiff}% difference)`);
    }

    // Adaptation match
    if (substitution.adaptation_match === 'exact') {
      reasons.push('Same training adaptation');
    } else {
      reasons.push(`Compatible training focus (${substitution.adaptation})`);
    }

    // Equipment considerations
    if (substitution.equipment_required && substitution.equipment_required.length > 0) {
      reasons.push(`Requires: ${substitution.equipment_required.join(', ')}`);
    } else {
      reasons.push('Minimal equipment required');
    }

    // Confidence indication
    if (substitution.confidence_score >= 0.9) {
      reasons.push('High confidence substitution');
    } else if (substitution.confidence_score >= 0.75) {
      reasons.push('Good substitution match');
    } else {
      reasons.push('Reasonable alternative option');
    }

    return `${reasons.join('. ')}.`;
  }

  /**
   * Get substitution statistics for analysis
   * @param {Array} substitutions - Generated substitutions
   * @returns {Object} Statistics summary
   */
  getSubstitutionStats(substitutions) {
    if (!substitutions || substitutions.length === 0) {
      return { count: 0 };
    }

    const loadVariances = substitutions.map(s => s.load_variance_percentage);
    const confidences = substitutions.map(s => s.confidence_score);

    return {
      count: substitutions.length,
      avg_load_variance:
        Math.round((loadVariances.reduce((a, b) => a + b, 0) / loadVariances.length) * 10) / 10,
      avg_confidence:
        Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100,
      best_load_match: Math.min(...loadVariances),
      highest_confidence: Math.max(...confidences),
      within_10_percent: loadVariances.filter(v => v <= 10).length,
    };
  }
}

export default SubstitutionEngine;
