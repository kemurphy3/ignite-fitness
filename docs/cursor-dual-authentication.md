# Cursor Prompt: Implement Dual Authentication System (Email + Strava)

## Overview

Make the app accessible to everyone, not just Strava users. Implement
email/password authentication alongside the existing Strava OAuth.

## Task 1: Update Database Schema

Run these migrations in your Neon SQL editor:

```sql
-- Add auth fields to users table
ALTER TABLE users
ADD COLUMN auth_type VARCHAR(20) DEFAULT 'strava',
ADD COLUMN email_unique VARCHAR(255) UNIQUE,
ADD COLUMN password_hash VARCHAR(255),
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN reset_token VARCHAR(255),
ADD COLUMN reset_token_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN verification_token VARCHAR(255),
ADD COLUMN verification_token_expires TIMESTAMP WITH TIME ZONE;

-- Create index for email login
CREATE INDEX idx_users_email_unique ON users(email_unique);
CREATE INDEX idx_users_reset_token ON users(reset_token);

-- Update existing Strava users
UPDATE users SET auth_type = 'strava' WHERE external_id IS NOT NULL;
```

## Task 2: Create Enhanced Auth System

### Create js/auth-enhanced.js

```javascript
class AuthManager {
  constructor() {
    this.sessionKey = 'ignite_session';
    this.authType = null;
  }

  // ============ EMAIL AUTH ============

  async signupWithEmail(email, password, username) {
    try {
      // Validate inputs
      if (!this.validateEmail(email)) {
        throw new Error('Invalid email format');
      }
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      // Check if email already exists
      const existing = await db.getUserByEmail(email);
      if (existing) {
        throw new Error('Email already registered');
      }

      // Hash password (using Web Crypto API since we're client-side)
      const passwordHash = await this.hashPassword(password);

      // Generate verification token
      const verificationToken = this.generateToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const user = await db.createUser({
        email: email,
        email_unique: email.toLowerCase(),
        username: username || email.split('@')[0],
        password_hash: passwordHash,
        auth_type: 'email',
        email_verified: false,
        verification_token: verificationToken,
        verification_token_expires: expires,
      });

      // Send verification email
      await this.sendVerificationEmail(email, verificationToken);

      return {
        success: true,
        message: 'Account created! Check your email to verify.',
        userId: user.id,
      };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async loginWithEmail(email, password) {
    try {
      // Get user by email
      const user = await db.getUserByEmail(email.toLowerCase());
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const valid = await this.verifyPassword(password, user.password_hash);
      if (!valid) {
        throw new Error('Invalid email or password');
      }

      // Check if email is verified
      if (!user.email_verified) {
        throw new Error('Please verify your email first');
      }

      // Create session
      const session = {
        userId: user.id,
        username: user.username,
        email: user.email,
        authType: 'email',
        loginTime: Date.now(),
      };

      localStorage.setItem(this.sessionKey, JSON.stringify(session));

      return {
        success: true,
        user: session,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async forgotPassword(email) {
    try {
      const user = await db.getUserByEmail(email.toLowerCase());
      if (!user) {
        // Don't reveal if email exists
        return {
          success: true,
          message: 'If that email exists, a reset link has been sent',
        };
      }

      // Generate reset token
      const resetToken = this.generateToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token
      await db.updateUser(user.id, {
        reset_token: resetToken,
        reset_token_expires: expires,
      });

      // Send reset email
      await this.sendResetEmail(email, resetToken);

      return {
        success: true,
        message: 'If that email exists, a reset link has been sent',
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        message: 'Error processing request',
      };
    }
  }

  async resetPassword(token, newPassword) {
    try {
      // Find user with valid token
      const user = await db.getUserByResetToken(token);
      if (!user || new Date(user.reset_token_expires) < new Date()) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password and clear token
      await db.updateUser(user.id, {
        password_hash: passwordHash,
        reset_token: null,
        reset_token_expires: null,
      });

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async verifyEmail(token) {
    try {
      const user = await db.getUserByVerificationToken(token);
      if (!user || new Date(user.verification_token_expires) < new Date()) {
        throw new Error('Invalid or expired verification token');
      }

      await db.updateUser(user.id, {
        email_verified: true,
        verification_token: null,
        verification_token_expires: null,
      });

      return {
        success: true,
        message: 'Email verified successfully! You can now log in.',
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // ============ STRAVA AUTH (Keep existing) ============

  async loginWithStrava() {
    // Your existing Strava OAuth code
    const authUrl =
      `https://www.strava.com/oauth/authorize?` +
      `client_id=${CONFIG.strava.clientId}` +
      `&response_type=code` +
      `&redirect_uri=${CONFIG.strava.redirectUri}` +
      `&scope=activity:read_all,profile:read_all`;

    window.location.href = authUrl;
  }

  // ============ HELPERS ============

  async hashPassword(password) {
    // Using Web Crypto API (client-side safe)
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  }

  async verifyPassword(password, hash) {
    const testHash = await this.hashPassword(password);
    return testHash === hash;
  }

  generateToken() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // ============ EMAIL SENDING ============

  async sendVerificationEmail(email, token) {
    const verifyUrl = `${window.location.origin}?verify=${token}`;

    // Simple client-side email (using mailto as fallback)
    // In production, you'd want a proper email service
    const subject = 'Verify your Ignite Fitness account';
    const body = `
      Welcome to Ignite Fitness!
      
      Please verify your email by clicking this link:
      ${verifyUrl}
      
      Or copy and paste it into your browser.
      
      This link expires in 24 hours.
      
      If you didn't create an account, please ignore this email.
    `;

    // For now, log to console (replace with actual email service)
    console.log('Verification Email:', { to: email, subject, body });

    // Optional: Open mailto link for manual sending
    if (confirm('Send verification email via your email client?')) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  }

  async sendResetEmail(email, token) {
    const resetUrl = `${window.location.origin}?reset=${token}`;

    const subject = 'Reset your Ignite Fitness password';
    const body = `
      Reset your password by clicking this link:
      ${resetUrl}
      
      Or copy and paste it into your browser.
      
      This link expires in 1 hour.
      
      If you didn't request this, please ignore this email.
    `;

    // For now, log to console
    console.log('Reset Email:', { to: email, subject, body });

    // Optional: Manual sending
    if (confirm('Send reset email via your email client?')) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  }

  // ============ SESSION MANAGEMENT ============

  getCurrentUser() {
    const session = localStorage.getItem(this.sessionKey);
    return session ? JSON.parse(session) : null;
  }

  isLoggedIn() {
    return this.getCurrentUser() !== null;
  }

  logout() {
    localStorage.removeItem(this.sessionKey);
    window.location.href = '/';
  }
}

