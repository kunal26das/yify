const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {loadTs} = require('../helpers/loadTs.cjs');

const root = path.resolve(__dirname, '../..');
const pkg = require('../../package.json');
const brand = require('../../config/brand.json');
const legacyRedirects = require('../../config/legacy-redirects.json');
const sentry = require('../../sentry.options.json');
const {ENFORCED_CSP, pageHeaders} = require('../../config/webHeaders.cjs');

const ENV_KEYS = ['EXPO_UPDATE_CHANNEL', 'EXPO_PUBLIC_WEB_CHECKOUT'];
const REMOVED_PLUGINS = [
    '@react-native-firebase/crashlytics', './plugins/withCrashlyticsNdk', 'expo-location', 'expo-notifications', 'expo-background-task',
];

function loadConfig(env = {}) {
    const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    const apply = (values) => {
        for (const key of ENV_KEYS) {
            if (values[key] === undefined) delete process.env[key];
            else process.env[key] = values[key];
        }
    };
    const file = require.resolve('../../app.config.js');
    apply(env);
    delete require.cache[file];
    try {
        return require(file).expo;
    } finally {
        delete require.cache[file];
        apply(saved);
    }
}

function pluginName(plugin) {
    return Array.isArray(plugin) ? plugin[0] : plugin;
}

function pluginOptions(config, name) {
    const matches = config.plugins.filter((plugin) => pluginName(plugin) === name);
    assert.equal(matches.length, 1, `${name} is registered once`);
    return Array.isArray(matches[0]) ? matches[0][1] ?? {} : {};
}

function directive(policy, name) {
    return policy.split('; ').find((part) => part.startsWith(`${name} `)) ?? '';
}

test('an unset update channel defaults to Production and an explicit one is used', () => {
    assert.equal(loadConfig().updates.requestHeaders['expo-channel-name'], 'Production');
    assert.equal(loadConfig({EXPO_UPDATE_CHANNEL: 'Staging'}).updates.requestHeaders['expo-channel-name'], 'Staging');
});

test('the runtime is the package version and Android uses the package version code', () => {
    const config = loadConfig();
    assert.equal(config.version, pkg.version);
    assert.equal(config.runtimeVersion, pkg.version);
    assert.equal(config.android.versionCode, pkg.versionCode);
    assert.equal(config.ios.buildNumber, String(pkg.versionCode));
    assert.equal(pkg.version, '2.0.0');
    assert.equal(pkg.versionCode, 116);
    assert.equal(loadTs('src/core/config/app.ts').APP_VERSION, pkg.version);
});

test('brand values come from config/brand.json', () => {
    const config = loadConfig();
    assert.equal(config.name, brand.appName);
    assert.equal(config.primaryColor, brand.colors.dark.surface);
    const splash = pluginOptions(config, 'expo-splash-screen');
    assert.equal(splash.backgroundColor, brand.colors.light.surface);
    assert.equal(splash.dark.backgroundColor, brand.colors.dark.surface);
    assert.notEqual(splash.dark.image, splash.image);
    assert.equal(config.android.adaptiveIcon.backgroundColor, brand.androidIconBackground);
    assert.equal(Object.hasOwn(config.android.adaptiveIcon, 'backgroundImage'), false);
    const fonts = pluginOptions(config, 'expo-font').fonts;
    assert.deepEqual(fonts.slice(0, 3), [brand.fonts.display.file, brand.fonts.body.file, brand.fonts.bodyStrong.file]);
});

test('every asset path in the resolved config exists on disk', () => {
    const config = loadConfig();
    const splash = pluginOptions(config, 'expo-splash-screen');
    const paths = [
        config.icon,
        config.ios.googleServicesFile,
        config.android.googleServicesFile,
        config.android.adaptiveIcon.foregroundImage,
        config.android.adaptiveIcon.monochromeImage,
        config.web.favicon,
        splash.image,
        splash.dark.image,
        ...pluginOptions(config, 'expo-font').fonts,
    ];
    for (const file of paths) {
        assert.equal(typeof file, 'string');
        assert.ok(fs.statSync(path.resolve(root, file)).isFile(), `${file} exists`);
    }
});

test('web headers carry the enforced CSP and a report-only policy for both checkout states', () => {
    const reportUri = 'https://o4512058491338752.ingest.us.sentry.io/api/4512058497695744/security/?sentry_key=ab0c10fbe49dc5a4e4f0c9ab3c7a0386';
    assert.match(sentry.dsn, /^https:\/\/ab0c10fbe49dc5a4e4f0c9ab3c7a0386@o4512058491338752\.ingest\.us\.sentry\.io\/4512058497695744$/);
    for (const webCheckout of [false, true]) {
        const headers = pluginOptions(loadConfig({EXPO_PUBLIC_WEB_CHECKOUT: webCheckout ? '1' : undefined}), 'expo-router').headers;
        const policy = headers['Content-Security-Policy-Report-Only'];
        assert.equal(headers['Content-Security-Policy'], ENFORCED_CSP);
        assert.equal(headers['X-Content-Type-Options'], 'nosniff');
        assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
        assert.equal(headers['Permissions-Policy'].includes('payment=()'), !webCheckout);
        assert.ok(directive(policy, 'frame-src').split(' ').includes("'self'"));
        assert.equal(policy.includes('firebaseapp.com'), false);
        assert.equal(directive(policy, 'script-src').includes('https://js.stripe.com'), webCheckout);
        assert.equal(directive(policy, 'connect-src').includes('https://api.stripe.com'), webCheckout);
        assert.equal(directive(policy, 'frame-src').includes('https://js.stripe.com'), webCheckout);
        assert.equal(directive(policy, 'report-uri'), `report-uri ${reportUri}`);
    }
});

test('the router serves the legacy redirects and the page headers from config/', () => {
    const router = pluginOptions(loadConfig(), 'expo-router');
    assert.deepEqual(router.redirects, legacyRedirects);
    assert.deepEqual(router.pageHeaders, pageHeaders);
    assert.equal(router.headOrigin, 'https://yify.expo.app');
});

test('no plugin entry names a removed package', () => {
    const names = loadConfig().plugins.map(pluginName);
    for (const removed of REMOVED_PLUGINS) assert.equal(names.includes(removed), false, removed);
});
