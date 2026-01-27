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
]);
