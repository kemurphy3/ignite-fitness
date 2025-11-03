/**
 * CurrentVolume - Weekly training volume input step
 * Collects current training minutes by activity for load estimation
 */

class CurrentVolume extends window.BaseComponent {
    constructor() {
        super();
        this.weeklyVolumes = {
            running: 0,
            cycling: 0,
            swimming: 0,
            strength: 0
        };
    }

    /**
     * Render current volume step
     * @param {Object} onboardingData - Current onboarding data
     * @returns {string} HTML for step
     */
    render(onboardingData = {}) {
        this.onboardingData = onboardingData;
        this.weeklyVolumes = onboardingData.weeklyVolumes || this.weeklyVolumes;

        return `
            <div class="onboarding-step current-volume-step">
                <div class="step-header">
                    <h2>Current Weekly Training</h2>
                    <p>Tell us how much you currently train per week</p>
                </div>

                <div class="volume-inputs">
                    <div class="activity-volume">
                        <label for="running_minutes">Running (minutes per week):</label>
                        <div class="volume-input-row">
                            <input type="number" 
                                   id="running_minutes" 
                                   name="running_minutes" 
                                   min="0" 
                                   max="2000"
                                   value="${this.weeklyVolumes.running || 0}"
                                   placeholder="e.g., 180" 
                                   onchange="window.CurrentVolume.updateVolume('running', this.value)">
                            <div class="volume-slider">
                                <input type="range" 
                                       id="running_slider"
                                       min="0" 
                                       max="600" 
                                       step="30" 
                                       value="${this.weeklyVolumes.running || 0}"
                                       oninput="window.CurrentVolume.updateVolumeFromSlider('running', this.value)">
                                <div class="slider-labels">
                                    <span>0</span><span>300</span><span>600+</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="activity-volume">
                        <label for="cycling_minutes">Cycling (minutes per week):</label>
                        <div class="volume-input-row">
                            <input type="number" 
                                   id="cycling_minutes" 
                                   name="cycling_minutes" 
                                   min="0" 
                                   max="2000"
                                   value="${this.weeklyVolumes.cycling || 0}"
                                   placeholder="e.g., 240" 
                                   onchange="window.CurrentVolume.updateVolume('cycling', this.value)">
                            <div class="volume-slider">
                                <input type="range" 
                                       id="cycling_slider"
                                       min="0" 
                                       max="800" 
                                       step="30" 
                                       value="${this.weeklyVolumes.cycling || 0}"
                                       oninput="window.CurrentVolume.updateVolumeFromSlider('cycling', this.value)">
                                <div class="slider-labels">
                                    <span>0</span><span>400</span><span>800+</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="activity-volume">
                        <label for="swimming_minutes">Swimming (minutes per week):</label>
                        <div class="volume-input-row">
                            <input type="number" 
                                   id="swimming_minutes" 
                                   name="swimming_minutes" 
                                   min="0" 
                                   max="1000"
                                   value="${this.weeklyVolumes.swimming || 0}"
                                   placeholder="e.g., 120" 
                                   onchange="window.CurrentVolume.updateVolume('swimming', this.value)">
                            <div class="volume-slider">
                                <input type="range" 
                                       id="swimming_slider"
                                       min="0" 
                                       max="400" 
                                       step="15" 
                                       value="${this.weeklyVolumes.swimming || 0}"
                                       oninput="window.CurrentVolume.updateVolumeFromSlider('swimming', this.value)">
                                <div class="slider-labels">
                                    <span>0</span><span>200</span><span>400+</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="activity-volume">
                        <label>Strength Training (sessions per week):</label>
                        <div class="session-buttons">
                            ${[0,1,2,3,4,5,6,7].map(num => `
                                <button type="button" 
                                        class="session-btn ${(this.weeklyVolumes.strength || 0) === num ? 'selected' : ''}" 
                                        onclick="window.CurrentVolume.selectSessions(${num})"
                                        aria-label="${num} sessions per week">
                                    ${num}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="volume-summary">
                    <h3>Weekly Summary</h3>
                    <div class="total-time">
                        Total: <span id="total-minutes">0</span> minutes
                        (<span id="total-hours">0</span> hours)
                    </div>
                    <div class="training-level">
                        Training Level: <span id="training-level">Beginner</span>
                    </div>
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()" aria-label="Go back">
                        Back
                    </button>
                    <button class="btn btn-primary" onclick="window.CurrentVolume.saveAndContinue()" aria-label="Continue to next step">
                        Continue
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Update volume for activity
     * @param {string} activity - Activity name
     * @param {string|number} minutes - Minutes value
     */
    updateVolume(activity, minutes) {
        const value = parseInt(minutes) || 0;
        this.weeklyVolumes[activity] = value;
        
        // Sync slider
        const slider = document.getElementById(`${activity}_slider`);
        if (slider) {
            slider.value = value;
        }
        
        this.updateSummary();
    }

    /**
     * Update volume from slider
     * @param {string} activity - Activity name
     * @param {string} value - Slider value
     */
    updateVolumeFromSlider(activity, value) {
        const numValue = parseInt(value);
        this.weeklyVolumes[activity] = numValue;
        
        // Sync input
        const input = document.getElementById(`${activity}_minutes`);
        if (input) {
            input.value = numValue;
        }
        
        this.updateSummary();
    }

    /**
     * Select strength sessions
     * @param {number} sessions - Number of sessions
     */
    selectSessions(sessions) {
        this.weeklyVolumes.strength = sessions;
        
        // Update UI
        document.querySelectorAll('.session-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.querySelectorAll('.session-btn')[sessions]?.classList.add('selected');
        
        this.updateSummary();
    }

    /**
     * Update summary display
     */
    updateSummary() {
        const totalMinutes = Object.values(this.weeklyVolumes).reduce((sum, val) => {
            // Strength sessions counted as 60 minutes each
            if (val > 100) return sum + (val * 60); // If it's sessions
            return sum + val;
        }, 0);
        
        const strengthMinutes = (this.weeklyVolumes.strength || 0) * 60;
        const actualTotalMinutes = totalMinutes - (this.weeklyVolumes.strength * 60) + strengthMinutes;
        const totalHours = Math.round((actualTotalMinutes / 60) * 10) / 10;

        const totalMinutesEl = document.getElementById('total-minutes');
        const totalHoursEl = document.getElementById('total-hours');
        
        if (totalMinutesEl) totalMinutesEl.textContent = actualTotalMinutes;
        if (totalHoursEl) totalHoursEl.textContent = totalHours;

        // Determine training level
        let level = 'Beginner';
        if (actualTotalMinutes > 300) level = 'Intermediate';
        if (actualTotalMinutes > 600) level = 'Advanced';
        if (actualTotalMinutes > 900) level = 'Elite';

        const levelEl = document.getElementById('training-level');
        if (levelEl) levelEl.textContent = level;
    }

    /**
     * Save data and continue
     */
    saveAndContinue() {
        const onboardingManager = window.OnboardingManager;
        if (onboardingManager) {
            onboardingManager.onboardingData.weeklyVolumes = this.weeklyVolumes;
            
            // Calculate total for training level
            const totalMinutes = Object.values(this.weeklyVolumes).reduce((sum, val) => {
                if (val > 100) return sum + (val * 60);
                return sum + val;
            }, 0);
            const strengthMinutes = (this.weeklyVolumes.strength || 0) * 60;
            const actualTotal = totalMinutes - (this.weeklyVolumes.strength * 60) + strengthMinutes;
            
            let trainingLevel = 'beginner';
            if (actualTotal > 300) trainingLevel = 'intermediate';
            if (actualTotal > 600) trainingLevel = 'advanced';
            if (actualTotal > 900) trainingLevel = 'elite';
            
            onboardingManager.onboardingData.trainingLevel = trainingLevel;
            
            onboardingManager.saveStepData('current_volume', {
                weeklyVolumes: this.weeklyVolumes,
                trainingLevel: trainingLevel
            });
            
            onboardingManager.nextStep();
        }
    }
}

// Create global instance
window.CurrentVolume = new CurrentVolume();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrentVolume;
}

