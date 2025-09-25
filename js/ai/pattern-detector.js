// Pattern Detection System
// Analyzes user workout patterns, performance trends, and behavioral insights

class PatternDetector {
    constructor() {
        this.patterns = {
            performance: {},
            timing: {},
            volume: {},
            intensity: {},
            recovery: {},
            progression: {}
        };
        
        this.insights = [];
        this.recommendations = [];
    }

    // Analyze user patterns from workout data
    analyzePatterns(workoutData, userProfile) {
        this.patterns = {
            performance: this.analyzePerformancePatterns(workoutData),
            timing: this.analyzeTimingPatterns(workoutData),
            volume: this.analyzeVolumePatterns(workoutData),
            intensity: this.analyzeIntensityPatterns(workoutData),
            recovery: this.analyzeRecoveryPatterns(workoutData),
            progression: this.analyzeProgressionPatterns(workoutData)
        };
        
        this.generateInsights();
        this.generateRecommendations(userProfile);
        
        return {
            patterns: this.patterns,
            insights: this.insights,
            recommendations: this.recommendations
        };
    }

    // Analyze performance patterns
    analyzePerformancePatterns(workoutData) {
        const sessions = workoutData.sessions || [];
        if (sessions.length < 3) return {};

        const patterns = {
            dayOfWeek: this.analyzeDayOfWeekPerformance(sessions),
            timeOfDay: this.analyzeTimeOfDayPerformance(sessions),
            exercisePerformance: this.analyzeExercisePerformance(sessions),
            consistency: this.calculateConsistency(sessions),
            improvement: this.calculateImprovement(sessions)
        };

        return patterns;
    }

    // Analyze day-of-week performance patterns
    analyzeDayOfWeekPerformance(sessions) {
        const dayPerformance = {};
        
        for (let i = 0; i < 7; i++) {
            dayPerformance[i] = {
                count: 0,
                totalRPE: 0,
                averageRPE: 0,
                totalVolume: 0,
                averageVolume: 0
            };
        }

        sessions.forEach(session => {
            const dayOfWeek = new Date(session.start_at).getDay();
            const rpe = session.averageRPE || 0;
            const volume = this.calculateSessionVolume(session);
            
            dayPerformance[dayOfWeek].count++;
            dayPerformance[dayOfWeek].totalRPE += rpe;
            dayPerformance[dayOfWeek].totalVolume += volume;
        });

        // Calculate averages
        Object.keys(dayPerformance).forEach(day => {
            const data = dayPerformance[day];
            if (data.count > 0) {
                data.averageRPE = data.totalRPE / data.count;
                data.averageVolume = data.totalVolume / data.count;
            }
        });

        return dayPerformance;
    }

    // Analyze time-of-day performance patterns
    analyzeTimeOfDayPerformance(sessions) {
        const timePerformance = {
            morning: { count: 0, totalRPE: 0, averageRPE: 0 },
            afternoon: { count: 0, totalRPE: 0, averageRPE: 0 },
            evening: { count: 0, totalRPE: 0, averageRPE: 0 }
        };

        sessions.forEach(session => {
            const hour = new Date(session.start_at).getHours();
            const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
            const rpe = session.averageRPE || 0;
            
            timePerformance[timeSlot].count++;
            timePerformance[timeSlot].totalRPE += rpe;
        });

        // Calculate averages
        Object.keys(timePerformance).forEach(time => {
            const data = timePerformance[time];
            if (data.count > 0) {
                data.averageRPE = data.totalRPE / data.count;
            }
        });

        return timePerformance;
    }

    // Analyze exercise-specific performance
    analyzeExercisePerformance(sessions) {
        const exerciseStats = {};
        
        sessions.forEach(session => {
            if (session.exercises) {
                session.exercises.forEach(exercise => {
                    if (!exerciseStats[exercise.name]) {
                        exerciseStats[exercise.name] = {
                            count: 0,
                            totalWeight: 0,
                            totalReps: 0,
                            totalSets: 0,
                            averageWeight: 0,
                            averageReps: 0,
                            averageSets: 0,
                            progression: []
                        };
                    }
                    
                    const stats = exerciseStats[exercise.name];
                    stats.count++;
                    stats.totalWeight += exercise.weight || 0;
                    stats.totalReps += exercise.reps || 0;
                    stats.totalSets += exercise.sets || 0;
                    stats.progression.push({
                        date: session.start_at,
                        weight: exercise.weight || 0,
                        reps: exercise.reps || 0,
                        sets: exercise.sets || 0
                    });
                });
            }
        });

        // Calculate averages and progression
        Object.keys(exerciseStats).forEach(exercise => {
            const stats = exerciseStats[exercise];
            if (stats.count > 0) {
                stats.averageWeight = stats.totalWeight / stats.count;
                stats.averageReps = stats.totalReps / stats.count;
                stats.averageSets = stats.totalSets / stats.count;
                stats.progression = this.calculateExerciseProgression(stats.progression);
            }
        });

        return exerciseStats;
    }

