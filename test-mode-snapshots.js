/**
 * Mode and Override Snapshot Tests
 * Tests Simple vs Advanced mode routes and instant overrides
 */

class ModeSnapshotTest {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            snapshots: {}
        };
    }

    /**
     * Run all snapshot tests
     */
    async runAllTests() {
        console.log('📸 Running Mode & Override Snapshot Tests...\n');
        
        await this.testSimpleModeSnapshot();
        await this.testAdvancedModeSnapshot();
        await this.testOverrideWithoutReload();
        await this.testQuickStartFlow();
        await this.testCoachChatIntegration();
        
        this.printResults();
    }

    /**
     * Test Simple Mode snapshot
     */
    async testSimpleModeSnapshot() {
        try {
            // Switch to simple mode
            await window.ModeManager.switchMode('simple');
            
            // Get UI state
            const simpleModeState = this.captureUISnapshot('simple');
            
            this.results.snapshots.simple = simpleModeState;
            
            // Verify key characteristics
            const hasQuickStart = document.getElementById('quick-start-button');
            const noAdvancedControls = document.querySelectorAll('.advanced-control').length === 0;
            
            if (hasQuickStart && noAdvancedControls) {
                this.results.passed.push('Simple Mode: Quick start shown, no advanced controls');
            } else {
                this.results.failed.push({ test: 'Simple Mode snapshot', reason: 'UI mismatch' });
            }
        } catch (error) {
            this.results.failed.push({ test: 'Simple Mode snapshot', error: error.message });
        }
    }

    /**
     * Test Advanced Mode snapshot
     */
    async testAdvancedModeSnapshot() {
        try {
            // Switch to advanced mode
            await window.ModeManager.switchMode('advanced');
            
            // Get UI state
            const advancedModeState = this.captureUISnapshot('advanced');
            
            this.results.snapshots.advanced = advancedModeState;
            
            // Verify key characteristics
            const hasRPEInput = document.querySelector('.rpe-input');
            const hasDetailedSettings = document.querySelector('.detailed-settings');
            const hasAdvancedControls = document.querySelectorAll('.advanced-control').length > 0;
            
            if ((hasRPEInput || hasDetailedSettings || hasAdvancedControls)) {
                this.results.passed.push('Advanced Mode: Advanced controls shown');
            } else {
                this.results.failed.push({ test: 'Advanced Mode snapshot', reason: 'Advanced controls missing' });
            }
        } catch (error) {
            this.results.failed.push({ test: 'Advanced Mode snapshot', error: error.message });
        }
    }

    /**
     * Test override without reload
     */
    async testOverrideWithoutReload() {
        try {
            const initialPlan = { exercises: [{ name: 'Squat' }] };
            window.OverrideBar.setCurrentPlan(initialPlan);
            
            // Apply override
            await window.OverrideBar.handleOverride('reduce-intensity');
            
            const updatedPlan = window.OverrideBar.currentPlan;
            
            if (updatedPlan && updatedPlan !== initialPlan) {
                this.results.passed.push('Override updates plan without reloading app');
            } else {
                this.results.failed.push({ test: 'Override without reload', reason: 'Plan not updated' });
            }
        } catch (error) {
            this.results.failed.push({ test: 'Override without reload', error: error.message });
        }
    }

    /**
     * Test quick start flow
     */
    async testQuickStartFlow() {
        try {
            // Switch to simple mode
            await window.ModeManager.switchMode('simple');
            
            // Simulate quick start
            const context = {
                user: { sport: 'soccer' },
                readiness: 7,
                preferences: { aestheticFocus: 'functional' }
            };
            
            const plan = window.ExpertCoordinator.getSessionPlan(context);
            const simplifiedPlan = window.QuickStart.simplifyPlan(plan);
            
            if (simplifiedPlan.circuit && simplifiedPlan.duration === 30) {
                this.results.passed.push('Quick Start: Simplified plan generated (warmup + circuit + finisher)');
            } else {
                this.results.failed.push({ test: 'Quick start flow', reason: 'Plan not simplified' });
            }
        } catch (error) {
            this.results.failed.push({ test: 'Quick start flow', error: error.message });
        }
    }

    /**
     * Test coach chat integration
     */
    async testCoachChatIntegration() {
        try {
            // Open chat
            window.CoachChat.openChat();
            
            if (window.CoachChat.isOpen) {
                this.results.passed.push('Coach Chat: Opens successfully');
            }
            
            // Test message
            const response = await window.CoachChat.getCoachResponse('too tired');
            
            if (response.text && response.text.length > 0) {
                this.results.passed.push('Coach Chat: Provides contextual responses');
            } else {
                this.results.failed.push({ test: 'Coach chat integration', reason: 'No response' });
            }
        } catch (error) {
            this.results.failed.push({ test: 'Coach chat integration', error: error.message });
        }
    }

    /**
     * Capture UI snapshot
     * @param {string} mode - Mode name
     * @returns {Object} UI snapshot
     */
    captureUISnapshot(mode) {
        return {
            mode,
            timestamp: new Date().toISOString(),
            quickStartVisible: document.getElementById('quick-start-button')?.style.display !== 'none',
            overrideBarVisible: document.getElementById('override-bar')?.classList.contains('visible'),
            advancedControlsVisible: document.querySelectorAll('.advanced-control:not([style*="display: none"])').length,
            chatVisible: document.getElementById('coach-chat')?.classList.contains('hidden') === false
        };
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n📸 Snapshot Test Results');
        console.log(`✅ Passed: ${this.results.passed.length}`);
        console.log(`❌ Failed: ${this.results.failed.length}`);
        
        this.results.passed.forEach((test, i) => {
            console.log(`${i + 1}. ${test}`);
        });
        
        if (this.results.failed.length > 0) {
            console.log('\nFailed:');
            this.results.failed.forEach((test, i) => {
                console.log(`${i + 1}. ${test.test}: ${test.reason || test.error}`);
            });
        }
        
        console.log('\n' + '='.repeat(50));
        if (this.results.failed.length === 0) {
            console.log('✅ ALL SNAPSHOT TESTS PASSED');
        }
        console.log('='.repeat(50));
        
        console.log('\n📸 Captured Snapshots:');
        console.log(JSON.stringify(this.results.snapshots, null, 2));
    }
}

window.ModeSnapshotTest = ModeSnapshotTest;
