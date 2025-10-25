// vitest.config.js
// Vitest configuration for IgniteFitness testing

import { defineConfig } from 'vitest/config';

// Check if we have a real database URL (not mock)
const hasRealDatabase = process.env.DATABASE_URL && 
  !process.env.DATABASE_URL.includes('mock') && 
  process.env.MOCK_DATABASE !== 'true';

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
    
    // Pool configuration - sequential for real DB, parallel for mock
    pool: 'threads',
    poolOptions: {
      threads: hasRealDatabase ? {
        // Sequential execution for real database - reliable and simple
        singleThread: true,
        minThreads: 1,
        maxThreads: 1
      } : {
        // Parallel execution for mock database tests - fast local development
        singleThread: false,
        minThreads: 1,
        maxThreads: 4
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