const authManager = new AuthManager();
```

## Task 3: Create Login/Signup UI

### Update index.html with auth forms:

```html
<!-- Add to index.html -->
<div id="auth-container" class="auth-container">
  <div class="auth-tabs">
    <button class="auth-tab active" onclick="showAuthTab('login')">
      Login
    </button>
    <button class="auth-tab" onclick="showAuthTab('signup')">Sign Up</button>
  </div>

  <!-- Login Form -->
  <div id="login-form" class="auth-form active">
    <h2>Welcome Back!</h2>

    <!-- Email Login -->
    <form onsubmit="handleEmailLogin(event)">
      <input type="email" id="login-email" placeholder="Email" required />
      <input
        type="password"
        id="login-password"
        placeholder="Password"
        required
      />
      <button type="submit" class="btn-primary">Log In</button>
    </form>

    <div class="auth-divider">OR</div>

    <!-- Strava Login -->
    <button onclick="authManager.loginWithStrava()" class="btn-strava">
      <img src="strava-icon.svg" alt="Strava" />
      Continue with Strava
    </button>

    <a href="#" onclick="showForgotPassword()" class="forgot-link"
      >Forgot password?</a
    >
  </div>

  <!-- Signup Form -->
  <div id="signup-form" class="auth-form">
    <h2>Create Account</h2>

    <form onsubmit="handleEmailSignup(event)">
      <input type="text" id="signup-username" placeholder="Username" required />
      <input type="email" id="signup-email" placeholder="Email" required />
      <input
        type="password"
        id="signup-password"
        placeholder="Password (8+ characters)"
        required
        minlength="8"
      />
      <input
        type="password"
        id="signup-password-confirm"
        placeholder="Confirm Password"
        required
      />
      <button type="submit" class="btn-primary">Sign Up</button>
    </form>

    <div class="auth-divider">OR</div>

    <button onclick="authManager.loginWithStrava()" class="btn-strava">
      <img src="strava-icon.svg" alt="Strava" />
      Sign up with Strava (Recommended)
    </button>
  </div>

  <!-- Forgot Password Form -->
  <div id="forgot-form" class="auth-form">
    <h2>Reset Password</h2>
    <p>Enter your email and we'll send you a reset link.</p>

    <form onsubmit="handleForgotPassword(event)">
      <input type="email" id="forgot-email" placeholder="Email" required />
      <button type="submit" class="btn-primary">Send Reset Link</button>
    </form>

    <a href="#" onclick="showAuthTab('login')" class="back-link"
      >Back to login</a
    >
  </div>

  <!-- Reset Password Form (shown when user clicks reset link) -->
  <div id="reset-form" class="auth-form">
    <h2>Set New Password</h2>

    <form onsubmit="handleResetPassword(event)">
      <input
        type="password"
        id="reset-password"
        placeholder="New Password (8+ characters)"
        required
        minlength="8"
      />
      <input
        type="password"
        id="reset-password-confirm"
        placeholder="Confirm New Password"
        required
      />
      <button type="submit" class="btn-primary">Reset Password</button>
    </form>
  </div>
