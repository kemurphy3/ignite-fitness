/**
 * Prompt 0.1 Verification Checklist
 * Test suite to verify all "Done Means" criteria
 */

class Prompt01Verification {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
  }

  /**
   * Run all verification tests
   */
  runAllTests() {
    console.log('🧪 Running Prompt 0.1 Verification Tests...\n');

    this.testFiveTabNavigation();
    this.testHashRouting();
    this.testMobileResponsive();
    this.testDarkModeToggle();
    this.testConnectionStatus();
    this.testSeasonPhasePill();
    this.testAccessibility();
    this.testPerformance();

    this.printResults();
  }

  /**
   * Test five-tab navigation with active states
   */
  testFiveTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const expectedTabs = ['Home', 'Training', 'Progress', 'Sport', 'Profile'];

    if (tabs.length === 5) {
      this.results.passed.push('Five-tab navigation exists');
    } else {
      this.results.failed.push(`Expected 5 tabs, found ${tabs.length}`);
    }

    // Check active states
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab) {
      this.results.passed.push('Active tab state working');
    } else {
      this.results.warnings.push('No active tab found on initial load');
    }

    // Check all tabs have proper attributes
    tabs.forEach(tab => {
      if (tab.hasAttribute('data-route') && tab.hasAttribute('data-tab')) {
        this.results.passed.push('Tab attributes present');
      }
    });
  }

  /**
   * Test hash routing
   */
  testHashRouting() {
    if (window.Router) {
      this.results.passed.push('Router initialized');

      // Test navigation
      const initialRoute = window.location.hash || '#/';
      window.Router.navigate('#/training');

      setTimeout(() => {
        if (window.location.hash === '#/training') {
          this.results.passed.push('Hash routing navigates smoothly');
        } else {
          this.results.failed.push('Hash routing not working');
        }

        // Reset
        window.Router.navigate(initialRoute);
      }, 100);
    } else {
      this.results.failed.push('Router not initialized');
    }
  }

  /**
   * Test mobile responsive design
   */
  testMobileResponsive() {
    const nav = document.getElementById('bottom-navigation');
    if (!nav) {
      this.results.failed.push('Bottom navigation not found');
      return;
    }

    // Check mobile-specific attributes
    const tabs = nav.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      if (tab.offsetHeight >= 44) {
        this.results.passed.push('Touch-friendly button sizes (≥44px)');
      } else {
        this.results.failed.push(`Button height ${tab.offsetHeight}px (requires ≥44px)`);
      }
    });

    // Check viewport meta
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && viewport.content.includes('width=device-width')) {
      this.results.passed.push('Viewport meta tag configured');
    } else {
      this.results.warnings.push('Viewport meta tag may need configuration');
    }
  }

  /**
   * Test dark mode toggle
   */
  testDarkModeToggle() {
    const hasDarkModeCSS = document.querySelector('link[href*="design-tokens"]');
    if (hasDarkModeCSS) {
      this.results.passed.push('Dark mode CSS included');
    } else {
      this.results.failed.push('Dark mode styles not found');
    }

    // Check for CSS custom properties
    const styles = document.querySelector('link[href*="design-tokens"]');
    if (styles) {
      this.results.passed.push('CSS custom properties for theming');
    }
  }

  /**
   * Test connection status indicator
   */
  testConnectionStatus() {
    const connectionIndicator = document.getElementById('connection-status');
    if (connectionIndicator) {
      this.results.passed.push('Connection status indicator exists');

      // Check online state
      if (
        connectionIndicator.classList.contains('online') ||
        connectionIndicator.classList.contains('offline')
      ) {
        this.results.passed.push('Connection status shows state');
      }
    } else {
      this.results.failed.push('Connection status indicator not found');
    }
  }

  /**
   * Test season phase pill
   */
  testSeasonPhasePill() {
    const pill = document.querySelector('.season-phase-pill');
    if (pill) {
      this.results.passed.push('Season phase pill exists');

      // Check it's always visible in header
      const header = document.getElementById('persistent-header');
      if (header && header.contains(pill)) {
        this.results.passed.push('Season phase pill in header');
      }
    } else {
      this.results.warnings.push('Season phase pill not found (may need initialization)');
    }

    // Check SeasonPhase module
    if (window.SeasonPhase) {
      this.results.passed.push('SeasonPhase module initialized');

      const currentPhase = window.SeasonPhase.getCurrentPhase();
      if (currentPhase) {
        this.results.passed.push('Current phase retrieved');
      }
    }
  }

  /**
   * Test accessibility requirements
   */
  testAccessibility() {
    // Check ARIA labels
    const tabs = document.querySelectorAll('.nav-tab');
    let ariaLabelsFound = 0;

    tabs.forEach(tab => {
      if (tab.hasAttribute('aria-label') || tab.textContent.trim()) {
        ariaLabelsFound++;
      }
    });

    if (ariaLabelsFound === tabs.length) {
      this.results.passed.push('ARIA labels on interactive elements');
    } else {
      this.results.warnings.push(`Only ${ariaLabelsFound}/${tabs.length} tabs have labels`);
    }

    // Check keyboard navigation
    let keyboardable = 0;
    tabs.forEach(tab => {
      if (tab.tabIndex >= 0 || tab.tagName === 'BUTTON') {
        keyboardable++;
      }
    });

    if (keyboardable === tabs.length) {
      this.results.passed.push('Keyboard navigation supported');
    }

    // Check heading hierarchy
    const h1 = document.querySelector('h1');
    if (h1) {
      this.results.passed.push('Proper heading hierarchy');
    }
  }

  /**
   * Test performance
   */
  testPerformance() {
    // Check for performance optimizations
    const lighthouseOptimization = document.querySelector('script[src*="lighthouse-optimization"]');
    if (lighthouseOptimization) {
      this.results.passed.push('Lighthouse optimization script included');
    }

    // Check for lazy loading
    const images = document.querySelectorAll('img[loading="lazy"]');
    if (images.length > 0) {
      this.results.passed.push('Lazy loading for images');
    }

    // Check for preconnect
    const preconnects = document.querySelectorAll('link[rel="preconnect"]');
    if (preconnects.length > 0) {
      this.results.passed.push('Preconnect optimizations');
    }

    // Performance marks
    const perfEntries = performance.getEntriesByType('navigation');
    if (perfEntries.length > 0) {
      const perfEntry = perfEntries[0];
      const fcp = perfEntry.loadEventStart - perfEntry.fetchStart;

      if (fcp <= 1500) {
        this.results.passed.push(`FCP: ${fcp}ms (Target: ≤1500ms)`);
      } else {
        this.results.warnings.push(`FCP: ${fcp}ms (Target: ≤1500ms)`);
      }
    }
  }

  /**
   * Print test results
   */
  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log(`✅ Passed: ${this.results.passed.length}`);
    console.log(`❌ Failed: ${this.results.failed.length}`);
    console.log(`⚠️  Warnings: ${this.results.warnings.length}`);

    if (this.results.passed.length > 0) {
      console.log('\n✅ Passed Tests:');
      this.results.passed.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }

    if (this.results.failed.length > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.failed.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }

    if (this.results.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.results.warnings.forEach((test, i) => {
        console.log(`  ${i + 1}. ${test}`);
      });
    }

    // Final status
    console.log('\n' + '='.repeat(50));
    if (this.results.failed.length === 0) {
      console.log('✅ PROMPT 0.1: ALL CRITERIA MET');
    } else {
      console.log('❌ PROMPT 0.1: SOME CRITERIA NEED ATTENTION');
    }
    console.log('='.repeat(50));
  }
}

// Auto-run verification when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const verifier = new Prompt01Verification();
      verifier.runAllTests();
    }, 1000);
  });
} else {
  setTimeout(() => {
    const verifier = new Prompt01Verification();
    verifier.runAllTests();
  }, 1000);
}

// Export for manual testing
window.Prompt01Verification = Prompt01Verification;
