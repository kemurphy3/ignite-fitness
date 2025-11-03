/**
 * InjuryHistory - Injury flags and limitations step
 * Collects current limitations and past injury issues
 */

class InjuryHistory extends window.BaseComponent {
    constructor() {
        super();
        this.currentInjuries = [];
        this.pastInjuries = [];
        this.limitations = new Set();
    }

    render(onboardingData = {}) {
        this.onboardingData = onboardingData;
        this.currentInjuries = onboardingData.currentInjuries || [];
        this.pastInjuries = onboardingData.pastInjuries || [];
        this.limitations = new Set(onboardingData.limitations || []);

        return `
            <div class="onboarding-step injury-history-step">
                <div class="step-header">
                    <h2>Injury Flags</h2>
                    <p>Current limitations and past issues (optional but helpful)</p>
                </div>

                <div class="injury-section">
                    <h3>Current Injuries/Limitations</h3>
                    <div class="limitation-checkboxes">
                        ${['knee', 'ankle', 'hip', 'shoulder', 'back', 'wrist', 'elbow', 'none'].map(lim => `
                            <label class="limitation-checkbox">
                                <input type="checkbox" 
                                       value="${lim}" 
                                       ${this.limitations.has(lim) ? 'checked' : ''}
                                       onchange="window.InjuryHistory.toggleLimitation('${lim}', this.checked)">
                                ${lim.charAt(0).toUpperCase() + lim.slice(1)}
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="injury-section">
                    <h3>Past Significant Injuries</h3>
                    <textarea placeholder="List any significant past injuries, surgeries, or conditions (optional)" 
                              rows="4"
                              onchange="window.InjuryHistory.updatePastInjuries(this.value)">${this.pastInjuries.join('\n')}</textarea>
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()">Back</button>
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.nextStep()">Skip</button>
                    <button class="btn btn-primary" onclick="window.InjuryHistory.saveAndContinue()">Continue</button>
                </div>
            </div>
        `;
    }

    toggleLimitation(lim, selected) {
        if (selected) this.limitations.add(lim);
        else this.limitations.delete(lim);
    }

    updatePastInjuries(text) {
        this.pastInjuries = text.split('\n').filter(line => line.trim());
    }

    saveAndContinue() {
        const om = window.OnboardingManager;
        if (om) {
            om.onboardingData.currentInjuries = Array.from(this.limitations);
            om.onboardingData.pastInjuries = this.pastInjuries;
            om.onboardingData.limitations = Array.from(this.limitations);
            om.saveStepData('injury_history', {
                currentInjuries: Array.from(this.limitations),
                pastInjuries: this.pastInjuries,
                limitations: Array.from(this.limitations)
            });
            om.nextStep();
        }
    }
}

window.InjuryHistory = new InjuryHistory();

