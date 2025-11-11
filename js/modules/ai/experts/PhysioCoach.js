/**
 * PhysioCoach - AI expert for injury prevention and rehab recommendations
 * Provides safe modifications and movement quality focus
 */
class PhysioCoach {
  constructor() {
    this.logger = window.SafeLogger || console;
  }

  /**
   * Propose session plan based on physiotherapy principles
   * @param {Object} context - User context
   * @returns {Object} Physio coach proposal
   */
  propose({ user, season, schedule, history, readiness, preferences }) {
    const proposal = {
      blocks: [],
      constraints: [],
      priorities: [],
    };

    // Check for injury flags
    const activeInjuries = history?.injuryFlags?.filter(f => f.active) || [];

    // Corrective work based on movement screening
    const correctiveWork = this.generateCorrectiveWork(user, activeInjuries);

    // Prehab work
    const prehabWork = this.generatePrehab(user);

    proposal.blocks = [...correctiveWork, ...prehabWork];

    proposal.constraints = [
      { type: 'pain_free_only', rule: 'Stop if pain exceeds 3/10' },
      { type: 'modify_if_needed', rule: 'Choose safer exercise variations' },
    ];

    proposal.priorities = [
      { priority: 1, goal: 'Safety and injury prevention', weight: 0.4 },
      { priority: 2, goal: 'Movement quality', weight: 0.25 },
    ];

    return proposal;
  }

  generateCorrectiveWork(user, activeInjuries) {
    if (activeInjuries.length === 0) {
      return [];
    }

    return activeInjuries.map(injury => ({
      type: 'corrective',
      exercise: this.getCorrectiveExercise(injury),
      sets: 3,
      rationale: `Corrective work for ${injury.location}: ${injury.painLevel}/10`,
    }));
  }

  generatePrehab(user) {
    // Based on movement screening results or sport-specific needs
    const prehabExercises = [];

    if (user.sport === 'soccer') {
      prehabExercises.push(
        { name: 'hip_mobility', rationale: 'Prevent groin strains common in soccer' },
        { name: 'ankle_stability', rationale: 'Prevent ankle sprains' }
      );
    }

    return prehabExercises.map(ex => ({
      type: 'prehab',
      exercise: ex.name,
      sets: 2,
      rationale: ex.rationale,
    }));
  }

  getCorrectiveExercise(injury) {
    const correctiveMap = {
      knee: {
        exercise: 'goblet_squat',
        rationale: 'Safer knee flexion with neutral spine',
      },
      lower_back: {
        exercise: 'trap_bar_deadlift',
        rationale: 'More upright position reduces shear forces',
      },
      shoulder: {
        exercise: 'landmine_press',
        rationale: 'Angled pressing reduces shoulder impingement',
      },
    };

    const correction = correctiveMap[injury.location.toLowerCase()];
    if (correction) {
      return {
        name: correction.exercise,
        rationale: `${correction.rationale} due to ${injury.location} pain (${injury.painLevel}/10)`,
      };
    }

    return {
      name: 'light_modified_version',
      rationale: `Safe modification for ${injury.location} concern`,
    };
  }
}

window.PhysioCoach = PhysioCoach;
