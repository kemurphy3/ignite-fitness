// vitest.config.js
// Vitest configuration for IgniteFitness testing

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git'],
    
    // Global test setup
    setupFiles: ['tests/setup.js'],
    
    // Test timeout
    testTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'coverage/',
        '*.config.js',
        'netlify/functions/_base.js' // Exclude base utility from coverage
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: 'test-results.json'
    },
    
    // Watch mode configuration
    watch: false,
    
    // Pool configuration for parallel tests
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    },
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test'
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': './',
      '@tests': './tests',
      '@utils': './netlify/functions/utils'
    }
  }
});
