/**
 * EquipmentTime Step - Capture constraints and preferences
 * Available days, session length, equipment availability, dislike list
 */
class EquipmentTimeStep {
    constructor() {
        this.logger = window.SafeLogger || console;
    }

    /**
     * Render equipment/time selection step
     * @param {Object} existingData - Existing onboarding data
     * @returns {string} HTML for equipment/time step
     */
    render(existingData = {}) {
        const availableDays = existingData.available_days || ['monday', 'wednesday', 'friday'];
        const sessionLength = existingData.session_length || '45';
        const equipment = existingData.equipment || 'commercial_gym';
        const dislikes = existingData.exercise_dislikes || [];

        return `
            <div class="onboarding-step equipment-time-step">
                <h2>Training Constraints</h2>
                <p class="step-description">Tell us about your schedule and preferences.</p>
                
                <div class="section">
                    <label class="section-label">Available Days Per Week</label>
                    <div class="day-options">
                        <label class="day-checkbox">
                            <input type="checkbox" value="monday" ${availableDays.includes('monday') ? 'checked' : ''}>
                            Mon
                        </label>
                        <label class="day-checkbox">
                            <input type="checkbox" value="tuesday" ${availableDays.includes('tuesday') ? 'checked' : ''}>
                            Tue
                        </label>
                        <label class="day-checkbox">
                            <input type="checkbox" value="wednesday" ${availableDays.includes('wednesday') ? 'checked' : ''}>
                            Wed
                        </label>
                        <label class="day-checkbox">
                            <input type="checkbox" value="thursday" ${availableDays.includes('thursday') ? 'checked' : ''}>
                            Thu
                        </label>
                        <label class="day-checkbox">
                            <input type="checkbox" value="friday" ${availableDays.includes('friday') ? 'checked' : ''}>
                            Fri
                        </label>
                        <label class="day-checkbox">
                            <input type="checkbox" value="saturday" ${availableDays.includes('saturday') ? 'checked' : ''}>
                            Sat
                        </label>
                        <label class="day-checkbox">
                            <input type="checkbox" value="sunday" ${availableDays.includes('sunday') ? 'checked' : ''}>
                            Sun
                        </label>
                    </div>
                </div>
                
                <div class="section">
                    <label class="section-label">Preferred Session Length</label>
                    <div class="session-length-options">
                        <label class="session-option">
                            <input type="radio" name="session_length" value="30" ${sessionLength === '30' ? 'checked' : ''}>
                            <span>30 min</span>
                        </label>
                        <label class="session-option">
                            <input type="radio" name="session_length" value="45" ${sessionLength === '45' ? 'checked' : ''}>
                            <span>45 min</span>
                        </label>
                        <label class="session-option">
                            <input type="radio" name="session_length" value="60" ${sessionLength === '60' ? 'checked' : ''}>
                            <span>60 min</span>
                        </label>
                    </div>
                </div>
                
                <div class="section">
                    <label class="section-label">Equipment Available</label>
                    <select class="form-select" id="equipment-available">
                        <option value="commercial_gym" ${equipment === 'commercial_gym' ? 'selected' : ''}>
                            Commercial Gym (Full equipment)
                        </option>
                        <option value="home_gym" ${equipment === 'home_gym' ? 'selected' : ''}>
                            Home Gym (Limited equipment)
                        </option>
                        <option value="minimal" ${equipment === 'minimal' ? 'selected' : ''}>
                            Minimal (Bodyweight + bands)
                        </option>
                    </select>
                </div>
                
                <div class="section">
                    <label class="section-label">Exercises to Avoid (optional)</label>
                    <input type="text" class="form-input" 
                           id="exercise-dislikes" 
                           placeholder="e.g., Bulgarian split squats, lateral raises"
                           value="${dislikes.join(', ')}">
                    <small>Separate with commas</small>
                </div>
                
                <div class="step-actions">
                    <button class="btn-secondary" onclick="window.OnboardingManager.skipStep()">
                        Skip for now
                    </button>
                    <button class="btn-primary" onclick="window.OnboardingManager.nextStep()">
                        Continue →
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Get selected values
     * @returns {Object} Selected constraints
     */
    getSelectedValues() {
        const availableDays = Array.from(document.querySelectorAll('.day-checkbox input:checked'))
            .map(cb => cb.value);

        const sessionLength = document.querySelector('input[name="session_length"]:checked')?.value || '45';
        const equipment = document.getElementById('equipment-available')?.value || 'commercial_gym';
        const exerciseDislikes = document.getElementById('exercise-dislikes')?.value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0) || [];

        return {
            available_days: availableDays,
            session_length: parseInt(sessionLength),
            equipment,
            exercise_dislikes: exerciseDislikes
        };
    }

    /**
     * Validate step
     * @returns {boolean} Is valid
     */
    validate() {
        const availableDays = Array.from(document.querySelectorAll('.day-checkbox input:checked')).length;
        return availableDays > 0 || document.getElementById('exercise-dislikes')?.value; // At least one day or skip
    }
}

window.EquipmentTimeStep = EquipmentTimeStep;
