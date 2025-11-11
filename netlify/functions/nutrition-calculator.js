/**
 * Nutrition Calculator Function
 * Calculates daily macro targets with sport-specific guidance
 * Based on BMR (Mifflin-St Jeor) + activity multiplier
 */

exports.handler = async (event, context) => {
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
    const { gender, age, weight, height, activityLevel, dayType, sport } = JSON.parse(
      event.body || '{}'
    );

    if (!gender || !age || !weight || !height) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' }),
      };
    }

    const nutrition = calculateNutrition(
      gender,
      age,
      weight,
      height,
      activityLevel,
      dayType,
      sport
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(nutrition),
    };
  } catch (error) {
    console.error('Nutrition calculator error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/**
 * Calculate complete nutrition plan
 * @param {string} gender - Gender (male/female)
 * @param {number} age - Age in years
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @param {string} activityLevel - Activity level
 * @param {string} dayType - Day type (game/training/rest)
 * @param {string} sport - Sport type
 * @returns {Object} Nutrition plan
 */
function calculateNutrition(
  gender,
  age,
  weight,
  height,
  activityLevel = 'moderate',
  dayType = 'training',
  sport = 'soccer',
  bodyFat = null,
  goals = null,
  weeklyLoad = null
) {
  // Calculate BMR using Mifflin-St Jeor equation
  const bmr = calculateBMR(gender, age, weight, height, bodyFat);

  // Apply activity multiplier
  const activityMultiplier = getActivityMultiplier(activityLevel);
  const maintenanceCalories = bmr * activityMultiplier;

  // Apply goal-specific adjustments
  const goalAdjustment = getGoalAdjustment(goals, dayType);

  // Apply day type adjustment
  const dayTypeAdjustment = getDayTypeAdjustment(dayType);

  // Combined adjustment
  const totalAdjustment = dayTypeAdjustment * goalAdjustment;
  const targetCalories = Math.round(maintenanceCalories * totalAdjustment);

  // Calculate macros based on goals and day type
  const macros = calculateMacrosAdaptive(targetCalories, sport, dayType, goals, weight);

  // Get sport-specific meal examples
  const mealExamples = getMealExamples(sport, dayType);

  // Get timing recommendations
  const timing = getTimingRecommendations(sport, dayType);

  // Get hydration targets
  const hydration = getHydrationTargets(dayType, sport, weight);

  return {
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(maintenanceCalories),
    targetCalories,
    goalAdjustment: (goalAdjustment - 1) * 100,
    dayTypeAdjustment: (dayTypeAdjustment - 1) * 100,
    macros,
    mealExamples,
    timing,
    hydration,
    carbTiming: getCarbTiming(dayType, sport),
    rationale: generateRationale(dayType, goals, macros, sport),
  };
}

/**
 * Calculate BMR using Mifflin-St Jeor equation
 * BMR = (10 × weight) + (6.25 × height) - (5 × age) + s
 * where s = +5 for males, -161 for females
 * @param {string} gender - Gender
 * @param {number} age - Age in years
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 * @returns {number} BMR in calories
 */
function calculateBMR(gender, age, weight, height, bodyFat = null) {
  const baseBMR = 10 * weight + 6.25 * height - 5 * age;
  const genderFactor = gender.toLowerCase() === 'male' ? 5 : -161;
  let bmr = baseBMR + genderFactor;

  // Adjust BMR based on body fat if provided
  if (bodyFat !== null) {
    // Higher body fat reduces BMR per kg
    const leanMass = weight * (1 - bodyFat / 100);
    const adjustedBMR = 370 + 21.6 * leanMass;
    bmr = adjustedBMR; // Use Katch-McArdle when body fat known
  }

  return bmr;
}

/**
 * Get goal-specific adjustments
 * @param {Array} goals - User goals
 * @param {string} dayType - Day type
 * @returns {number} Goal adjustment multiplier
 */
function getGoalAdjustment(goals, dayType) {
  if (!goals || goals.length === 0) {
    return 1.0; // No adjustment if no goals specified
  }

  // Determine primary goal
  const primaryGoal = goals[0];

  const adjustments = {
    muscle_building: {
      game: 1.15, // +15% surplus for game days
      training: 1.1, // +10% surplus
      rest: 1.05, // +5% surplus
    },
    fat_loss: {
      game: 1.0, // Maintenance for game days
      training: 0.9, // -10% deficit
      rest: 0.85, // -15% deficit
    },
    toning_maintenance: {
      game: 1.1, // +10%
      training: 1.0, // Maintenance
      rest: 0.95, // -5%
    },
    athletic_performance: {
      game: 1.2, // +20% for game days
      training: 1.1, // +10% for training
      rest: 0.9, // -10% for rest
    },
  };

  const goalAdjustments = adjustments[primaryGoal] || adjustments.toning_maintenance;
  return goalAdjustments[dayType] || 1.0;
}

/**
 * Calculate macros adaptively based on goals
 * @param {number} calories - Target calories
 * @param {string} sport - Sport type
 * @param {string} dayType - Day type
 * @param {Array} goals - User goals
 * @param {number} weightKg - Weight in kg
 * @returns {Object} Macronutrients
 */
function calculateMacrosAdaptive(calories, sport, dayType, goals, weightKg) {
  if (!goals || goals.length === 0) {
    return calculateMacros(calories, sport, dayType);
  }

  const primaryGoal = goals[0];
  const weightLb = weightKg * 2.20462;

  let proteinGrams, carbGrams, fatGrams;

  // Goal-specific protein targets
  if (primaryGoal === 'muscle_building') {
    // 0.9-1.1 g/lb
    proteinGrams = Math.round(weightLb * 1.0);
  } else if (primaryGoal === 'fat_loss') {
    // 1.2-1.3 g/lb
    proteinGrams = Math.round(weightLb * 1.25);
  } else {
    // ~1.0 g/lb for maintenance/toning
    proteinGrams = Math.round(weightLb * 1.0);
  }

  // Calculate remaining calories for carbs and fat
  const proteinCalories = proteinGrams * 4;
  const remainingCalories = calories - proteinCalories;

  // Sport and day type determine carb/fat split
  if (dayType === 'game') {
    // High carbs for game days
    carbGrams = Math.round((remainingCalories * 0.65) / 4);
    fatGrams = Math.round((remainingCalories * 0.35) / 9);
  } else if (dayType === 'training') {
    // Moderate carbs
    carbGrams = Math.round((remainingCalories * 0.5) / 4);
    fatGrams = Math.round((remainingCalories * 0.5) / 9);
  } else {
    // Rest day: lower carbs, more fats
    carbGrams = Math.round((remainingCalories * 0.4) / 4);
    fatGrams = Math.round((remainingCalories * 0.6) / 9);
  }

  return {
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    proteinPct: (((proteinGrams * 4) / calories) * 100).toFixed(0),
    carbsPct: (((carbGrams * 4) / calories) * 100).toFixed(0),
    fatPct: (((fatGrams * 9) / calories) * 100).toFixed(0),
  };
}

/**
 * Get hydration targets
 * @param {string} dayType - Day type
 * @param {string} sport - Sport type
 * @param {number} weightKg - Weight in kg
 * @returns {Object} Hydration recommendations
 */
function getHydrationTargets(dayType, sport, weightKg) {
  const baseHydration = weightKg * 35; // 35 ml per kg body weight

  const dayMultipliers = {
    game: 1.4,
    training: 1.2,
    rest: 1.0,
  };

  const dailyTarget = Math.round(baseHydration * dayMultipliers[dayType] || 1.0);

  return {
    daily: dailyTarget,
    unit: 'ml',
    duringWorkout: dayType === 'game' ? 'Drink 200ml every 15 min' : 'Drink 150ml every 20 min',
    postWorkout: 'Replace 150% of sweat loss within 4 hours',
    timing: 'Start hydrated, maintain throughout, replace after',
  };
}

/**
 * Generate rationale for nutrition recommendations
 * @param {string} dayType - Day type
 * @param {Array} goals - User goals
 * @param {Object} macros - Macronutrient breakdown
 * @param {string} sport - Sport type
 * @returns {string} Rationale text
 */
function generateRationale(dayType, goals, macros, sport) {
  const goalText = goals && goals.length > 0 ? goals[0] : 'general fitness';
  const dayText = {
    game: 'game day performance',
    training: 'training session support',
    rest: 'recovery and adaptation',
  };

  return `High protein (${macros.protein}g) supports muscle maintenance during ${dayText[dayType]}. ${dayType === 'game' ? 'Higher carbs' : 'Balanced macros'} fuel ${goalText.replace('_', ' ')} goals for ${sport}.`;
}

/**
 * Get activity multiplier
 * @param {string} activityLevel - Activity level
 * @returns {number} Activity multiplier
 */
function getActivityMultiplier(activityLevel) {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375, // 1-3 days/week
    moderate: 1.55, // 3-5 days/week
    active: 1.725, // 6-7 days/week
    very_active: 1.9, // 2x per day
  };

  return multipliers[activityLevel] || multipliers.moderate;
}

/**
 * Get day type adjustment
 * @param {string} dayType - Day type
 * @returns {number} Adjustment multiplier
 */
function getDayTypeAdjustment(dayType) {
  const adjustments = {
    game: 1.2, // +20% for game days
    training: 1.1, // +10% for training days
    rest: 0.9, // -10% for rest days
  };

  return adjustments[dayType] || adjustments.training;
}

/**
 * Calculate macros
 * @param {number} targetCalories - Target calories
 * @param {string} sport - Sport type
 * @param {string} dayType - Day type
 * @returns {Object} Macronutrient breakdown
 */
function calculateMacros(targetCalories, sport, dayType) {
  // Sport-specific macro ratios
  const macroRatios = {
    soccer: {
      game: { protein: 0.2, carbs: 0.55, fat: 0.25 },
      training: { protein: 0.25, carbs: 0.45, fat: 0.3 },
      rest: { protein: 0.3, carbs: 0.35, fat: 0.35 },
    },
    basketball: {
      game: { protein: 0.2, carbs: 0.6, fat: 0.2 },
      training: { protein: 0.25, carbs: 0.5, fat: 0.25 },
      rest: { protein: 0.3, carbs: 0.35, fat: 0.35 },
    },
    running: {
      game: { protein: 0.15, carbs: 0.65, fat: 0.2 },
      training: { protein: 0.2, carbs: 0.6, fat: 0.2 },
      rest: { protein: 0.25, carbs: 0.4, fat: 0.35 },
    },
    default: {
      game: { protein: 0.2, carbs: 0.55, fat: 0.25 },
      training: { protein: 0.25, carbs: 0.45, fat: 0.3 },
      rest: { protein: 0.3, carbs: 0.35, fat: 0.35 },
    },
  };

  const ratios = macroRatios[sport] || macroRatios.default;
  const dayRatios = ratios[dayType] || ratios.training;

  const proteinGrams = Math.round((targetCalories * dayRatios.protein) / 4);
  const carbGrams = Math.round((targetCalories * dayRatios.carbs) / 4);
  const fatGrams = Math.round((targetCalories * dayRatios.fat) / 9);

  return {
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    proteinPct: (dayRatios.protein * 100).toFixed(0),
    carbsPct: (dayRatios.carbs * 100).toFixed(0),
    fatPct: (dayRatios.fat * 100).toFixed(0),
  };
}

/**
 * Get sport-specific meal examples
 * @param {string} sport - Sport type
 * @param {string} dayType - Day type
 * @returns {Object} Meal examples
 */
function getMealExamples(sport, dayType) {
  const examples = {
    soccer: {
      pre: ['Banana + peanut butter', 'Oatmeal + berries', 'Bagel + honey', 'Energy bar + banana'],
      post: [
        'Chocolate milk + protein',
        'Rice + chicken + vegetables',
        'Pasta + lean protein',
        'Protein shake + banana',
      ],
      game: [
        'Simple carbs 2-3 hours before',
        'Coffee/caffeine if tolerated',
        'Hydration: 16-24 oz water',
        'Banana at halftime',
      ],
    },
    basketball: {
      pre: ['Bagel + jam', 'Energy gel + banana', 'Sports drink', 'White rice + grilled chicken'],
      post: [
        'Protein shake + carbs',
        'Sweet potato + salmon',
        'Quinoa + vegetables + protein',
        'Smoothie with protein powder',
      ],
      game: [
        'Light meal 2-3 hours before',
        'Hydration throughout',
        'Energy gels during breaks',
        'Rapid recovery shake post-game',
      ],
    },
    running: {
      pre: [
        'Banana 30-60 min before',
        'Toast + almond butter',
        'Caffeine + simple carbs',
        'Energy bar if >60 min run',
      ],
      post: [
        '4:1 carbs to protein within 30 min',
        'Chocolate milk',
        'Rice + protein',
        'Recovery drink',
      ],
      game: [
        'Carbo-load 2-3 days before race',
        'Hydration strategy',
        'Fuel every 45-60 min during',
        'Rapid refuel post-race',
      ],
    },
  };

  const sportExamples = examples[sport] || examples.soccer;
  return sportExamples[dayType] || sportExamples.pre;
}

/**
 * Get timing recommendations
 * @param {string} sport - Sport type
 * @param {string} dayType - Day type
 * @returns {Object} Timing recommendations
 */
function getTimingRecommendations(sport, dayType) {
  if (dayType === 'game') {
    return {
      '3-4 hours before': 'Larger meal: Carbs + moderate protein + low fat',
      '1-2 hours before': 'Light snack: Simple carbs, avoid fiber/fat',
      During: 'Sports drink, energy gels if >90 min',
      'Within 30 min after': 'Rapid refuel: 4:1 carbs to protein',
      '2-3 hours after': 'Recovery meal: Balanced macros',
    };
  } else if (dayType === 'training') {
    return {
      'Pre-workout (1-2 hours)': 'Simple carbs + protein',
      'During workout': 'Hydration only if <60 min',
      'Post-workout (0-30 min)': 'Rapid protein + carbs',
      Evening: 'Balanced dinner with complex carbs',
    };
  } else {
    return {
      Breakfast: 'Protein + healthy fats',
      Lunch: 'Balanced with vegetables',
      Dinner: 'Lighter meal, focus on protein',
    };
  }
}

/**
 * Get carb timing recommendations
 * @param {string} dayType - Day type
 * @param {string} sport - Sport type
 * @returns {Object} Carb timing
 */
function getCarbTiming(dayType, sport) {
  if (dayType === 'game') {
    return {
      '2-3 hours before': 'Largest meal with carbs',
      '30-60 min before': 'Small snack if needed',
      'Halftime/breaks': 'Quick carbs (banana, energy gel)',
      'Post-game': 'Rapid carbohydrate + protein',
      'Next day': 'Continue high carbs for recovery',
    };
  } else if (dayType === 'training') {
    return {
      'Pre-workout': 'Carbs for energy',
      'Post-workout': 'Carbs for recovery',
      'Meal timing': 'Time carbs around training sessions',
    };
  } else {
    return {
      Focus: 'Lower carb intake',
      'Meal timing': 'Spread meals evenly',
      Note: 'Maintain protein and healthy fats',
    };
  }
}

module.exports = { calculateNutrition, calculateBMR };
