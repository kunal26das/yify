const base = require('./app.json');

const isRelease =
    process.env.EAS_BUILD_PROFILE === 'production' ||
    process.env.APP_VARIANT === 'release';

const googleServicesFile = isRelease
    ? './config/android/google-services.release.json'
    : './config/android/google-services.debug.json';

const basePackage = base.expo.android.package;
const packageName = isRelease ? basePackage : `${basePackage}.debug`;

module.exports = {
    ...base,
    expo: {
        ...base.expo,
        android: {
            ...base.expo.android,
            package: packageName,
            googleServicesFile,
        },
    },
};
