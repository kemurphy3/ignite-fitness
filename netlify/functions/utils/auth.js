/**
 * JWT Secret Validation Utility
 * Enforces production-grade JWT secret requirements and validation
 */

const crypto = require('crypto');
const SafeLogger = require('./safe-logging');

// Create safe logger for JWT validation
const logger = SafeLogger.create({
  enableMasking: true,
  visibleChars: 4,
  maskChar: '*',
});

// JWT Secret Configuration
const JWT_CONFIG = {
  minEntropyBits: 256,
  minLength: 32,
  maxLength: 512,
  requiredCharacterSets: ['lowercase', 'uppercase', 'digits', 'special'],
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  entropyThreshold: 4.5, // Minimum entropy per character
  rotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
  maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
};

// Common weak secrets to reject
const WEAK_SECRETS = [
  'secret',
  'password',
  '123456',
  'admin',
  'test',
  'default',
  'changeme',
  'jwt',
  'token',
  'key',
  'secretkey',
  'jwtsecret',
  'mysecret',
  'supersecret',
  'verysecret',
  'secret123',
  'password123',
  'admin123',
  'test123',
  'default123',
];

/**
 * Calculate entropy of a string
 * @param {string} str - String to analyze
 * @returns {number} Entropy in bits
 */
function calculateEntropy(str) {
  const charCounts = {};
  const { length } = str;

  // Count character frequencies
  for (const char of str) {
    charCounts[char] = (charCounts[char] || 0) + 1;
  }

  // Calculate entropy using Shannon's formula
  let entropy = 0;
  for (const count of Object.values(charCounts)) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy * length;
}

/**
 * Check if string contains required character sets
 * @param {string} str - String to check
 * @returns {Object} Character set analysis
 */
function analyzeCharacterSets(str) {
  const analysis = {
    lowercase: /[a-z]/.test(str),
    uppercase: /[A-Z]/.test(str),
    digits: /[0-9]/.test(str),
    special: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(str),
    spaces: /\s/.test(str),
    unicode: /[^\x00-\x7F]/.test(str),
  };

  analysis.hasRequired = JWT_CONFIG.requiredCharacterSets.every(set => analysis[set]);

  return analysis;
}

/**
 * Check if secret is in weak secrets list
 * @param {string} secret - Secret to check
 * @returns {boolean} Is weak secret
 */
function isWeakSecret(secret) {
  const normalizedSecret = secret.toLowerCase().trim();

  return WEAK_SECRETS.some(
    weak =>
      normalizedSecret === weak ||
      normalizedSecret.includes(weak) ||
      weak.includes(normalizedSecret)
  );
}

/**
 * Check if secret follows common patterns
 * @param {string} secret - Secret to check
 * @returns {Object} Pattern analysis
 */
