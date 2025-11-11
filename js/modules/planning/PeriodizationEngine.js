import ProgressionCalculator from './ProgressionCalculator.js';

/**
 * PeriodizationEngine - constructs multi-phase periodization plans with block,
 * conjugate, and undulating structures, incorporating tapering for competition.
 */
class PeriodizationEngine {
    constructor(options = {}) {
        this.logger = options.logger || (typeof window !== 'undefined' ? window.SafeLogger : console);
        this.progressionCalculator = options.progressionCalculator || new ProgressionCalculator({});
    }

    designPeriodizationPlan(goals, constraints = {}, calendar = {}) {
        if (!Array.isArray(goals) || goals.length === 0) {
            throw new Error('goals array is required');
        }

        const normalizedConstraints = this.#normalizeConstraints(constraints);
        const timeFrame = normalizedConstraints.timeFrame || 12;
        const phaseTemplate = this.#buildPhaseTemplate(timeFrame, goals);
        const sessionsPerWeek = normalizedConstraints.sessionsPerWeek || 5;

        const phases = phaseTemplate.map(phase => {
            const weeklyPlan = this.#constructWeeklyPlan(phase, sessionsPerWeek, goals, normalizedConstraints);
            const progression = this.progressionCalculator.createProgressionModel(phase, weeklyPlan);
            return {
                ...phase,
                weeklyPlan,
                progression
            };
        });

        const taper = this.#buildTaper(goals, normalizedConstraints, calendar);
        if (taper) {
            phases.push(taper);
        }

        const performanceScore = this.#estimatePerformanceGain(phases, normalizedConstraints);

        return {
            phases,
            performanceScore
        };
    }

