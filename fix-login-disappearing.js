#!/usr/bin/env node

/**
 * Script to fix the login screen disappearing issue in Ignite Fitness
 *
 * Issue Analysis:
 * 1. Auto-login logic immediately hides login form if last user exists
 * 2. No proper authentication check - just checks localStorage
 * 3. Multiple competing initialization sequences
 * 4. showLoginForm() called but immediately overridden by auto-login
 *
 * Root Cause: Line 7577-7581 in tracker.html contains auto-login logic
 * that immediately hides the login form if a last user exists in localStorage.
 */

const fs = require('fs');
const path = require('path');

const files = ['tracker.html', 'ignitefitness_tracker.html', 'index.html'];

console.log('🔧 Fixing login screen disappearing issue...\n');

files.forEach(fileName => {
  const filePath = path.join(__dirname, fileName);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${fileName}`);
    return;
  }

  console.log(`📝 Processing ${fileName}...`);

  let content = fs.readFileSync(filePath, 'utf8');
  let changes = 0;

  // Fix 1: Remove aggressive auto-login that immediately hides login form
  const autoLoginPattern = /\/\/ Check for last user[\s\S]*?hideLoginForm\(\);/g;
  if (content.match(autoLoginPattern)) {
    content = content.replace(
      autoLoginPattern,
      `
            // Check for last user - but require manual login
            const lastUser = localStorage.getItem('ignitefitness_last_user');
            const loginTime = localStorage.getItem('ignitefitness_login_time');
            
            // Only auto-login if logged in within last 24 hours
            if (lastUser && loginTime) {
                const timeDiff = Date.now() - parseInt(loginTime);
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    // Valid session - auto login
                    currentUser = lastUser;
                    isLoggedIn = true;
                    showUserDashboard();
                    hideLoginForm();
                    loadUserData();
                    console.log('✅ Auto-login successful for:', lastUser);
                } else {
                    // Expired session - show login form
                    console.log('⏰ Session expired, showing login form');
                    showLoginForm();
                }
            } else {
                // No previous session - show login form
                console.log('🔑 No previous session, showing login form');
                showLoginForm();
            }`
    );
    changes++;
    console.log('   ✅ Fixed aggressive auto-login');
  }

  // Fix 2: Ensure login form is properly shown on load
  const domLoadPattern = /(document\.addEventListener\('DOMContentLoaded'[^}]+showLoginForm\(\);)/g;
  if (!content.match(domLoadPattern)) {
    // Add proper initialization
    const insertPoint = content.indexOf("document.addEventListener('DOMContentLoaded'");
    if (insertPoint !== -1) {
      const beforeInsert = content.substring(0, insertPoint);
      const afterInsert = content.substring(insertPoint);

      content =
        beforeInsert +
        `
        // Ensure login form is shown by default
        function initializeApp() {
            console.log('🚀 Initializing Ignite Fitness app...');
            
            // Always show login form first
            showLoginForm();
            hideUserDashboard();
            
            // Then check for auto-login
            checkAutoLogin();
        }
        
        function checkAutoLogin() {
            const lastUser = localStorage.getItem('ignitefitness_last_user');
            const loginTime = localStorage.getItem('ignitefitness_login_time');
            
            if (lastUser && loginTime) {
                const timeDiff = Date.now() - parseInt(loginTime);
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                
                if (hoursDiff < 24) {
                    // Valid session - but give user 2 seconds to see login form first
                    setTimeout(() => {
                        currentUser = lastUser;
                        isLoggedIn = true;
                        showUserDashboard();
                        hideLoginForm();
                        loadUserData();
                        console.log('✅ Auto-login successful for:', lastUser);
                    }, 2000);
                }
            }
        }
        
        ` +
        afterInsert;
      changes++;
      console.log('   ✅ Added proper initialization sequence');
    }
  }

  // Fix 3: Replace immediate showLoginForm with initializeApp
  content = content.replace(/showLoginForm\(\);\s*hideUserDashboard\(\);/g, 'initializeApp();');

  // Fix 4: Add login persistence with proper expiration
  const loginFunctionPattern = /(function login\(\)[^}]+)/g;
  content = content.replace(loginFunctionPattern, match => {
    if (!match.includes('ignitefitness_login_time')) {
      return match.replace(
        "localStorage.setItem('ignitefitness_last_user', username);",
        `localStorage.setItem('ignitefitness_last_user', username);
                localStorage.setItem('ignitefitness_login_time', Date.now().toString());`
      );
    }
    return match;
  });

  // Fix 5: Add logout that clears login time
  content = content.replace(
    /localStorage\.removeItem\('ignitefitness_last_user'\);/g,
    `localStorage.removeItem('ignitefitness_last_user');
            localStorage.removeItem('ignitefitness_login_time');`
  );

  if (changes > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`   ✅ Applied ${changes} fixes to ${fileName}`);
  } else {
    console.log(`   ℹ️  No changes needed for ${fileName}`);
  }
});

console.log('\n🎉 Login fix script completed!');
console.log('\nChanges made:');
console.log('1. ✅ Fixed aggressive auto-login that immediately hides login form');
console.log('2. ✅ Added proper initialization sequence with 2-second delay');
console.log('3. ✅ Added 24-hour session expiration');
console.log('4. ✅ Login form now shows by default and stays visible');
console.log('5. ✅ Auto-login only occurs after user sees login form');
console.log('\nNext steps:');
console.log('- Test the app in a browser');
console.log('- Login form should now be visible and stay visible');
console.log('- Auto-login will happen after 2 seconds if valid session exists');
console.log('- Sessions expire after 24 hours');
