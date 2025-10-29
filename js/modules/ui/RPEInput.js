/**
 * RPEInput - Rate of Perceived Exertion input wheel
 * Touch-friendly RPE input for in-gym use
 */
class RPEInput {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.currentRPE = 5;
        
        this.createModal();
    }

    /**
     * Create RPE input modal
     */
    createModal() {
        const modal = document.createElement('div');
        modal.id = 'rpe-input-modal';
        modal.className = 'rpe-modal hidden';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.RPEInput.hide()"></div>
            <div class="modal-content rpe-content">
                <div class="modal-header">
                    <h2>Rate Your Effort</h2>
                    <p>How hard was that set?</p>
                </div>
                <div class="modal-body rpe-wheel-container">
                    <div class="rpe-wheel">
                        <div class="rpe-value" id="rpe-value">5</div>
                        <input 
                            type="range" 
                            id="rpe-slider" 
                            min="1" 
                            max="10" 
                            value="5" 
                            step="1"
                            aria-label="Rate of Perceived Exertion slider"
                            aria-valuemin="1"
                            aria-valuemax="10"
                            aria-valuenow="5"
                            aria-valuetext="Moderate effort"
                        >
                        <div class="rpe-descriptions">
                            <span class="rpe-low">1-3: Very Easy</span>
                            <span class="rpe-moderate">4-6: Moderate</span>
                            <span class="rpe-hard">7-9: Hard</span>
                            <span class="rpe-max">10: Max Effort</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary large" onclick="window.RPEInput.submit()">
                        Record RPE
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener for slider
        const slider = document.getElementById('rpe-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.updateDisplay(parseInt(e.target.value));
            });
            
            // Update on touch for mobile
            slider.addEventListener('touchmove', (e) => {
                this.updateDisplay(parseInt(e.target.value));
            });
        }
    }

    /**
     * Show RPE input
     * @param {Function} callback - Callback with RPE value
     */
    show(callback = null) {
        this.callback = callback;
        const modal = document.getElementById('rpe-input-modal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // Reset to default
            this.currentRPE = 5;
            this.updateDisplay(5);
        }
    }

    /**
     * Hide RPE input
     */
    hide() {
        const modal = document.getElementById('rpe-input-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    /**
     * Update display with RPE value
     * @param {number} rpe - RPE value
     */
    updateDisplay(rpe) {
        this.currentRPE = rpe;
        
        const valueDisplay = document.getElementById('rpe-value');
        const slider = document.getElementById('rpe-slider');
        
        if (valueDisplay) {
            valueDisplay.textContent = rpe;
            
            // Add visual feedback
            valueDisplay.className = 'rpe-value';
            if (rpe <= 3) {
                valueDisplay.classList.add('low');
            } else if (rpe <= 6) {
                valueDisplay.classList.add('moderate');
            } else if (rpe <= 9) {
                valueDisplay.classList.add('hard');
            } else {
                valueDisplay.classList.add('max');
            }
        }
        
        // Update slider with accessibility attributes
        if (slider) {
            slider.value = rpe;
            slider.setAttribute('aria-valuenow', rpe);
            slider.setAttribute('aria-valuetext', this.getRPEDescription(rpe));
        }
    }

    /**
     * Get RPE description for accessibility
     * @param {number} rpe - RPE value
     * @returns {string} Description
     */
    getRPEDescription(rpe) {
        const descriptions = {
            1: 'Very light effort - minimal exertion',
            2: 'Light effort - easy breathing',
            3: 'Moderate effort - comfortable pace',
            4: 'Moderate effort - noticeable breathing',
            5: 'Moderate effort - steady pace',
            6: 'Moderate effort - slightly challenging',
            7: 'Hard effort - difficult but sustainable',
            8: 'Hard effort - very challenging',
            9: 'Very hard effort - extremely difficult',
            10: 'Maximum effort - all-out exertion'
        };
        return descriptions[rpe] || 'Moderate effort';
    }

    /**
     * Submit RPE
     */
    submit() {
        if (this.callback) {
            this.callback(this.currentRPE);
        }
        
        this.hide();
    }

    /**
     * Get current RPE
     * @returns {number} Current RPE
     */
    getCurrentRPE() {
        return this.currentRPE;
    }
}

// Create global instance
window.RPEInput = new RPEInput();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RPEInput;
}
