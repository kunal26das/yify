// https://docs.expo.dev/guides/using-eslint/
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
      // Clean architecture module boundaries — the React Native equivalent of
      // Gradle module dependencies. Each `target` lists the modules it is NOT
      // allowed to import from, enforcing the dependency graph:
      //   domain        → depends on nothing (innermost layer)
      //   data          → depends only on domain
      //   presentation  → depends only on domain
      //   app           → composition root, may depend on everything
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
