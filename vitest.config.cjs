// vitest.config.cjs - CommonJS version for Node 18 compatibility
const { defineConfig } = require('vitest/config');

// Check if we have a real database URL (not mock)
const hasRealDatabase =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('mock') &&
  process.env.MOCK_DATABASE !== 'true';

module.exports = defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',
    globals: true,

    // Test file patterns
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git'],

    // Global test setup
    setupFiles: ['tests/setup.js'],

    // Test timeout
    testTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['js/modules/load/**/*.js', 'js/modules/ui/WeekView.js'],
      exclude: [
        'node_modules/',
        'tests/',
        'coverage/',
        '*.config.js',
        'netlify/functions/_base.js', // Exclude base utility from coverage
      ],
      thresholds: {
        global: {
          branches: 50, // Lowered for initial pass
          functions: 50,
          lines: 50,
          statements: 50,
        },
      },
    },

    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: 'test-results.json',
    },

    // Watch mode configuration
    watch: false,

    // Pool configuration - sequential for real DB, parallel for mock
    pool: 'forks', // Use forks instead of threads for Node 18
    poolOptions: {
      forks: hasRealDatabase
        ? {
            // Sequential execution for real database - reliable and simple
            singleFork: true,
            minForks: 1,
            maxForks: 1,
          }
        : {
            // Parallel execution for mock database tests - fast local development
            singleFork: false,
            minForks: 1,
            maxForks: 2, // Reduced for Node 18
          },
    },

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'mock://test',
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': './',
      '@tests': './tests',
      '@utils': './netlify/functions/utils',
    },
  },
});
