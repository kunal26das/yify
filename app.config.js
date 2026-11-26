const base = require('./app.json');
const pkg = require('./package.json');
const brand = require('./config/brand.json');
const sentry = require('./sentry.options.json');
const legacyRedirects = require('./config/legacy-redirects.json');
const {pageHeaders, webHeaders} = require('./config/webHeaders.cjs');

const projectId = base.expo.extra.eas.projectId;
const updateChannel = process.env.EXPO_UPDATE_CHANNEL || 'Production';
const webCheckout = process.env.EXPO_PUBLIC_WEB_CHECKOUT === '1';
const textFonts = [brand.fonts.display.file, brand.fonts.body.file, brand.fonts.bodyStrong.file];

function withBrand(plugin) {
    if (!Array.isArray(plugin)) return plugin;
    const [name, options] = plugin;
    if (name === 'expo-router') {
        return [name, {...options, redirects: legacyRedirects, headers: webHeaders({webCheckout, sentryDsn: sentry.dsn}), pageHeaders}];
    }
    if (name === 'expo-splash-screen') {
        return [name, {...options, backgroundColor: brand.colors.light.surface, dark: {...options.dark, backgroundColor: brand.colors.dark.surface}}];
    }
    if (name === 'expo-font') {
        return [name, {...options, fonts: [...textFonts, ...options.fonts]}];
    }
    return plugin;
}

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        name: brand.appName,
        version: pkg.version,
        runtimeVersion: pkg.version,
        primaryColor: brand.colors.dark.surface,
        updates: {
            url: `https://u.expo.dev/${projectId}`,
            requestHeaders: {'expo-channel-name': updateChannel},
            checkAutomatically: 'ON_LOAD',
            fallbackToCacheTimeout: 0,
        },
        plugins: base.expo.plugins.map(withBrand),
        android: {
            ...base.expo.android,
            versionCode: pkg.versionCode,
            googleServicesFile: './config/android/google-services.json',
            adaptiveIcon: {...base.expo.android.adaptiveIcon, backgroundColor: brand.androidIconBackground},
        },
        ios: {...base.expo.ios, buildNumber: String(pkg.versionCode), googleServicesFile: './config/ios/GoogleService-Info.plist'},
    },
};
