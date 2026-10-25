import {readFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseModules = ['app', 'auth', 'analytics', 'crashlytics', 'remote-config'].map(name => `@react-native-firebase/${name}`);
const googleSignIn = '@react-native-google-signin/google-signin';
const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'resolutions'];
const deniedDefaults = [
    'analytics_auto_collection_enabled', 'analytics_default_allow_analytics_storage',
    'analytics_default_allow_ad_storage', 'analytics_default_allow_ad_user_data',
    'analytics_default_allow_ad_personalization_signals', 'google_analytics_adid_collection_enabled',
    'google_analytics_ssaid_collection_enabled', 'google_analytics_automatic_screen_reporting_enabled',
    'analytics_idfv_collection_enabled', 'google_analytics_registration_with_ad_network_enabled',
    'crashlytics_javascript_exception_handler_chaining_enabled',
];

function equal(actual, expected, label) {
    if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual) ?? 'missing'}.`);
}

function equalList(actual, expected, label) {
    if (!Array.isArray(actual) || actual.length !== expected.length || expected.some((value, index) => actual[index] !== value)) {
        throw new Error(`${label}: expected exactly ${JSON.stringify(expected)}, received ${JSON.stringify(actual) ?? 'missing'}.`);
    }
}

function plugin(plugins, name) {
    const matches = plugins.filter(value => (Array.isArray(value) ? value[0] : value) === name);
    equal(matches.length, 1, `app.json expo.plugins ${name} count`);
    return Array.isArray(matches[0]) ? matches[0][1] ?? {} : {};
}

export function validateFirebaseCompatibility({policy, manifest, installed, appConfig, firebaseConfig, crashreportingManifest}) {
    for (const [label, value] of Object.entries({policy, manifest, installed, appConfig, firebaseConfig, crashreportingManifest})) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Firebase compatibility ${label}: missing manifest or invalid object.`);
    }
    equal(policy?.schemaVersion, 1, 'Firebase compatibility policy schemaVersion');
    for (const key of ['reactNativeFirebase', 'firebaseJavaScript', 'androidBom', 'appleSdk', 'kotlin', 'googleSignInWrapper', 'googleSignInAppleSdk']) {
        if (typeof policy[key] !== 'string' || !/^\d+\.\d+\.\d+$/.test(policy[key])) {
            throw new Error(`Firebase compatibility policy ${key}: expected an exact release version.`);
        }
    }
    equal(policy.androidMinSdk, 24, 'Firebase compatibility policy androidMinSdk');
    equalList(policy.staticApplePods, ['RNGoogleMobileAds'], 'Firebase compatibility policy staticApplePods');
    for (const key of deniedDefaults) equal(policy.firebaseDefaults?.[key], false, `Firebase compatibility policy firebaseDefaults.${key}`);
    equal(policy.firebaseDefaults?.crashlytics_is_error_generation_on_js_crash_enabled, true,
        'Firebase compatibility policy firebaseDefaults.crashlytics_is_error_generation_on_js_crash_enabled');
    const expectedPackages = Object.fromEntries([
        ...firebaseModules.map(name => [name, policy.reactNativeFirebase]),
        ['firebase', policy.firebaseJavaScript], [googleSignIn, policy.googleSignInWrapper],
    ]);
    for (const [name, version] of Object.entries(expectedPackages)) {
        equal(manifest?.dependencies?.[name], version, `package.json dependencies.${name}`);
        for (const section of dependencySections.slice(1)) {
            if (Object.hasOwn(manifest?.[section] ?? {}, name)) equal(manifest[section][name], version, `package.json ${section}.${name}`);
        }
        if (!installed?.[name]) throw new Error(`Installed package ${name}: missing package metadata; install the complete reviewed dependency graph.`);
        equal(installed[name].name, name, `Installed package ${name} name`);
        equal(installed[name].version, version, `Installed package ${name} version`);
    }
    for (const section of dependencySections) {
        for (const name of Object.keys(manifest?.[section] ?? {})) {
            if (name.startsWith('@react-native-firebase/') && !firebaseModules.includes(name)) {
                throw new Error(`package.json ${section}.${name}: Firebase module is outside the reviewed compatibility policy.`);
            }
        }
        for (const [name, value] of Object.entries(crashreportingManifest?.[section] ?? {})) {
            if (/firebase/i.test(name) || /firebase/i.test(String(value))) {
                throw new Error(`crashreporting/package.json ${section}.${name}: Firebase must remain injected, without a direct SDK dependency.`);
            }
        }
    }
    for (const name of firebaseModules.slice(1)) {
        equal(installed[name].peerDependencies?.['@react-native-firebase/app'], policy.reactNativeFirebase, `Installed package ${name} app peer`);
    }
    equal(installed['@react-native-firebase/remote-config'].peerDependencies?.['@react-native-firebase/analytics'], policy.reactNativeFirebase,
        'Installed package @react-native-firebase/remote-config analytics peer');
    const app = installed['@react-native-firebase/app'];
    equal(app.dependencies?.firebase, policy.firebaseJavaScript, 'Installed Firebase app JavaScript SDK dependency');
    equal(app.sdkVersions?.android?.firebase, policy.androidBom, 'Installed Firebase app Android BoM');
    equal(app.sdkVersions?.android?.minSdk, policy.androidMinSdk, 'Installed Firebase app Android minSdk');
    equal(app.sdkVersions?.ios?.firebase, policy.appleSdk, 'Installed Firebase app Apple SDK');
    equal(app.sdkVersions?.ios?.firebaseSpmUrl, 'https://github.com/firebase/firebase-ios-sdk.git', 'Installed Firebase app Apple distribution URL');
    equal(installed[googleSignIn].GoogleSignInPodVersion, policy.googleSignInAppleSdk, 'Installed Google Sign-In Apple SDK metadata');
    const plugins = appConfig?.expo?.plugins;
    if (!Array.isArray(plugins)) throw new Error('app.json expo.plugins: expected a plugin array.');
    const firebase = plugin(plugins, '@react-native-firebase/app');
    if (Object.hasOwn(firebase, 'disableSPM') || Object.hasOwn(firebase.ios ?? {}, 'disableSPM')) {
        throw new Error('app.json Firebase app plugin: remove disableSPM entirely; Firebase 27 requires SPM.');
    }
    plugin(plugins, './plugins/withGoogleSigninSpm');
    const build = plugin(plugins, 'expo-build-properties');
    equal(build.android?.kotlinVersion, policy.kotlin, 'app.json Android kotlinVersion');
    equal(build.android?.minSdkVersion, policy.androidMinSdk, 'app.json Android minSdkVersion');
    equal(build.ios?.useFrameworks, 'dynamic', 'app.json iOS useFrameworks');
    equalList(build.ios?.forceStaticLinking, policy.staticApplePods, 'app.json iOS forceStaticLinking');
    equal(plugin(plugins, 'react-native-google-mobile-ads').delayAppMeasurementInit, true, 'app.json AdMob delayAppMeasurementInit');
    equal(plugin(plugins, './plugins/withGradleJvmArgs').properties?.RNGMA_ANDROID_BACKEND, 'classic', 'app.json RNGMA_ANDROID_BACKEND');
    for (const [key, value] of Object.entries(policy.firebaseDefaults)) equal(firebaseConfig?.['react-native']?.[key], value, `firebase.json react-native.${key}`);
    const defaults = firebaseConfig['react-native'];
    const crashCollection = Object.hasOwn(defaults, 'crashlytics_auto_collection_enabled')
        ? defaults.crashlytics_auto_collection_enabled
        : Object.hasOwn(defaults, 'app_data_collection_default_enabled') ? defaults.app_data_collection_default_enabled : true;
    equal(crashCollection, true, 'firebase.json effective default Crashlytics collection');
    return true;
}

async function readJson(directory, filename) {
    try {
        return JSON.parse(await readFile(join(directory, filename), 'utf8'));
    } catch (error) {
        throw new Error(`Firebase compatibility cannot read ${filename}: ${error.code ?? error.name}.`);
    }
}

export async function checkFirebaseCompatibility(directory = root) {
    const filenames = ['scripts/firebase-compatibility.json', 'package.json', 'app.json', 'firebase.json', 'crashreporting/package.json'];
    const [policy, manifest, appConfig, firebaseConfig, crashreportingManifest] = await Promise.all(filenames.map(name => readJson(directory, name)));
    const names = [...firebaseModules, 'firebase', googleSignIn];
    const packages = await Promise.all(names.map(name => readJson(directory, `node_modules/${name}/package.json`)));
    return validateFirebaseCompatibility({policy, manifest, appConfig, firebaseConfig, crashreportingManifest,
        installed: Object.fromEntries(names.map((name, index) => [name, packages[index]]))});
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    checkFirebaseCompatibility().then(() => {
        console.log('Firebase versions, native prerequisites, identity integration and collection defaults match the reviewed policy.');
    }).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
