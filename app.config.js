const base = require('./app.json');
const pkg = require('./package.json');

const packageName = base.expo.android.package;

const version = pkg.version;
const buildNumber = String(pkg.versionCode);

const baseUrl = process.env.EXPO_WEB_BASE_URL ?? '';

const projectId = base.expo.extra?.eas?.projectId ?? '';

const updateChannel = process.env.APP_VARIANT === 'debug' ? 'Staging' : 'Production';

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        version,
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
