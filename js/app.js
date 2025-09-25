// Simplified App.js - All functionality in one file for reliability
// This ensures everything works without complex module dependencies

// Global variables
let currentUser = null;
let isLoggedIn = false;
let users = {};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('Ignite Fitness App Starting...');
    
    // Check if user is already logged in
    const savedUser = localStorage.getItem('ignitefitness_current_user');
    if (savedUser) {
        currentUser = savedUser;
        isLoggedIn = true;
    }
    
    // Load users from localStorage
    const savedUsers = localStorage.getItem('ignitefitness_users');
    if (savedUsers) {
        try {
            users = JSON.parse(savedUsers);
        } catch (error) {
            console.error('Error parsing saved users:', error);
            users = {};
        }
    }
    
    // Show appropriate UI
    if (isLoggedIn && currentUser) {
        showUserDashboard();
        loadUserData();
    } else {
        showLoginForm();
    }
    
    console.log('Ignite Fitness App Ready!');
});

// Simple hash function for password hashing
function simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// Authentication Functions
function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        showError(errorDiv, 'Please enter both username and password');
        return;
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
            loadUserData();
        } else {
            showError(errorDiv, 'Invalid username or password');
        }
    } else {
        showError(errorDiv, 'User not found. Please register first.');
    }
}

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

    if (users[username]) {
        showError(errorDiv, 'Username already exists');
        return;
    }

    if (password.length < 6) {
        showError(errorDiv, 'Password must be at least 6 characters long');
        return;
    }

    // Create new user with hashed password
    users[username] = {
        passwordHash: simpleHash(password),
        athleteName: athleteName,
        personalData: {},
        goals: {},
        wearableSettings: {},
        workoutPlan: null,
        data: {
            workouts: [],
            soccerSessions: [],
            recoveryData: [],
            stravaData: [],
            sleepData: []
        },
        createdAt: Date.now(),
        lastLogin: null
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
function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('userDashboard').classList.add('hidden');
}

function showUserDashboard() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('userDashboard').classList.remove('hidden');
    
    // Update athlete name display
    const athleteNameElement = document.getElementById('currentAthleteName');
    if (athleteNameElement && users[currentUser]) {
        athleteNameElement.textContent = users[currentUser].athleteName || currentUser;
    }
}

function showPasswordReset() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('passwordResetForm').classList.remove('hidden');
}

function hidePasswordReset() {
    document.getElementById('passwordResetForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

function showRegisterForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function hideRegisterForm() {
    document.getElementById('registerForm').classList.add('hidden');
}

function hideLoginForm() {
    document.getElementById('loginForm').classList.add('hidden');
}

// Tab Functions
function showTab(tabName, clickedButton) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }
    
    // Add active class to clicked button
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

// Data Functions
function loadUserData() {
    if (!currentUser || !users[currentUser]) return;
    
    const user = users[currentUser];
    
    // Load personal data
    if (user.personalData) {
        if (user.personalData.age) document.getElementById('age').value = user.personalData.age;
        if (user.personalData.weight) document.getElementById('weight').value = user.personalData.weight;
        if (user.personalData.height) document.getElementById('height').value = user.personalData.height;
        if (user.personalData.experience) document.getElementById('experience').value = user.personalData.experience;
    }
    
    // Load goals
    if (user.goals) {
        if (user.goals.primary) {
            const primaryGoal = document.querySelector(`input[name="primaryGoal"][value="${user.goals.primary}"]`);
            if (primaryGoal) primaryGoal.checked = true;
        }
        if (user.goals.secondary) {
            const secondaryGoal = document.querySelector(`input[name="secondaryGoal"][value="${user.goals.secondary}"]`);
            if (secondaryGoal) secondaryGoal.checked = true;
        }
    }
}

function saveUserData() {
    if (!currentUser) return;
    localStorage.setItem('ignitefitness_users', JSON.stringify(users));
}

function savePersonalInfo() {
    if (!currentUser) return;
    
    const personalData = {
        age: document.getElementById('age').value,
        weight: document.getElementById('weight').value,
        height: document.getElementById('height').value,
        experience: document.getElementById('experience').value
    };
    
    if (!users[currentUser]) {
        users[currentUser] = {};
    }
    
    users[currentUser].personalData = personalData;
    saveUserData();
    showSuccess('Personal information saved!');
}

function saveGoals() {
    if (!currentUser) return;
    
    const primaryGoal = document.querySelector('input[name="primaryGoal"]:checked')?.value;
    const secondaryGoal = document.querySelector('input[name="secondaryGoal"]:checked')?.value;
    
    const goals = {
        primary: primaryGoal,
        secondary: secondaryGoal
    };
    
    if (!users[currentUser]) {
        users[currentUser] = {};
    }
    
    users[currentUser].goals = goals;
    saveUserData();
    showSuccess('Goals saved!');
}

function generateWorkoutPlan() {
    showSuccess('Workout plan generation will be implemented in the full version!');
}

function logout() {
    currentUser = null;
    isLoggedIn = false;
    localStorage.removeItem('ignitefitness_current_user');
    showLoginForm();
    showSuccess('Logged out successfully!');
}

// Utility Functions
function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

function showSuccess(message) {
    // Create or update success notification
    let notification = document.getElementById('success-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'success-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #68d391;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            display: none;
        `;
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}
