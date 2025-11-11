/**
 * Beginner-friendly UI components
 */
class BeginnerUI {
  static createWelcomeMessage() {
    return `
        <div class="welcome-banner" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h2>🎉 Welcome to Ignite Fitness!</h2>
            <p>Your personal AI fitness coach that learns from your progress and adapts to your goals.</p>
            <div class="quick-benefits">
                <div>✨ Personalized workouts</div>
                <div>📈 Progress tracking</div>
                <div>🤖 AI-powered guidance</div>
            </div>
        </div>
        `;
  }

  static createQuickStartGuide() {
    return `
        <div class="quick-start-guide" style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h3>🚀 Quick Start Guide</h3>
            <div class="steps">
                <div class="step">
                    <span class="step-number">1</span>
                    <span class="step-text">Set your fitness goals</span>
                </div>
                <div class="step">
                    <span class="step-number">2</span>
                    <span class="step-text">Tell us about your schedule</span>
                </div>
                <div class="step">
                    <span class="step-number">3</span>
                    <span class="step-text">Get your personalized workout plan</span>
                </div>
            </div>
        </div>
        `;
  }

  static createProgressCard(title, value, icon, color = '#4299e1') {
    return `
        <div class="progress-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 15px;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 24px; margin-right: 10px;">${icon}</span>
                <h4 style="margin: 0; color: #2d3748;">${title}</h4>
            </div>
            <div style="font-size: 24px; font-weight: bold; color: ${color};">${value}</div>
        </div>
        `;
  }

  static createSimpleWorkoutCard(workout) {
    return `
        <div class="workout-card" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 15px;">
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: #2d3748;">${workout.name}</h3>
                <span class="duration" style="background: #e2e8f0; padding: 5px 10px; border-radius: 15px; font-size: 12px;">${workout.duration}</span>
            </div>
            <p style="color: #718096; margin-bottom: 15px;">${workout.description}</p>
            <button class="start-workout-btn" style="background: #4299e1; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                Start Workout
            </button>
        </div>
        `;
  }
}
