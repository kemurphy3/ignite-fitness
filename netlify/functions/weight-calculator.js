/**
 * Weight Calculator Function
 * Converts decimal weights into practical plate-loading instructions
 */

// Standard plate options
const BAR_CONFIGS = {
  us: {
    barWeight: 45,
    plates: [45, 35, 25, 10, 5, 2.5],
    unit: 'lb',
  },
  metric: {
    barWeight: 20,
    plates: [20, 15, 10, 5, 2.5, 1.25],
    unit: 'kg',
  },
};

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { targetWeight, mode = 'us', equipmentAvailable } = JSON.parse(event.body || '{}');

    if (!targetWeight) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'targetWeight is required' }),
      };
    }

    const result = calculateWeightLoad(targetWeight, mode, equipmentAvailable);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Weight calculator error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Calculate plate loading for target weight
 * @param {number} targetWeight - Target weight (total including bar)
 * @param {string} mode - 'us' or 'metric'
 * @param {Array} equipmentAvailable - Available plates
 * @returns {Object} Loading instructions
 */
function calculateWeightLoad(targetWeight, mode = 'us', equipmentAvailable = null) {
  const config = BAR_CONFIGS[mode] || BAR_CONFIGS.us;
  const { barWeight } = config;

  // Calculate weight needed per side
  const weightPerSide = (targetWeight - barWeight) / 2;

  if (weightPerSide <= 0) {
    return {
      totalWeight: barWeight,
      weightPerSide: 0,
      plates: [],
      instruction: `${targetWeight} ${config.unit} is less than bar weight (${barWeight} ${config.unit}). Use empty bar or add plates.`,
      warning: 'Weight is less than bar weight',
    };
  }

  // Get available plates
  const availablePlates = equipmentAvailable || config.plates;
  const sortedPlates = [...availablePlates].sort((a, b) => b - a);

  // Calculate plate combination
  const { plates, remainingWeight, warnings } = calculatePlateCombination(
    weightPerSide,
    sortedPlates,
    config.unit
  );

  // Generate instruction text
  const instruction = generateInstruction(plates, barWeight, targetWeight, config);

  // Check if we need fallback due to missing small plates
  let fallback = null;
  if (Math.abs(remainingWeight) > 0.1 && plates.length > 0) {
    fallback = generateFallback(weightPerSide, sortedPlates, config);
  }

  return {
    totalWeight: barWeight + plates.reduce((sum, p) => sum + p.weight * 2, 0),
    weightPerSide,
    plates,
    instruction,
    warnings,
    fallback,
    exactMatch: remainingWeight === 0,
  };
}

/**
 * Calculate optimal plate combination
 * @param {number} targetWeight - Weight per side
 * @param {Array} availablePlates - Available plate options
 * @param {string} unit - Weight unit
 * @returns {Object} Plate combination result
 */
function calculatePlateCombination(targetWeight, availablePlates, unit) {
  const plates = [];
  let remainingWeight = targetWeight;
  const warnings = [];

  for (const plateWeight of availablePlates) {
    const count = Math.floor(remainingWeight / plateWeight);

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        plates.push({
          weight: plateWeight,
          count: 1,
        });
        remainingWeight -= plateWeight;
      }
    }

    if (remainingWeight < 0.1) {
      break;
    }
  }

  // Round to nearest plate if very close
  if (remainingWeight > 0.1 && remainingWeight < 2.5) {
    const smallestPlate = availablePlates[availablePlates.length - 1];
    if (remainingWeight >= smallestPlate / 2) {
      plates.push({
        weight: smallestPlate,
        count: 1,
      });
      remainingWeight -= smallestPlate;
    }
  }

  // If we can't hit exact weight, warn user
  if (Math.abs(remainingWeight) > 0.1) {
    warnings.push(
      `Cannot achieve exact weight. Closest match will be ±${Math.abs(remainingWeight).toFixed(1)} ${unit} per side.`
    );
  }

  return { plates, remainingWeight, warnings };
}

/**
 * Generate human-readable instruction
 * @param {Array} plates - Plate array
 * @param {number} barWeight - Bar weight
 * @param {number} targetWeight - Target weight
 * @param {Object} config - Bar config
 * @returns {string} Instruction text
 */
function generateInstruction(plates, barWeight, targetWeight, config) {
  const plateCounts = {};
  plates.forEach(p => {
    plateCounts[p.weight] = (plateCounts[p.weight] || 0) + 1;
  });

  const plateStrings = [];
  for (const [weight, count] of Object.entries(plateCounts).sort((a, b) => b[0] - a[0])) {
    if (count === 1) {
      plateStrings.push(weight);
    } else {
      plateStrings.push(`${count}x${weight}`);
    }
  }

  const platesPerSide = plateStrings.length > 0 ? plateStrings.join(' + ') : 'no plates';
  const totalPlateWeight = plates.reduce((sum, p) => sum + p.weight * 2, 0);
  const actualTotal = barWeight + totalPlateWeight;

  return `Load ${barWeight} ${config.unit} bar + ${platesPerSide} each side → ${actualTotal.toFixed(1)} ${config.unit} total`;
}

/**
 * Generate fallback option
 * @param {number} targetWeight - Target weight per side
 * @param {Array} availablePlates - Available plates
 * @param {Object} config - Bar config
 * @returns {Object} Fallback option
 */
function generateFallback(targetWeight, availablePlates, config) {
  // Find next lower achievable weight
  const smallerTarget = targetWeight - (availablePlates[availablePlates.length - 1] || 2.5);

  const { plates } = calculatePlateCombination(smallerTarget, availablePlates, config.unit);

  return {
    totalWeight: config.barWeight + plates.reduce((sum, p) => sum + p.weight * 2, 0),
    instruction: `If missing plates, use ${Math.floor(smallerTarget * 2 + config.barWeight)} ${config.unit} and add 2-3 reps per set`,
    plates,
  };
}

// Export for testing
module.exports = { calculateWeightLoad, BAR_CONFIGS };
