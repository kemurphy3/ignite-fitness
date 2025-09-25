// Circuit Breaker Implementation for Strava API Calls
const { getDB } = require('./database');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 120000;
    
    this.state = 'CLOSED';
    this.failures = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
  }

  async execute(fn) {
    // Load state from database if available
    await this.loadState();
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Next attempt at ${new Date(this.nextAttempt).toISOString()}`);
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    } finally {
      // Save state to database
      await this.saveState();
    }
  }

  onSuccess() {
    this.failures = 0;
    this.lastSuccess = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log(`Circuit breaker ${this.name} is now CLOSED`);
      }
    }
  }

  onFailure(error) {
    this.failures++;
    this.lastFailure = { 
      error: error.message, 
      timestamp: Date.now(),
      status: error.status || 'UNKNOWN'
    };
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
      this.successCount = 0;
      console.error(`Circuit breaker ${this.name} is now OPEN after ${this.failures} failures`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null,
      successCount: this.successCount
    };
  }

  async loadState() {
    try {
      const sql = getDB();
      const result = await sql`
        SELECT state, failure_count, last_failure_at, next_attempt_at
        FROM circuit_breaker_state
        WHERE service_name = ${this.name}
      `;

      if (result.length > 0) {
        const state = result[0];
        this.state = state.state;
        this.failures = state.failure_count || 0;
        this.nextAttempt = state.next_attempt_at ? new Date(state.next_attempt_at).getTime() : Date.now();
        
        if (state.last_failure_at) {
          this.lastFailure = {
            timestamp: new Date(state.last_failure_at).getTime(),
            error: 'Previous failure',
            status: 'UNKNOWN'
          };
        }
      }
    } catch (error) {
      console.error('Failed to load circuit breaker state:', error);
      // Continue with current state
    }
  }

  async saveState() {
    try {
      const sql = getDB();
      await sql`
        INSERT INTO circuit_breaker_state (
          service_name, state, failure_count, last_failure_at, next_attempt_at, updated_at
        ) VALUES (
          ${this.name}, ${this.state}, ${this.failures}, 
          ${this.lastFailure ? new Date(this.lastFailure.timestamp) : null},
          ${this.state === 'OPEN' ? new Date(this.nextAttempt) : null},
          NOW()
        )
        ON CONFLICT (service_name) DO UPDATE SET
          state = EXCLUDED.state,
          failure_count = EXCLUDED.failure_count,
          last_failure_at = EXCLUDED.last_failure_at,
          next_attempt_at = EXCLUDED.next_attempt_at,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (error) {
      console.error('Failed to save circuit breaker state:', error);
    }
  }

  // Reset circuit breaker (for testing or manual intervention)
  async reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successCount = 0;
    this.lastFailure = null;
    this.lastSuccess = Date.now();
    
    await this.saveState();
    console.log(`Circuit breaker ${this.name} has been reset`);
  }

  // Check if circuit breaker allows requests
  isAvailable() {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }
}

// Create circuit breaker instances
const stravaCircuit = new CircuitBreaker('strava-api', {
  failureThreshold: 5,
  recoveryTimeout: 60000,
  monitoringPeriod: 120000
});

const stravaOAuthCircuit = new CircuitBreaker('strava-oauth', {
  failureThreshold: 3,
  recoveryTimeout: 30000,
  monitoringPeriod: 60000
});

module.exports = { 
  CircuitBreaker, 
  stravaCircuit, 
  stravaOAuthCircuit 
};
