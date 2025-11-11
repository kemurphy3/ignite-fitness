/**
 * SportSoccer Step - Soccer-specific onboarding
 * Captures position, season phase, and soccer-specific preferences
 */
class SportSoccerStep {
  constructor() {
    this.logger = window.SafeLogger || console;
  }

  /**
   * Render soccer selection step
   * @param {Object} existingData - Existing onboarding data
   * @returns {string} HTML for soccer step
   */
  render(existingData = {}) {
    const selectedPosition = existingData.position || '';
    const selectedPhase = existingData.season_phase || 'in-season';

    return `
            <div class="onboarding-step sport-soccer-step">
                <h2>Soccer-Specific Details</h2>
                <p class="step-description">Help us personalize your training for soccer.</p>
                
                <div class="section">
                    <label class="section-label">Your Position</label>
                    <div class="position-options">
                        <label class="position-option">
                            <input type="radio" name="position" value="goalkeeper" 
                                   ${selectedPosition === 'goalkeeper' ? 'checked' : ''}>
                            <span class="position-card">
                                <span class="position-icon">🥅</span>
                                <span class="position-name">Goalkeeper</span>
                            </span>
                        </label>
                        
                        <label class="position-option">
                            <input type="radio" name="position" value="defender" 
                                   ${selectedPosition === 'defender' ? 'checked' : ''}>
                            <span class="position-card">
                                <span class="position-icon">🛡️</span>
                                <span class="position-name">Defender</span>
                            </span>
                        </label>
                        
                        <label class="position-option">
                            <input type="radio" name="position" value="midfielder" 
                                   ${selectedPosition === 'midfielder' ? 'checked' : ''}>
                            <span class="position-card">
                                <span class="position-icon">⚡</span>
                                <span class="position-name">Midfielder</span>
                            </span>
                        </label>
                        
                        <label class="position-option">
                            <input type="radio" name="position" value="forward" 
                                   ${selectedPosition === 'forward' ? 'checked' : ''}>
                            <span class="position-card">
                                <span class="position-icon">⚽</span>
                                <span class="position-name">Forward</span>
                            </span>
                        </label>
                    </div>
                </div>
                
                <div class="section">
                    <label class="section-label">Current Season Phase</label>
                    <div class="season-options">
                        <label class="season-option">
                            <input type="radio" name="season_phase" value="off-season" 
                                   ${selectedPhase === 'off-season' ? 'checked' : ''}>
                            <span>Off-Season<br><small>Building strength & power</small></span>
                        </label>
                        
                        <label class="season-option">
                            <input type="radio" name="season_phase" value="pre-season" 
                                   ${selectedPhase === 'pre-season' ? 'checked' : ''}>
                            <span>Pre-Season<br><small>Sport-specific preparation</small></span>
                        </label>
                        
                        <label class="season-option">
                            <input type="radio" name="season_phase" value="in-season" 
                                   ${selectedPhase === 'in-season' ? 'checked' : ''}>
                            <span>In-Season<br><small>Performance maintenance</small></span>
                        </label>
                        
                        <label class="season-option">
                            <input type="radio" name="season_phase" value="transition" 
                                   ${selectedPhase === 'transition' ? 'checked' : ''}>
                            <span>Transition<br><small>Recovery & regeneration</small></span>
                        </label>
                    </div>
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
   * @returns {Object} Selected position and phase
   */
  getSelectedValues() {
    const position =
      document.querySelector('input[name="position"]:checked')?.value || 'midfielder';
    const season_phase =
      document.querySelector('input[name="season_phase"]:checked')?.value || 'in-season';

    return {
      position,
      season_phase,
    };
  }

  /**
   * Validate step
   * @returns {boolean} Is valid
   */
  validate() {
    return true; // Position has default
  }
}

window.SportSoccerStep = SportSoccerStep;
