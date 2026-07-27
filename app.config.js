const base = require('./app.json');
const pkg = require('./package.json');

const packageName = base.expo.android.package;

const version = pkg.version;
const buildNumber = String(pkg.versionCode);

const baseUrl = process.env.EXPO_WEB_BASE_URL ?? '';

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        version,
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
