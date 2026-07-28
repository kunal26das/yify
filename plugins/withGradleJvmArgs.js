const {withGradleProperties} = require('@expo/config-plugins');

const DEFAULT_JVM_ARGS = '-Xmx6144m -XX:MaxMetaspaceSize=2g -XX:+HeapDumpOnOutOfMemoryError';

module.exports = (config, options = {}) => {
    const jvmArgs = options.jvmArgs ?? DEFAULT_JVM_ARGS;
    return withGradleProperties(config, (cfg) => {
        cfg.modResults = cfg.modResults.filter(
            (item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs')
        );
        cfg.modResults.push({
            type: 'property',
            key: 'org.gradle.jvmargs',
            value: jvmArgs,
        });
        return cfg;
    });
};
