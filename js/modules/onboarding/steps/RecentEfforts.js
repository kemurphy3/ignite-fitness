/**
 * RecentEfforts - Recent best efforts collection step
 * Helps estimate training zones from recent performances
 */

class RecentEfforts extends window.BaseComponent {
  constructor() {
    super();
    this.efforts = {};
  }

  render(onboardingData = {}) {
    this.onboardingData = onboardingData;
    this.efforts = onboardingData.recentEfforts || {};

    const primarySport = onboardingData.primarySport || 'running';

    return `
            <div class="onboarding-step recent-efforts-step">
                <div class="step-header">
                    <h2>Recent Best Efforts</h2>
                    <p>Help us estimate your training zones (optional)</p>
                </div>

                ${primarySport === 'running' ? this.renderRunningEfforts() : ''}
                ${primarySport === 'cycling' ? this.renderCyclingEfforts() : ''}
                ${primarySport === 'swimming' ? this.renderSwimmingEfforts() : ''}

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()">Back</button>
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.nextStep()">Skip</button>
                    <button class="btn btn-primary" onclick="window.RecentEfforts.saveAndContinue()">Continue</button>
                </div>
            </div>
        `;
  }

  renderRunningEfforts() {
    return `
            <div class="efforts-inputs">
                <div class="effort-input">
                    <label>5K time:</label>
                    <input type="text" placeholder="e.g., 22:30" value="${this.efforts.run5k || ''}" onchange="window.RecentEfforts.updateEffort('run5k', this.value)">
                </div>
                <div class="effort-input">
                    <label>10K time:</label>
                    <input type="text" placeholder="e.g., 48:00" value="${this.efforts.run10k || ''}" onchange="window.RecentEfforts.updateEffort('run10k', this.value)">
                </div>
                <div class="effort-input">
                    <label>Half marathon time:</label>
                    <input type="text" placeholder="e.g., 1:45:00" value="${this.efforts.runHalf || ''}" onchange="window.RecentEfforts.updateEffort('runHalf', this.value)">
                </div>
            </div>
        `;
  }

  renderCyclingEfforts() {
    return `
            <div class="efforts-inputs">
                <div class="effort-input">
                    <label>FTP (watts):</label>
                    <input type="number" placeholder="e.g., 250" value="${this.efforts.ftp || ''}" onchange="window.RecentEfforts.updateEffort('ftp', this.value)">
                </div>
                <div class="effort-input">
                    <label>20min max power:</label>
                    <input type="number" placeholder="e.g., 280" value="${this.efforts.power20min || ''}" onchange="window.RecentEfforts.updateEffort('power20min', this.value)">
                </div>
            </div>
        `;
  }

  renderSwimmingEfforts() {
    return `
            <div class="efforts-inputs">
                <div class="effort-input">
                    <label>100m best time:</label>
                    <input type="text" placeholder="e.g., 1:30" value="${this.efforts.swim100m || ''}" onchange="window.RecentEfforts.updateEffort('swim100m', this.value)">
                </div>
                <div class="effort-input">
                    <label>400m best time:</label>
                    <input type="text" placeholder="e.g., 6:30" value="${this.efforts.swim400m || ''}" onchange="window.RecentEfforts.updateEffort('swim400m', this.value)">
                </div>
            </div>
        `;
  }

  updateEffort(key, value) {
    this.efforts[key] = value;
  }

  saveAndContinue() {
    const om = window.OnboardingManager;
    if (om) {
      om.onboardingData.recentEfforts = this.efforts;
      om.saveStepData('recent_efforts', { recentEfforts: this.efforts });
      om.nextStep();
    }
  }
}

window.RecentEfforts = new RecentEfforts();
