/**
 * InjuryCheck - Pain tracking and safe modifications
 * Educational only - no diagnosis, suggests safe alternatives
 */
class InjuryCheck {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.eventBus = window.EventBus;
        this.storageManager = window.StorageManager;
        this.correctiveExercises = window.CorrectiveExercises;

        this.activeModals = new Map();
        this.painReports = [];
    }

    /**
     * Show pain assessment modal during workout
     * @param {string} exerciseName - Current exercise
     * @param {string} bodyLocation - Body part in question
     * @returns {Promise<Object>} Assessment result
     */
    async showPainAssessment(exerciseName, bodyLocation) {
        return new Promise((resolve) => {
            const modal = this.createPainModal(exerciseName, bodyLocation, (result) => {
                this.handlePainReport(result, exerciseName);
                resolve(result);
            });

            document.body.appendChild(modal);
            this.activeModals.set(bodyLocation, modal);
        });
    }

    /**
     * Create pain assessment modal
     * @param {string} exerciseName - Exercise name
     * @param {string} bodyLocation - Body location
     * @param {Function} callback - Result callback
     * @returns {HTMLElement} Modal element
     */
    createPainModal(exerciseName, bodyLocation, callback) {
        const modal = document.createElement('div');
        modal.className = 'pain-assessment-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.pain-assessment-modal').remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Pain Assessment</h2>
                    <button class="modal-close" onclick="this.closest('.pain-assessment-modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p><strong>Exercise:</strong> ${exerciseName}</p>
                    <p><strong>Location:</strong> ${bodyLocation}</p>
                    
                    <div class="pain-scale">
                        <label>Pain Level (1-10):</label>
                        <input type="range" id="pain-level" min="1" max="10" value="5">
                        <div class="pain-value" id="pain-value">5</div>
                    </div>
                    
                    <div class="pain-description">
                        <label>Describe the pain:</label>
                        <select id="pain-type">
                            <option value="sharp">Sharp</option>
                            <option value="dull">Dull</option>
                            <option value="burning">Burning</option>
                            <option value="aching">Aching</option>
                            <option value="stiff">Stiff</option>
                        </select>
                    </div>
                    
                    <div class="educational-note">
                        <p><strong>⚠️ Important:</strong> This is not a medical diagnosis. 
                        We provide exercise modifications only. Consult a healthcare professional for medical concerns.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.pain-assessment-modal').remove()">Cancel</button>
                    <button class="btn-primary" onclick="handlePainAssessment()">Submit</button>
                </div>
            </div>
        `;

        // Add event listeners
        const slider = modal.querySelector('#pain-level');
        const valueDisplay = modal.querySelector('#pain-value');

        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value;
        });

        // Handle submission
        window.handlePainAssessment = () => {
            const painLevel = parseInt(modal.querySelector('#pain-level').value);
            const painType = modal.querySelector('#pain-type').value;

            const result = {
                exerciseName,
                bodyLocation,
                painLevel,
                painType,
                timestamp: new Date().toISOString(),
                suggestions: this.getSafeModifications(bodyLocation, painLevel)
            };

            modal.remove();
            callback(result);
        };

        return modal;
    }

    /**
     * Get safe modifications based on pain location and severity
     * @param {string} bodyLocation - Body location
     * @param {number} painLevel - Pain level (1-10)
     * @returns {Object} Safe modifications
     */
    getSafeModifications(bodyLocation, painLevel) {
        const location = bodyLocation.toLowerCase();
        const rules = {
            knee: {
                high: { // pain 7-10
                    modifications: ['Avoid deep squats', 'Use goblet squat', 'Add hip stretches'],
                    alternatives: ['Goblet Squat', 'Box Squat', 'Leg Press'],
                    correctiveExercises: ['hip_strengthening', 'glute_activation', 'VMO_strengthening'],
                    message: 'For knee discomfort, try lighter loads and focus on hip and glute strengthening.'
                },
                moderate: { // pain 4-6
                    modifications: ['Reduce depth', 'Lighter load', 'Focus on form'],
                    alternatives: ['Box Squat', 'Goblet Squat'],
                    correctiveExercises: ['hip_strengthening'],
                    message: 'Consider reducing squat depth and load for knee comfort.'
                },
                low: { // pain 1-3
                    modifications: ['Warm up thoroughly', 'Focus on form'],
                    alternatives: [],
                    correctiveExercises: ['hip_strengthening'],
                    message: 'Light discomfort may improve with proper warm-up.'
                }
            },
            'low back': {
                high: {
                    modifications: ['Avoid forward flexion', 'Use cat-cow stretch', 'Reduce load'],
                    alternatives: ['Cat-Cow Mobility', 'Lighter RDL', 'Romanian Deadlift'],
                    correctiveExercises: ['cat_cow', 'mobility_work'],
                    message: 'For low back discomfort, avoid excessive spinal loading and focus on mobility.'
                },
                moderate: {
                    modifications: ['Reduce weight', 'Focus on neutral spine', 'Add breaks'],
                    alternatives: ['Lighter RDL', 'Good Mornings'],
                    correctiveExercises: ['cat_cow', 'mobility_work'],
                    message: 'Reduce load and maintain neutral spine alignment.'
                },
                low: {
                    modifications: ['Ensure warm-up', 'Check form'],
                    alternatives: [],
                    correctiveExercises: [],
                    message: 'Ensure proper warm-up and neutral spine alignment.'
                }
            },
            shoulder: {
                high: {
                    modifications: ['Reduce overhead work', 'Band external rotations', 'Focus on form'],
                    alternatives: ['Band External Rotations', 'Wall Slides', 'Face Pulls'],
                    correctiveExercises: ['band_external_rotations', 'shoulder_mobility'],
                    message: 'For shoulder discomfort, avoid overhead movements and focus on posterior delt work.'
                },
                moderate: {
                    modifications: ['Reduce range of motion', 'Lighter loads', 'Band work'],
                    alternatives: ['Incline Bench', 'Band External Rotations'],
                    correctiveExercises: ['band_external_rotations'],
                    message: 'Reduce overhead range of motion and incorporate shoulder stability work.'
                },
                low: {
                    modifications: ['Warm up rotators', 'Focus on form'],
                    alternatives: [],
                    correctiveExercises: ['band_external_rotations'],
                    message: 'Ensure proper warm-up of rotator cuff before overhead work.'
                }
            }
        };

        const specificRules = rules[location];
        if (!specificRules) {
            return {
                modifications: ['Reduce intensity', 'Stop if pain increases'],
                alternatives: [],
                correctiveExercises: [],
                message: 'If pain persists or increases, reduce intensity or stop the exercise.'
            };
        }

        // Determine severity category
        let category;
        if (painLevel >= 7) {category = 'high';}
        else if (painLevel >= 4) {category = 'moderate';}
        else {category = 'low';}

        const rule = specificRules[category];

        return {
            category,
            ...rule,
            educationalNote: '⚠️ These are exercise suggestions only, not medical advice. Consult a healthcare professional if pain persists.'
        };
    }

    /**
     * Handle pain report and log to injury_flags
     * @param {Object} painData - Pain assessment data
     * @param {string} exerciseName - Exercise name
     */
    async handlePainReport(painData, exerciseName) {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();

            if (!userId) {
                this.logger.warn('No user ID for pain report');
                return;
            }

            const date = new Date().toISOString().split('T')[0];
            const painReport = {
                userId,
                date,
                exerciseName,
                bodyLocation: painData.bodyLocation,
                painLevel: painData.painLevel,
                painType: painData.painType,
                suggestions: painData.suggestions,
                timestamp: painData.timestamp
            };

            // Save to injury_flags
            await this.storageManager.saveInjuryFlag(userId, date, painReport);

            // Store in local array for quick access
            this.painReports.push(painReport);

            // Emit event
            this.eventBus.emit('injury:pain_reported', painReport);

            this.logger.audit('PAIN_REPORT_LOGGED', painReport);
        } catch (error) {
            this.logger.error('Failed to handle pain report', error);
        }
    }

    /**
     * Get pain history for user
     * @param {string} userId - User ID
     * @returns {Array} Pain history
     */
    getPainHistory(userId) {
        try {
            const flags = this.storageManager.getInjuryFlags();
            return Object.values(flags).filter(flag => flag.userId === userId);
        } catch (error) {
            this.logger.error('Failed to get pain history', error);
            return [];
        }
    }

    /**
     * Check if exercise should be modified based on pain history
     * @param {string} exerciseName - Exercise name
     * @returns {Object|null} Modification recommendation
     */
    checkExerciseModifications(exerciseName) {
        const authManager = window.AuthManager;
        const userId = authManager?.getCurrentUsername();

        if (!userId) {return null;}

        const recentPain = this.painReports.find(report =>
            report.exerciseName === exerciseName &&
            new Date(report.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        );

        if (recentPain && recentPain.painLevel >= 5) {
            return recentPain.suggestions;
        }

        return null;
    }
}

// Create global instance
window.InjuryCheck = new InjuryCheck();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InjuryCheck;
}
