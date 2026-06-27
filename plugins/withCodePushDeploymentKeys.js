const {withXcodeProject, withDangerousMod} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Makes the RevoPush/CodePush deployment key build-type aware so OTA updates
 * are isolated per environment:
 *   - Release builds  -> Production-<platform> deployment
 *   - Debug builds    -> Staging-<platform> deployment
 *
 * Must run AFTER @revopush/expo-code-push-plugin, which writes the base
 * (Production) key into Info.plist / strings.xml and wires the native bridge.
 *
 * iOS:    the RevoPush plugin writes Info.plist `CodePushDeploymentKey` as the
 *         build variable `$(CODE_PUSH_DEPLOYMENT_KEY)` (see app.json); this plugin
 *         defines that variable per Xcode configuration (Debug=Staging,
 *         Release=Production), which Xcode substitutes into Info.plist at build time.
 * Android: the main strings.xml keeps the Production key (used by `release`),
 *         and a `src/debug/res/values/strings.xml` override supplies the Staging
 *         key for `debug` builds (debug source set wins during resource merge).
 */
const withIos = (config, {ios}) => {
    config = withXcodeProject(config, (cfg) => {
        const project = cfg.modResults;
        const configurations = project.pbxXCBuildConfigurationSection();
        for (const id of Object.keys(configurations)) {
            const entry = configurations[id];
            const settings = entry && entry.buildSettings;
            if (!settings) continue; // skip comment entries
            if (entry.name === 'Release') {
                settings.CODE_PUSH_DEPLOYMENT_KEY = `"${ios.production}"`;
            } else if (entry.name === 'Debug') {
                settings.CODE_PUSH_DEPLOYMENT_KEY = `"${ios.staging}"`;
            }
        }
        return cfg;
    });
    return config;
};

const withAndroid = (config, {android}) => {
    return withDangerousMod(config, [
        'android',
        (cfg) => {
            const valuesDir = path.join(
                cfg.modRequest.platformProjectRoot,
                'app',
                'src',
                'debug',
                'res',
                'values'
            );
            fs.mkdirSync(valuesDir, {recursive: true});
            const contents =
                '<?xml version="1.0" encoding="utf-8"?>\n' +
                '<resources>\n' +
                `    <string name="CodePushDeploymentKey" translatable="false">${android.staging}</string>\n` +
                '</resources>\n';
            fs.writeFileSync(path.join(valuesDir, 'strings.xml'), contents);
            return cfg;
        },
    ]);
};

module.exports = (config, options = {}) => {
    if (options.ios) config = withIos(config, options);
    if (options.android) config = withAndroid(config, options);
    return config;
};
