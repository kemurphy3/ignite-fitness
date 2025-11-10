/**
 * EquipmentAccess - Equipment and facility access step
 * Collects available equipment and training facilities
 */

class EquipmentAccess extends window.BaseComponent {
    constructor() {
        super();
        this.availableEquipment = new Set();
        this.timePreferences = {
            typicalDuration: 60,
            preferredTimes: [],
            trainingDaysPerWeek: 4
        };
    }

    /**
     * Render equipment access step
     * @param {Object} onboardingData - Current onboarding data
     * @returns {string} HTML for step
     */
    render(onboardingData = {}) {
        this.onboardingData = onboardingData;
        this.availableEquipment = new Set(onboardingData.equipment || []);
        this.timePreferences = onboardingData.timePreferences || this.timePreferences;

        return `
            <div class="onboarding-step equipment-access-step">
                <div class="step-header">
                    <h2>Equipment & Facility Access</h2>
                    <p>What do you have available for training?</p>
                </div>

                <div class="equipment-categories">
                    <div class="category">
                        <h3>🏃‍♂️ Running</h3>
                        <div class="equipment-grid">
                            ${this.renderEquipmentCheckbox('outdoor_roads', 'Outdoor roads/paths')}
                            ${this.renderEquipmentCheckbox('track', 'Athletic track')}
                            ${this.renderEquipmentCheckbox('trails', 'Trail access')}
                            ${this.renderEquipmentCheckbox('hills', 'Hills (6%+ grade)')}
                            ${this.renderEquipmentCheckbox('treadmill', 'Treadmill')}
                            ${this.renderEquipmentCheckbox('soccer_field', 'Soccer field')}
                        </div>
                    </div>

                    <div class="category">
                        <h3>🚴‍♂️ Cycling</h3>
                        <div class="equipment-grid">
                            ${this.renderEquipmentCheckbox('road_bike', 'Road bike')}
                            ${this.renderEquipmentCheckbox('gravel_bike', 'Gravel/CX bike')}
                            ${this.renderEquipmentCheckbox('mountain_bike', 'Mountain bike')}
                            ${this.renderEquipmentCheckbox('indoor_trainer', 'Indoor trainer')}
                            ${this.renderEquipmentCheckbox('power_meter', 'Power meter')}
                            ${this.renderEquipmentCheckbox('safe_roads', 'Safe cycling roads')}
                        </div>
                    </div>

                    <div class="category">
                        <h3>🏊‍♂️ Swimming</h3>
                        <div class="equipment-grid">
                            ${this.renderEquipmentCheckbox('pool_25m', '25m pool')}
                            ${this.renderEquipmentCheckbox('pool_50m', '50m pool')}
                            ${this.renderEquipmentCheckbox('open_water', 'Open water access')}
                            ${this.renderEquipmentCheckbox('lane_swimming', 'Lap swimming lanes')}
                            ${this.renderEquipmentCheckbox('pool_toys', 'Kickboard/pull buoy')}
                        </div>
                    </div>

                    <div class="category">
                        <h3>💪 Strength & Other</h3>
                        <div class="equipment-grid">
                            ${this.renderEquipmentCheckbox('gym_access', 'Gym membership')}
                            ${this.renderEquipmentCheckbox('home_weights', 'Home weights')}
                            ${this.renderEquipmentCheckbox('bodyweight_space', 'Bodyweight exercise space')}
                            ${this.renderEquipmentCheckbox('resistance_bands', 'Resistance bands')}
                            ${this.renderEquipmentCheckbox('yoga_mat', 'Yoga/exercise mat')}
                        </div>
                    </div>
                </div>

                <div class="time-constraints">
                    <h3>⏰ Time Availability</h3>
                    <div class="time-slots">
                        <div class="time-slot">
                            <label for="typical_duration">Typical workout duration:</label>
                            <select id="typical_duration" name="typical_duration" onchange="window.EquipmentAccess.updateTimePreference('typicalDuration', this.value)">
                                <option value="30" ${this.timePreferences.typicalDuration === 30 ? 'selected' : ''}>30 minutes or less</option>
                                <option value="45" ${this.timePreferences.typicalDuration === 45 ? 'selected' : ''}>30-45 minutes</option>
                                <option value="60" ${this.timePreferences.typicalDuration === 60 ? 'selected' : ''}>45-60 minutes</option>
                                <option value="90" ${this.timePreferences.typicalDuration === 90 ? 'selected' : ''}>60-90 minutes</option>
                                <option value="120" ${this.timePreferences.typicalDuration === 120 ? 'selected' : ''}>90+ minutes</option>
                            </select>
                        </div>

                        <div class="time-slot">
                            <label>Preferred training times:</label>
                            <div class="time-checkboxes">
                                ${this.renderTimeCheckbox('early_morning', 'Early morning (5-7 AM)')}
                                ${this.renderTimeCheckbox('morning', 'Morning (7-10 AM)')}
                                ${this.renderTimeCheckbox('midday', 'Midday (10 AM-2 PM)')}
                                ${this.renderTimeCheckbox('afternoon', 'Afternoon (2-6 PM)')}
                                ${this.renderTimeCheckbox('evening', 'Evening (6-9 PM)')}
                                ${this.renderTimeCheckbox('night', 'Night (9+ PM)')}
                            </div>
                        </div>

                        <div class="time-slot">
                            <label>Training days per week:</label>
                            <div class="days-selector">
                                ${[3,4,5,6,7].map(days => `
                                    <button type="button" 
                                            class="days-btn ${this.timePreferences.trainingDaysPerWeek === days ? 'selected' : ''}" 
                                            onclick="window.EquipmentAccess.selectTrainingDays(${days})"
                                            aria-label="${days} days per week">
                                        ${days} days
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()" aria-label="Go back">
                        Back
                    </button>
                    <button class="btn btn-primary" onclick="window.EquipmentAccess.saveAndContinue()" aria-label="Continue to next step">
                        Continue
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render equipment checkbox
     * @param {string} value - Equipment value
     * @param {string} label - Label text
     * @returns {string} HTML for checkbox
     */
    renderEquipmentCheckbox(value, label) {
        const checked = this.availableEquipment.has(value) ? 'checked' : '';
        return `
            <label class="equipment-checkbox">
                <input type="checkbox" 
                       name="equipment" 
                       value="${value}" 
                       ${checked}
                       onchange="window.EquipmentAccess.toggleEquipment('${value}', this.checked)">
                ${label}
            </label>
        `;
    }

    /**
     * Render time preference checkbox
     * @param {string} value - Time value
     * @param {string} label - Label text
     * @returns {string} HTML for checkbox
     */
    renderTimeCheckbox(value, label) {
        const checked = this.timePreferences.preferredTimes.includes(value) ? 'checked' : '';
        return `
            <label class="time-checkbox">
                <input type="checkbox" 
                       name="time_preference" 
                       value="${value}" 
                       ${checked}
                       onchange="window.EquipmentAccess.toggleTimePreference('${value}', this.checked)">
                ${label}
            </label>
        `;
    }

    /**
     * Toggle equipment selection
     * @param {string} equipment - Equipment key
     * @param {boolean} selected - Whether selected
     */
    toggleEquipment(equipment, selected) {
        if (selected) {
            this.availableEquipment.add(equipment);
        } else {
            this.availableEquipment.delete(equipment);
        }
    }

    /**
     * Update time preference
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     */
    updateTimePreference(key, value) {
        if (key === 'typicalDuration') {
            this.timePreferences.typicalDuration = parseInt(value);
        }
    }

    /**
     * Toggle time preference
     * @param {string} time - Time value
     * @param {boolean} selected - Whether selected
     */
    toggleTimePreference(time, selected) {
        if (selected && !this.timePreferences.preferredTimes.includes(time)) {
            this.timePreferences.preferredTimes.push(time);
        } else if (!selected) {
            this.timePreferences.preferredTimes = this.timePreferences.preferredTimes.filter(t => t !== time);
        }
    }

    /**
     * Select training days per week
     * @param {number} days - Number of days
     */
    selectTrainingDays(days) {
        this.timePreferences.trainingDaysPerWeek = days;

        // Update UI
        document.querySelectorAll('.days-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelectorAll('.days-btn').forEach((btn, index) => {
            if (parseInt(btn.textContent) === days) {
                btn.classList.add('selected');
            }
        });
    }

    /**
     * Save data and continue
     */
    saveAndContinue() {
        const onboardingManager = window.OnboardingManager;
        if (onboardingManager) {
            onboardingManager.onboardingData.equipment = Array.from(this.availableEquipment);
            onboardingManager.onboardingData.timePreferences = this.timePreferences;

            onboardingManager.saveStepData('equipment_access', {
                equipment: Array.from(this.availableEquipment),
                timePreferences: this.timePreferences
            });

            onboardingManager.nextStep();
        }
    }
}

// Create global instance
window.EquipmentAccess = new EquipmentAccess();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EquipmentAccess;
}

