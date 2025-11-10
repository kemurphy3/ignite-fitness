/**
 * UpgradeNudge - Friendly nudge for advanced features
 * Never blocks core session, only shows upsell
 */
class UpgradeNudge {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.featureFlags = window.FeatureFlags;
    }

    /**
     * Show nudge for disabled feature
     * @param {string} flagName - Feature flag name
     * @param {string} context - Context (where nudge is shown)
     * @returns {HTMLElement} Nudge element
     */
    render(flagName, context = 'general') {
        const descriptions = this.featureFlags.getFlagDescriptions();
        const feature = descriptions[flagName];

        if (!feature) {
            return null;
        }

        const nudge = document.createElement('div');
        nudge.className = 'upgrade-nudge';
        nudge.dataset.flag = flagName;

        nudge.innerHTML = `
            <div class="nudge-content">
                <div class="nudge-icon">${feature.icon}</div>
                <div class="nudge-text">
                    <div class="nudge-title">${feature.name}</div>
                    <div class="nudge-description">${feature.description}</div>
                    <button class="btn-upgrade" onclick="window.UpgradeNudge.handleUpgrade('${flagName}')">
                        Learn More →
                    </button>
                </div>
            </div>
        `;

        return nudge;
    }

    /**
     * Handle upgrade button click
     * @param {string} flagName - Feature flag name
     */
    handleUpgrade(flagName) {
        this.logger.audit('UPGRADE_NUDGE_CLICKED', { feature: flagName });

        // For now, just show message
        // Later: redirect to upgrade flow
        alert(`Coming soon: ${flagName.replace(/_/g, ' ')}\n\nThis feature will be available soon!`);
    }

    /**
     * Check if feature should show nudge
     * @param {string} flagName - Feature flag name
     * @returns {boolean} Should show nudge
     */
    shouldShowNudge(flagName) {
        return !this.featureFlags.isEnabled(flagName);
    }

    /**
     * Attach nudge to element if feature is disabled
     * @param {HTMLElement} element - Target element
     * @param {string} flagName - Feature flag name
     * @param {string} context - Context
     */
    attach(element, flagName, context = 'general') {
        if (!element || !this.shouldShowNudge(flagName)) {
            return;
        }

        const nudge = this.render(flagName, context);
        if (nudge) {
            element.appendChild(nudge);
        }
    }

    /**
     * Show upgrade modal (future implementation)
     * @param {string} featureName - Feature name
     */
    async showUpgradeModal(featureName) {
        const modal = document.createElement('div');
        modal.className = 'upgrade-modal';

        modal.innerHTML = `
            <div class="modal-backdrop" onclick="this.closest('.upgrade-modal').remove()"></div>
            <div class="modal-content">
                <h2>Unlock ${featureName}</h2>
                <p>This feature is coming soon!</p>
                <div class="feature-benefits">
                    <div class="benefit">✓ Advanced features</div>
                    <div class="benefit">✓ Priority support</div>
                    <div class="benefit">✓ Early access</div>
                </div>
                <button class="btn-primary" onclick="this.closest('.upgrade-modal').remove()">
                    Got it!
                </button>
            </div>
        `;

        document.body.appendChild(modal);
    }
}

window.UpgradeNudge = new UpgradeNudge();
