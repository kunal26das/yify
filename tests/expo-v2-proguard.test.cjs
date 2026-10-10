const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');

const root = join(__dirname, '..');
const read = path => readFileSync(join(root, path), 'utf8');

test('release R8 retains the reflected Expo v2 registry and module implementations', () => {
    const config = require('../app.json');
    const pkg = require('../package.json');
    const android = config.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')[1].android;
    const rules = android.extraProguardRules.split('\n');
    const generated = read('android/app/proguard-rules.pro');
    const host = read('node_modules/expo-modules-core/android/src/main/java/expo/modules/v2/ExpoModulesV2Host.kt');
    const application = read('node_modules/expo-application/android/src/main/java/expo/modules/application/ApplicationModule.kt');

    assert.equal(android.enableProguardInReleaseBuilds, true);
    assert.match(host, /GENERATED_PROVIDER_CLASS = "expo\.modules\.ExpoModulesV2ModuleList"/);
    assert.match(host, /Class\.forName\(GENERATED_PROVIDER_CLASS\)/);
    assert.match(application, /@ExpoModule\("ExpoApplication"\)/);
    for (const rule of [
        '-keep class expo.modules.ExpoModulesV2ModuleList { *; }',
        '-keep class * extends io.github.expo.modules.v2.Module { *; }',
        '-keep class io.github.expo.kolibri.** { *; }',
        '-keep class io.github.expo.modules.v2.** { *; }',
    ]) {
        assert.ok(rules.includes(rule), `Missing source R8 rule: ${rule}`);
        assert.ok(generated.split('\n').includes(rule), `Missing generated R8 rule: ${rule}`);
    }
    assert.ok(pkg.versionCode > 99);
    const [major, minor, patch] = pkg.version.split('.').map(Number);
    assert.ok(major > 1 || major === 1 && (minor > 8 || minor === 8 && patch > 17));
    const resolved = require('../app.config.js').expo;
    assert.equal(resolved.runtimeVersion, pkg.version);
    assert.equal(resolved.android.versionCode, pkg.versionCode);
    assert.ok(read('android/app/build.gradle').includes(`versionCode ${pkg.versionCode}\n        versionName "${pkg.version}"`));
    assert.ok(read('android/app/src/main/res/values/strings.xml').includes(`name="expo_runtime_version">${pkg.version}<`));
    assert.ok(read('ios/Yify/Info.plist').includes(`<key>CFBundleShortVersionString</key>\n\t<string>${pkg.version}</string>`));
    assert.ok(read('ios/Yify/Info.plist').includes(`<key>CFBundleVersion</key>\n\t<string>${pkg.versionCode}</string>`));
    assert.ok(read('ios/Yify/Supporting/Expo.plist').includes(`<key>EXUpdatesRuntimeVersion</key>\n    <string>${pkg.version}</string>`));
});
