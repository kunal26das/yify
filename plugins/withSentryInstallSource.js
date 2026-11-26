const {withBaseMod} = require('@expo/config-plugins');

const INIT = /^([ \t]*)RNSentrySDK\.init\(this\)[ \t]*$/m;
const INIT_LINES = /^[ \t]*RNSentrySDK\.init\(this\)[ \t]*$/gm;
const BLOCK = [
    'runCatching {',
    '    val installer = if (android.os.Build.VERSION.SDK_INT >= 30) packageManager.getInstallSourceInfo(packageName).installingPackageName else packageManager.getInstallerPackageName(packageName)',
    '    io.sentry.Sentry.setTag("installer", installer ?: "none")',
    '    io.sentry.Sentry.setTag("split_count", (applicationInfo.splitSourceDirs?.size ?: 0).toString())',
    '}',
];

function addInstallSourceTags(contents, language) {
    if (language !== 'kt') {
        throw new Error('withSentryInstallSource requires a Kotlin MainApplication');
    }
    if ((contents.match(INIT_LINES) ?? []).length !== 1) {
        throw new Error('withSentryInstallSource requires exactly one RNSentrySDK.init(this) in MainApplication: enable useNativeInit and list this plugin after @sentry/react-native/expo');
    }
    const [line, indent] = INIT.exec(contents);
    const block = BLOCK.map((text) => indent + text).join('\n');
    if (contents.includes(`${line}\n${block}\n`)) {
        return contents;
    }
    if (contents.includes('io.sentry.Sentry.setTag("installer"')) {
        throw new Error('withSentryInstallSource found install-source tags that do not directly follow RNSentrySDK.init(this)');
    }
    return contents.replace(INIT, `${line}\n${block}`);
}

function withSentryInstallSource(config) {
    return withBaseMod(config, {
        platform: 'android',
        mod: 'mainApplication',
        async action({modRequest: {nextMod, ...modRequest}, ...rest}) {
            const results = await nextMod({...rest, modRequest});
            results.modResults.contents = addInstallSourceTags(results.modResults.contents, results.modResults.language);
            return results;
        },
    });
}

module.exports = withSentryInstallSource;
module.exports.addInstallSourceTags = addInstallSourceTags;
module.exports.INSTALL_SOURCE_BLOCK = BLOCK;
