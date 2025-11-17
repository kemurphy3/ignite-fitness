import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Environment setup
    environment: 'jsdom',
    globals: true,

    // Test patterns
    include: ['tests/**/*.{test,spec}.{js,mjs}'],
    exclude: [
      'node_modules',
      'dist',
      '.git',
      'tests/helpers/**', // Exclude helper files from test discovery
    ],

    // Setup files
    setupFiles: ['tests/setup.js'],

    // Timeout configuration
    testTimeout: 30000,
    hookTimeout: 30000,

    // Mock configuration
    deps: {
      external: ['pg'], // Mock problematic external deps
    },

    // Pool configuration for stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        minForks: 1,
        maxForks: 2,
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: [
        'js/modules/load/**/*.js',
        'js/modules/ui/WeekView.js',
        'netlify/functions/utils/**/*.js',
      ],
      exclude: ['node_modules/', 'tests/', 'coverage/', '*.config.js'],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },

    // Reporter configuration
    reporter: ['verbose', 'json'],
    outputFile: {
      json: 'test-results.json',
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      '@tests': new URL('./tests', import.meta.url).pathname,
      '@utils': new URL('./netlify/functions/utils', import.meta.url).pathname,
    },
  },

  // Define configuration for Node.js compatibility
  define: {
    global: 'globalThis',
  },
});