    // Calculate workout consistency
    calculateConsistency(sessions) {
        if (sessions.length < 7) return 0;
        
        const last30Days = sessions.filter(session => {
            const sessionDate = new Date(session.start_at);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return sessionDate >= thirtyDaysAgo;
        });
        
        const expectedWorkouts = 30; // Assuming daily workouts
        const actualWorkouts = last30Days.length;
        
        return actualWorkouts / expectedWorkouts;
    }

    // Calculate improvement over time
    calculateImprovement(sessions) {
        if (sessions.length < 4) return 0;
        
        const sortedSessions = sessions.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
        const firstHalf = sortedSessions.slice(0, Math.floor(sortedSessions.length / 2));
        const secondHalf = sortedSessions.slice(Math.floor(sortedSessions.length / 2));
        
        const firstHalfVolume = firstHalf.reduce((sum, session) => sum + this.calculateSessionVolume(session), 0);
        const secondHalfVolume = secondHalf.reduce((sum, session) => sum + this.calculateSessionVolume(session), 0);
        
        if (firstHalfVolume === 0) return 0;
        
        return (secondHalfVolume - firstHalfVolume) / firstHalfVolume;
    }

    // Analyze timing patterns
    analyzeTimingPatterns(workoutData) {
        const sessions = workoutData.sessions || [];
        if (sessions.length < 3) return {};

        return {
            preferredDays: this.getPreferredDays(sessions),
            preferredTimes: this.getPreferredTimes(sessions),
            sessionFrequency: this.calculateSessionFrequency(sessions),
            restDayPattern: this.analyzeRestDayPattern(sessions)
        };
    }

    // Get preferred workout days
    getPreferredDays(sessions) {
        const dayCounts = {};
        
        for (let i = 0; i < 7; i++) {
            dayCounts[i] = 0;
        }
        
        sessions.forEach(session => {
            const dayOfWeek = new Date(session.start_at).getDay();
            dayCounts[dayOfWeek]++;
        });
        
        return Object.entries(dayCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([day, count]) => ({ day: parseInt(day), count }));
    }

    // Get preferred workout times
    getPreferredTimes(sessions) {
        const timeCounts = { morning: 0, afternoon: 0, evening: 0 };
        
        sessions.forEach(session => {
            const hour = new Date(session.start_at).getHours();
            const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
            timeCounts[timeSlot]++;
        });
        
        return Object.entries(timeCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([time, count]) => ({ time, count }));
    }

    // Calculate session frequency
    calculateSessionFrequency(sessions) {
        if (sessions.length < 2) return 0;
        
        const firstSession = new Date(Math.min(...sessions.map(s => new Date(s.start_at))));
        const lastSession = new Date(Math.max(...sessions.map(s => new Date(s.start_at))));
        const daysDiff = (lastSession - firstSession) / (1000 * 60 * 60 * 24);
        
        return sessions.length / Math.max(1, daysDiff);
    }

    // Analyze rest day patterns
    analyzeRestDayPattern(sessions) {
        const restDays = [];
        const sortedSessions = sessions.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
        
        for (let i = 1; i < sortedSessions.length; i++) {
            const current = new Date(sortedSessions[i].start_at);
            const previous = new Date(sortedSessions[i - 1].start_at);
            const daysDiff = (current - previous) / (1000 * 60 * 60 * 24);
            
            if (daysDiff > 1) {
                restDays.push(daysDiff - 1);
            }
        }
        
        return {
            averageRestDays: restDays.length > 0 ? restDays.reduce((sum, days) => sum + days, 0) / restDays.length : 0,
            maxRestDays: restDays.length > 0 ? Math.max(...restDays) : 0,
            minRestDays: restDays.length > 0 ? Math.min(...restDays) : 0
        };
    }

    // Analyze volume patterns
    analyzeVolumePatterns(workoutData) {
        const sessions = workoutData.sessions || [];
        if (sessions.length < 3) return {};

        const volumes = sessions.map(session => this.calculateSessionVolume(session));
        
        return {
            averageVolume: this.calculateAverage(volumes),
            volumeTrend: this.calculateTrend(volumes),
            volumeVariability: this.calculateVariability(volumes),
            peakVolume: Math.max(...volumes),
            lowVolume: Math.min(...volumes)
        };
    }

