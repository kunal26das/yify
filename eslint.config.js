const path = require('path');
const {defineConfig} = require('eslint/config');
const expoConfig = require('./tooling/eslint.cjs');

const FEATURES = ['shell', 'home', 'search', 'title', 'person', 'player', 'library', 'sync', 'account', 'settings', 'you', 'monetization', 'legacy'];

const EFFECT = 'CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/]';
const NAV_MESSAGE = 'Navigation and URL writes belong in event handlers, never in effects (YIFY-36). Render <Redirect> for render-time redirects.';
const NAV_IN_EFFECT = [
  {selector: `${EFFECT} CallExpression[callee.property.name='setParams']`, message: NAV_MESSAGE},
  {selector: `${EFFECT} CallExpression[callee.object.name=/^(router|navigation)$/][callee.property.name=/^(replace|push|navigate|dismissTo|back)$/]`, message: NAV_MESSAGE},
  {selector: `${EFFECT} CallExpression[callee.object.name=/^(url|[a-z]+Url)$/][callee.property.name='commit']`, message: NAV_MESSAGE},
];
const DIALOG_MESSAGE = 'System dialogs are banned. Use useConfirm() from src/core/ui/components/ConfirmDialog.';
const SYSTEM_DIALOGS = [
  {selector: "CallExpression[callee.object.name='Alert'][callee.property.name='alert']", message: DIALOG_MESSAGE},
  {selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]", message: DIALOG_MESSAGE},
];
const TOKEN_MESSAGE = 'Use theme tokens from src/core/ui/theme for colours, type and shape.';
const TOKENS = [
  {selector: 'Literal[value=/^#[0-9A-Fa-f]{3,8}$/]', message: TOKEN_MESSAGE},
  {selector: 'Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]', message: TOKEN_MESSAGE},
  {selector: 'Property[key.name=/^(fontSize|lineHeight|letterSpacing|fontFamily|fontWeight)$/]', message: TOKEN_MESSAGE},
  {selector: "Property[key.name='borderRadius'][value.type='Literal']", message: TOKEN_MESSAGE},
];
const PLATFORM_OS = {
  selector: "MemberExpression[object.name='Platform'][property.name='OS']",
  message: 'Split by platform with .web.ts(x) twins in a platform adapter folder (src/core/platform, src/core/ui, src/features/<name>/platform).',
};
const TYPEOF_DOM = {
  selector: "UnaryExpression[operator='typeof'][argument.name=/^(window|document|navigator)$/]",
  message: 'Environment checks live in platform adapter folders.',
};
const wholeFile = (message) => ({selector: 'Program', message});
const NODE_GLOBALS = Object.fromEntries([
  '__dirname', '__filename', 'Buffer', 'process', 'require', 'module', 'exports', 'console', 'URL', 'URLSearchParams',
  'fetch', 'Response', 'Request', 'Headers', 'AbortController', 'AbortSignal', 'TextEncoder', 'TextDecoder',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'structuredClone',
].map((name) => [name, 'readonly']));

const yify = {
  rules: {
    'no-comments': {
      meta: {type: 'problem', schema: []},
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (comment.type === 'Shebang') continue;
              context.report({loc: comment.loc, message: 'Comments are not allowed in this codebase.'});
            }
          },
        };
      },
    },
  },
};

const zones = [
  {target: './src/core', from: ['./src/features', './src/server', './app'],
    message: 'core must not depend on features, server code or routes.'},
  {target: './src/core/domain', from: './src/core', except: ['./domain'],
    message: 'core/domain imports only core/domain.'},
  {target: './src/core/config', from: './src/core', except: ['./config', './domain'],
    message: 'core/config holds constants and may import only core/domain.'},
  {target: './src/features', from: ['./src/server', './app'],
    message: 'features must not import server code or routes.'},
  ...FEATURES.map((feature) => ({
    target: `./src/features/${feature}`,
    from: './src/features/**',
    except: [`**/src/features/${feature}/**`, '**/src/features/*/public/**'],
    message: `features/${feature} may use other features only through their public/ folder.`,
  })),
  {target: './src/server', from: ['./src/core', './src/features', './app'], except: ['./domain', './config'],
    message: 'server code imports only src/server, src/core/domain and src/core/config.'},
  {target: './app', from: './src/features/**',
    except: ['**/src/features/*/screens/**', '**/src/features/*/public/**'],
    message: 'Routes import feature screens or public modules only.'},
  {target: './app/**/*.tsx', from: './src/server', except: ['./seo'],
    message: 'Only +api.ts, +middleware.ts and the web route twins (through src/server/seo) may use server code.'},
];

