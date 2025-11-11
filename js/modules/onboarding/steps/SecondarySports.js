/**
 * SecondarySports - Secondary activities selection step
 * Collects cross-training and seasonal activities
 */

class SecondarySports extends window.BaseComponent {
  constructor() {
    super();
    this.secondarySports = new Set();
  }

  render(onboardingData = {}) {
    this.onboardingData = onboardingData;
    this.secondarySports = new Set(onboardingData.secondarySports || []);

    const allSports = [
      'running',
      'cycling',
      'swimming',
      'soccer',
      'strength',
      'yoga',
      'pilates',
      'crossfit',
    ];

    return `
            <div class="onboarding-step secondary-sports-step">
                <div class="step-header">
                    <h2>Secondary Activities</h2>
                    <p>Select any cross-training or seasonal activities you do</p>
                </div>

                <div class="sports-grid">
                    ${allSports
                      .map(
                        sport => `
                        <label class="sport-checkbox ${this.secondarySports.has(sport) ? 'selected' : ''}">
                            <input type="checkbox" 
                                   value="${sport}" 
                                   ${this.secondarySports.has(sport) ? 'checked' : ''}
                                   onchange="window.SecondarySports.toggleSport('${sport}', this.checked)">
                            <span class="sport-label">${sport.charAt(0).toUpperCase() + sport.slice(1)}</span>
                        </label>
                    `
                      )
                      .join('')}
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()">Back</button>
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.nextStep()">Skip</button>
                    <button class="btn btn-primary" onclick="window.SecondarySports.saveAndContinue()">Continue</button>
                </div>
            </div>
        `;
  }

  toggleSport(sport, selected) {
    if (selected) {
      this.secondarySports.add(sport);
    } else {
      this.secondarySports.delete(sport);
    }
  }

  saveAndContinue() {
    const om = window.OnboardingManager;
    if (om) {
      om.onboardingData.secondarySports = Array.from(this.secondarySports);
      om.saveStepData('secondary_sports', { secondarySports: Array.from(this.secondarySports) });
      om.nextStep();
    }
  }
}

window.SecondarySports = new SecondarySports();