    #normalizeConstraints(constraints) {
        const defaults = {
            sessionsPerWeek: 5,
            timeFrame: 16,
            competitionDate: null,
            fatigueSensitivity: 0.6
        };
        return { ...defaults, ...constraints };
    }

    #buildPhaseTemplate(timeFrame, goals) {
        const emphasisMap = this.#determineEmphasis(goals);
        const blockLengths = [
            Math.round(timeFrame * 0.35),
            Math.round(timeFrame * 0.35),
            Math.round(timeFrame * 0.20)
        ];
        const maintenanceWeeks = timeFrame - (blockLengths[0] + blockLengths[1] + blockLengths[2]);
        if (maintenanceWeeks > 0) {blockLengths[2] += maintenanceWeeks;}
        return [
            { name: 'Accumulation', weeks: blockLengths[0], emphasis: emphasisMap.accumulation, intensity: 'moderate', focus: 'volume' },
            { name: 'Intensification', weeks: blockLengths[1], emphasis: emphasisMap.intensification, intensity: 'high', focus: 'intensity' },
            { name: 'Realization', weeks: blockLengths[2], emphasis: emphasisMap.realization, intensity: 'peak', focus: 'performance' }
        ];
    }

    #determineEmphasis(goals) {
        const strengthPriority = goals.some(goal => goal.type === 'strength') ? 1 : 0.5;
        const endurancePriority = goals.some(goal => goal.type === 'endurance') ? 1 : 0.4;
        const compositionPriority = goals.some(goal => goal.type === 'body-composition') ? 0.8 : 0.3;
        const speedPriority = goals.some(goal => ['speed', 'agility'].includes(goal.type)) ? 0.7 : 0.2;

        const normalize = values => {
            const sum = values.reduce((acc, value) => acc + value.value, 0);
            return values.map(item => ({ ...item, value: item.value / sum }));
        };

        return {
            accumulation: normalize([
                { key: 'strength', value: strengthPriority * 0.6 },
                { key: 'endurance', value: endurancePriority * 0.7 },
                { key: 'conditioning', value: compositionPriority * 0.5 },
                { key: 'speed', value: speedPriority * 0.2 }
            ]),
            intensification: normalize([
                { key: 'strength', value: strengthPriority * 0.9 },
                { key: 'endurance', value: endurancePriority * 0.5 },
                { key: 'conditioning', value: compositionPriority * 0.6 },
                { key: 'speed', value: speedPriority * 0.8 }
            ]),
            realization: normalize([
                { key: 'strength', value: strengthPriority * 0.85 },
                { key: 'endurance', value: endurancePriority * 0.6 },
                { key: 'conditioning', value: compositionPriority * 0.5 },
                { key: 'speed', value: speedPriority * 0.9 }
            ])
        };
    }

    #constructWeeklyPlan(phase, sessionsPerWeek, goals, constraints) {
        const sessions = [];
        for (let day = 0; day < sessionsPerWeek; day++) {
            const emphasis = phase.emphasis[day % phase.emphasis.length];
            const intensity = this.#dayIntensity(phase, day);
            const modalities = this.#modalitiesForEmphasis(emphasis.key);
            sessions.push({
                day,
                modalities,
                intensity,
                primaryFocus: emphasis.key,
                sessionLoad: intensity * (emphasis.value * 100),
                recoveryFocus: this.#recoveryFocus(emphasis.key, goals),
                constraints
            });
        }
        return sessions;
    }

    #dayIntensity(phase, dayIndex) {
        if (phase.focus === 'volume') {
            return 0.65 + ((dayIndex % 3) * 0.05);
        }
        if (phase.focus === 'intensity') {
            return 0.7 + ((dayIndex % 2) * 0.07);
        }
        return 0.6 + ((dayIndex % 4) * 0.08);
    }

    #modalitiesForEmphasis(emphasis) {
        switch (emphasis) {
        case 'strength':
            return ['strength', 'conditioning'];
        case 'endurance':
            return ['endurance'];
        case 'conditioning':
            return ['conditioning', 'endurance'];
        case 'speed':
            return ['strength', 'speed'];
        default:
            return ['conditioning'];
        }
    }

    #recoveryFocus(emphasis, goals) {
        if (emphasis === 'strength') {
            return goals.some(goal => goal.type === 'strength') ? 'neuromuscular' : 'general';
        }
        if (emphasis === 'endurance') {
            return 'glycogen';
        }
        if (emphasis === 'speed') {
            return 'nervousSystem';
        }
        return 'general';
    }

    #buildTaper(goals, constraints, calendar) {
        const hasCompetition = Boolean(constraints.competitionDate || calendar?.eventDate);
        if (!hasCompetition) {return null;}
        const emphasis = this.#determineEmphasis(goals);
        return {
            name: 'Taper',
            weeks: 2,
            emphasis: emphasis.realization,
            intensity: 'reduced',
            focus: 'taper',
            weeklyPlan: [{
                day: 0,
                modalities: ['strength'],
                intensity: 0.55,
                sessionLoad: 60,
                primaryFocus: 'strength',
                recoveryFocus: 'neuromuscular'
            }, {
                day: 2,
                modalities: ['endurance'],
                intensity: 0.6,
                sessionLoad: 45,
                primaryFocus: 'endurance',
                recoveryFocus: 'glycogen'
            }, {
                day: 4,
                modalities: ['speed'],
                intensity: 0.65,
                sessionLoad: 35,
                primaryFocus: 'speed',
                recoveryFocus: 'nervousSystem'
            }]
        };
    }

    #estimatePerformanceGain(phases, constraints) {
        const fatigueSensitivity = constraints.fatigueSensitivity || 0.6;
        const volumes = phases.map(phase =>
            phase.weeklyPlan.reduce((sum, session) => sum + session.sessionLoad, 0) * phase.weeks
        );
        const intensities = phases.map(phase =>
            phase.weeklyPlan.reduce((sum, session) => sum + session.intensity, 0) / phase.weeklyPlan.length
        );
        const volumeScore = volumes.reduce((sum, value, index) => sum + (value * (index + 1)), 0) / (volumes.length || 1);
        const intensityScore = intensities.reduce((sum, value) => sum + value, 0) / (intensities.length || 1);
        const fatiguePenalty = fatigueSensitivity * volumes.reduce((sum, value) => sum + value, 0) / 1500;
        return Math.max(0, (volumeScore * 0.4) + (intensityScore * 60) - fatiguePenalty);
    }
}

if (typeof window !== 'undefined') {
    window.PeriodizationEngine = PeriodizationEngine;
}

export default PeriodizationEngine;


