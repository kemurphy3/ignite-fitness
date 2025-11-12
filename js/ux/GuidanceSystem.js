/**
 * User Guidance System
 * Provides contextual help and tips
 */
class _GuidanceSystem {
  constructor() {
    this.tips = {
      goals: 'Start with 1-2 specific goals. You can always add more later!',
      schedule:
        "Be honest about your available time. It's better to be consistent with shorter workouts.",
      workouts:
        "Your AI coach will adjust difficulty based on your feedback. Don't worry about being perfect!",
      progress:
        'Track how you feel after workouts. This helps your AI coach personalize future sessions.',
    };
  }

  showTip(category) {
    const tip = this.tips[category];
    if (tip) {
      this.displayTooltip(tip);
    }
  }

  displayTooltip(message) {
    // Remove existing tooltip
    const existing = document.getElementById('guidance-tooltip');
    if (existing) {
      existing.remove();
    }

    // Create new tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'guidance-tooltip';
    tooltip.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #1a365d;
                color: white;
                padding: 15px;
                border-radius: 10px;
                max-width: 300px;
                z-index: 1000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            ">
                <div style="display: flex; justify-content: between; align-items: flex-start;">
                    <div>
                        <strong>💡 Tip:</strong>
                        <p style="margin: 5px 0 0 0;">${message}</p>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        font-size: 16px;
                        padding: 0;
                        margin-left: 10px;
                    ">×</button>
                </div>
            </div>
        `;

    document.body.appendChild(tooltip);

    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (tooltip.parentElement) {
        tooltip.remove();
      }
    }, 8000);
  }

  addHelpButton(elementId, category) {
    const element = document.getElementById(elementId);
    if (element) {
      const helpBtn = document.createElement('button');
      helpBtn.innerHTML = '?';
      helpBtn.style.cssText = `
                background: #e2e8f0;
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                cursor: pointer;
                margin-left: 10px;
                font-size: 12px;
                color: #4a5568;
            `;
      helpBtn.onclick = () => this.showTip(category);

      element.appendChild(helpBtn);
    }
  }
}
