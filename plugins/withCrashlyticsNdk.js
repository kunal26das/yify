const {withAppBuildGradle} = require('@expo/config-plugins');

const CONFIGURATION = `
pluginManager.withPlugin("com.google.firebase.crashlytics") {
    android.buildTypes.release.firebaseCrashlytics.nativeSymbolUploadEnabled = true
    tasks.matching { it.name == "assembleRelease" || it.name == "bundleRelease" }.configureEach {
        dependsOn("uploadCrashlyticsSymbolFileRelease")
    }
}
`;

module.exports = (config) =>
    withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== 'groovy') {
            throw new Error('withCrashlyticsNdk requires a Groovy app build.gradle');
        }
        if (!cfg.modResults.contents.includes(CONFIGURATION.trim())) {
            cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${CONFIGURATION}`;
        }
        return cfg;
    });