    // Analyze intensity patterns
    analyzeIntensityPatterns(workoutData) {
        const sessions = workoutData.sessions || [];
        if (sessions.length < 3) return {};

        const rpeValues = sessions.map(session => session.averageRPE || 0).filter(rpe => rpe > 0);
        
        return {
            averageRPE: this.calculateAverage(rpeValues),
            rpeTrend: this.calculateTrend(rpeValues),
            rpeVariability: this.calculateVariability(rpeValues),
            maxRPE: Math.max(...rpeValues),
            minRPE: Math.min(...rpeValues)
        };
    }

    // Analyze recovery patterns
    analyzeRecoveryPatterns(workoutData) {
        const sessions = workoutData.sessions || [];
        if (sessions.length < 3) return {};

        return {
            recoveryTime: this.calculateAverageRecoveryTime(sessions),
            fatiguePattern: this.analyzeFatiguePattern(sessions),
            overtrainingRisk: this.assessOvertrainingRisk(sessions)
        };
    }

    // Analyze progression patterns
    analyzeProgressionPatterns(workoutData) {
        const sessions = workoutData.sessions || [];
        if (sessions.length < 3) return {};

        return {
            strengthProgression: this.calculateStrengthProgression(sessions),
            volumeProgression: this.calculateVolumeProgression(sessions),
            consistencyProgression: this.calculateConsistencyProgression(sessions)
        };
    }

    // Calculate session volume
    calculateSessionVolume(session) {
        if (!session.exercises) return 0;
        
        return session.exercises.reduce((total, exercise) => {
            const weight = exercise.weight || 0;
            const reps = exercise.reps || 0;
            const sets = exercise.sets || 0;
            return total + (weight * reps * sets);
        }, 0);
    }

    // Calculate exercise progression
    calculateExerciseProgression(progressionData) {
        if (progressionData.length < 2) return 0;
        
        const sorted = progressionData.sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        
        const firstVolume = first.weight * first.reps * first.sets;
        const lastVolume = last.weight * last.reps * last.sets;
        
        if (firstVolume === 0) return 0;
        
        return (lastVolume - firstVolume) / firstVolume;
    }

    // Calculate average
    calculateAverage(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    // Calculate trend
    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const firstAvg = this.calculateAverage(firstHalf);
        const secondAvg = this.calculateAverage(secondHalf);
        
        if (firstAvg === 0) return 0;
        
        return (secondAvg - firstAvg) / firstAvg;
    }

    // Calculate variability (coefficient of variation)
    calculateVariability(values) {
        if (values.length < 2) return 0;
        
        const average = this.calculateAverage(values);
        if (average === 0) return 0;
        
        const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
        const standardDeviation = Math.sqrt(variance);
        
        return standardDeviation / average;
    }

    // Calculate average recovery time
    calculateAverageRecoveryTime(sessions) {
        const sortedSessions = sessions.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
        const recoveryTimes = [];
        
        for (let i = 1; i < sortedSessions.length; i++) {
            const current = new Date(sortedSessions[i].start_at);
            const previous = new Date(sortedSessions[i - 1].start_at);
            const hoursDiff = (current - previous) / (1000 * 60 * 60);
            recoveryTimes.push(hoursDiff);
        }
        
        return this.calculateAverage(recoveryTimes);
    }

    // Analyze fatigue pattern
    analyzeFatiguePattern(sessions) {
        const sortedSessions = sessions.sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
        const rpeValues = sortedSessions.map(session => session.averageRPE || 0);
        
        // Look for declining RPE over time (fatigue)
        const trend = this.calculateTrend(rpeValues);
        return {
            fatigueTrend: trend,
            isFatigued: trend < -0.1,
            fatigueLevel: Math.abs(trend)
        };
    }

    // Assess overtraining risk
    assessOvertrainingRisk(sessions) {
        const recentSessions = sessions.slice(-7); // Last 7 sessions
        const averageRPE = this.calculateAverage(recentSessions.map(s => s.averageRPE || 0));
        const sessionFrequency = this.calculateSessionFrequency(recentSessions);
        
        let riskScore = 0;
        
        // High RPE + High frequency = High risk
        if (averageRPE > 8) riskScore += 3;
        else if (averageRPE > 7) riskScore += 2;
        else if (averageRPE > 6) riskScore += 1;
        
        if (sessionFrequency > 6) riskScore += 3;
        else if (sessionFrequency > 4) riskScore += 2;
        else if (sessionFrequency > 2) riskScore += 1;
        
        return {
            riskScore,
            riskLevel: riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low',
            factors: {
                highIntensity: averageRPE > 7,
                highFrequency: sessionFrequency > 4,
                insufficientRecovery: this.calculateAverageRecoveryTime(recentSessions) < 24
            }
        };
    }

