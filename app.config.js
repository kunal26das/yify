const base = require('./app.json');
const pkg = require('./package.json');

const packageName = base.expo.android.package;

// package.json is the single source of truth for versioning: android/app/build.gradle already reads
// `packageJson.version`/`packageJson.versionCode`, and the iOS project has a build phase that writes
// CFBundleShortVersionString/CFBundleVersion from the same file. app.json used to carry its own
// copies, which drifted — the binary shipped 1.2.2 while anything reading expoConfig said 1.1.6.
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
