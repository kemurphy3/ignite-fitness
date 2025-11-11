/**
 * Hash Utilities
 * Provides SHA256 hashing for deduplication and data integrity
 */

class HashUtils {
  /**
   * Generate SHA256 hash of input string
   * @param {string} input - String to hash
   * @returns {string} SHA256 hash in hex format
   */
  static sha256(input) {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    // Use Web Crypto API if available (browser/Node 16+)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      return this.sha256WebCrypto(input);
    }

    // Fallback to Node.js crypto module
    if (typeof require !== 'undefined') {
      try {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
      } catch (error) {
        throw new Error('SHA256 not available in this environment');
      }
    }

    throw new Error('SHA256 not available in this environment');
  }

  /**
   * Generate SHA256 hash using Web Crypto API
   * @param {string} input - String to hash
   * @returns {Promise<string>} SHA256 hash in hex format
   */
  static async sha256WebCrypto(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate SHA256 hash synchronously (Node.js only)
   * @param {string} input - String to hash
   * @returns {string} SHA256 hash in hex format
   */
  static sha256Sync(input) {
    if (typeof require === 'undefined') {
      throw new Error('Synchronous SHA256 only available in Node.js');
    }

    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    } catch (error) {
      throw new Error('SHA256 not available in this environment');
    }
  }

  /**
   * Generate hash for activity deduplication
   * @param {Object} activity - Activity data
   * @param {number} activity.userId - User ID
   * @param {string} activity.startTs - Start timestamp (ISO string)
   * @param {number} activity.durationS - Duration in seconds
   * @param {string} activity.type - Activity type
   * @returns {string} SHA256 hash for deduplication
   */
  static buildDedupHash(activity) {
    const { userId, startTs, durationS, type } = activity;

    if (!userId || !startTs || !durationS || !type) {
      throw new Error('Missing required fields for dedup hash');
    }

    // Round duration to minutes for fuzzy matching
    const durationMinutes = Math.round(durationS / 60);

    // Create normalized string for hashing
    const hashInput = `${userId}|${startTs}|${durationMinutes}|${type}`;

    return this.sha256Sync(hashInput);
  }

  /**
   * Generate hash for raw data deduplication
   * @param {string|Object} rawData - Raw data to hash
   * @returns {string} SHA256 hash
   */
  static hashRawData(rawData) {
    let input;

    if (typeof rawData === 'string') {
      input = rawData;
    } else if (typeof rawData === 'object') {
      // Sort keys for consistent hashing
      input = JSON.stringify(rawData, Object.keys(rawData).sort());
    } else {
      input = String(rawData);
    }

    return this.sha256Sync(input);
  }

  /**
   * Generate hash for user-specific data
   * @param {number} userId - User ID
   * @param {string} data - Data to hash
   * @returns {string} SHA256 hash
   */
  static hashUserData(userId, data) {
    const input = `${userId}|${data}`;
    return this.sha256Sync(input);
  }

  /**
   * Verify hash integrity
   * @param {string} data - Original data
   * @param {string} hash - Hash to verify
   * @returns {boolean} True if hash matches
   */
  static verifyHash(data, hash) {
    const computedHash = this.sha256Sync(data);
    return computedHash === hash;
  }

  /**
   * Generate short hash (first 8 characters)
   * @param {string} input - String to hash
   * @returns {string} Short hash
   */
  static shortHash(input) {
    return this.sha256Sync(input).substring(0, 8);
  }

  /**
   * Generate hash with salt
   * @param {string} input - String to hash
   * @param {string} salt - Salt to add
   * @returns {string} SHA256 hash with salt
   */
  static hashWithSalt(input, salt) {
    const saltedInput = `${salt}|${input}`;
    return this.sha256Sync(saltedInput);
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HashUtils;
}

// Export for browser
if (typeof window !== 'undefined') {
  window.HashUtils = HashUtils;
}
