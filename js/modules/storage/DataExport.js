/**
 * DataExport - Workout data export functionality
 * Exports workout history, progress metrics, and readiness scores as CSV/JSON
 */
class DataExport {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.authManager = window.AuthManager;
    }

    /**
     * Export user data in specified format
     * @param {string} format - Export format ('csv' or 'json')
     * @param {Object} options - Export options
     * @returns {Promise<void>} Download triggered
     */
    async exportData(format = 'csv', options = {}) {
        try {
            const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            const {
                includeSessions = true,
                includeReadiness = true,
                includeProgression = true,
                includeInjuryFlags = false,
                dateRange = null // { start: Date, end: Date }
            } = options;

            // Collect data
            const exportData = {
                metadata: {
                    userId,
                    exportDate: new Date().toISOString(),
                    appVersion: window.IF_swVersion || '1.0.0',
                    format
                },
                sessions: [],
                readiness: [],
                progression: [],
                injuryFlags: []
            };

            // Get session logs
            if (includeSessions) {
                exportData.sessions = this.getSessionLogs(userId, dateRange);
            }

            // Get readiness logs
            if (includeReadiness) {
                exportData.readiness = this.getReadinessLogs(userId, dateRange);
            }

            // Get progression events
            if (includeProgression) {
                exportData.progression = this.getProgressionEvents(userId, dateRange);
            }

            // Get injury flags
            if (includeInjuryFlags) {
                exportData.injuryFlags = this.getInjuryFlags(userId, dateRange);
            }

            // Generate and download file
            if (format === 'csv') {
                await this.downloadCSV(exportData, options);
            } else if (format === 'json') {
                await this.downloadJSON(exportData, options);
            } else {
                throw new Error(`Unsupported format: ${format}`);
            }

            this.logger.audit('DATA_EXPORTED', {
                userId,
                format,
                sessionsCount: exportData.sessions.length,
                readinessCount: exportData.readiness.length,
                progressionCount: exportData.progression.length
            });

        } catch (error) {
            this.logger.error('Failed to export data:', error);
            throw error;
        }
    }

    /**
     * Get session logs for user
     * @param {string} userId - User ID
     * @param {Object|null} dateRange - Date range filter
     * @returns {Array} Session logs
     */
    getSessionLogs(userId, dateRange = null) {
        try {
            const allLogs = this.storageManager.getSessionLogs();
            const userSessions = Object.values(allLogs)
                .filter(log => log.userId === userId)
                .map(log => ({
                    date: log.date,
                    duration: log.duration || log.totalDuration || null,
                    exercises: log.exercises || [],
                    exerciseCount: (log.exercises || []).length,
                    totalSets: this.calculateTotalSets(log.exercises || []),
                    totalVolume: this.calculateTotalVolume(log.exercises || []),
                    averageRPE: this.calculateAverageRPE(log.exercises || []),
                    workoutType: log.workoutType || log.type || null,
                    notes: log.notes || null,
                    completed: log.completed !== false,
                    updatedAt: log.updatedAt
                }))
                .filter(log => this.isInDateRange(log.date, dateRange))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            return userSessions;
        } catch (error) {
            this.logger.error('Failed to get session logs:', error);
            return [];
        }
    }

    /**
     * Get readiness logs for user
     * @param {string} userId - User ID
     * @param {Object|null} dateRange - Date range filter
     * @returns {Array} Readiness logs
     */
    getReadinessLogs(userId, dateRange = null) {
        try {
            const allLogs = this.storageManager.getReadinessLogs();
            const userReadiness = Object.values(allLogs)
                .filter(log => log.userId === userId)
                .map(log => ({
                    date: log.date,
                    readinessScore: log.readinessScore || log.score || null,
                    sleepHours: log.sleepHours || null,
                    sleepQuality: log.sleepQuality || null,
                    stressLevel: log.stressLevel || null,
                    energyLevel: log.energyLevel || null,
                    sorenessLevel: log.sorenessLevel || null,
                    notes: log.notes || null,
                    updatedAt: log.updatedAt
                }))
                .filter(log => this.isInDateRange(log.date, dateRange))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            return userReadiness;
        } catch (error) {
            this.logger.error('Failed to get readiness logs:', error);
            return [];
        }
    }

    /**
     * Get progression events for user
     * @param {string} userId - User ID
     * @param {Object|null} dateRange - Date range filter
     * @returns {Array} Progression events
     */
    getProgressionEvents(userId, dateRange = null) {
        try {
            const allEvents = this.storageManager.getProgressionEvents();
            const userEvents = Object.values(allEvents)
                .filter(event => event.userId === userId)
                .map(event => ({
                    date: event.date,
                    type: event.type || null,
                    exercise: event.exercise || event.exerciseName || null,
                    weight: event.weight || null,
                    reps: event.reps || null,
                    sets: event.sets || null,
                    rpe: event.rpe || null,
                    notes: event.notes || event.rationale || null,
                    updatedAt: event.updatedAt
                }))
                .filter(event => this.isInDateRange(event.date, dateRange))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            return userEvents;
        } catch (error) {
            this.logger.error('Failed to get progression events:', error);
            return [];
        }
    }

    /**
     * Get injury flags for user
     * @param {string} userId - User ID
     * @param {Object|null} dateRange - Date range filter
     * @returns {Array} Injury flags
     */
    getInjuryFlags(userId, dateRange = null) {
        try {
            const allFlags = this.storageManager.getInjuryFlags();
            const userFlags = Object.values(allFlags)
                .filter(flag => flag.userId === userId)
                .map(flag => ({
                    date: flag.date,
                    bodyPart: flag.bodyPart || flag.region || null,
                    severity: flag.severity || null,
                    notes: flag.notes || flag.description || null,
                    resolved: flag.resolved || false,
                    updatedAt: flag.updatedAt
                }))
                .filter(flag => this.isInDateRange(flag.date, dateRange))
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            return userFlags;
        } catch (error) {
            this.logger.error('Failed to get injury flags:', error);
            return [];
        }
    }

    /**
     * Check if date is in date range
     * @param {string|Date} date - Date to check
     * @param {Object|null} dateRange - Date range
     * @returns {boolean} Is in range
     */
    isInDateRange(date, dateRange) {
        if (!dateRange) {return true;}

        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);

        if (dateRange.start) {
            const start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
            if (checkDate < start) {return false;}
        }

        if (dateRange.end) {
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);
            if (checkDate > end) {return false;}
        }

        return true;
    }

    /**
     * Calculate total sets from exercises
     * @param {Array} exercises - Exercise array
     * @returns {number} Total sets
     */
    calculateTotalSets(exercises) {
        if (!Array.isArray(exercises)) {return 0;}

        return exercises.reduce((total, ex) => {
            if (Array.isArray(ex.sets)) {
                return total + ex.sets.length;
            }
            return total + (ex.sets || 0);
        }, 0);
    }

    /**
     * Calculate total volume (sets × reps × weight)
     * @param {Array} exercises - Exercise array
     * @returns {number} Total volume
     */
    calculateTotalVolume(exercises) {
        if (!Array.isArray(exercises)) {return 0;}

        return exercises.reduce((total, ex) => {
            const sets = Array.isArray(ex.sets) ? ex.sets : [{ weight: 0, reps: 0 }];

            return total + sets.reduce((exTotal, set) => {
                const weight = set.weight || set.targetWeight || 0;
                const reps = set.reps || set.targetReps || 0;
                return exTotal + (weight * reps);
            }, 0);
        }, 0);
    }

    /**
     * Calculate average RPE from exercises
     * @param {Array} exercises - Exercise array
     * @returns {number|null} Average RPE
     */
    calculateAverageRPE(exercises) {
        if (!Array.isArray(exercises)) {return null;}

        const rpeValues = exercises.reduce((rpes, ex) => {
            if (ex.rpe) {rpes.push(ex.rpe);}
            if (Array.isArray(ex.sets)) {
                ex.sets.forEach(set => {
                    if (set.rpe) {rpes.push(set.rpe);}
                });
            }
            return rpes;
        }, []);

        if (rpeValues.length === 0) {return null;}

        const sum = rpeValues.reduce((total, rpe) => total + rpe, 0);
        return Math.round((sum / rpeValues.length) * 10) / 10;
    }

    /**
     * Download data as CSV
     * @param {Object} exportData - Export data
     * @param {Object} options - Export options
     */
    async downloadCSV(exportData, options = {}) {
        const timestamp = new Date().toISOString().split('T')[0];
        let csvContent = '';

        // Add metadata
        csvContent += '# IgniteFitness Data Export\n';
        csvContent += `# Export Date: ${exportData.metadata.exportDate}\n`;
        csvContent += `# User ID: ${exportData.metadata.userId}\n`;
        csvContent += '# Format: CSV\n\n';

        // Sessions CSV
        if (exportData.sessions.length > 0) {
            csvContent += '# Workout Sessions\n';
            csvContent += this.convertToCSV(exportData.sessions, [
                'date', 'duration', 'exerciseCount', 'totalSets', 'totalVolume', 'averageRPE', 'workoutType', 'notes'
            ]);
            csvContent += '\n';
        }

        // Readiness CSV
        if (exportData.readiness.length > 0) {
            csvContent += '# Readiness Scores\n';
            csvContent += this.convertToCSV(exportData.readiness, [
                'date', 'readinessScore', 'sleepHours', 'sleepQuality', 'stressLevel', 'energyLevel', 'sorenessLevel', 'notes'
            ]);
            csvContent += '\n';
        }

        // Progression CSV
        if (exportData.progression.length > 0) {
            csvContent += '# Progression Events\n';
            csvContent += this.convertToCSV(exportData.progression, [
                'date', 'type', 'exercise', 'weight', 'reps', 'sets', 'rpe', 'notes'
            ]);
            csvContent += '\n';
        }

        // Injury flags CSV
        if (exportData.injuryFlags.length > 0) {
            csvContent += '# Injury Flags\n';
            csvContent += this.convertToCSV(exportData.injuryFlags, [
                'date', 'bodyPart', 'severity', 'resolved', 'notes'
            ]);
            csvContent += '\n';
        }

        // Download
        this.downloadFile(csvContent, `ignite-fitness-export-${timestamp}.csv`, 'text/csv');
    }

    /**
     * Download data as JSON
     * @param {Object} exportData - Export data
     * @param {Object} options - Export options
     */
    async downloadJSON(exportData, options = {}) {
        const timestamp = new Date().toISOString().split('T')[0];
        const jsonContent = JSON.stringify(exportData, null, 2);

        // Download
        this.downloadFile(jsonContent, `ignite-fitness-export-${timestamp}.json`, 'application/json');
    }

    /**
     * Convert array of objects to CSV
     * @param {Array} data - Data array
     * @param {Array} columns - Column names
     * @returns {string} CSV string
     */
    convertToCSV(data, columns) {
        if (!data || data.length === 0) {return '';}

        // CSV header
        const header = columns.join(',');

        // CSV rows
        const rows = data.map(row => {
            return columns.map(col => {
                const value = row[col];

                // Handle null/undefined
                if (value === null || value === undefined) {return '';}

                // Handle arrays/objects
                if (Array.isArray(value) || typeof value === 'object') {
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                }

                // Handle strings with quotes or commas
                const stringValue = String(value);
                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }

                return stringValue;
            }).join(',');
        });

        return `${[header, ...rows].join('\n') }\n`;
    }

    /**
     * Download file to user's device
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} mimeType - MIME type
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * Export specific data type
     * @param {string} dataType - Data type ('sessions', 'readiness', 'progression', 'all')
     * @param {string} format - Export format ('csv' or 'json')
     * @param {Object} options - Export options
     */
    async exportDataType(dataType, format = 'csv', options = {}) {
        const exportOptions = {
            includeSessions: dataType === 'sessions' || dataType === 'all',
            includeReadiness: dataType === 'readiness' || dataType === 'all',
            includeProgression: dataType === 'progression' || dataType === 'all',
            includeInjuryFlags: dataType === 'injuryFlags' || dataType === 'all',
            ...options
        };

        return this.exportData(format, exportOptions);
    }

    /**
     * Get export summary (preview before export)
     * @param {Object} options - Export options
     * @returns {Promise<Object>} Export summary
     */
    async getExportSummary(options = {}) {
        try {
            const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
            if (!userId) {
                throw new Error('User not authenticated');
            }

            const {
                includeSessions = true,
                includeReadiness = true,
                includeProgression = true,
                includeInjuryFlags = false,
                dateRange = null
            } = options;

            const summary = {
                userId,
                dateRange,
                sessions: includeSessions ? this.getSessionLogs(userId, dateRange).length : 0,
                readiness: includeReadiness ? this.getReadinessLogs(userId, dateRange).length : 0,
                progression: includeProgression ? this.getProgressionEvents(userId, dateRange).length : 0,
                injuryFlags: includeInjuryFlags ? this.getInjuryFlags(userId, dateRange).length : 0,
                totalRecords: 0,
                estimatedSize: 'Unknown'
            };

            summary.totalRecords = summary.sessions + summary.readiness + summary.progression + summary.injuryFlags;

            // Estimate file size (rough calculation)
            const avgRecordSize = 200; // bytes per record
            summary.estimatedSize = `${(summary.totalRecords * avgRecordSize / 1024).toFixed(1)} KB`;

            return summary;
        } catch (error) {
            this.logger.error('Failed to get export summary:', error);
            throw error;
        }
    }
}

// Create global instance
window.DataExport = new DataExport();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataExport;
}
