const base = require('./app.json');

const packageName = base.expo.android.package;

const baseUrl = process.env.EXPO_WEB_BASE_URL ?? '';

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        experiments: {
            ...base.expo.experiments,
            baseUrl,
        },
        android: {
            ...base.expo.android,
            package: packageName,
            googleServicesFile: './config/android/google-services.json',
        },
        ios: {
            ...base.expo.ios,
            googleServicesFile: './config/ios/GoogleService-Info.plist',
        },
    },
};
