// Unit Conversion Utilities for User Profiles
const convertUnits = {
    // Convert height to centimeters
    toCm(height) {
        if (typeof height === 'number') {
            return height; // Already in cm
        }

        if (height.unit === 'feet') {
            return (height.value * 30.48) + ((height.inches || 0) * 2.54);
        } else if (height.unit === 'inches') {
            return height.value * 2.54;
        } else if (height.unit === 'cm') {
            return height.value;
        }

        throw new Error(`Unsupported height unit: ${height.unit}`);
    },

    // Convert weight to kilograms
    toKg(weight) {
        if (typeof weight === 'number') {
            return weight; // Already in kg
        }

        if (weight.unit === 'lbs') {
            return weight.value * 0.453592;
        } else if (weight.unit === 'kg') {
            return weight.value;
        }

        throw new Error(`Unsupported weight unit: ${weight.unit}`);
    },

    // Convert centimeters to feet and inches
    toFeetInches(cm) {
        if (!cm) {return null;}

        const totalInches = cm / 2.54;
        const feet = Math.floor(totalInches / 12);
        const inches = Math.round(totalInches % 12);

        return {
            feet,
            inches,
            display: `${feet}'${inches}"`,
            total_inches: Math.round(totalInches)
        };
    },

    // Convert kilograms to pounds
    toLbs(kg) {
        if (!kg) {return null;}
        return Math.round(kg * 2.20462 * 100) / 100; // Round to 2 decimal places
    },

    // Convert pounds to kilograms
    lbsToKg(lbs) {
        if (!lbs) {return null;}
        return Math.round(lbs * 0.453592 * 100) / 100; // Round to 2 decimal places
    },

    // Convert feet and inches to centimeters
    feetInchesToCm(feet, inches = 0) {
        return (feet * 30.48) + (inches * 2.54);
    },

    // Format time in seconds to MM:SS or HH:MM:SS
    formatTime(seconds) {
        if (!seconds) {return null;}

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    },

    // Parse time string to seconds
    parseTime(timeString) {
        if (!timeString) {return null;}

        const parts = timeString.split(':').map(Number);

        if (parts.length === 2) {
            // MM:SS format
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
            // HH:MM:SS format
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        throw new Error(`Invalid time format: ${timeString}`);
    },

    // Validate height input
    validateHeight(height) {
        if (typeof height === 'number') {
            return height >= 50 && height <= 300;
        }

        if (height.unit === 'feet') {
            const totalInches = (height.value * 12) + (height.inches || 0);
            return totalInches >= 20 && totalInches <= 120;
        } else if (height.unit === 'inches') {
            return height.value >= 20 && height.value <= 120;
        } else if (height.unit === 'cm') {
            return height.value >= 50 && height.value <= 300;
        }

        return false;
    },

    // Validate weight input
    validateWeight(weight) {
        if (typeof weight === 'number') {
            return weight >= 20 && weight <= 500;
        }

        if (weight.unit === 'lbs') {
            return weight.value >= 44 && weight.value <= 1100;
        } else if (weight.unit === 'kg') {
            return weight.value >= 20 && weight.value <= 500;
        }

        return false;
    },

    // Get unit display name
    getUnitDisplayName(unit) {
        const units = {
            'cm': 'centimeters',
            'inches': 'inches',
            'feet': 'feet',
            'kg': 'kilograms',
            'lbs': 'pounds',
            'metric': 'metric',
            'imperial': 'imperial'
        };

        return units[unit] || unit;
    },

    // Convert profile data to preferred units
    convertProfileToUnits(profile, preferredUnits) {
        const converted = { ...profile };

        if (preferredUnits === 'imperial') {
            if (converted.height_cm) {
                converted.height = this.toFeetInches(converted.height_cm);
                delete converted.height_cm;
            }

            if (converted.weight_kg) {
                converted.weight = this.toLbs(converted.weight_kg);
                delete converted.weight_kg;
            }

            // Convert lift maxes
            if (converted.bench_press_max) {
                converted.bench_press_max = this.toLbs(converted.bench_press_max);
            }
            if (converted.squat_max) {
                converted.squat_max = this.toLbs(converted.squat_max);
            }
            if (converted.deadlift_max) {
                converted.deadlift_max = this.toLbs(converted.deadlift_max);
            }
            if (converted.overhead_press_max) {
                converted.overhead_press_max = this.toLbs(converted.overhead_press_max);
            }
            if (converted.total_lifts) {
                converted.total_lifts = this.toLbs(converted.total_lifts);
            }
        } else {
            // Ensure metric units are used
            if (converted.height) {
                converted.height_cm = this.toCm(converted.height);
                delete converted.height;
            }

            if (converted.weight) {
                converted.weight_kg = this.toKg(converted.weight);
                delete converted.weight;
            }
        }

        return converted;
    }
};

module.exports = convertUnits;
