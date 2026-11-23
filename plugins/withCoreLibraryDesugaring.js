const {withAppBuildGradle} = require('@expo/config-plugins');

const LIBRARY = 'com.android.tools:desugar_jdk_libs_nio:2.1.5';
const OPTIONS = `    compileOptions {
        coreLibraryDesugaringEnabled true
    }
`;
const DEPENDENCY = `    coreLibraryDesugaring('${LIBRARY}')
`;

module.exports = (config) =>
    withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== 'groovy') {
            throw new Error('withCoreLibraryDesugaring requires a Groovy app build.gradle');
        }
        const contents = cfg.modResults.contents;
        if ((contents.match(/^android \{$/gm) ?? []).length !== 1) {
            throw new Error('withCoreLibraryDesugaring requires exactly one android block in android/app/build.gradle');
        }
        if ((contents.match(/^dependencies \{$/gm) ?? []).length !== 1) {
            throw new Error('withCoreLibraryDesugaring requires exactly one dependencies block in android/app/build.gradle');
        }
        const enabled = contents.match(/coreLibraryDesugaringEnabled/g) ?? [];
        const libraries = contents.match(/coreLibraryDesugaring\(/g) ?? [];
        if (enabled.length === 1 && libraries.length === 1 && contents.includes(OPTIONS) && contents.includes(DEPENDENCY)) {
            return cfg;
        }
        if (enabled.length || libraries.length || /desugar_jdk_libs/.test(contents)) {
            throw new Error('withCoreLibraryDesugaring found an existing core library desugaring configuration');
        }
        if (/^    compileOptions \{$/m.test(contents)) {
            throw new Error('withCoreLibraryDesugaring found existing Android compile options');
        }
        cfg.modResults.contents = contents
            .replace(/^android \{$/m, `android {\n${OPTIONS}`)
            .replace(/^dependencies \{$/m, `dependencies {\n${DEPENDENCY}`);
        return cfg;
    });
