// Enhanced Encryption with AWS KMS for Strava Token Management
const crypto = require('crypto');

class TokenEncryption {
  constructor() {
    this.keyCache = new Map();
    this.cacheExpiry = 3600000; // 1 hour
    this.fallbackKey = process.env.FALLBACK_ENCRYPTION_KEY; // For development
  }

  async getDecryptionKey(version = 1) {
    const cacheKey = `decrypt_${version}`;
    const cached = this.keyCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.key;
    }

    // For production, use AWS KMS
    if (process.env.AWS_REGION && process.env.KMS_KEY_ID) {
      try {
        const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');
        const kmsClient = new KMSClient({
          region: process.env.AWS_REGION
        });

        const command = new DecryptCommand({
          CiphertextBlob: Buffer.from(process.env[`KMS_KEY_V${version}`], 'base64'),
          KeyId: process.env.KMS_KEY_ID
        });

        const response = await kmsClient.send(command);
        const key = response.Plaintext;

        this.keyCache.set(cacheKey, {
          key,
          expiry: Date.now() + this.cacheExpiry
        });

        return key;
      } catch (error) {
        console.error('KMS decryption failed, falling back to local key:', error);
      }
    }

    // Fallback to local key for development
    if (this.fallbackKey) {
      const key = Buffer.from(this.fallbackKey, 'hex');
      this.keyCache.set(cacheKey, {
        key,
        expiry: Date.now() + this.cacheExpiry
      });
      return key;
    }

    throw new Error('No encryption key available');
  }

  async encrypt(data, keyVersion = 1) {
    const key = await this.getDecryptionKey(keyVersion);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted: `${keyVersion}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`,
      keyVersion
    };
  }

  async decrypt(encryptedData) {
    const [version, ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const key = await this.getDecryptionKey(parseInt(version));

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Generate a fallback key for development
  static generateFallbackKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate encryption key format
  static validateKey(key) {
    if (!key || typeof key !== 'string') {
      return false;
    }

    // Check if it's a valid hex string of correct length
    const hexRegex = /^[0-9a-fA-F]{64}$/;
    return hexRegex.test(key);
  }
}

module.exports = { TokenEncryption };
