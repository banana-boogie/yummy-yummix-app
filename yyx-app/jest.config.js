/**
 * Jest Configuration for YummyYummix App
 *
 * This configuration is optimized for:
 * - React Native + Expo projects
 * - AI coding agents (clear patterns, consistent behavior)
 * - Comprehensive coverage reporting
 *
 * @see https://jestjs.io/docs/configuration
 */

module.exports = {
  // Use Expo's Jest preset for React Native compatibility
  preset: 'jest-expo',

  // Setup files run after Jest is initialized but before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Module path aliases (must match tsconfig.json paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).[jt]s?(x)',
    '**/*.(test|spec).[jt]s?(x)',
  ],

  // Files to ignore when looking for tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/.expo/',
  ],

  // Transform configuration for dependencies that need processing
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|uuid)',
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    // Exclusions
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
    '!**/test/**',
    '!**/types/**',
    '!**/index.ts', // Re-export files
  ],

  // Coverage thresholds - start at 0, increase as tests are added
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },

  // Coverage output formats
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Directory for coverage output
  coverageDirectory: 'coverage',

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Maximum workers for parallel execution
  maxWorkers: '50%',

  // Test timeout (10 seconds)
  testTimeout: 10000,

  // Verbose output for clearer test results
  verbose: true,

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Global variables available in tests
  globals: {
    __DEV__: true,
  },
};
