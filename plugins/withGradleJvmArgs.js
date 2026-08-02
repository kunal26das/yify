const {withGradleProperties} = require('@expo/config-plugins');

const DEFAULT_PROPERTIES = {
    'org.gradle.jvmargs': '-Xmx6144m -XX:MaxMetaspaceSize=2g -XX:+HeapDumpOnOutOfMemoryError',
    'org.gradle.tooling.parallel': 'true',
};

module.exports = (config, options = {}) => {
    const properties = {
        ...DEFAULT_PROPERTIES,
        ...(options.jvmArgs ? {'org.gradle.jvmargs': options.jvmArgs} : {}),
        ...(options.properties ?? {}),
    };
    const keys = new Set(Object.keys(properties));

    return withGradleProperties(config, (cfg) => {
        cfg.modResults = cfg.modResults.filter(
            (item) => !(item.type === 'property' && keys.has(item.key))
        );
        for (const [key, value] of Object.entries(properties)) {
            cfg.modResults.push({type: 'property', key, value});
        }
        return cfg;
    });
};
