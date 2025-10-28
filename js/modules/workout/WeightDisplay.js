/**
 * WeightDisplay - Client-side weight display and calculator
 * Shows practical loading instructions instead of decimal weights
 */
class WeightDisplay {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.storageManager = window.StorageManager;
        this.userPreferences = null;
        this.mode = 'us'; // Default to US
        this.availablePlates = null;
        
        this.loadUserPreferences();
    }

    /**
     * Load user equipment preferences
     */
    async loadUserPreferences() {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();
            
            if (userId) {
                const prefs = await this.storageManager.getPreferences(userId);
                if (prefs) {
                    this.userPreferences = prefs;
                    this.mode = prefs.weightUnit || 'us';
                    this.availablePlates = prefs.availablePlates || this.getDefaultPlates();
                }
            }
            
            // Set defaults if no preferences
            if (!this.availablePlates) {
                this.availablePlates = this.getDefaultPlates();
            }
        } catch (error) {
            this.logger.error('Failed to load user preferences', error);
            this.availablePlates = this.getDefaultPlates();
        }
    }

    /**
     * Get default plates for mode
     * @returns {Array} Default plates
     */
    getDefaultPlates() {
        const config = this.getConfig();
        return config.plates;
    }

    /**
     * Get bar configuration
     * @returns {Object} Bar config
     */
    getConfig() {
        const configs = {
            us: {
                barWeight: 45,
                plates: [45, 35, 25, 10, 5, 2.5],
                unit: 'lb'
            },
            metric: {
                barWeight: 20,
                plates: [20, 15, 10, 5, 2.5, 1.25],
                unit: 'kg'
            }
        };
        
        return configs[this.mode] || configs.us;
    }

    /**
     * Calculate loading instructions for target weight
     * @param {number} targetWeight - Target weight (total including bar)
     * @returns {Object} Loading instructions
     */
    calculateLoad(targetWeight) {
        const config = this.getConfig();
        const barWeight = config.barWeight;
        
        // Calculate weight needed per side
        const weightPerSide = (targetWeight - barWeight) / 2;
        
        if (weightPerSide <= 0) {
            return {
                totalWeight: barWeight,
                weightPerSide: 0,
                plates: [],
                instruction: `${targetWeight} ${config.unit} is less than bar weight (${barWeight} ${config.unit}). Use empty bar or add plates.`,
                warning: 'Weight is less than bar weight'
            };
        }

        // Calculate plate combination
        const { plates, remainingWeight, warnings } = this.calculatePlateCombination(
            weightPerSide,
            this.availablePlates
        );

        // Generate instruction text
        const instruction = this.generateInstruction(plates, barWeight, targetWeight, config);

        // Check for fallback
        let fallback = null;
        if (Math.abs(remainingWeight) > 0.1 && plates.length > 0) {
            fallback = this.generateFallback(weightPerSide, config);
        }

        return {
            totalWeight: barWeight + (plates.reduce((sum, p) => sum + p.weight * 2, 0)),
            weightPerSide,
            plates,
            instruction,
            warnings,
            fallback,
            exactMatch: remainingWeight === 0,
            mode: this.mode,
            unit: config.unit
        };
    }

    /**
     * Calculate optimal plate combination
     * @param {number} targetWeight - Weight per side
     * @param {Array} availablePlates - Available plates
     * @returns {Object} Result
     */
    calculatePlateCombination(targetWeight, availablePlates) {
        const plates = [];
        let remainingWeight = targetWeight;
        const warnings = [];

        // Sort plates descending
        const sortedPlates = [...availablePlates].sort((a, b) => b - a);

        for (const plateWeight of sortedPlates) {
            const count = Math.floor(remainingWeight / plateWeight);
            
            if (count > 0) {
                for (let i = 0; i < count; i++) {
                    plates.push({
                        weight: plateWeight,
                        count: 1
                    });
                    remainingWeight -= plateWeight;
                }
            }

            if (remainingWeight < 0.1) break;
        }

        // Round to nearest plate if very close
        if (remainingWeight > 0.1 && remainingWeight < 2.5) {
            const smallestPlate = sortedPlates[sortedPlates.length - 1];
            if (remainingWeight >= smallestPlate / 2) {
                plates.push({
                    weight: smallestPlate,
                    count: 1
                });
                remainingWeight -= smallestPlate;
            }
        }

        // Warning if cannot hit exact weight
        if (Math.abs(remainingWeight) > 0.1) {
            const config = this.getConfig();
            warnings.push(`Cannot achieve exact weight. Closest match will be ±${Math.abs(remainingWeight).toFixed(1)} ${config.unit} per side.`);
        }

        return { plates, remainingWeight, warnings };
    }

    /**
     * Generate human-readable instruction
     * @param {Array} plates - Plates array
     * @param {number} barWeight - Bar weight
     * @param {number} targetWeight - Target weight
     * @param {Object} config - Config
     * @returns {string} Instruction
     */
    generateInstruction(plates, barWeight, targetWeight, config) {
        const plateCounts = {};
        plates.forEach(p => {
            plateCounts[p.weight] = (plateCounts[p.weight] || 0) + 1;
        });

        // Format: "Load 45 lb bar + 35 + 10 + 2.5 per side → 135 lb total"
        const plateStrings = [];
        for (const [weight, count] of Object.entries(plateCounts).sort((a, b) => b[0] - a[0])) {
            // Do not show "each side" if only one plate of each type
            if (count === 1) {
                plateStrings.push(weight);
            } else {
                plateStrings.push(`${count}x${weight}`);
            }
        }

        const platesPerSide = plateStrings.length > 0 ? plateStrings.join(' + ') : 'no plates';
        const totalPlateWeight = plates.reduce((sum, p) => sum + p.weight * 2, 0);
        const actualTotal = barWeight + totalPlateWeight;

        return `Load ${barWeight} ${config.unit} bar + ${platesPerSide} per side → ${actualTotal.toFixed(0)} ${config.unit} total`;
    }

    /**
     * Generate fallback for missing plates
     * @param {number} targetWeight - Target weight per side
     * @param {Object} config - Config
     * @returns {Object} Fallback
     */
    generateFallback(targetWeight, config) {
        const smallestPlate = this.availablePlates[this.availablePlates.length - 1];
        const smallerTarget = targetWeight - smallestPlate;
        
        const { plates } = this.calculatePlateCombination(smallerTarget, this.availablePlates);
        const fallbackTotal = config.barWeight + (plates.reduce((sum, p) => sum + p.weight * 2, 0));
        
        return {
            totalWeight: fallbackTotal,
            instruction: `If missing ${smallestPlate} ${config.unit} plates, use ${Math.floor(fallbackTotal)} ${config.unit} and add 2-3 reps per set`,
            plates
        };
    }

    /**
     * Format weight display for exercise
     * @param {number} targetWeight - Target weight
     * @param {Object} options - Display options
     * @returns {string} Formatted display
     */
    formatWeightDisplay(targetWeight, options = {}) {
        const {
            showInstructions = true,
            showBarOnly = false
        } = options;

        const loadResult = this.calculateLoad(targetWeight);
        
        if (!showInstructions) {
            return `${loadResult.totalWeight} ${loadResult.unit}`;
        }

        let display = `
            <div class="weight-display">
                <div class="target-weight">Target: ${targetWeight} ${loadResult.unit}</div>
                <div class="loading-instruction">${loadResult.instruction}</div>
        `;

        if (loadResult.warnings && loadResult.warnings.length > 0) {
            display += `<div class="weight-warning">⚠️ ${loadResult.warnings[0]}</div>`;
        }

        if (loadResult.fallback) {
            display += `<div class="weight-fallback">💡 ${loadResult.fallback.instruction}</div>`;
        }

        display += '</div>';

        return display;
    }

    /**
     * Update user equipment preferences
     * @param {Object} preferences - New preferences
     */
    async updatePreferences(preferences) {
        try {
            const authManager = window.AuthManager;
            const userId = authManager?.getCurrentUsername();
            
            if (!userId) {
                throw new Error('User not logged in');
            }

            const updatedPrefs = {
                ...this.userPreferences,
                ...preferences,
                weightUnit: preferences.weightUnit || this.mode,
                availablePlates: preferences.availablePlates || this.availablePlates
            };

            await this.storageManager.savePreferences(userId, updatedPrefs);
            this.userPreferences = updatedPrefs;
            this.mode = updatedPrefs.weightUnit;
            this.availablePlates = updatedPrefs.availablePlates;
            
            this.logger.debug('Equipment preferences updated', updatedPrefs);
        } catch (error) {
            this.logger.error('Failed to update preferences', error);
            throw error;
        }
    }

    /**
     * Convert weight between US and metric
     * @param {number} weight - Weight to convert
     * @param {string} from - From unit
     * @param {string} to - To unit
     * @returns {number} Converted weight
     */
    convertWeight(weight, from, to) {
        if (from === to) return weight;
        
        const conversions = {
            'lb_kg': 0.453592,
            'kg_lb': 2.20462
        };
        
        const key = `${from}_${to}`;
        if (conversions[key]) {
            return parseFloat((weight * conversions[key]).toFixed(2));
        }
        
        return weight;
    }

    /**
     * Get available plates for display
     * @returns {Object} Plate configuration
     */
    getAvailablePlates() {
        return {
            mode: this.mode,
            availablePlates: this.availablePlates,
            barConfig: this.getConfig()
        };
    }
}

// Create global instance
window.WeightDisplay = new WeightDisplay();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeightDisplay;
}
