/**
 * Expert Coordinator
 * Manages AI expertise coordination for fitness recommendations
 */

class ExpertCoordinator {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.experts = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the expert coordinator
   */
  async initialize() {
    try {
      this.isInitialized = true;
      this.logger.info('ExpertCoordinator initialized');
    } catch (error) {
      this.logger.error('Failed to initialize ExpertCoordinator:', error);
    }
  }

  /**
   * Register an expert
   * @param {string} name - Expert name
   * @param {Object} expert - Expert instance
   */
  registerExpert(name, expert) {
    this.experts.set(name, expert);
    this.logger.debug(`Expert registered: ${name}`);
  }

  /**
   * Get expert recommendation
   * @param {string} expertName - Name of expert to consult
   * @param {Object} context - Context data
   * @returns {Promise<Object>} Recommendation
   */
  async getRecommendation(expertName, context) {
    const expert = this.experts.get(expertName);
    if (!expert) {
      throw new Error(`Expert not found: ${expertName}`);
    }

    return expert.getRecommendation(context);
  }

  /**
   * Get all experts
   * @returns {Array} List of expert names
   */
  getExperts() {
    return Array.from(this.experts.keys());
  }

  /**
   * Destroy the coordinator
   */
  destroy() {
    this.experts.clear();
    this.isInitialized = false;
    this.logger.info('ExpertCoordinator destroyed');
  }
}

// Export for both module and global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExpertCoordinator };
} else if (typeof window !== 'undefined') {
  window.ExpertCoordinator = ExpertCoordinator;
}

export { ExpertCoordinator };
