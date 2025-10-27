/**
 * Aesthetic Programming Function
 * Generates accessory exercises based on aesthetic focus while maintaining 70/30 performance/aesthetic split
 */

// Accessory matrix by focus
const ACCESSORY_MATRIX = {
    v_taper: {
        primary: [
            { name: 'Overhead Press', category: 'shoulders', sets: 3, reps: '8-10', rationale: 'Broad shoulder development' },
            { name: 'Lat Pulldowns', category: 'back', sets: 4, reps: '10-12', rationale: 'Wide lats for V-taper' },
            { name: 'Lateral Raises', category: 'shoulders', sets: 3, reps: '15-20', rationale: 'Shoulder width' },
            { name: 'Face Pulls', category: 'rear_delts', sets: 3, reps: '12-15', rationale: 'Posterior delts balance' }
        ],
        secondary: [
            { name: 'Incline DB Press', category: 'upper_chest', sets: 3, reps: '10-12' },
            { name: 'Bent Over Rows', category: 'back', sets: 4, reps: '8-10' }
        ],
        split: '70/30', // 70% performance, 30% aesthetic
        tooltip: 'Building V-taper foundation'
    },
    glutes: {
        primary: [
            { name: 'Hip Thrusts', category: 'glutes', sets: 4, reps: '12-15', rationale: 'Glute hypertrophy' },
            { name: 'Bulgarian Split Squats', category: 'glutes_quads', sets: 3, reps: '10-12', rationale: 'Unilateral glute strength' },
            { name: 'Romanian Deadlift', category: 'glutes_hams', sets: 3, reps: '10-12', rationale: 'Posterior chain' },
            { name: 'Cable Kickbacks', category: 'glutes', sets: 3, reps: '15-20', rationale: 'Glute isolation' }
        ],
        secondary: [
            { name: 'Walking Lunges', category: 'legs', sets: 3, reps: '12 per side' },
            { name: 'Calf Raises', category: 'calves', sets: 4, reps: '15-20' }
        ],
        split: '70/30',
        tooltip: 'Maximizing glute development'
    },
    toned: {
        primary: [
            { name: 'Higher Rep Accessories', category: 'full_body', sets: 3, reps: '15-20', rationale: 'Muscle endurance and tone' },
            { name: 'Circuit Training', category: 'conditioning', sets: 3, reps: '12-15', rationale: 'Fat loss and conditioning' },
            { name: 'Cable Flies', category: 'chest', sets: 3, reps: '15-20', rationale: 'Chest definition' },
            { name: 'Tricep Rope Extensions', category: 'arms', sets: 3, reps: '15-20', rationale: 'Arm definition' }
        ],
        secondary: [
            { name: 'Dumbbell Curls', category: 'arms', sets: 3, reps: '15-20' },
            { name: 'Lateral Raises', category: 'shoulders', sets: 3, reps: '20-25' }
        ],
        split: '70/30',
        tooltip: 'Building lean, athletic physique'
    },
    functional: {
        primary: [
            { name: 'Turkish Get-ups', category: 'core_stability', sets: 3, reps: '5 each side', rationale: 'Total body coordination' },
            { name: 'Kettlebell Swings', category: 'posterior_chain', sets: 3, reps: '15-20', rationale: 'Hip power and conditioning' },
            { name: 'Farmer\'s Walks', category: 'grip_strength', sets: 3, reps: 'distance', rationale: 'Functional strength' },
            { name: 'Pallof Press', category: 'core_anti-rotation', sets: 3, reps: '10-12', rationale: 'Core stability' }
        ],
        secondary: [
            { name: 'Battle Ropes', category: 'conditioning', sets: 3, reps: '30s' },
            { name: 'Sled Pushes', category: 'legs', sets: 3, reps: 'distance' }
        ],
        split: '70/30',
        tooltip: 'Movement and performance optimization'
    }
};

// Performance movements that take 70% of training time
const PERFORMANCE_MOVEMENTS = [
    'Squat', 'Deadlift', 'Bench Press', 'Overhead Press',
    'Pull-ups', 'Dips', 'Power Cleans', 'Snatches'
];

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const { aestheticFocus, readinessLevel, equipmentAvailable } = JSON.parse(event.body || '{}');

        if (!aestheticFocus) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'aestheticFocus is required' })
            };
        }

        const program = generateAestheticProgram(aestheticFocus, readinessLevel, equipmentAvailable);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(program)
        };
    } catch (error) {
        console.error('Aesthetic programming error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

/**
 * Generate aesthetic accessory program
 * @param {string} aestheticFocus - User's aesthetic focus
 * @param {number} readinessLevel - Current readiness (1-10)
 * @param {Array} equipmentAvailable - Available equipment
 * @returns {Object} Aesthetic program
 */
function generateAestheticProgram(aestheticFocus, readinessLevel = 8, equipmentAvailable = []) {
    const accessoryConfig = ACCESSORY_MATRIX[aestheticFocus] || ACCESSORY_MATRIX.functional;
    
    // Adjust volume based on readiness
    const volumeMultiplier = readinessLevel <= 6 ? 0.7 : 1.0;
    const shouldReduceAccessories = readinessLevel <= 6;
    
    // Select primary accessories (take 30% of training focus)
    const primaryAccessories = accessoryConfig.primary.map(acc => ({
        ...acc,
        adjustedSets: shouldReduceAccessories ? Math.max(1, Math.floor(acc.sets * volumeMultiplier)) : acc.sets
    }));
    
    // Select secondary accessories if readiness is good
    const secondaryAccessories = readinessLevel > 6 ? accessoryConfig.secondary : [];
    
    // Filter by equipment if provided
    const filteredAccessories = equipmentAvailable.length > 0 
        ? filterByEquipment([...primaryAccessories, ...secondaryAccessories], equipmentAvailable)
        : primaryAccessories;
    
    return {
        aestheticFocus,
        split: accessoryConfig.split,
        tooltip: accessoryConfig.tooltip,
        primaryAccessories: filteredAccessories.slice(0, primaryAccessories.length),
        secondaryAccessories: secondaryAccessories.length > 0 
            ? filteredAccessories.slice(primaryAccessories.length)
            : [],
        volumeReduced: shouldReduceAccessories,
        readinessLevel,
        totalAccessories: filteredAccessories.length,
        distribution: {
            performance: '70%',
            aesthetic: '30%'
        }
    };
}

/**
 * Filter accessories by available equipment
 * @param {Array} accessories - Accessories to filter
 * @param {Array} equipmentAvailable - Available equipment
 * @returns {Array} Filtered accessories
 */
function filterByEquipment(accessories, equipmentAvailable) {
    // Simple keyword matching for equipment
    return accessories.filter(acc => {
        const equipment = acc.name.toLowerCase() + ' ' + (acc.category || '');
        
        // Check if we have required equipment
        return equipmentAvailable.some(equip => 
            equipment.includes(equip.toLowerCase()) || 
            equipment.includes('bodyweight') ||
            equipment.includes('dumbbell') ||
            equipment.includes('barbell')
        );
    });
}

// Export for testing
module.exports = { generateAestheticProgram, ACCESSORY_MATRIX };
