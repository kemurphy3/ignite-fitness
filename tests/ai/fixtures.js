/**
 * Expert Coordinator Test Fixtures
 * Provides test contexts for various scenarios
 */

// Prevent duplicate declaration
if (typeof window === 'undefined' || !window.Fixtures) {
    (function() {
        // Standard context: normal training day
        const normal = {
            user: {
                sport: 'soccer',
                position: 'midfielder',
                weight: 75,
                height: 180,
                age: 25
            },
            season: 'in-season',
            schedule: {
                upcomingGames: [],
                isGameDay: false,
                isRestDay: false
            },
            history: {
                lastSession: {
                    mainMovement: 'deadlift',
                    averageRPE: 7
                }
            },
            readiness: 8,
            preferences: {
                aestheticFocus: 'functional',
                trainingMode: 'simple',
                availableDays: 4,
                sessionLength: 45
            },
            constraints: {
                timeLimit: 45,
                equipment: ['barbell', 'dumbbells', 'bench'],
                flags: []
            }
        };

        // Build fixtures object
        const fixtures = {
            normal: normal,

            // Game tomorrow: heavy lower body removed
            gameTomorrow: {
                ...normal,
                schedule: {
                    upcomingGames: [{
                        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                        type: 'game',
                        importance: 'high'
                    }],
                    daysUntilGame: 1,
                    isGameDay: false
                },
                constraints: {
                    ...normal.constraints,
                    flags: ['game_safety']
                }
            },

            // Low readiness: volume reduction
            lowReadiness: {
                ...normal,
                readiness: 3,
                history: {
                    lastSession: {
                        mainMovement: 'squat',
                        averageRPE: 9,
                        totalVolume: 5000
                    }
                }
            },

            // Time-crunched: 20-minute session
            timeCrushed: {
                ...normal,
                constraints: {
                    ...normal.constraints,
                    timeLimit: 20
                },
                preferences: {
                    ...normal.preferences,
                    sessionLength: 20
                }
            },

            // Knee pain: no BSS, safe alternatives
            kneePain: {
                ...normal,
                constraints: {
                    ...normal.constraints,
                    flags: ['knee_pain'],
                    painLocation: 'knee'
                }
            },

            // Simple mode: minimal blocks
            simpleMode: {
                ...normal,
                preferences: {
                    ...normal.preferences,
                    trainingMode: 'simple'
                }
            },

            // Advanced mode: full plan
            advancedMode: {
                ...normal,
                preferences: {
                    ...normal.preferences,
                    trainingMode: 'advanced'
                }
            },

            // Aesthetic focus: V-taper
            aestheticVtaper: {
                ...normal,
                preferences: {
                    ...normal.preferences,
                    aestheticFocus: 'v_taper'
                }
            },

            // Aesthetic focus: Glutes
            aestheticGlutes: {
                ...normal,
                preferences: {
                    ...normal.preferences,
                    aestheticFocus: 'glutes'
                }
            }
        };

        // Export for Node.js or browser
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = fixtures;
        } else {
            window.Fixtures = fixtures;
        }
    })();
}

