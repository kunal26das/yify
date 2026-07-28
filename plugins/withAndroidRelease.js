const {withAppBuildGradle} = require('@expo/config-plugins');

const PREAMBLE = `
def packageJson = new groovy.json.JsonSlurper().parseText(file("$projectRoot/package.json").text)

def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
`;

const replace = (contents, pattern, replacement, label) => {
    if (!pattern.test(contents)) {
        throw new Error(`withAndroidRelease: could not find the ${label} anchor in android/app/build.gradle`);
    }
    return contents.replace(pattern, replacement);
};

module.exports = (config) =>
    withAppBuildGradle(config, (cfg) => {
        let contents = cfg.modResults.contents;

        contents = replace(
            contents,
            /^def projectRoot = .*$/m,
            (match) => `${match}\n${PREAMBLE}`,
            'projectRoot'
        );

        contents = replace(
            contents,
            /^(\s*)versionCode \d+$/m,
            '$1versionCode packageJson.versionCode',
            'versionCode'
        );

        contents = replace(
            contents,
            /^(\s*)versionName ".*"$/m,
            '$1versionName packageJson.version',
            'versionName'
        );

        contents = replace(
            contents,
            /^(\s*)keyPassword 'android'\n(\s*)\}\n/m,
            `$1keyPassword 'android'\n$2}\n${RELEASE_SIGNING_CONFIG}`,
            'debug signingConfig'
        );

        contents = replace(
            contents,
            /^\s*\/\/ Caution! In production.*\n\s*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n(\s*)signingConfig signingConfigs\.debug$/m,
            '$1signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug',
            'release signingConfig'
        );

        cfg.modResults.contents = contents;
        return cfg;
    });