</div>
```

### Add form handlers in js/auth-ui.js:

```javascript
// Form handlers
async function handleEmailLogin(event) {
  event.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  showLoading('Logging in...');

  const result = await authManager.loginWithEmail(email, password);

  if (result.success) {
    window.location.reload(); // Reload to show main app
  } else {
    showError(result.message);
  }
}

async function handleEmailSignup(event) {
  event.preventDefault();

  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const passwordConfirm = document.getElementById(
    'signup-password-confirm'
  ).value;

  if (password !== passwordConfirm) {
    showError('Passwords do not match');
    return;
  }

  showLoading('Creating account...');

  const result = await authManager.signupWithEmail(email, password, username);

  if (result.success) {
    showSuccess(result.message);
    showAuthTab('login');
  } else {
    showError(result.message);
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById('forgot-email').value;

  showLoading('Sending reset link...');

  const result = await authManager.forgotPassword(email);

  if (result.success) {
    showSuccess(result.message);
    showAuthTab('login');
  } else {
    showError(result.message);
  }
}

async function handleResetPassword(event) {
  event.preventDefault();

  const password = document.getElementById('reset-password').value;
  const passwordConfirm = document.getElementById(
    'reset-password-confirm'
  ).value;

  if (password !== passwordConfirm) {
    showError('Passwords do not match');
    return;
  }

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('reset');

  if (!token) {
    showError('Invalid reset link');
    return;
  }

  showLoading('Resetting password...');

  const result = await authManager.resetPassword(token, password);

  if (result.success) {
    showSuccess(result.message);
    window.location.href = '/'; // Go to login
  } else {
    showError(result.message);
  }
}

// Check for verification/reset tokens on page load
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);

  // Check for email verification
  const verifyToken = urlParams.get('verify');
  if (verifyToken) {
    const result = await authManager.verifyEmail(verifyToken);
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(result.message);
    }
    window.history.replaceState({}, document.title, '/');
  }

  // Check for password reset
  const resetToken = urlParams.get('reset');
  if (resetToken) {
    document.getElementById('auth-container').style.display = 'block';
    showResetForm();
  }

  // Check if logged in
  if (authManager.isLoggedIn()) {
    document.getElementById('auth-container').style.display = 'none';
    initializeApp(); // Start main app
  } else {
    document.getElementById('auth-container').style.display = 'block';
  }
});
```

## Task 4: Add Email Service (Later Enhancement)

For production, replace the mailto links with a proper email service:

### Option 1: Use Netlify Functions + SendGrid

```javascript
// netlify/functions/send-email.js
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async event => {
  const { to, subject, html } = JSON.parse(event.body);

  const msg = {
    to,
    from: 'noreply@ignitefitness.app',
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    return { statusCode: 200, body: 'Email sent' };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  }
};
```

### Option 2: Simple Manual Support

For beta/small scale, you can manually handle password resets:

- Users email help@katemurphy.io
- You manually generate a reset link
- Send it from your personal email

## Task 5: Update Database Queries

Add these to database.js:

```javascript
async getUserByEmail(email) {
  const query = 'SELECT * FROM users WHERE email_unique = $1';
  const result = await this.pool.query(query, [email.toLowerCase()]);
  return result.rows[0];
}

