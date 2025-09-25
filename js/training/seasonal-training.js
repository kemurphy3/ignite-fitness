// Seasonal Training System
// Manages training phases and adjustments based on season and competition schedule

class SeasonalTrainingSystem {
    constructor() {
        this.phases = {
            'off-season': {
                name: 'Off-Season',
                duration: '3-4 months',
                focus: 'Strength & Power Development',
                volume: 'High',
                intensity: 'Moderate-High',
                frequency: '5-6 days/week',
                priorities: [
                    'Build maximum strength',
                    'Address weaknesses',
                    'Improve movement patterns',
                    'Injury prevention',
                    'Conditioning base'
                ],
                adjustments: {
                    volumeMultiplier: 1.2,
                    intensityMultiplier: 0.8,
                    recoveryDays: 1,
                    maxSessionDuration: 120
                }
            },
            'pre-season': {
                name: 'Pre-Season',
                duration: '6-8 weeks',
                focus: 'Sport-Specific Preparation',
                volume: 'Moderate-High',
                intensity: 'High',
                frequency: '4-5 days/week',
                priorities: [
                    'Sport-specific conditioning',
                    'Speed & agility work',
                    'Tactical preparation',
                    'Peak strength maintenance',
                    'Competition readiness'
                ],
                adjustments: {
                    volumeMultiplier: 0.9,
                    intensityMultiplier: 1.1,
                    recoveryDays: 2,
                    maxSessionDuration: 90
                }
            },
            'in-season': {
                name: 'In-Season',
                duration: '4-6 months',
                focus: 'Performance Maintenance',
                volume: 'Low-Moderate',
                intensity: 'Moderate',
                frequency: '2-3 days/week',
                priorities: [
                    'Maintain strength gains',
                    'Recovery optimization',
                    'Injury prevention',
                    'Peak performance',
                    'Competition focus'
                ],
                adjustments: {
                    volumeMultiplier: 0.6,
                    intensityMultiplier: 0.9,
                    recoveryDays: 3,
                    maxSessionDuration: 60
                }
            },
            'playoffs': {
                name: 'Playoffs',
                duration: '2-4 weeks',
                focus: 'Peak Performance',
                volume: 'Low',
                intensity: 'High',
                frequency: '1-2 days/week',
                priorities: [
                    'Peak performance',
                    'Maximum recovery',
                    'Mental preparation',
                    'Tactical refinement',
                    'Competition execution'
                ],
                adjustments: {
                    volumeMultiplier: 0.4,
                    intensityMultiplier: 1.2,
                    recoveryDays: 4,
                    maxSessionDuration: 45
                }
            }
        };
        
        this.currentPhase = this.detectCurrentPhase();
        this.seasonStartDate = this.getSeasonStartDate();
        this.gameSchedule = [];
    }

    // Detect current training phase based on date and schedule
    detectCurrentPhase() {
        const now = new Date();
        const month = now.getMonth();
        const day = now.getDate();
        
        // Default phase detection based on calendar
        if (month >= 0 && month <= 2) return 'off-season'; // Jan-Mar
        if (month >= 3 && month <= 4) return 'pre-season'; // Apr-May
        if (month >= 5 && month <= 10) return 'in-season'; // Jun-Nov
        if (month >= 11) return 'playoffs'; // Dec
        
        return 'off-season';
    }

