#!/usr/bin/env node

/**
 * Reset Demo Data - Cleans up demo data for a fresh start
 */

const fs = require('fs');
const path = require('path');

class DemoDataReset {
    constructor() {
        this.dataDir = path.join(process.cwd(), 'data');
        this.filesToRemove = [
            'local-demo.json',
            'demo-data.js',
            'fallback-demo.json',
            'minimal-demo.json'
        ];
        this.localStorageKeys = [
            'demo_user',
            'demo_sessions',
            'demo_workouts',
            'demo_substitutions',
            'onboarding_completed',
            'DEMO_MODE'
        ];
    }

    async reset() {
        console.log('🧹 Resetting demo data...');
        this.removeFiles();
        await this.clearBrowserData();
        console.log('🎉 Demo data reset complete');
    }

    removeFiles() {
        if (!fs.existsSync(this.dataDir)) {
            console.log('ℹ️  No data directory found. Nothing to clean.');
            return;
        }

        this.filesToRemove.forEach((file) => {
            const fullPath = path.join(this.dataDir, file);
            if (fs.existsSync(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`✅ Removed ${path.join('data', file)}`);
                } catch (error) {
                    console.log(`⚠️  Unable to remove ${file}: ${error.message}`);
                }
            }
        });
    }

    async clearBrowserData() {
        if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
            console.log('ℹ️  No browser context detected. LocalStorage cleanup skipped.');
            return;
        }

        this.localStorageKeys.forEach((key) => {
            try {
                window.localStorage.removeItem(key);
            } catch (error) {
                console.log(`⚠️  Unable to remove localStorage key ${key}: ${error.message}`);
            }
        });

        console.log('✅ Cleared browser localStorage demo data');
    }
}

if (require.main === module) {
    const reset = new DemoDataReset();
    reset.reset().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = DemoDataReset;
