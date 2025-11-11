/**
 * LegalCopy - Disclaimer and legal acknowledgment management
 * Tracks user acceptance of disclaimers with timestamps
 */
class LegalCopy {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.acceptances = new Map();

    this.disclaimers = {
      injuryAssessment: {
        id: 'injury_assessment',
        title: 'Injury Assessment Disclaimer',
        text: `
⚠️ IMPORTANT DISCLAIMER

This application provides exercise suggestions and modifications only. 
It is NOT a substitute for medical advice, diagnosis, or treatment.

Pain Assessment:
- We provide educational information about exercise modifications
- We suggest alternatives based on pain location and severity
- We do NOT diagnose medical conditions
- We do NOT provide medical treatment recommendations

If you experience:
- Severe pain (7/10 or higher)
- Pain that persists or worsens
- Numbness, tingling, or loss of sensation
- Any concerning symptoms

Please STOP and consult a qualified healthcare professional immediately.

By continuing, you acknowledge:
1. You understand this is not medical advice
2. You will consult a healthcare professional for medical concerns
3. You accept full responsibility for your training decisions
4. You will stop exercising if pain increases

Timestamp: ${new Date().toISOString()}
                `.trim(),
        required: true,
      },
      generalFitness: {
        id: 'general_fitness',
        title: 'General Fitness Disclaimer',
        text: `
Exercise Disclaimer:

Physical exercise involves risk of injury. By using this application, 
you acknowledge and accept full responsibility for:
- Your physical condition and capabilities
- Your exercise choices and modifications
- Any injuries sustained during exercise
- Consulting healthcare professionals when appropriate

The creators and operators of this application:
- Are not liable for injuries or damages
- Do not guarantee specific results
- Provide educational content only
- Recommend consulting professionals for medical concerns

Always:
- Warm up properly before exercise
- Use appropriate loads and techniques
- Stop if you experience pain or concerning symptoms
- Consult professionals for medical or health questions

Timestamp: ${new Date().toISOString()}
                `.trim(),
        required: true,
      },
    };

    this.loadAcceptances();
  }

  /**
   * Load stored acceptances
   */
  loadAcceptances() {
    try {
      const stored = localStorage.getItem('ignitefitness_legal_acceptances');
      if (stored) {
        this.acceptances = new Map(JSON.parse(stored));
      }
    } catch (error) {
      this.logger.error('Failed to load legal acceptances', error);
    }
  }

  /**
   * Save acceptances to storage
   */
  saveAcceptances() {
    try {
      const serialized = JSON.stringify(Array.from(this.acceptances.entries()));
      localStorage.setItem('ignitefitness_legal_acceptances', serialized);
    } catch (error) {
      this.logger.error('Failed to save legal acceptances', error);
    }
  }

  /**
   * Check if disclaimer was accepted
   * @param {string} disclaimerId - Disclaimer ID
   * @returns {boolean} Is accepted
   */
  isAccepted(disclaimerId) {
    return this.acceptances.has(disclaimerId);
  }

  /**
   * Get timestamp of acceptance
   * @param {string} disclaimerId - Disclaimer ID
   * @returns {Date|null} Acceptance timestamp
   */
  getAcceptanceTimestamp(disclaimerId) {
    const acceptance = this.acceptances.get(disclaimerId);
    return acceptance ? new Date(acceptance.timestamp) : null;
  }

  /**
   * Show disclaimer and get acceptance
   * @param {string} disclaimerId - Disclaimer ID
   * @returns {Promise<boolean>} Accepted
   */
  async showDisclaimer(disclaimerId) {
    return new Promise(resolve => {
      const disclaimer = this.disclaimers[disclaimerId];
      if (!disclaimer) {
        this.logger.error('Unknown disclaimer:', disclaimerId);
        resolve(false);
        return;
      }

      if (this.isAccepted(disclaimerId)) {
        resolve(true);
        return;
      }

      const modal = this.createDisclaimerModal(disclaimer, accepted => {
        if (accepted) {
          this.acceptDisclaimer(disclaimerId);
        }
        resolve(accepted);
      });

      document.body.appendChild(modal);
    });
  }

  /**
   * Create disclaimer modal
   * @param {Object} disclaimer - Disclaimer data
   * @param {Function} callback - Acceptance callback
   * @returns {HTMLElement} Modal element
   */
  createDisclaimerModal(disclaimer, callback) {
    const modal = document.createElement('div');
    modal.className = 'legal-disclaimer-modal';
    modal.innerHTML = `
            <div class="modal-overlay" onclick="event.stopPropagation()"></div>
            <div class="modal-content legal-modal">
                <div class="modal-header">
                    <h2>${disclaimer.title}</h2>
                </div>
                <div class="modal-body legal-text">
                    <pre>${disclaimer.text}</pre>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" onclick="handleLegalAcceptance()">I Accept and Acknowledge</button>
                    <div class="legal-note">
                        <small>Required to continue using injury assessment features</small>
                    </div>
                </div>
            </div>
        `;

    window.handleLegalAcceptance = () => {
      modal.remove();
      callback(true);
    };

    // Prevent closing without acceptance if required
    if (disclaimer.required) {
      modal.querySelector('.modal-close')?.remove();
    }

    return modal;
  }

  /**
   * Accept disclaimer
   * @param {string} disclaimerId - Disclaimer ID
   */
  acceptDisclaimer(disclaimerId) {
    this.acceptances.set(disclaimerId, {
      timestamp: new Date().toISOString(),
      version: this.disclaimers[disclaimerId]?.version || '1.0',
    });

    this.saveAcceptances();

    this.logger.audit('DISCLAIMER_ACCEPTED', {
      disclaimerId,
      timestamp: new Date().toISOString(),
    });

    // Emit event
    if (window.EventBus) {
      window.EventBus.emit('legal:disclaimer_accepted', { disclaimerId });
    }
  }

  /**
   * Get all accepted disclaimers
   * @returns {Object} Accepted disclaimers
   */
  getAcceptedDisclaimers() {
    const accepted = {};
    this.acceptances.forEach((data, id) => {
      accepted[id] = data;
    });
    return accepted;
  }

  /**
   * Reset acceptances (for testing)
   */
  resetAcceptances() {
    this.acceptances.clear();
    this.saveAcceptances();
    this.logger.debug('Legal acceptances reset');
  }
}

// Create global instance
window.LegalCopy = new LegalCopy();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LegalCopy;
}
