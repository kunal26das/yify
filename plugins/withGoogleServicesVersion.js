const {withProjectBuildGradle} = require('@expo/config-plugins');
const {sdkVersions} = require('@react-native-firebase/app/package.json');

module.exports = (config) =>
    withProjectBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== 'groovy') {
            throw new Error('withGoogleServicesVersion requires a Groovy project build.gradle');
        }
        const version = sdkVersions.android.gmsGoogleServicesGradle;
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            throw new Error('withGoogleServicesVersion requires an exact Google Services version from React Native Firebase');
        }
        const classpath = /^([ \t]*classpath[ \t]*(?:\([ \t]*)?)(['"])com\.google\.gms:google-services:[^'"\r\n]+\2([ \t]*\)?[ \t]*)$/gm;
        if ([...cfg.modResults.contents.matchAll(classpath)].length !== 1) {
            throw new Error('withGoogleServicesVersion requires exactly one Google Services classpath in android/build.gradle');
        }
        cfg.modResults.contents = cfg.modResults.contents.replace(
            classpath,
            (_match, prefix, quote, suffix) => `${prefix}${quote}com.google.gms:google-services:${version}${quote}${suffix}`,
        );
        return cfg;
    });
