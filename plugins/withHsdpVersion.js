const {withAppBuildGradle} = require('@expo/config-plugins');

const PIN = `    constraints {
        implementation('com.google.android.play:hsdp') {
            version { strictly '2.2.0' }
        }
    }
`;

module.exports = (config) =>
    withAppBuildGradle(config, (cfg) => {
        if (cfg.modResults.language !== 'groovy') {
            throw new Error('withHsdpVersion requires a Groovy app build.gradle');
        }
        const contents = cfg.modResults.contents;
        if ((contents.match(/^dependencies \{$/gm) ?? []).length !== 1) {
            throw new Error('withHsdpVersion requires exactly one dependencies block in android/app/build.gradle');
        }
        const declarations = contents.match(/com\.google\.android\.play:hsdp/g) ?? [];
        if (declarations.length === 1 && contents.includes(PIN)) {
            return cfg;
        }
        if (declarations.length !== 0) {
            throw new Error('withHsdpVersion found an existing HSDP dependency declaration');
        }
        cfg.modResults.contents = contents.replace(/^dependencies \{$/m, `dependencies {\n${PIN}`);
        return cfg;
    });
