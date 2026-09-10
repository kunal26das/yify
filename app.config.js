const base = require('./app.json');
const pkg = require('./package.json');

const packageName = base.expo.android.package;

const version = pkg.version;
const buildNumber = String(pkg.versionCode);

const baseUrl = process.env.EXPO_WEB_BASE_URL ?? '';
const hostingOutput = process.env.EXPO_WEB_OUTPUT === 'server';

const projectId = base.expo.extra?.eas?.projectId ?? '';

const updateChannel = process.env.EXPO_UPDATE_CHANNEL || 'Production';

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        plugins: base.expo.plugins.map((plugin) => {
            if (!hostingOutput || !Array.isArray(plugin) || plugin[0] !== 'expo-router') return plugin;
            return [plugin[0], {
                ...plugin[1],
                redirects: [
                    ...(plugin[1].redirects ?? []),
                    ...['privacy', 'terms', 'delete-account'].map((page) => ({
                        source: `/${page}`,
                        destination: `https://yify.expo.app/${page}.html`,
                        permanent: true,
                    })),
                ],
            }];
        }),
        version,
        runtimeVersion: process.env.EXPO_RUNTIME_VERSION || version,
        ...(projectId
            ? {
                updates: {
                    url: `https://u.expo.dev/${projectId}`,
                    requestHeaders: {'expo-channel-name': updateChannel},
                },
            }
            : {}),
        experiments: {
            ...base.expo.experiments,
            baseUrl,
        },
        web: {
            ...base.expo.web,
            output: hostingOutput ? 'server' : 'static',
        },
        android: {
            ...base.expo.android,
            package: packageName,
            versionCode: pkg.versionCode,
            googleServicesFile: './config/android/google-services.json',
        },
        ios: {
            ...base.expo.ios,
            buildNumber,
            googleServicesFile: './config/ios/GoogleService-Info.plist',
        },
    },
};
