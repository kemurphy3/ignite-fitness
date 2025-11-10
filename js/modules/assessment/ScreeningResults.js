/**
 * ScreeningResults - Movement screening results tracking and analysis
 * Manages screening history, trends, and insights
 */
class ScreeningResults {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.results = this.loadResults();
        this.insights = this.initializeInsights();
    }

    /**
     * Load screening results from storage
     * @returns {Array} Screening results
     */
    loadResults() {
        try {
            const stored = localStorage.getItem('ignitefitness_screening_results');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            this.logger.error('Failed to load screening results', error);
            return [];
        }
    }

    /**
     * Initialize insights engine
     * @returns {Object} Insights system
     */
    initializeInsights() {
        return {
            patternDetector: this.detectPatterns.bind(this),
            riskCalculator: this.calculateRisk.bind(this),
            progressTracker: this.trackProgress.bind(this),
            recommendationEngine: this.generateInsights.bind(this)
        };
    }

    /**
     * Save screening result
     * @param {Object} result - Screening result
     * @returns {Object} Saved result
     */
    saveResult(result) {
        result.id = this.generateId();
        result.savedAt = new Date().toISOString();

        this.results.push(result);
        this.saveToStorage();

        // Generate insights
        const insights = this.generateInsights(result);

        this.logger.audit('SCREENING_RESULT_SAVED', {
            resultId: result.id,
            screenId: result.screenId,
            userId: result.userProfile?.userId
        });

        return {
            result,
            insights
        };
    }

    /**
     * Get results for user
     * @param {string} userId - User ID
     * @returns {Array} User results
     */
    getUserResults(userId) {
        return this.results.filter(result =>
            result.userProfile?.userId === userId
        ).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    }

    /**
     * Get latest results for screen
     * @param {string} screenId - Screen ID
     * @param {string} userId - User ID
     * @returns {Object|null} Latest result
     */
    getLatestResult(screenId, userId) {
        const userResults = this.getUserResults(userId);
        const screenResults = userResults.filter(r => r.screenId === screenId);

        return screenResults.length > 0 ? screenResults[0] : null;
    }

    /**
     * Get results for date range
     * @param {string} userId - User ID
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Results in date range
     */
    getResultsForDateRange(userId, startDate, endDate) {
        return this.getUserResults(userId).filter(result => {
            const resultDate = new Date(result.savedAt);
            return resultDate >= startDate && resultDate <= endDate;
        });
    }

    /**
     * Detect patterns in results
     * @param {Array} results - Results to analyze
     * @returns {Object} Pattern analysis
     */
    detectPatterns(results) {
        if (results.length === 0) {
            return { available: false, message: 'No results to analyze' };
        }

        const patterns = {
            recurringIssues: [],
            improvementAreas: [],
            deteriorationAreas: [],
            asymmetries: []
        };

        // Analyze for recurring issues
        const issueFrequency = {};
        results.forEach(result => {
            if (result.observations) {
                Object.values(result.observations).forEach(obs => {
                    if (obs.compensation) {
                        issueFrequency[obs.compensation] = (issueFrequency[obs.compensation] || 0) + 1;
                    }
                });
            }
        });

        // Identify recurring issues (appearing in 50%+ of screens)
        Object.entries(issueFrequency).forEach(([issue, count]) => {
            if (count / results.length >= 0.5) {
                patterns.recurringIssues.push({
                    issue,
                    frequency: count / results.length,
                    priority: 'high'
                });
            }
        });

        return patterns;
    }

    /**
     * Calculate injury risk from results
     * @param {Array} results - Recent results
     * @returns {Object} Risk assessment
     */
    calculateRisk(results) {
        if (results.length === 0) {
            return { riskLevel: 'unknown', score: 0, factors: [] };
        }

        const factors = [];
        let riskScore = 0;

        // Analyze movement quality
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        if (avgScore < 2) {
            factors.push('low_movement_quality');
            riskScore += 3;
        }

        // Check for asymmetries
        const asymmetryCount = results.filter(r =>
            r.observations && Object.values(r.observations).some(obs => obs.asymmetry)
        ).length;

        if (asymmetryCount / results.length > 0.3) {
            factors.push('significant_asymmetries');
            riskScore += 2;
        }

        // Check for major compensations
        const majorCompCount = results.filter(r =>
            r.observations && Object.values(r.observations).some(obs =>
                obs.compensation === 'major'
            )
        ).length;

        if (majorCompCount > 0) {
            factors.push('major_compensations_present');
            riskScore += 3;
        }

        // Determine risk level
        let riskLevel = 'low';
        if (riskScore >= 7) {riskLevel = 'very_high';}
        else if (riskScore >= 5) {riskLevel = 'high';}
        else if (riskScore >= 3) {riskLevel = 'moderate';}
        else if (riskScore >= 1) {riskLevel = 'low_moderate';}

        return {
            riskLevel,
            score: riskScore,
            factors,
            recommendations: this.generateRiskRecommendations(riskLevel, factors)
        };
    }

    /**
     * Track progress over time
     * @param {string} screenId - Screen ID
     * @param {string} userId - User ID
     * @returns {Object} Progress analysis
     */
    trackProgress(screenId, userId) {
        const userResults = this.getUserResults(userId);
        const screenResults = userResults.filter(r => r.screenId === screenId);

        if (screenResults.length < 2) {
            return { available: false, message: 'Insufficient data for progress tracking' };
        }

        const scores = screenResults.map(r => r.score);
        const firstScore = scores[0];
        const latestScore = scores[scores.length - 1];
        const improvement = latestScore - firstScore;

        return {
            available: true,
            trend: this.calculateTrend(scores),
            improvement,
            latestScore,
            firstScore,
            progressPercentage: ((improvement / 3) * 100).toFixed(1),
            recommendations: this.generateProgressRecommendations(improvement)
        };
    }

    /**
     * Calculate trend from scores
     * @param {Array} scores - Score history
     * @returns {string} Trend
     */
    calculateTrend(scores) {
        if (scores.length < 2) {return 'insufficient_data';}

        const recentScores = scores.slice(-3);
        const latest = recentScores[recentScores.length - 1];
        const previous = recentScores[0];

        if (latest > previous) {return 'improving';}
        if (latest < previous) {return 'declining';}
        return 'stable';
    }

    /**
     * Generate insights from result
     * @param {Object} result - Screening result
     * @returns {Object} Generated insights
     */
    generateInsights(result) {
        const insights = {
            immediate: [],
            shortTerm: [],
            longTerm: []
        };

        // Immediate insights based on score
        if (result.score <= 1) {
            insights.immediate.push({
                type: 'warning',
                message: 'Movement quality significantly compromised. Consider reducing training load.',
                priority: 'high'
            });
        } else if (result.score === 2) {
            insights.immediate.push({
                type: 'caution',
                message: 'Minor movement issues detected. Incorporate corrective exercises.',
                priority: 'medium'
            });
        } else {
            insights.immediate.push({
                type: 'positive',
                message: 'Excellent movement quality. Maintain current training approach.',
                priority: 'low'
            });
        }

        // Short-term insights based on compensatory patterns
        if (result.observations) {
            const compensations = [];
            Object.values(result.observations).forEach(obs => {
                if (obs.compensation) {
                    compensations.push(obs.compensation);
                }
            });

            if (compensations.length > 0) {
                insights.shortTerm.push({
                    type: 'action',
                    message: `Address ${compensations.join(', ')} through targeted corrective exercises.`,
                    exercises: result.correctiveExercises,
                    priority: 'high'
                });
            }
        }

        return insights;
    }

    /**
     * Generate risk recommendations
     * @param {string} riskLevel - Risk level
     * @param {Array} factors - Risk factors
     * @returns {Array} Recommendations
     */
    generateRiskRecommendations(riskLevel, factors) {
        const recommendations = [];

        if (riskLevel === 'very_high' || riskLevel === 'high') {
            recommendations.push({
                type: 'reduction',
                message: 'Significant injury risk detected. Implement comprehensive corrective program immediately.',
                priority: 'critical',
                actions: [
                    'Reduce training load significantly',
                    'Focus on corrective exercises',
                    'Consider professional consultation',
                    'Increase recovery time'
                ]
            });
        }

        if (factors.includes('low_movement_quality')) {
            recommendations.push({
                type: 'improvement',
                message: 'Movement quality needs improvement before progressing training load.',
                priority: 'high',
                actions: [
                    'Focus on fundamental movement patterns',
                    'Incorporate mobility work',
                    'Progress gradually'
                ]
            });
        }

        if (factors.includes('significant_asymmetries')) {
            recommendations.push({
                type: 'correction',
                message: 'Significant asymmetries detected. Implement single-sided corrective work.',
                priority: 'high',
                actions: [
                    'Single-leg strengthening',
                    'Unilateral corrective exercises',
                    'Address dominant side imbalances'
                ]
            });
        }

        return recommendations;
    }

    /**
     * Generate progress recommendations
     * @param {number} improvement - Improvement score
     * @returns {Array} Recommendations
     */
    generateProgressRecommendations(improvement) {
        const recommendations = [];

        if (improvement > 0) {
            recommendations.push({
                type: 'positive',
                message: 'Excellent progress! Continue current corrective approach.',
                priority: 'low'
            });
        } else if (improvement === 0) {
            recommendations.push({
                type: 'maintenance',
                message: 'Maintaining movement quality. Continue monitoring and adjust as needed.',
                priority: 'low'
            });
        } else {
            recommendations.push({
                type: 'attention',
                message: 'Movement quality declining. Review and adjust corrective program.',
                priority: 'high'
            });
        }

        return recommendations;
    }

    /**
     * Get summary for user
     * @param {string} userId - User ID
     * @returns {Object} User summary
     */
    getUserSummary(userId) {
        const userResults = this.getUserResults(userId);

        if (userResults.length === 0) {
            return {
                available: false,
                message: 'No screening data available'
            };
        }

        const summary = {
            available: true,
            totalScreens: userResults.length,
            screensPerformed: [...new Set(userResults.map(r => r.screenId))].length,
            latestScore: userResults[0].score,
            averageScore: userResults.reduce((sum, r) => sum + r.score, 0) / userResults.length,
            patterns: this.detectPatterns(userResults),
            riskAssessment: this.calculateRisk(userResults.slice(0, 5)), // Last 5 screens
            trends: this.calculateOverallTrends(userResults)
        };

        return summary;
    }

    /**
     * Calculate overall trends
     * @param {Array} results - User results
     * @returns {Object} Trends
     */
    calculateOverallTrends(results) {
        if (results.length < 2) {
            return { available: false };
        }

        const latestScores = results.slice(0, 3).map(r => r.score);
        const trend = this.calculateTrend(latestScores);

        return {
            available: true,
            direction: trend,
            latestScore: latestScores[latestScores.length - 1],
            averageRecentScore: latestScores.reduce((a, b) => a + b, 0) / latestScores.length
        };
    }

    /**
     * Compare results
     * @param {string} resultId1 - First result ID
     * @param {string} resultId2 - Second result ID
     * @returns {Object} Comparison
     */
    compareResults(resultId1, resultId2) {
        const result1 = this.results.find(r => r.id === resultId1);
        const result2 = this.results.find(r => r.id === resultId2);

        if (!result1 || !result2) {
            return { available: false, message: 'One or both results not found' };
        }

        return {
            available: true,
            scoreChange: result2.score - result1.score,
            timeDifference: new Date(result2.savedAt) - new Date(result1.savedAt),
            improvementAreas: this.identifyImprovementAreas(result1, result2),
            deteriorationAreas: this.identifyDeteriorationAreas(result1, result2)
        };
    }

    /**
     * Identify improvement areas between results
     * @param {Object} earlierResult - Earlier result
     * @param {Object} laterResult - Later result
     * @returns {Array} Improvement areas
     */
    identifyImprovementAreas(earlierResult, laterResult) {
        const improvements = [];

        // Check if score improved
        if (laterResult.score > earlierResult.score) {
            improvements.push('overall_movement_quality');
        }

        // Check for reduced compensations
        if (earlierResult.observations && laterResult.observations) {
            const earlierComps = this.getCompensations(earlierResult.observations);
            const laterComps = this.getCompensations(laterResult.observations);

            earlierComps.forEach(comp => {
                if (!laterComps.includes(comp)) {
                    improvements.push(`${comp}_resolved`);
                }
            });
        }

        return improvements;
    }

    /**
     * Identify deterioration areas between results
     * @param {Object} earlierResult - Earlier result
     * @param {Object} laterResult - Later result
     * @returns {Array} Deterioration areas
     */
    identifyDeteriorationAreas(earlierResult, laterResult) {
        const deteriorations = [];

        // Check if score declined
        if (laterResult.score < earlierResult.score) {
            deteriorations.push('overall_movement_quality');
        }

        // Check for new compensations
        if (earlierResult.observations && laterResult.observations) {
            const earlierComps = this.getCompensations(earlierResult.observations);
            const laterComps = this.getCompensations(laterResult.observations);

            laterComps.forEach(comp => {
                if (!earlierComps.includes(comp)) {
                    deteriorations.push(`${comp}_emerged`);
                }
            });
        }

        return deteriorations;
    }

    /**
     * Get compensations from observations
     * @param {Object} observations - Observations
     * @returns {Array} Compensations
     */
    getCompensations(observations) {
        const compensations = [];
        Object.values(observations).forEach(obs => {
            if (obs.compensation) {
                compensations.push(obs.compensation);
            }
        });
        return compensations;
    }

    /**
     * Save to storage
     */
    saveToStorage() {
        try {
            localStorage.setItem('ignitefitness_screening_results', JSON.stringify(this.results));
        } catch (error) {
            this.logger.error('Failed to save screening results', error);
        }
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export results for analysis
     * @param {string} userId - User ID
     * @returns {Object} Exportable data
     */
    exportResults(userId) {
        const userResults = this.getUserResults(userId);

        return {
            userId,
            exportDate: new Date().toISOString(),
            totalResults: userResults.length,
            results: userResults,
            summary: this.getUserSummary(userId)
        };
    }
}

// Create global instance
window.ScreeningResults = new ScreeningResults();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScreeningResults;
}
