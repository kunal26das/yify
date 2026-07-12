const path = require('path');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    settings: {
      'import/resolver': {
        typescript: {
          project: path.join(__dirname, 'tsconfig.json'),
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          basePath: __dirname,
          zones: [
            {
              target: './domain',
              from: ['./data', './presentation', './app'],
              message:
                'domain is a pure module and must not import from data, presentation, or app.',
            },
            {
              target: './data',
              from: ['./presentation', './app'],
              message: 'data may depend only on domain — not presentation or app.',
            },
            {
              target: './presentation',
              from: ['./data', './app'],
              message: 'presentation may depend only on domain — not data or app.',
            },
          ],
        },
      ],
    },
  },
]);
