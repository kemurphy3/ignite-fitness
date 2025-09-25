// JWT Authentication Utilities for User Profiles
const jwt = require('jsonwebtoken');

async function verifyJWT(headers) {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded.sub; // user_id
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return null;
    }
}

// Generate JWT token for testing
function generateTestToken(userId, expiresIn = '24h') {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }
    
    return jwt.sign(
        { 
            sub: userId,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        process.env.JWT_SECRET,
        { expiresIn }
    );
}

// Validate JWT token without verification (for testing)
function parseJWT(token) {
    try {
        const decoded = jwt.decode(token, { complete: true });
        return decoded;
    } catch (error) {
        return null;
    }
}

// Check if token is expired
function isTokenExpired(token) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) {
            return true;
        }
        return Date.now() >= decoded.exp * 1000;
    } catch (error) {
        return true;
    }
}

// Extract user ID from token without verification (for logging)
function extractUserIdFromToken(token) {
    try {
        const decoded = jwt.decode(token);
        return decoded?.sub || null;
    } catch (error) {
        return null;
    }
}

// Validate JWT secret is configured
function validateJWTConfig() {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    
    return true;
}

// Generate a secure JWT secret (for development)
function generateJWTSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
}

module.exports = {
    verifyJWT,
    generateTestToken,
    parseJWT,
    isTokenExpired,
    extractUserIdFromToken,
    validateJWTConfig,
    generateJWTSecret
};