const CLIENT = ['src/core/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'];
const ALLOWED_TWINS = [
  'src/core/platform/**',
  'src/core/ui/**',
  'src/features/*/platform/**',
  'src/core/api/baseUrl.web.ts',
  'src/core/query/lifecycle.web.ts',
  'src/core/storage/kv.web.ts',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'android/**', 'ios/**', 'dist/**', 'dist-hosting/**', 'public/**', 'assets/**', '**/node_modules/**',
      'desktop-dist/**', 'store-artifacts/**', 'store-listing/**', 'docs/**', '.claude/**', '.expo/**', 'expo-env.d.ts',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    plugins: {yify},
    rules: {'yify/no-comments': 'error'},
  },
  {
    files: ['**/*.cjs', 'plugins/**/*.js', 'tooling/**/*.js', '*.config.js'],
    languageOptions: {sourceType: 'commonjs', globals: NODE_GLOBALS},
    rules: {'@typescript-eslint/no-require-imports': 'off'},
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {sourceType: 'module', globals: NODE_GLOBALS},
  },
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {typescript: {project: path.join(__dirname, 'tsconfig.json'), alwaysTryTypes: true}},
    },
    rules: {
      'import/no-restricted-paths': ['error', {basePath: __dirname, zones}],
      'no-restricted-imports': ['error', {
        paths: [{name: 'expo-router', importNames: ['router'],
          message: 'Use useRouter(), <Link> or <Redirect>. The global router throws before the root navigator mounts (YIFY-2R).'}],
      }],
    },
  },
  {
    files: CLIENT,
    rules: {'no-restricted-syntax': ['error', ...NAV_IN_EFFECT, ...SYSTEM_DIALOGS, ...TOKENS]},
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    ignores: ['src/features/*/platform/**'],
    rules: {'no-restricted-syntax': ['error', ...NAV_IN_EFFECT, ...SYSTEM_DIALOGS, ...TOKENS, PLATFORM_OS, TYPEOF_DOM]},
  },
  {
    files: ['src/core/ui/theme/**/*.{ts,tsx}'],
    rules: {'no-restricted-syntax': ['error', ...NAV_IN_EFFECT, ...SYSTEM_DIALOGS]},
  },
  {
    files: ['app/+html.tsx', 'src/server/**/*.ts', 'app/**/*+api.ts', 'app/+middleware.ts'],
    rules: {'no-restricted-syntax': ['error', PLATFORM_OS, TYPEOF_DOM]},
  },
  {
    files: ['src/**/*.web.{ts,tsx}'],
    ignores: ALLOWED_TWINS,
    rules: {'no-restricted-syntax': ['error', wholeFile('Platform twins (*.web.ts[x]) live only in src/core/platform, src/core/ui, src/features/<name>/platform or the three named core adapters.')]},
  },
  {
    files: ['src/**/index.{ts,tsx}'],
    rules: {'no-restricted-syntax': ['error', wholeFile('No barrels. Import the module file directly.')]},
  },
  {
    files: ['src/core/domain/**/*.ts', 'src/core/config/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {patterns: [{
        group: ['react', 'react-*', 'react-native', 'react-native/*', 'expo', 'expo-*', '@expo/*', 'firebase', 'firebase/*', '@react-native-firebase/*', '@sentry/*', '@tanstack/*'],
        message: 'core/domain and core/config are platform-free TypeScript.',
      }]}],
    },
  },
]);
