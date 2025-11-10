module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  globals: {
    window: 'readonly',
    document: 'readonly',
    console: 'readonly',
    localStorage: 'readonly',
    sessionStorage: 'readonly',
    fetch: 'readonly',
    URLSearchParams: 'readonly',
    FormData: 'readonly',
    Chart: 'readonly',
    performance: 'readonly'
  },
  rules: {
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-shadow': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'dot-notation': 'error',
    'no-multi-spaces': 'error',
    'no-trailing-spaces': 'error',
    semi: ['error', 'always'],
    quotes: ['error', 'single', { avoidEscape: true }],
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'prefer-destructuring': ['warn', { array: false, object: true }],
    'no-inner-declarations': 'error',
    'no-new-wrappers': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js', '**/tests/**/*.js'],
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        spyOn: 'readonly',
        jasmine: 'readonly',
        ExerciseAdapter: 'readonly'
      },
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'off'
      }
    },
    {
      files: ['scripts/**/*.js', 'tools/**/*.js', 'verify-*.js', 'test-*.js', 'check-*.js'],
      rules: {
        'no-console': 'off',
        'no-process-exit': 'off',
        'no-unused-vars': 'off',
        'prefer-const': 'off'
      }
    },
    {
      files: ['netlify/functions/**/*.js'],
      env: {
        node: true
      },
      rules: {
        'no-console': 'off'
      }
    }
  ]
};
