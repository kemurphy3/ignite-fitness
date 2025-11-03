/**
 * Safety Module - Export GuardrailManager
 * Comprehensive safety guardrails and load management
 */

export { GuardrailManager } from './GuardrailManager.js';

// Also make available globally
if (typeof window !== 'undefined') {
    window.GuardrailManager = window.GuardrailManager || require('./GuardrailManager.js').default;
}

