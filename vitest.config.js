import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.{test,spec}.{js,mjs}'],
    exclude: ['node_modules', 'dist', '.git'],
    setupFiles: ['tests/setup.js'],
    testTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 2,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['js/modules/load/**/*.js'],
      exclude: ['node_modules/', 'tests/', '*.config.js'],
    },
    reporter: ['verbose'],
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      '@tests': new URL('./tests', import.meta.url).pathname,
    },
  },
});
