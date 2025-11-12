/**
 * ReviewComplete - Review and launch step
 * Final step to review all data and complete onboarding
 */

class ReviewComplete extends window.BaseComponent {
  constructor() {
    super();
  }

  render(onboardingData = {}) {
    this.onboardingData = onboardingData;

    return `
            <div class="onboarding-step review-complete-step">
                <div class="step-header">
                    <h2>Review & Launch</h2>
                    <p>Confirm your profile and start training</p>
                </div>

                <div class="review-summary">
                    <div class="summary-section">
                        <h3>Primary Sport</h3>
                        <p>${this.onboardingData.primarySport || 'Not selected'}</p>
                    </div>

                    <div class="summary-section">
                        <h3>Training Level</h3>
                        <p>${this.onboardingData.trainingLevel || 'Not determined'}</p>
                    </div>

                    <div class="summary-section">
                        <h3>Weekly Volume</h3>
                        <p>${this.calculateTotalVolume()} minutes/week</p>
                    </div>

                    <div class="summary-section">
                        <h3>Equipment</h3>
                        <p>${(this.onboardingData.equipment || []).length} items selected</p>
                    </div>
                </div>

                <div class="validation-status">
                    ${this.validateRequired() ? '' : '<div class="validation-error">⚠️ Please complete all required steps</div>'}
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" onclick="window.OnboardingManager.previousStep()">Back</button>
                    <button class="btn btn-primary" 
                            ${this.validateRequired() ? '' : 'disabled'}
                            onclick="window.ReviewComplete.completeOnboarding()">
                        Complete Onboarding
                    </button>
                </div>
            </div>
        `;
  }

  calculateTotalVolume() {
    const volumes = this.onboardingData.weeklyVolumes || {};
    return Object.values(volumes).reduce((sum, v) => sum + (v || 0), 0);
  }

  validateRequired() {
    const required = {
      primarySport: !!this.onboardingData.primarySport,
      weeklyVolumes: !!this.onboardingData.weeklyVolumes,
      equipment: (this.onboardingData.equipment || []).length > 0,
      timeWindows: !!this.onboardingData.timeWindows,
    };
    return Object.values(required).every(v => v);
  }

  completeOnboarding() {
    if (!this.validateRequired()) {
      // eslint-disable-next-line no-alert
      alert('Please complete all required fields');
      return;
    }

    const om = window.OnboardingManager;
    if (om) {
      om.saveStepData('review_complete', { completed: true });
      om.completeOnboarding();
    }
  }
}

window.ReviewComplete = new ReviewComplete();
