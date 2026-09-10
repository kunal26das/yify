const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const withFirebaseCrashlytics = require('@react-native-firebase/crashlytics/app.plugin.js').default;
const withCrashlyticsNdk = require('../plugins/withCrashlyticsNdk');

const repoRoot = path.resolve(__dirname, '..');
const FIREBASE_PLUGIN = "apply plugin: 'com.google.firebase.crashlytics'";
const APP_GRADLE = `apply plugin: "io.sentry.android.gradle"
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

react {
    autolinkLibrariesWithApp()
}

apply from: new File(["node", "--print", "require('path').dirname(require.resolve('@sentry/react-native/package.json'))"].execute().text.trim(), "sentry.gradle.kts")

android {
    namespace 'io.github.kunal26das.yify'
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")
}

apply plugin: 'com.google.gms.google-services'

sentry {
    autoUploadProguardMapping = shouldSentryAutoUpload()
    includeProguardMapping = true
    uploadNativeSymbols = shouldSentryAutoUpload()
    autoUploadNativeSymbols = shouldSentryAutoUpload()
    includeNativeSources = false
    tracingInstrumentation {
        enabled = false
    }
}
`;

async function apply(contents, {language = 'groovy', plugins = [withCrashlyticsNdk]} = {}) {
    const config = plugins.reduce((result, plugin) => plugin(result), {
        name: 'Yify',
        slug: 'yify',
        android: {package: 'io.github.kunal26das.yify'},
        _internal: {projectRoot: repoRoot},
    });
    return config.mods.android.appBuildGradle({
        ...config,
        modRequest: {
            platform: 'android',
            modName: 'appBuildGradle',
            projectRoot: repoRoot,
            platformProjectRoot: path.join(repoRoot, 'android'),
        },
        modResults: {language, contents},
    });
}

function occurrences(contents, text) {
    return contents.split(text).length - 1;
}

test('the registered Expo mod enables release native symbols while preserving Sentry and Firebase configuration', async () => {
    const fixture = `${APP_GRADLE}\n${FIREBASE_PLUGIN}\n`;
    const result = await apply(fixture);

    assert.equal(result.name, 'Yify');
    assert.equal(result.android.package, 'io.github.kunal26das.yify');
    assert.equal(result.modResults.language, 'groovy');
    assert.ok(result.modResults.contents.startsWith(fixture.trimEnd()));
    assert.match(result.modResults.contents, /android\.buildTypes\.release\.firebaseCrashlytics\.nativeSymbolUploadEnabled\s*=\s*true/);
    assert.equal(occurrences(result.modResults.contents, FIREBASE_PLUGIN), 1);
    assert.equal(occurrences(result.modResults.contents, 'apply plugin: "io.sentry.android.gradle"'), 1);
    assert.equal(occurrences(result.modResults.contents, 'sentry.gradle.kts'), 1);
});

test('reapplying the plugin to generated Gradle leaves the file byte-for-byte unchanged', async () => {
    const first = (await apply(`${APP_GRADLE}\n${FIREBASE_PLUGIN}\n`)).modResults.contents;
    const second = (await apply(first)).modResults.contents;
    const third = (await apply(second)).modResults.contents;

    assert.equal(second, first);
    assert.equal(third, first);
    assert.equal(occurrences(third, 'nativeSymbolUploadEnabled = true'), 1);
    assert.equal(occurrences(third, 'dependsOn("uploadCrashlyticsSymbolFileRelease")'), 1);
});

test('duplicate Expo plugin registration does not add duplicate configuration or upload dependencies', async () => {
    const single = (await apply(APP_GRADLE)).modResults.contents;
    const duplicate = (await apply(APP_GRADLE, {plugins: [withCrashlyticsNdk, withCrashlyticsNdk]})).modResults.contents;
    assert.equal(duplicate, single);
});

test('the real RNFirebase Expo mod can run before or after the NDK mod without losing either configuration', async () => {
    for (const plugins of [
        [withFirebaseCrashlytics, withCrashlyticsNdk],
        [withCrashlyticsNdk, withFirebaseCrashlytics],
    ]) {
        const contents = (await apply(APP_GRADLE, {plugins})).modResults.contents;
        assert.ok(contents.startsWith(APP_GRADLE.trimEnd()));
        assert.equal(occurrences(contents, FIREBASE_PLUGIN), 1);
        assert.equal(occurrences(contents, 'nativeSymbolUploadEnabled = true'), 1);
        assert.match(contents, /pluginManager\.withPlugin\("com\.google\.firebase\.crashlytics"\)\s*\{/);
        assert.equal((await apply(contents, {plugins})).modResults.contents, contents);
    }
});

test('non-Groovy Gradle files fail explicitly instead of receiving invalid Groovy configuration', async () => {
    await assert.rejects(
        apply('plugins { id("com.android.application") }\n', {language: 'kt'}),
        /withCrashlyticsNdk requires a Groovy app build\.gradle/,
    );
    await assert.rejects(
        apply(APP_GRADLE, {language: 'unknown'}),
        /withCrashlyticsNdk requires a Groovy app build\.gradle/,
    );
});

test('Expo app configuration includes the NDK plugin alongside the Firebase Crashlytics plugin', () => {
    const plugins = require('../app.json').expo.plugins.map(plugin => Array.isArray(plugin) ? plugin[0] : plugin);
    assert.equal(plugins.filter(plugin => plugin === './plugins/withCrashlyticsNdk').length, 1);
    assert.ok(plugins.includes('@react-native-firebase/crashlytics'));
});
