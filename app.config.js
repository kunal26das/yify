const base = require('./app.json');

const isRelease =
    process.env.EAS_BUILD_PROFILE === 'production' ||
    process.env.APP_VARIANT === 'release';

// Debug builds get a distinct package so they can coexist with a release
// install; the single google-services.json registers both packages.
const basePackage = base.expo.android.package;
const packageName = isRelease ? basePackage : `${basePackage}.debug`;

module.exports = {
    ...base,
    expo: {
        ...base.expo,
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