async getUserByResetToken(token) {
  const query = 'SELECT * FROM users WHERE reset_token = $1';
  const result = await this.pool.query(query, [token]);
  return result.rows[0];
}

async getUserByVerificationToken(token) {
  const query = 'SELECT * FROM users WHERE verification_token = $1';
  const result = await this.pool.query(query, [token]);
  return result.rows[0];
}

async createUser(userData) {
  const query = `
    INSERT INTO users (
      email, email_unique, username, password_hash,
      auth_type, email_verified, verification_token,
      verification_token_expires
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const values = [
    userData.email,
    userData.email_unique,
    userData.username,
    userData.password_hash,
    userData.auth_type,
    userData.email_verified,
    userData.verification_token,
    userData.verification_token_expires
  ];

  const result = await this.pool.query(query, values);
  return result.rows[0];
}
```

## CSS Styling for Auth Forms

```css
.auth-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.auth-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.auth-tab {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #666;
}

.auth-tab.active {
  color: #ff4500;
  border-bottom: 2px solid #ff4500;
}

.auth-form {
  display: none;
}

.auth-form.active {
  display: block;
}

.auth-form input {
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 16px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #ff4500;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  margin: 10px 0;
}

.btn-strava {
  width: 100%;
  padding: 12px;
  background: #fc4c02;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.auth-divider {
  text-align: center;
  margin: 20px 0;
  color: #999;
  position: relative;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 45%;
  height: 1px;
  background: #ddd;
}

.auth-divider::before {
  left: 0;
}

.auth-divider::after {
  right: 0;
}

.forgot-link,
.back-link {
  display: block;
  text-align: center;
  margin-top: 15px;
  color: #666;
  text-decoration: none;
}

.forgot-link:hover,
.back-link:hover {
  color: #ff4500;
}
```

## Benefits of This Approach

1. **Wider audience** - Not limited to Strava users
2. **Better onboarding** - Users can try the app immediately
3. **Strava optional** - They can connect Strava later if they want
4. **Fallback auth** - If Strava OAuth breaks, users can still access their data
5. **Standard UX** - Email/password is what most users expect

## Testing Checklist

- [ ] Email signup creates user
- [ ] Email verification works
- [ ] Email login works
- [ ] Password reset flow works
- [ ] Strava login still works
- [ ] Sessions persist across refreshes
- [ ] Logout clears session
- [ ] Can't access app without login
- [ ] Duplicate email prevention works
- [ ] Password requirements enforced

## Note on Email Service

For initial testing, the mailto: fallback is fine. When ready for production:

1. Sign up for SendGrid (free tier: 100 emails/day)
2. Add SENDGRID_API_KEY to Netlify environment variables
3. Implement the Netlify Function above
4. Update auth-enhanced.js to call the function instead of mailto
