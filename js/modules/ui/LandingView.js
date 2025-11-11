/**
 * LandingView - First-time user landing experience
 * Shows hero section, social proof, and call-to-action before signup
 */

class LandingView {
  constructor() {
    this.logger = window.SafeLogger || console;
  }

  /**
   * Render landing page
   * @returns {string} Landing HTML
   */
  render() {
    return `
            <div data-component="LandingView" class="landing-view">
                <section class="hero-modern">
                    <div class="hero-content">
                        <h1 class="hero-title">
                            Your AI Fitness Coach<br>
                            <span class="accent">Adapts to You</span>
                        </h1>
                        <p class="hero-subtitle">
                            Get personalized workouts that evolve with your progress. 
                            Start simple, grow stronger.
                        </p>
                        
                        <div class="social-proof">
                            <div class="stat">
                                <span class="stat-number">10K+</span>
                                <span class="stat-label">Workouts Generated</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number">95%</span>
                                <span class="stat-label">User Satisfaction</span>
                            </div>
                        </div>
                        
                        <button class="cta-primary" onclick="window.Router?.navigate('#/register')" aria-label="Start your fitness journey">
                            Start Your Fitness Journey
                            <span class="cta-subtext">Free • No App Download • Works Offline</span>
                        </button>
                    </div>
                    
                    <div class="hero-preview">
                        <div class="phone-mockup">
                            <div class="workout-preview">
                                <div class="preview-header">Today's Workout</div>
                                <div class="preview-exercise">🏋️ Squat - 3x8</div>
                                <div class="preview-exercise">💪 Bench Press - 3x10</div>
                                <div class="preview-exercise">🏃 Cardio - 20min</div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <section class="features-section">
                    <h2>Why Choose IgniteFitness?</h2>
                    <div class="features-grid">
                        <div class="feature-card">
                            <div class="feature-icon">🤖</div>
                            <h3>AI-Powered</h3>
                            <p>Workouts adapt based on your feedback and progress</p>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">📱</div>
                            <h3>Works Offline</h3>
                            <p>No internet? No problem. Use it anywhere, anytime</p>
                        </div>
                        <div class="feature-card">
                            <div class="feature-icon">🎯</div>
                            <h3>Simple to Start</h3>
                            <p>Get your personalized plan in under 60 seconds</p>
                        </div>
                    </div>
                </section>
            </div>
        `;
  }
}

// Create global instance
window.LandingView = LandingView;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LandingView;
}
