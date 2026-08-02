const {withAndroidManifest, AndroidConfig} = require('@expo/config-plugins');

const MODES = ['always', 'default', 'never'];
const DEFAULT_MODE = 'always';

module.exports = (config, props) => {
    const mode = props?.mode ?? DEFAULT_MODE;
    if (!MODES.includes(mode)) {
        throw new Error(
            `withGwpAsan: unsupported mode "${mode}", expected one of ${MODES.join(', ')}`
        );
    }
    return withAndroidManifest(config, (cfg) => {
        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
        application.$['android:gwpAsanMode'] = mode;
        return cfg;
    });
};
