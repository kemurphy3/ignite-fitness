/**
 * Periodization Planner Function
 * Generates unified training periodization with seasonal macrocycles and 4-week microcycles
 */

exports.handler = async (event, _context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { sport, season, gameDates, preferences } = JSON.parse(event.body || '{}');

    if (!sport || !season) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'sport and season are required' }),
      };
    }

    const periodization = generatePeriodization(sport, season, gameDates, preferences);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(periodization),
    };
  } catch (error) {
    console.error('Periodization planner error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Generate periodization plan
 * @param {string} sport - Sport type
 * @param {string} season - Seasonal phase
 * @param {Array} gameDates - Important game dates
 * @param {Object} preferences - User preferences
 * @returns {Object} Periodization plan
 */
function generatePeriodization(sport, season, gameDates = [], preferences = {}) {
  // Define seasonal macrocycles
  const macrocycles = {
    'off-season': {
      duration: '12-16 weeks',
      focus: 'strength_power_development',
      intensity: 'high',
      volume: 'moderate',
      blocks: 3, // 3-4 blocks of 4 weeks each
    },
    'pre-season': {
      duration: '6-8 weeks',
      focus: 'sport_specific_preparation',
      intensity: 'high',
      volume: 'high',
      blocks: 2, // 2 blocks of 4 weeks each
    },
    'in-season': {
      duration: '24-36 weeks',
      focus: 'performance_maintenance',
      intensity: 'moderate',
      volume: 'moderate',
      blocks: 6, // 6-9 blocks of 4 weeks each
    },
    'post-season': {
      duration: '2-4 weeks',
      focus: 'recovery_regeneration',
      intensity: 'low',
      volume: 'low',
      blocks: 1, // 1 block
    },
  };

  const macrocycle = macrocycles[season] || macrocycles['off-season'];
  const resolvedStartDate = resolveProgramStartDate(preferences) || new Date();

  // Generate 4-week microcycle blocks
  const blocks = [];
  for (let i = 1; i <= macrocycle.blocks; i++) {
    const block = generateMicrocycleBlock(i, macrocycle, gameDates, resolvedStartDate);
    blocks.push(block);
  }

  // Calculate auto-taper before games
  const taperWeeks = calculateAutoTaper(gameDates, blocks);

  return {
    sport,
    season,
    macrocycle,
    blocks,
    taperWeeks,
    gameDates: gameDates.map(d => ({
      date: d,
      daysUntil: calculateDaysUntil(d),
      taperApplied: taperWeeks.some(t => t.gameDate === d),
    })),
    summary: {
      totalWeeks: blocks.length * 4,
      totalBlocks: blocks.length,
      programStartDate: resolvedStartDate.toISOString(),
      phaseProgress: calculatePhaseProgress(blocks, resolvedStartDate),
      recommendations: generateRecommendations(season, blocks),
    },
  };
}

/**
 * Generate microcycle block
 * @param {number} blockNumber - Block number
 * @param {Object} macrocycle - Macrocycle config
 * @param {Array} gameDates - Game dates
 * @param {Date} programStartDate - The start date of the training program
 * @returns {Object} Microcycle block
 */
function generateMicrocycleBlock(
  blockNumber,
  macrocycle,
  gameDates,
  programStartDate = new Date()
) {
  const weeks = [];

  for (let week = 1; week <= 4; week++) {
    const weekStartDate = calculateWeekStartDate(week, blockNumber, programStartDate);
    const weekData = {
      week: `${blockNumber}-${week}`,
      volumeMultiplier: calculateVolumeMultiplier(week),
      intensityMultiplier: calculateIntensityMultiplier(week),
      isDeload: week === 4,
      focus: macrocycle.focus,
      trainingLoad: macrocycle.intensity,
      gameConflict: hasGameConflict(week, blockNumber, gameDates),
      startDate: weekStartDate,
    };

    // Apply taper if game is close
    const taperAdjustment = calculateTaperAdjustment(week, blockNumber, gameDates);
    if (taperAdjustment) {
      weekData.taper = true;
      weekData.volumeMultiplier *= taperAdjustment.volume;
      weekData.intensityMultiplier *= taperAdjustment.intensity;
      weekData.reason = `Tapering for game on ${taperAdjustment.gameDate}`;
    }

    weeks.push(weekData);
  }

  return {
    blockNumber,
    phase: macrocycle.focus,
    weeks,
    startDate: calculateBlockStartDate(blockNumber, programStartDate),
    endDate: calculateBlockEndDate(blockNumber, programStartDate),
    focusAreas: [], // TODO: determineFocusAreas(blockNumber, macrocycle),
    deloadWeek: 4,
    taperWeeks: [], // TODO: identifyTaperWeeks(weeks),
    readinessFocus: [], // TODO: determineReadinessFocus(macrocycle, blockNumber),
  };
}

/**
 * Calculate volume multiplier for week
 * @param {number} week - Week in block (1-4)
 * @returns {number} Volume multiplier
 */
function calculateVolumeMultiplier(week) {
  if (week === 4) {
    return 0.6;
  } // Deload: -40%
  return 0.7 + week * 0.1; // Progressive: 0.8, 0.9, 1.0
}

/**
 * Calculate intensity multiplier for week
 * @param {number} week - Week in block (1-4)
 * @returns {number} Intensity multiplier
 */
function calculateIntensityMultiplier(week) {
  if (week === 4) {
    return 0.85;
  } // Deload: -15%
  return 0.9 + week * 0.033; // Progressive: 0.933, 0.966, 1.0
}

/**
 * Check for game conflict in week
 * @param {number} week - Week in block
 * @param {number} blockNumber - Block number
 * @param {Array} gameDates - Game dates
 * @returns {boolean} Has game conflict
 */
function hasGameConflict(week, blockNumber, gameDates) {
  if (!gameDates || gameDates.length === 0) {
    return false;
  }

  const weekStartDate = calculateWeekStartDate(week, blockNumber, new Date());
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  return gameDates.some(gameDate => {
    const game = new Date(gameDate);
    return game >= weekStartDate && game < weekEndDate;
  });
}

/**
 * Calculate auto-taper adjustments
 * @param {Array} gameDates - Game dates
 * @param {Array} blocks - Training blocks
 * @returns {Array} Taper weeks
 */
function calculateAutoTaper(gameDates, blocks) {
  if (!gameDates || gameDates.length === 0) {
    return [];
  }

  const taperWeeks = [];

  gameDates.forEach(gameDate => {
    const game = new Date(gameDate);

    // Taper protocol: 2 weeks before game
    const taperStart = new Date(game);
    taperStart.setDate(taperStart.getDate() - 14);

    blocks.forEach(block => {
      block.weeks.forEach(week => {
        const weekStart = calculateWeekStartDate(
          week.week.split('-')[1],
          block.blockNumber,
          new Date()
        );
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        if (weekStart <= taperStart && weekEnd > taperStart) {
          taperWeeks.push({
            gameDate,
            week: week.week,
            adjustments: {
              volume: 0.7, // -30% volume
              intensity: 0.9, // -10% intensity
            },
          });
        }
      });
    });
  });

  return taperWeeks;
}

/**
 * Calculate taper adjustment
 * @param {number} week - Week in block
 * @param {number} blockNumber - Block number
 * @param {Array} gameDates - Game dates
 * @returns {Object|null} Taper adjustment
 */
function calculateTaperAdjustment(week, blockNumber, gameDates) {
  if (!gameDates || gameDates.length === 0) {
    return null;
  }

  const weekStartDate = calculateWeekStartDate(week, blockNumber, new Date());

  for (const gameDate of gameDates) {
    const game = new Date(gameDate);
    const daysUntil = Math.floor((game - weekStartDate) / (1000 * 60 * 60 * 24));

    if (daysUntil >= 0 && daysUntil <= 14) {
      // Apply taper in 2 weeks before game
      const taperIntensity = 1 - daysUntil / 14; // 0 to 1 scale

      return {
        volume: Math.max(0.5, 1 - taperIntensity * 0.3), // -30% max
        intensity: Math.max(0.8, 1 - taperIntensity * 0.2), // -20% max
        gameDate,
      };
    }
  }

  return null;
}

/**
 * Calculate week start date
 * @param {number} week - Week number within block
 * @param {number} blockNumber - Block number
 * @returns {Date} Week start date
 */
function calculateWeekStartDate(week, blockNumber, programStartDate) {
  const baseDate = programStartDate ? new Date(programStartDate) : new Date();
  const weeksOffset = (blockNumber - 1) * 4 + (week - 1);
  const computedStart = new Date(baseDate.getTime());
  computedStart.setDate(computedStart.getDate() + weeksOffset * 7);
  return computedStart;
}

/**
 * Calculate block start date
 * @param {number} blockNumber - Block number
 * @returns {Date} Block start date
 */
function calculateBlockStartDate(blockNumber, programStartDate) {
  const baseDate = programStartDate ? new Date(programStartDate) : new Date();
  const computedStart = new Date(baseDate.getTime());
  const weeksOffset = (blockNumber - 1) * 4;
  computedStart.setDate(computedStart.getDate() + weeksOffset * 7);
  return computedStart;
}

/**
 * Calculate block end date
 * @param {number} blockNumber - Block number
 * @returns {Date} Block end date
 */
function calculateBlockEndDate(blockNumber, programStartDate) {
  const startDate = calculateBlockStartDate(blockNumber, programStartDate);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 28); // 4 weeks
  return endDate;
}

/**
 * Calculate days until date
 * @param {string} gameDate - Game date
 * @returns {number} Days until
 */
function calculateDaysUntil(gameDate) {
  const game = new Date(gameDate);
  const now = new Date();
  return Math.ceil((game - now) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate phase progress
 * @param {Array} blocks - Training blocks
 * @param {Date} programStartDate - The start date of the training program
 * @returns {Object} Phase progress
 */
function calculatePhaseProgress(blocks, programStartDate) {
  const totalWeeks = blocks.length * 4;
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  let currentWeek = 0;

  const normalizedStart = programStartDate ? new Date(programStartDate) : null;
  const isStartValid = normalizedStart && !Number.isNaN(normalizedStart.getTime());

  if (isStartValid) {
    const now = new Date();
    const diffMs = now.getTime() - normalizedStart.getTime();

    if (diffMs < 0) {
      currentWeek = 0;
    } else {
      const calculatedWeek = Math.ceil(diffMs / msPerWeek);
      currentWeek = calculatedWeek === 0 ? 1 : calculatedWeek;
    }
  } else if (blocks.length > 0 && blocks[0]?.startDate) {
    const firstBlockStart = new Date(blocks[0].startDate);
    if (!Number.isNaN(firstBlockStart.getTime())) {
      const now = new Date();
      const diffMs = now.getTime() - firstBlockStart.getTime();
      if (diffMs >= 0) {
        const calculatedWeek = Math.ceil(diffMs / msPerWeek);
        currentWeek = calculatedWeek === 0 ? 1 : calculatedWeek;
      }
    }
  }

  if (!Number.isFinite(currentWeek) || currentWeek < 0) {
    currentWeek = 0;
  }

  if (totalWeeks > 0) {
    currentWeek = Math.min(currentWeek, totalWeeks);
  }

  const safeCurrentWeek = Math.max(currentWeek, 0);
  const percentage = totalWeeks > 0 ? Math.min(100, (safeCurrentWeek / totalWeeks) * 100) : 0;

  return {
    totalWeeks,
    currentWeek: safeCurrentWeek,
    percentage,
    completed: totalWeeks > 0 ? safeCurrentWeek >= totalWeeks : false,
  };
}

/**
 * Generate recommendations
 * @param {string} season - Season phase
 * @param {Array} blocks - Training blocks
 * @returns {Array} Recommendations
 */
function generateRecommendations(season, _blocks) {
  const recommendations = [];

  if (season === 'off-season') {
    recommendations.push('Focus on strength and power development');
    recommendations.push('Build aerobic base during deload weeks');
  } else if (season === 'pre-season') {
    recommendations.push('Increase sport-specific training');
    recommendations.push('Maintain strength while building fitness');
  } else if (season === 'in-season') {
    recommendations.push('Maintain fitness, reduce volume during travel');
    recommendations.push('Use deload weeks strategically around games');
  } else if (season === 'post-season') {
    recommendations.push('Focus on recovery and regeneration');
    recommendations.push('Active recovery activities preferred');
  }

  return recommendations;
}

/**
 * Resolve the program start date from preferences.
 * @param {Object} preferences - User preferences
 * @returns {Date|null} Resolved program start date or null
 */
function resolveProgramStartDate(preferences = {}) {
  const candidates = [
    preferences.programStartDate,
    preferences.program_start_date,
    preferences.trainingStartDate,
    preferences.training_start_date,
    preferences.startDate,
    preferences.start_date,
    preferences.seasonStartDate,
    preferences.season_start_date,
    preferences?.user_profile?.programStartDate,
    preferences?.user_profile?.program_start_date,
    preferences?.user_profile?.created_at,
    preferences?.profile?.programStartDate,
    preferences?.profile?.program_start_date,
  ].filter(Boolean);

  const validDates = candidates
    .map(value => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter(Boolean);

  if (validDates.length === 0) {
    return null;
  }

  validDates.sort((a, b) => a - b);
  return validDates[0];
}

// Export for testing
module.exports = {
  generatePeriodization,
  generateMicrocycleBlock,
  calculatePhaseProgress,
  resolveProgramStartDate,
};
