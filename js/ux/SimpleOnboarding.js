/**
 * Simplified Onboarding Flow
 * Reduces complexity for beta users
 */
class _SimpleOnboarding {
  constructor() {
    this.currentStep = 0;
    this.totalSteps = 3;
  }

  start() {
    this.showStep(0);
  }

  showStep(step) {
    // Hide all steps
    document.querySelectorAll('.onboarding-step').forEach(el => (el.style.display = 'none'));

    // Show current step
    const currentStepEl = document.getElementById(`step-${step}`);
    if (currentStepEl) {
      currentStepEl.style.display = 'block';
    }

    this.updateProgress();
  }

  nextStep() {
    if (this.currentStep < this.totalSteps - 1) {
      this.currentStep++;
      this.showStep(this.currentStep);
    } else {
      this.complete();
    }
  }

  complete() {
    // Hide onboarding, show main app
    document.getElementById('onboarding-container').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';

    // Save completion status
    localStorage.setItem('ignite_onboarding_completed', 'true');
  }

  updateProgress() {
    const progress = ((this.currentStep + 1) / this.totalSteps) * 100;
    const progressBar = document.getElementById('onboarding-progress');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }
}