    // Get season start date (typically fall for most sports)
    getSeasonStartDate() {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, 8, 1); // September 1st
    }

    // Set current phase manually
    setPhase(phase) {
        if (this.phases[phase]) {
            this.currentPhase = phase;
            this.savePhaseToStorage();
            return true;
        }
        return false;
    }

    // Get current phase details
    getCurrentPhase() {
        return {
            phase: this.currentPhase,
            details: this.phases[this.currentPhase],
            daysUntilSeason: this.getDaysUntilSeason(),
            phaseProgress: this.getPhaseProgress()
        };
    }

    // Calculate days until season starts
    getDaysUntilSeason() {
        const now = new Date();
        const seasonStart = this.getSeasonStartDate();
        const diffTime = seasonStart - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Calculate progress through current phase
    getPhaseProgress() {
        const now = new Date();
        const month = now.getMonth();
        
        switch (this.currentPhase) {
            case 'off-season':
                return Math.min((month + 1) / 3, 1); // Jan-Mar
            case 'pre-season':
                return Math.max(0, Math.min((month - 2) / 2, 1)); // Apr-May
            case 'in-season':
                return Math.max(0, Math.min((month - 4) / 6, 1)); // Jun-Nov
            case 'playoffs':
                return Math.max(0, Math.min((month - 10) / 1, 1)); // Dec
            default:
                return 0;
        }
    }

    // Generate phase-specific workout adjustments
    generatePhaseWorkoutPlan(baseWorkout) {
        const phaseDetails = this.phases[this.currentPhase];
        const adjustments = phaseDetails.adjustments;
        
        const adjustedWorkout = {
            ...baseWorkout,
            sessions: baseWorkout.sessions.map(session => ({
                ...session,
                duration: Math.min(session.duration * adjustments.volumeMultiplier, adjustments.maxSessionDuration),
                intensity: session.intensity * adjustments.intensityMultiplier,
                exercises: this.adjustExercisesForPhase(session.exercises, phaseDetails)
            }))
        };
        
        return adjustedWorkout;
    }

    // Adjust exercises based on phase
    adjustExercisesForPhase(exercises, phaseDetails) {
        return exercises.map(exercise => {
            const adjusted = { ...exercise };
            
            // Adjust sets based on phase
            if (phaseDetails.name === 'Off-Season') {
                adjusted.sets = Math.ceil(exercise.sets * 1.2);
            } else if (phaseDetails.name === 'In-Season') {
                adjusted.sets = Math.ceil(exercise.sets * 0.8);
            } else if (phaseDetails.name === 'Playoffs') {
                adjusted.sets = Math.ceil(exercise.sets * 0.6);
            }
            
            // Adjust reps based on phase
            if (phaseDetails.name === 'Off-Season') {
                adjusted.reps = Math.ceil(exercise.reps * 1.1);
            } else if (phaseDetails.name === 'Pre-Season') {
                adjusted.reps = Math.ceil(exercise.reps * 0.9);
            }
            
            return adjusted;
        });
    }

    // Add game to schedule
    addGame(game) {
        this.gameSchedule.push({
            date: new Date(game.date),
            opponent: game.opponent,
            type: game.type || 'regular', // regular, playoff, championship
            location: game.location || 'home'
        });
        
        this.gameSchedule.sort((a, b) => a.date - b.date);
        this.saveScheduleToStorage();
    }

    // Get upcoming games
    getUpcomingGames(count = 5) {
        const now = new Date();
        return this.gameSchedule
            .filter(game => game.date >= now)
            .slice(0, count);
    }

    // Get games this week
    getGamesThisWeek() {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return this.gameSchedule.filter(game => 
            game.date >= weekStart && game.date <= weekEnd
        );
    }

    // Check if it's a game day
    isGameDay(date = new Date()) {
        return this.gameSchedule.some(game => 
            game.date.toDateString() === date.toDateString()
        );
    }

    // Get next game
    getNextGame() {
        const now = new Date();
        const upcomingGames = this.gameSchedule.filter(game => game.date > now);
        return upcomingGames.length > 0 ? upcomingGames[0] : null;
    }

    // Generate pre-game workout (light session)
    generatePreGameWorkout() {
        return {
            type: 'Pre-Game',
            duration: 30,
            intensity: 'Light',
            exercises: [
                {
                    name: 'Dynamic Warm-up',
                    sets: 1,
                    reps: 10,
                    duration: 10
                },
                {
                    name: 'Light Movement Prep',
                    sets: 2,
                    reps: 8,
                    duration: 15
                },
                {
                    name: 'Mental Preparation',
                    sets: 1,
                    reps: 1,
                    duration: 5
                }
            ]
        };
    }

    // Generate post-game recovery
    generatePostGameRecovery() {
        return {
            type: 'Post-Game Recovery',
            duration: 20,
            intensity: 'Very Light',
            exercises: [
                {
                    name: 'Cool Down Walk',
                    sets: 1,
                    reps: 1,
                    duration: 5
                },
                {
                    name: 'Static Stretching',
                    sets: 1,
                    reps: 1,
                    duration: 10
                },
                {
                    name: 'Foam Rolling',
                    sets: 1,
                    reps: 1,
                    duration: 5
                }
            ]
        };
    }

    // Get phase-specific recommendations
    getPhaseRecommendations() {
        const phase = this.phases[this.currentPhase];
        const recommendations = [];
        
        // General phase recommendations
        recommendations.push({
            category: 'Training Focus',
            message: `Focus on ${phase.focus.toLowerCase()} during ${phase.name}`,
            priority: 'high'
        });
        
        // Volume recommendations
        recommendations.push({
            category: 'Volume',
            message: `Maintain ${phase.volume.toLowerCase()} training volume`,
            priority: 'medium'
        });
        
        // Recovery recommendations
        if (phase.adjustments.recoveryDays > 2) {
            recommendations.push({
                category: 'Recovery',
                message: `Ensure ${phase.adjustments.recoveryDays} rest days between intense sessions`,
                priority: 'high'
            });
        }
        
        // Game-specific recommendations
        if (this.isGameDay()) {
            recommendations.push({
                category: 'Game Day',
                message: 'Focus on light movement and mental preparation',
                priority: 'high'
            });
        }
        
        const nextGame = this.getNextGame();
        if (nextGame) {
            const daysUntil = Math.ceil((nextGame.date - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 2) {
                recommendations.push({
                    category: 'Upcoming Game',
                    message: `Game in ${daysUntil} days - reduce training intensity`,
                    priority: 'high'
                });
            }
        }
        
        return recommendations;
    }

    // Save phase to localStorage
    savePhaseToStorage() {
        localStorage.setItem('ignitefitness_current_phase', this.currentPhase);
    }

    // Load phase from localStorage
    loadPhaseFromStorage() {
        const savedPhase = localStorage.getItem('ignitefitness_current_phase');
        if (savedPhase && this.phases[savedPhase]) {
            this.currentPhase = savedPhase;
        }
    }

    // Save game schedule to localStorage
    saveScheduleToStorage() {
        localStorage.setItem('ignitefitness_game_schedule', JSON.stringify(this.gameSchedule));
    }

    // Load game schedule from localStorage
    loadScheduleFromStorage() {
        const savedSchedule = localStorage.getItem('ignitefitness_game_schedule');
        if (savedSchedule) {
            try {
                this.gameSchedule = JSON.parse(savedSchedule).map(game => ({
                    ...game,
                    date: new Date(game.date)
                }));
            } catch (error) {
                console.error('Error loading game schedule:', error);
                this.gameSchedule = [];
            }
        }
    }

    // Initialize the system
    initialize() {
        this.loadPhaseFromStorage();
        this.loadScheduleFromStorage();
        console.log(`Seasonal Training System initialized - Current Phase: ${this.currentPhase}`);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeasonalTrainingSystem };
} else {
    // Make available globally for browser
    window.SeasonalTrainingSystem = SeasonalTrainingSystem;
}
