/**
 * TimeWindows - Schedule preferences step
 * When and how long user can train (consolidated from EquipmentAccess if needed)
 */

class TimeWindows extends window.BaseComponent {
    constructor() {
        super();
        this.timeWindows = {
            typicalDuration: 60,
            preferredTimes: [],
            trainingDaysPerWeek: 4,
            flexibleSchedule: false
        };
    }

    render(onboardingData = {}) {
        this.onboardingData = onboardingData;
        this.timeWindows = onboardingData.timeWindows || onboardingData.timePreferences || this.timeWindows;

        return `
            <div class="onboarding-step time-windows-step">
                <div class="step-header">
                    <h2>Schedule Preferences</h2>
                    <p>When and how long you can train</p>
                </div>

                <div class="time-inputs">
                    <div class="input-group">
                        <label>Typical workout duration:</label>
                        <select onchange="window.TimeWindows.update('typicalDuration', this.value)">
                            <option value="30" ${this.timeWindows.typicalDuration === 30 ? 'selected' : ''}>30 min</option>
                            <option value="45" ${this.timeWindows.typicalDuration === 45 ? 'selected' : ''}>45 min</option>
                            <option value="60" ${this.timeWindows.typicalDuration === 60 ? 'selected' : ''}>60 min</option>
                            <option value="90" ${this.timeWindows.typicalDuration === 90 ? 'selected' : ''}>90 min</option>
                            <option value="120" ${this.timeWindows.typicalDuration === 120 ? 'selected' : ''}>120+ min</option>
                        </select>
                    </div>

                    <div class="input-group">
                        <label>Training days per week:</label>
                        <div class="days-buttons">
                            ${[3,4,5,6,7].map(d => `
                                <button type="button" 
                                        class="day-btn ${this.timeWindows.trainingDaysPerWeek === d ? 'selected' : ''}"
                                        onclick="window.TimeWindows.selectDays(${d})">${d}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()">Back</button>
                    <button class="btn btn-primary" onclick="window.TimeWindows.saveAndContinue()">Continue</button>
                </div>
            </div>
        `;
    }

    update(key, value) {
        this.timeWindows[key] = parseInt(value);
    }

    selectDays(days) {
        this.timeWindows.trainingDaysPerWeek = days;
        document.querySelectorAll('.day-btn').forEach((btn, i) => {
            btn.classList.toggle('selected', parseInt(btn.textContent) === days);
        });
    }

    saveAndContinue() {
        const om = window.OnboardingManager;
        if (om) {
            om.onboardingData.timeWindows = this.timeWindows;
            om.saveStepData('time_windows', { timeWindows: this.timeWindows });
            om.nextStep();
        }
    }
}

window.TimeWindows = new TimeWindows();