function analyzePatterns(secret) {
  const patterns = {
    sequential:
      /(?:0123|1234|2345|3456|4567|5678|6789|7890|abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/i.test(
        secret
      ),
    repeated: /(.)\1{3,}/.test(secret),
    keyboard: /(?:qwerty|asdf|zxcv|qwe|asd|zxc)/i.test(secret),
    common: /(?:password|admin|user|test|demo|example|sample)/i.test(secret),
    short: secret.length < JWT_CONFIG.minLength,
    long: secret.length > JWT_CONFIG.maxLength,
  };

  patterns.hasIssues = Object.values(patterns).some(Boolean);

  return patterns;
}

/**
 * Generate secure JWT secret
 * @param {number} length - Secret length (default: 64)
 * @returns {string} Secure JWT secret
 */
function generateSecureSecret(length = 64) {
  if (length < JWT_CONFIG.minLength) {
    throw new Error(`Secret length must be at least ${JWT_CONFIG.minLength} characters`);
  }

  if (length > JWT_CONFIG.maxLength) {
    throw new Error(`Secret length must be at most ${JWT_CONFIG.maxLength} characters`);
  }

  // Generate cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(Math.ceil((length * 3) / 4));
  const base64Secret = randomBytes.toString('base64');

  // Ensure it meets all requirements
  let secret = base64Secret.substring(0, length);

  // Add required character sets if missing
  const analysis = analyzeCharacterSets(secret);

  if (!analysis.lowercase) {
    secret = `${secret.substring(0, length - 1)}a`;
  }

  if (!analysis.uppercase) {
    secret = `${secret.substring(0, length - 1)}A`;
  }

  if (!analysis.digits) {
    secret = `${secret.substring(0, length - 1)}1`;
  }

  if (!analysis.special) {
    secret = `${secret.substring(0, length - 1)}!`;
  }

  // Validate the generated secret
  const validation = validateJWTSecret(secret);
  if (!validation.isValid) {
    throw new Error(`Generated secret failed validation: ${validation.errors.join(', ')}`);
  }

  logger.info('Secure JWT secret generated', {
    length: secret.length,
    entropy: validation.entropy,
    character_sets: validation.characterSets,
  });

  return secret;
}

/**
 * Validate JWT secret
 * @param {string} secret - Secret to validate
 * @returns {Object} Validation result
 */
function validateJWTSecret(secret) {
  const result = {
    isValid: true,
    errors: [],
    warnings: [],
    entropy: 0,
    characterSets: {},
    patterns: {},
    recommendations: [],
  };

  // Check if secret exists
  if (!secret || typeof secret !== 'string') {
    result.isValid = false;
    result.errors.push('Secret is required and must be a string');
    return result;
  }

  // Check length
  if (secret.length < JWT_CONFIG.minLength) {
    result.isValid = false;
    result.errors.push(`Secret must be at least ${JWT_CONFIG.minLength} characters long`);
  }

  if (secret.length > JWT_CONFIG.maxLength) {
    result.isValid = false;
    result.errors.push(`Secret must be at most ${JWT_CONFIG.maxLength} characters long`);
  }

  // Check for weak secrets
  if (isWeakSecret(secret)) {
    result.isValid = false;
    result.errors.push('Secret is in the list of common weak secrets');
  }

  // Calculate entropy
  result.entropy = calculateEntropy(secret);
  if (result.entropy < JWT_CONFIG.minEntropyBits) {
    result.isValid = false;
    result.errors.push(
      `Secret entropy (${result.entropy.toFixed(1)} bits) is below minimum (${JWT_CONFIG.minEntropyBits} bits)`
    );
  }

  // Analyze character sets
  result.characterSets = analyzeCharacterSets(secret);
  if (!result.characterSets.hasRequired) {
    result.isValid = false;
    result.errors.push('Secret must contain lowercase, uppercase, digits, and special characters');
  }

  // Analyze patterns
  result.patterns = analyzePatterns(secret);
  if (result.patterns.hasIssues) {
    result.warnings.push('Secret contains potentially weak patterns');

    if (result.patterns.sequential) {
      result.warnings.push('Secret contains sequential characters');
    }

    if (result.patterns.repeated) {
      result.warnings.push('Secret contains repeated characters');
    }

    if (result.patterns.keyboard) {
      result.warnings.push('Secret contains keyboard patterns');
    }

    if (result.patterns.common) {
      result.warnings.push('Secret contains common words');
    }
  }

  // Generate recommendations
  if (!result.isValid || result.warnings.length > 0) {
    result.recommendations.push(
      'Use generateSecureSecret() to create a cryptographically secure secret'
    );
    result.recommendations.push(
      'Ensure secret contains mixed case letters, numbers, and special characters'
    );
    result.recommendations.push('Avoid common words, patterns, and sequential characters');
    result.recommendations.push('Use a secret manager to store and rotate secrets');
  }

  return result;
}

/**
 * Validate JWT secret from environment
 * @param {string} envVar - Environment variable name
 * @returns {Object} Validation result
 */
function validateEnvironmentSecret(envVar = 'JWT_SECRET') {
  const secret = process.env[envVar];

  if (!secret) {
    logger.error('JWT secret not found in environment', {
      environment_variable: envVar,
    });

    return {
      isValid: false,
      errors: [`Environment variable ${envVar} is not set`],
      recommendations: [
        `Set ${envVar} environment variable`,
        'Use generateSecureSecret() to create a secure secret',
        'Store secret in environment variables or secret manager',
      ],
    };
  }

  const validation = validateJWTSecret(secret);

  if (!validation.isValid) {
    logger.error('JWT secret validation failed', {
      environment_variable: envVar,
      errors: validation.errors,
      entropy: validation.entropy,
    });
  } else {
    logger.info('JWT secret validation passed', {
      environment_variable: envVar,
      entropy: validation.entropy,
      length: secret.length,
    });
  }

  return validation;
}

/**
 * Initialize JWT secret validation on startup
 * @param {string} envVar - Environment variable name
 * @returns {boolean} Validation success
 */
function initializeJWTValidation(envVar = 'JWT_SECRET') {
  const validation = validateEnvironmentSecret(envVar);

  if (!validation.isValid) {
    logger.error('JWT secret validation failed on startup', {
      environment_variable: envVar,
      errors: validation.errors,
      recommendations: validation.recommendations,
    });

    // In production, fail startup
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`JWT secret validation failed: ${validation.errors.join(', ')}`);
    }

    return false;
  }

  logger.info('JWT secret validation passed on startup', {
    environment_variable: envVar,
    entropy: validation.entropy,
    length: process.env[envVar].length,
  });

  return true;
}

/**
 * Rotate JWT secret
 * @param {string} oldSecret - Current secret
 * @param {string} envVar - Environment variable name
 * @returns {Object} Rotation result
 */
function rotateJWTSecret(oldSecret, envVar = 'JWT_SECRET') {
  try {
    // Validate current secret
    const currentValidation = validateJWTSecret(oldSecret);
    if (!currentValidation.isValid) {
      throw new Error(`Current secret is invalid: ${currentValidation.errors.join(', ')}`);
    }

    // Generate new secret
    const newSecret = generateSecureSecret();

    // Validate new secret
    const newValidation = validateJWTSecret(newSecret);
    if (!newValidation.isValid) {
      throw new Error(`New secret is invalid: ${newValidation.errors.join(', ')}`);
    }

    logger.info('JWT secret rotation completed', {
      old_entropy: currentValidation.entropy,
      new_entropy: newValidation.entropy,
      environment_variable: envVar,
    });

    return {
      success: true,
      oldSecret,
      newSecret,
      oldValidation: currentValidation,
      newValidation,
    };
  } catch (error) {
    logger.error('JWT secret rotation failed', {
      error: error.message,
      environment_variable: envVar,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get JWT secret statistics
 * @param {string} envVar - Environment variable name
 * @returns {Object} Secret statistics
 */
function getJWTSecretStats(envVar = 'JWT_SECRET') {
  const secret = process.env[envVar];

  if (!secret) {
    return {
      exists: false,
      environment_variable: envVar,
    };
  }

  const validation = validateJWTSecret(secret);

  return {
    exists: true,
    environment_variable: envVar,
    length: secret.length,
    entropy: validation.entropy,
    character_sets: validation.characterSets,
    patterns: validation.patterns,
    is_valid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

// Export functions
module.exports = {
  calculateEntropy,
  analyzeCharacterSets,
  isWeakSecret,
  analyzePatterns,
  generateSecureSecret,
  validateJWTSecret,
  validateEnvironmentSecret,
  initializeJWTValidation,
  rotateJWTSecret,
  getJWTSecretStats,
  JWT_CONFIG,
  WEAK_SECRETS,
};
