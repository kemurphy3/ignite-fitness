// Authentication Module
// Handles user login, registration, password reset, and session management

const authCompat = (() => {
  const simpleHash = str => {
    let hash = 0;
    if (!str) {
      return hash.toString(16);
    }
    for (let i = 0; i < str.length; i += 1) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash;
    }
    return Math.abs(hash).toString(16);
  };

  const callIfAvailable = methodName => (...args) => {
    if (typeof window !== 'undefined' && typeof window[methodName] === 'function') {
      return window[methodName](...args);
    }
    return undefined;
  };

  return {
    login: callIfAvailable('login'),
    register: callIfAvailable('register'),
    resetPassword: callIfAvailable('resetPassword'),
    showPasswordReset: callIfAvailable('showPasswordReset'),
    hidePasswordReset: callIfAvailable('hidePasswordReset'),
    showRegisterForm: callIfAvailable('showRegisterForm'),
    hideRegisterForm: callIfAvailable('hideRegisterForm'),
    showLoginForm: callIfAvailable('showLoginForm'),
    hideLoginForm: callIfAvailable('hideLoginForm'),
    simpleHash,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = authCompat;
} else if (typeof window !== 'undefined') {
  window.AuthCompatibility = authCompat;
}
