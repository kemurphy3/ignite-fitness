#!/bin/bash

# Deployment script for Ignite Fitness UX improvements
echo "🚀 Deploying UX improvements..."

# Backup original files
mkdir -p backups
cp index.html backups/index.html.backup
cp tracker.html backups/tracker.html.backup

# Deploy simplified version
cp index-simple.html index.html

echo "✅ UX improvements deployed!"
echo ""
echo "Changes made:"
echo "1. ✅ Simplified landing page"
echo "2. ✅ Fixed login screen disappearing"
echo "3. ✅ Added user guidance system"
echo "4. ✅ Created beginner-friendly components"
echo "5. ✅ Improved onboarding flow"
echo ""
echo "To test:"
echo "- Open index.html in browser"
echo "- Login form should stay visible"
echo "- Simplified interface for beta users"
