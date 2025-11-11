// Authentication Module
// Handles user login, registration, password reset, and session management

// Access global variables
let currentUser, isLoggedIn, users, showUserDashboard, loadUserData, showSuccess, showError;

// Initialize with global references
function initAuth(globals) {
  currentUser = globals.currentUser;
  isLoggedIn = globals.isLoggedIn;
  users = globals.users;
  showUserDashboard = globals.showUserDashboard;
  // hideLoginForm is defined as a function below, not from globals
  loadUserData = globals.loadUserData;
  showSuccess = globals.showSuccess;
  showError = globals.showError;
}

// Simple hash function for password hashing (in production, use bcrypt)
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

// Login function
function login() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');

  if (!username || !password) {
    showError(errorDiv, 'Please enter both username and password');
    return;
  }

  // Load users from localStorage
  const savedUsers = localStorage.getItem('ignitefitness_users');
  if (savedUsers) {
    users = JSON.parse(savedUsers);
  }

  // Check if user exists and verify password hash
  if (users[username] && users[username].passwordHash) {
    const passwordHash = simpleHash(password);
    if (users[username].passwordHash === passwordHash) {
      currentUser = username;
      isLoggedIn = true;
      localStorage.setItem('ignitefitness_current_user', username);
      localStorage.setItem('ignitefitness_login_time', Date.now().toString());
      showSuccess('Login successful!');
      showUserDashboard();
      hideLoginForm();
      loadUserData();
    } else {
      showError(errorDiv, 'Invalid username or password');
    }
  } else {
    showError(errorDiv, 'User not found. Please register first.');
  }
}

// Register function
function register() {
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirmPassword = document.getElementById('regConfirmPassword').value;
  const athleteName = document.getElementById('regAthleteName').value;
  const errorDiv = document.getElementById('registerError');

  if (!username || !password || !athleteName) {
    showError(errorDiv, 'Please fill in all fields');
    return;
  }

  if (password !== confirmPassword) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  // Load existing users
  const savedUsers = localStorage.getItem('ignitefitness_users');
  if (savedUsers) {
    users = JSON.parse(savedUsers);
  }

  if (users[username]) {
    showError(errorDiv, 'Username already exists');
    return;
  }

  // Validate password strength
  if (password.length < 6) {
    showError(errorDiv, 'Password must be at least 6 characters long');
    return;
  }

  // Create new user with hashed password
  users[username] = {
    passwordHash: simpleHash(password), // Store hashed password
    athleteName,
    personalData: {},
    goals: {},
    wearableSettings: {},
    workoutPlan: null,
    data: {
      workouts: [],
      soccerSessions: [],
      recoveryData: [],
      stravaData: [],
      sleepData: [],
    },
    createdAt: Date.now(),
    lastLogin: null,
  };

  // Save users
  localStorage.setItem('ignitefitness_users', JSON.stringify(users));

  // Auto-login after registration
  currentUser = username;
  isLoggedIn = true;
  localStorage.setItem('ignitefitness_current_user', username);
  showSuccess('Registration successful! Welcome to Ignite Fitness!');
  showUserDashboard();
  hideRegisterForm();
  loadUserData();
}

// Password reset function
function resetPassword() {
  const username = document.getElementById('resetUsername').value;
  const athleteName = document.getElementById('resetAthleteName').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  const errorDiv = document.getElementById('resetError');

  if (!username || !athleteName || !newPassword || !confirmPassword) {
    showError(errorDiv, 'Please fill in all fields');
    return;
  }

  if (newPassword !== confirmPassword) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  if (newPassword.length < 6) {
    showError(errorDiv, 'Password must be at least 6 characters long');
    return;
  }

  // Load existing users
  const savedUsers = localStorage.getItem('ignitefitness_users');
  if (savedUsers) {
    users = JSON.parse(savedUsers);
  }

  // Verify user exists and athlete name matches
  if (users[username] && users[username].athleteName === athleteName) {
    // Update password hash
    users[username].passwordHash = simpleHash(newPassword);
    users[username].lastPasswordReset = Date.now();

    // Save updated users
    localStorage.setItem('ignitefitness_users', JSON.stringify(users));

    showSuccess('Password reset successfully! Please login with your new password.');
    hidePasswordReset();
  } else {
    showError(errorDiv, 'Invalid username or athlete name');
  }
}

// UI Functions
function showPasswordReset() {
  const loginForm = document.getElementById('loginForm');
  const passwordResetForm = document.getElementById('passwordResetForm');
  if (loginForm && passwordResetForm) {
    loginForm.classList.add('hidden');
    passwordResetForm.classList.remove('hidden');
  }
}

function hidePasswordReset() {
  const passwordResetForm = document.getElementById('passwordResetForm');
  const loginForm = document.getElementById('loginForm');
  if (passwordResetForm && loginForm) {
    passwordResetForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  }
}

function showRegisterForm() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  if (loginForm && registerForm) {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  }
}

function hideRegisterForm() {
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.classList.add('hidden');
  }
}

function showLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.classList.remove('hidden');
  }
  // Hide other forms
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.classList.add('hidden');
  }
  const passwordResetForm = document.getElementById('passwordResetForm');
  if (passwordResetForm) {
    passwordResetForm.classList.add('hidden');
  }
}

function hideLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.classList.add('hidden');
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    login,
    register,
    resetPassword,
    showPasswordReset,
    hidePasswordReset,
    showRegisterForm,
    hideRegisterForm,
    showLoginForm,
    hideLoginForm,
    simpleHash,
  };
} else {
  // Make available globally for browser
  window.login = login;
  window.register = register;
  window.resetPassword = resetPassword;
  window.showPasswordReset = showPasswordReset;
  window.hidePasswordReset = hidePasswordReset;
  window.showRegisterForm = showRegisterForm;
  window.hideRegisterForm = hideRegisterForm;
  window.showLoginForm = showLoginForm;
  window.hideLoginForm = hideLoginForm;
  window.simpleHash = simpleHash;
}
