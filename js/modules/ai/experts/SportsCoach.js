/**
 * SportsCoach - AI expert for sport-specific training recommendations
 * Provides athletic performance optimization
 */
class SportsCoach {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Propose session plan based on sport demands
     * @param {Object} context - User context
     * @returns {Object} Sports coach proposal
     */
    propose({ user, season, schedule, history, readiness, preferences }) {
        const sport = user.sport || 'soccer';
        
        const proposal = {
            blocks: [],
            constraints: [],
            priorities: []
        };

        // Check for game day scheduling
        const daysUntilGame = this.getDaysUntilGame(schedule);
        
        // Power development or maintenance
        const powerWork = this.generatePowerWork(sport, season, daysUntilGame);
        
        // Sport-specific conditioning
        const conditioning = this.generateConditioning(sport, readiness);

        proposal.blocks = [
            ...powerWork,
            {
                type: 'conditioning',
                exercises: conditioning,
                duration: 15,
                rationale: 'Sport-specific energy system development'
            }
        ];

        proposal.constraints = [
            { 
                type: 'game_day_safety',
                rule: daysUntilGame <= 2 ? 'Lower intensity, no heavy leg work' : 'Normal programming',
                daysUntilGame
            },
            { 
                type: 'volume',
                rule: `Total volume ${this.calculateVolume(readiness)}`
            }
        ];

        proposal.priorities = [
            { priority: 1, goal: 'Sport performance', weight: 0.30 },
            { priority: 2, goal: 'Injury prevention', weight: 0.20 }
        ];

        return proposal;
    }

    getDaysUntilGame(schedule) {
        if (!schedule || !schedule.upcomingGames) return 99;
        
        const nextGame = schedule.upcomingGames[0];
        const gameDate = new Date(nextGame.date);
        const today = new Date();
        const days = Math.ceil((gameDate - today) / (1000 * 60 * 60 * 24));
        
        return days;
    }

    generatePowerWork(sport, season, daysUntilGame) {
        if (daysUntilGame <= 1) {
            // Game -1: Upper body only, light
            return [{
                type: 'power',
                exercises: ['medicine_ball_throws', 'band_rotations'],
                sets: 3,
                rationale: 'Game tomorrow - upper body power maintenance'
            }];
        }
        
        if (daysUntilGame <= 2) {
            // Game -2: No heavy legs, moderate power
            return [{
                type: 'power',
                exercises: ['jump_squats', 'box_jumps'],
                sets: 3,
                load: 'bodyweight',
                rationale: 'Game in 2 days - power without heavy loading'
            }];
        }

        // Normal power work
        return [{
            type: 'power',
            exercises: ['power_cleans', 'jump_squats'],
            sets: 5,
            load: 'moderate',
            rationale: 'Power development for athleticism'
        }];
    }

    generateConditioning(sport, readiness) {
        const conditioningMap = {
            'soccer': ['interval_running', 'shuttle_runs', 'agility_drills'],
            'basketball': ['sprint_intervals', 'court_work', 'jump_conditioning'],
            'running': ['tempo_runs', 'hill_sprints', 'fartlek']
        };

        const exercises = conditioningMap[sport] || conditioningMap['soccer'];
        const adjustedVolume = this.adjustForReadiness(readiness);
        
        return exercises.map(ex => ({
            name: ex,
            duration: adjustedVolume.duration,
            intensity: adjustedVolume.intensity
        }));
    }

    adjustForReadiness(readiness) {
        if (readiness >= 8) {
            return { duration: '15-20min', intensity: 'high' };
        } else if (readiness >= 5) {
            return { duration: '10-15min', intensity: 'moderate' };
        } else {
            return { duration: '5-10min', intensity: 'low' };
        }
    }

    calculateVolume(readiness) {
        if (readiness >= 8) return 'high';
        if (readiness >= 5) return 'moderate';
        return 'low';
    }
}

window.SportsCoach = SportsCoach;