    // Calculate strength progression
    calculateStrengthProgression(sessions) {
        const exerciseStats = this.analyzeExercisePerformance(sessions);
        const progressions = Object.values(exerciseStats).map(stats => stats.progression);
        const averageProgression = this.calculateAverage(progressions);
        
        return {
            averageProgression,
            progressionLevel: averageProgression > 0.1 ? 'excellent' : 
                            averageProgression > 0.05 ? 'good' : 
                            averageProgression > 0 ? 'moderate' : 'poor'
        };
    }

    // Calculate volume progression
    calculateVolumeProgression(sessions) {
        const volumes = sessions.map(session => this.calculateSessionVolume(session));
        const trend = this.calculateTrend(volumes);
        
        return {
            trend,
            progressionLevel: trend > 0.1 ? 'increasing' : 
                            trend > -0.1 ? 'stable' : 'decreasing'
        };
    }

    // Calculate consistency progression
    calculateConsistencyProgression(sessions) {
        const consistency = this.calculateConsistency(sessions);
        
        return {
            consistency,
            consistencyLevel: consistency > 0.8 ? 'excellent' : 
                            consistency > 0.6 ? 'good' : 
                            consistency > 0.4 ? 'moderate' : 'poor'
        };
    }

    // Generate insights from patterns
    generateInsights() {
        this.insights = [];
        
        // Performance insights
        if (this.patterns.performance.dayOfWeek) {
            const bestDay = Object.entries(this.patterns.performance.dayOfWeek)
                .sort(([,a], [,b]) => b.averageRPE - a.averageRPE)[0];
            
            if (bestDay && bestDay[1].count > 0) {
                this.insights.push({
                    type: 'performance',
                    message: `You perform best on ${this.getDayName(bestDay[0])} with an average RPE of ${bestDay[1].averageRPE.toFixed(1)}`,
                    priority: 'medium'
                });
            }
        }
        
        // Timing insights
        if (this.patterns.timing.preferredTimes) {
            const preferredTime = this.patterns.timing.preferredTimes[0];
            if (preferredTime && preferredTime.count > 0) {
                this.insights.push({
                    type: 'timing',
                    message: `You prefer working out in the ${preferredTime.time} (${preferredTime.count} sessions)`,
                    priority: 'low'
                });
            }
        }
        
        // Volume insights
        if (this.patterns.volume.volumeTrend) {
            const trend = this.patterns.volume.volumeTrend;
            if (Math.abs(trend) > 0.1) {
                this.insights.push({
                    type: 'volume',
                    message: `Your training volume is ${trend > 0 ? 'increasing' : 'decreasing'} by ${Math.abs(trend * 100).toFixed(1)}%`,
                    priority: 'high'
                });
            }
        }
        
        // Recovery insights
        if (this.patterns.recovery.overtrainingRisk) {
            const risk = this.patterns.recovery.overtrainingRisk;
            if (risk.riskLevel === 'high') {
                this.insights.push({
                    type: 'recovery',
                    message: 'High risk of overtraining detected. Consider reducing intensity or frequency.',
                    priority: 'high'
                });
            }
        }
    }

    // Generate recommendations based on patterns
    generateRecommendations(userProfile) {
        this.recommendations = [];
        
        // Consistency recommendations
        if (this.patterns.performance.consistency < 0.6) {
            this.recommendations.push({
                type: 'consistency',
                message: 'Try to maintain a more consistent workout schedule',
                action: 'Set specific workout days and times'
            });
        }
        
        // Volume recommendations
        if (this.patterns.volume.volumeTrend < -0.1) {
            this.recommendations.push({
                type: 'volume',
                message: 'Consider gradually increasing your training volume',
                action: 'Add one more set or exercise to your workouts'
            });
        }
        
        // Recovery recommendations
        if (this.patterns.recovery.overtrainingRisk?.riskLevel === 'high') {
            this.recommendations.push({
                type: 'recovery',
                message: 'Take a deload week to allow for proper recovery',
                action: 'Reduce intensity by 20-30% for one week'
            });
        }
        
        // Progression recommendations
        if (this.patterns.progression.strengthProgression?.progressionLevel === 'poor') {
            this.recommendations.push({
                type: 'progression',
                message: 'Focus on progressive overload to continue improving',
                action: 'Increase weight or reps by 2-5% each week'
            });
        }
    }

    // Get day name from number
    getDayName(dayNumber) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayNumber];
    }

    // Get user patterns for display
    getUserPatterns() {
        return this.patterns;
    }

    // Get insights for display
    getUserInsights() {
        return this.insights;
    }

    // Get recommendations for display
    getUserRecommendations() {
        return this.recommendations;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PatternDetector };
} else {
    // Make available globally for browser
    window.PatternDetector = PatternDetector;
}
