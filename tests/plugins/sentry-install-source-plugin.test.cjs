const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const {modifyMainApplication} = require('@sentry/react-native/plugin/build/withSentryAndroid');
const withSentryInstallSource = require('../../plugins/withSentryInstallSource');

const {addInstallSourceTags, INSTALL_SOURCE_BLOCK} = withSentryInstallSource;
const projectRoot = path.resolve(__dirname, '../..');
const trackedPath = path.join(projectRoot, 'android/app/src/main/java/io/github/kunal26das/yify/MainApplication.kt');
const template = `package io.github.kunal26das.yify

import android.app.Application
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.STABLE
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

function pluginName(plugin) {
    return Array.isArray(plugin) ? plugin[0] : plugin;
}

async function runChain(contents, plugins) {
    let config = {name: 'Yify', slug: 'yify'};
    for (const plugin of plugins) config = plugin(config);
    const result = await config.mods.android.mainApplication({
        ...config,
        modRequest: {platform: 'android', modName: 'mainApplication', projectRoot, platformProjectRoot: path.join(projectRoot, 'android')},
        modResults: {path: trackedPath, language: 'kt', contents},
    });
    return result.modResults.contents;
}

test('app.json registers the install-source tags directly after Sentry native init', () => {
    const app = require('../../app.json');
    const names = app.expo.plugins.map(pluginName);
    const sentry = names.indexOf('@sentry/react-native/expo');
    assert.equal(names.indexOf('./plugins/withSentryInstallSource'), sentry + 1);
    assert.equal(app.expo.plugins[sentry][1].useNativeInit, true);
});

test('the tags follow RNSentrySDK.init(this) and precede React Native when the mods run in app.json order', async () => {
    const result = await runChain(template, [modifyMainApplication, withSentryInstallSource]);
    const init = result.indexOf('    RNSentrySDK.init(this)\n');
    const block = INSTALL_SOURCE_BLOCK.map((line) => `    ${line}`).join('\n');
    assert.ok(init > result.indexOf('super.onCreate()'));
    assert.equal(result.indexOf(block), init + '    RNSentrySDK.init(this)\n'.length);
    assert.ok(result.indexOf(block) < result.indexOf('loadReactNative(this)'));
    assert.match(result, /^import io\.sentry\.react\.RNSentrySDK$/m);
    assert.doesNotMatch(result, /RNSentrySDK\.init\(this\);/);
    assert.equal(addInstallSourceTags(result, 'kt'), result);
    assert.equal(await runChain(result, [modifyMainApplication, withSentryInstallSource]), result);
    assert.equal(await runChain(template, [withSentryInstallSource, modifyMainApplication]), result);
});

test('the block tags the Play installer and the split count with the documented Sentry API', () => {
    const block = INSTALL_SOURCE_BLOCK.join('\n');
    assert.match(block, /^runCatching \{/);
    assert.match(block, /Build\.VERSION\.SDK_INT >= 30\) packageManager\.getInstallSourceInfo\(packageName\)\.installingPackageName else packageManager\.getInstallerPackageName\(packageName\)/);
    assert.match(block, /io\.sentry\.Sentry\.setTag\("installer", installer \?: "none"\)/);
    assert.match(block, /io\.sentry\.Sentry\.setTag\("split_count", \(applicationInfo\.splitSourceDirs\?\.size \?: 0\)\.toString\(\)\)/);
});

test('fails closed without native init, with Java, or with a misplaced block', async () => {
    await assert.rejects(runChain(template, [withSentryInstallSource]), /exactly one RNSentrySDK\.init\(this\)/);
    assert.throws(() => addInstallSourceTags(template, 'java'), /requires a Kotlin MainApplication/);
    const initialized = template.replace('    super.onCreate()\n', '    super.onCreate()\n    RNSentrySDK.init(this)\n');
    const twice = initialized.replace('    RNSentrySDK.init(this)\n', '    RNSentrySDK.init(this)\n    RNSentrySDK.init(this)\n');
    assert.throws(() => addInstallSourceTags(twice, 'kt'), /exactly one/);
    const tagged = addInstallSourceTags(initialized, 'kt');
    const moved = tagged.replace('    RNSentrySDK.init(this)\n', '').replace('    loadReactNative(this)\n', '    loadReactNative(this)\n    RNSentrySDK.init(this)\n');
    assert.throws(() => addInstallSourceTags(moved, 'kt'), /do not directly follow/);
});

test('the tracked MainApplication matches the plugin and initializes Sentry before React Native', () => {
    const tracked = fs.readFileSync(trackedPath, 'utf8');
    assert.equal(addInstallSourceTags(tracked, 'kt'), tracked);
    assert.ok(tracked.indexOf('RNSentrySDK.init(this)') < tracked.indexOf('io.sentry.Sentry.setTag("installer"'));
    assert.ok(tracked.indexOf('io.sentry.Sentry.setTag("split_count"') < tracked.indexOf('loadReactNative(this)'));
});
