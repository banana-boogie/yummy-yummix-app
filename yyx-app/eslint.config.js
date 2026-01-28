const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['node_modules/', 'android/', 'ios/', '.expo/', 'coverage/'],
  },
  {
    // Downgrade some rules to warnings until codebase is cleaned up
    rules: {
      'import/no-unresolved': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react/display-name': 'warn',
    },
  },
  {
    // Jest environment for test files and setup
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.js', 'test/**/*.ts', 'test/**/*.tsx'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        test: 'readonly',
      },
    },
  },
]);
