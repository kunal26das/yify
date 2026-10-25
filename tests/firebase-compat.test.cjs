const assert = require('node:assert/strict');
const {test} = require('node:test');
const {mkdtemp, mkdir, readFile, writeFile, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const path = require('node:path');
const policy = require('../scripts/firebase-compatibility.json');
const load = () => import('../scripts/check-firebase-compat.mjs');
const appName = '@react-native-firebase/app';
const googleName = '@react-native-google-signin/google-signin';

function fixture() {
    const modules = ['app', 'auth', 'analytics', 'crashlytics', 'remote-config'].map(name => `@react-native-firebase/${name}`);
    const dependencies = Object.fromEntries(modules.map(name => [name, policy.reactNativeFirebase]));
    dependencies.firebase = policy.firebaseJavaScript;
    dependencies[googleName] = policy.googleSignInWrapper;
    const installed = Object.fromEntries(Object.entries(dependencies).map(([name, version]) => [name, {
        name, version, peerDependencies: {[appName]: policy.reactNativeFirebase},
    }]));
    installed[appName].dependencies = {firebase: policy.firebaseJavaScript};
    installed[appName].sdkVersions = {
        android: {firebase: policy.androidBom, minSdk: policy.androidMinSdk},
        ios: {firebase: policy.appleSdk, firebaseSpmUrl: 'https://github.com/firebase/firebase-ios-sdk.git'},
    };
    installed['@react-native-firebase/remote-config'].peerDependencies['@react-native-firebase/analytics'] = policy.reactNativeFirebase;
    installed[googleName].GoogleSignInPodVersion = policy.googleSignInAppleSdk;
    return {
        policy: structuredClone(policy), manifest: {dependencies}, installed,
        crashreportingManifest: {name: '@yify/crashreporting', dependencies: {'error-stack-parser': '2.1.4'}},
        firebaseConfig: {'react-native': {...policy.firebaseDefaults}},
        appConfig: {expo: {plugins: [
            appName,
            ['expo-build-properties', {android: {kotlinVersion: policy.kotlin, minSdkVersion: 24},
                ios: {useFrameworks: 'dynamic', forceStaticLinking: [...policy.staticApplePods]}}],
            ['react-native-google-mobile-ads', {delayAppMeasurementInit: true}],
            ['./plugins/withGradleJvmArgs', {properties: {RNGMA_ANDROID_BACKEND: 'classic'}}],
            './plugins/withGoogleSigninSpm',
        ]}},
    };
}

test('a coherent graph preserves optional analytics off and necessary crash generation on', async () => {
    const {validateFirebaseCompatibility} = await load();
    const input = fixture();
    const previous = structuredClone(input);
    assert.equal(validateFirebaseCompatibility(input), true);
    assert.deepEqual(input, previous);
});

const failures = [
    ['missing declared module', f => { delete f.manifest.dependencies[appName]; }, /dependencies.*app/],
    ['partial declared upgrade', f => { f.manifest.dependencies['@react-native-firebase/auth'] = '26.4.0'; }, /dependencies.*auth/],
    ['missing installed module', f => { delete f.installed['@react-native-firebase/analytics']; }, /analytics.*missing/],
    ['partial installed upgrade', f => { f.installed['@react-native-firebase/crashlytics'].version = '26.4.0'; }, /crashlytics version/],
    ['wrong JavaScript declaration', f => { f.manifest.dependencies.firebase = '12.0.0'; }, /dependencies.firebase/],
    ['wrong installed JavaScript', f => { f.installed.firebase.version = '12.0.0'; }, /firebase version/],
    ['wrong embedded JavaScript requirement', f => { f.installed[appName].dependencies.firebase = '12.0.0'; }, /JavaScript SDK dependency/],
    ['wrong package identity', f => { f.installed[appName].name = 'other'; }, /app name/],
    ['wrong app peer', f => { f.installed['@react-native-firebase/auth'].peerDependencies[appName] = '26.4.0'; }, /auth app peer/],
    ['wrong analytics peer', f => { delete f.installed['@react-native-firebase/remote-config'].peerDependencies['@react-native-firebase/analytics']; }, /analytics peer/],
    ['wrong Android SDK', f => { f.installed[appName].sdkVersions.android.firebase = '34.0.0'; }, /Android BoM/],
    ['wrong Apple SDK', f => { f.installed[appName].sdkVersions.ios.firebase = '12.0.0'; }, /Apple SDK/],
    ['distribution drift', f => { delete f.installed[appName].sdkVersions.ios.firebaseSpmUrl; }, /distribution URL/],
    ['wrong SDK min floor', f => { f.installed[appName].sdkVersions.android.minSdk = 23; }, /Android minSdk/],
    ['unreviewed wrapper', f => { f.manifest.dependencies[googleName] = '17.0.0'; }, /dependencies.*google-signin/],
    ['unpatched native Google version', f => { f.installed[googleName].GoogleSignInPodVersion = '~> 9.0'; }, /Google Sign-In Apple SDK/],
    ['missing native Google metadata', f => { delete f.installed[googleName].GoogleSignInPodVersion; }, /Google Sign-In Apple SDK/],
    ['Kotlin source config drift', f => { f.appConfig.expo.plugins[1][1].android.kotlinVersion = '2.3.20'; }, /kotlinVersion/],
    ['implicit min SDK', f => { delete f.appConfig.expo.plugins[1][1].android.minSdkVersion; }, /minSdkVersion/],
    ['static frameworks', f => { f.appConfig.expo.plugins[1][1].ios.useFrameworks = 'static'; }, /useFrameworks/],
    ['disabled SPM', f => { f.appConfig.expo.plugins[0] = [appName, {ios: {disableSPM: true}}]; }, /remove disableSPM/],
    ['false disableSPM still present', f => { f.appConfig.expo.plugins[0] = [appName, {ios: {disableSPM: false}}]; }, /remove disableSPM/],
    ['top-level disableSPM', f => { f.appConfig.expo.plugins[0] = [appName, {disableSPM: false}]; }, /remove disableSPM/],
    ['duplicate Firebase plugin', f => { f.appConfig.expo.plugins.push(appName); }, /app count/],
    ['missing Google app link plugin', f => { f.appConfig.expo.plugins.pop(); }, /withGoogleSigninSpm count/],
    ['duplicate Google app link plugin', f => { f.appConfig.expo.plugins.push('./plugins/withGoogleSigninSpm'); }, /withGoogleSigninSpm count/],
    ['missing plugins', f => { delete f.appConfig.expo.plugins; }, /plugin array/],
    ['immediate ad measurement', f => { f.appConfig.expo.plugins[2][1].delayAppMeasurementInit = false; }, /delayAppMeasurementInit/],
    ['native ad backend drift', f => { f.appConfig.expo.plugins[3][1].properties.RNGMA_ANDROID_BACKEND = 'next'; }, /RNGMA_ANDROID_BACKEND/],
    ['unknown Firebase module', f => { f.manifest.dependencies['@react-native-firebase/firestore'] = policy.reactNativeFirebase; }, /outside the reviewed/],
    ['resolution mismatch', f => { f.manifest.resolutions = {[appName]: '26.4.0'}; }, /resolutions/],
    ['crash workspace direct SDK', f => { f.crashreportingManifest.dependencies.firebase = '13.0.0'; }, /must remain injected/],
    ['crash workspace alias', f => { f.crashreportingManifest.devDependencies = {sdk: 'npm:@react-native-firebase/crashlytics@27.0.0'}; }, /must remain injected/],
    ['missing crash manifest', f => { delete f.crashreportingManifest; }, /missing manifest/],
    ['invalid crash manifest', f => { f.crashreportingManifest = []; }, /invalid object/],
    ['disabled crash collection', f => { f.firebaseConfig['react-native'].crashlytics_auto_collection_enabled = false; }, /default Crashlytics collection/],
    ['globally disabled crash collection', f => { f.firebaseConfig['react-native'].app_data_collection_default_enabled = false; }, /default Crashlytics collection/],
    ['invalid crash collection flag', f => { f.firebaseConfig['react-native'].crashlytics_auto_collection_enabled = null; }, /default Crashlytics collection/],
    ['policy schema drift', f => { f.policy.schemaVersion = 2; }, /schemaVersion/],
    ['policy version range', f => { f.policy.reactNativeFirebase = '^27.0.0'; }, /exact release/],
    ['policy missing mandatory default', f => { delete f.policy.firebaseDefaults.analytics_auto_collection_enabled; }, /policy firebaseDefaults/],
    ['policy weakens default', f => { f.policy.firebaseDefaults.analytics_auto_collection_enabled = true; }, /policy firebaseDefaults/],
];

for (const [name, mutate, message] of failures) {
    test(`rejects ${name}`, async () => {
        const {validateFirebaseCompatibility} = await load();
        const input = fixture();
        mutate(input);
        assert.throws(() => validateFirebaseCompatibility(input), message);
    });
}

for (const target of ['policy', 'config']) {
    for (const [name, value] of [
        ['missing', undefined], ['empty', []], ['null', null], ['string', 'RNGoogleMobileAds'],
        ['object', {0: 'RNGoogleMobileAds', length: 1}], ['nested', [['RNGoogleMobileAds']]],
        ['sparse', Array(1)],
        ['duplicate', ['RNGoogleMobileAds', 'RNGoogleMobileAds']],
        ['Firebase static', ['RNGoogleMobileAds', 'RNFBApp']],
        ['Google wrapper static', ['RNGoogleMobileAds', 'RNGoogleSignin']],
        ['Google SDK static', ['RNGoogleMobileAds', 'GoogleSignIn']],
        ['unknown static exception', ['OtherPod']],
    ]) {
        test(`rejects ${target} ${name} static Apple pod list`, async () => {
            const {validateFirebaseCompatibility} = await load();
            const input = fixture();
            if (target === 'policy') input.policy.staticApplePods = value;
            else input.appConfig.expo.plugins[1][1].ios.forceStaticLinking = value;
            assert.throws(() => validateFirebaseCompatibility(input), target === 'policy' ? /policy staticApplePods/ : /iOS forceStaticLinking/);
        });
    }
}

for (const [key, value] of Object.entries(policy.firebaseDefaults)) {
    for (const missing of [true, false]) {
        test(`rejects ${missing ? 'missing' : 'inverted'} ${key}`, async () => {
            const {validateFirebaseCompatibility} = await load();
            const input = fixture();
            if (missing) delete input.firebaseConfig['react-native'][key];
            else input.firebaseConfig['react-native'][key] = !value;
            assert.throws(() => validateFirebaseCompatibility(input), new RegExp(`firebase.json react-native.${key}`));
        });
    }
}

test('filesystem validation fails closed on missing installs and malformed metadata without rewriting input', async t => {
    const {checkFirebaseCompatibility} = await load();
    const directory = await mkdtemp(path.join(tmpdir(), 'yify-firebase-compat-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const input = fixture();
    const files = {
        'scripts/firebase-compatibility.json': input.policy, 'package.json': input.manifest,
        'app.json': input.appConfig, 'firebase.json': input.firebaseConfig,
        'crashreporting/package.json': input.crashreportingManifest,
        ...Object.fromEntries(Object.entries(input.installed).map(([name, pkg]) => [`node_modules/${name}/package.json`, pkg])),
    };
    for (const [filename, value] of Object.entries(files)) {
        const target = path.join(directory, filename);
        await mkdir(path.dirname(target), {recursive: true});
        await writeFile(target, JSON.stringify(value));
    }
    assert.equal(await checkFirebaseCompatibility(directory), true);
    for (const [filename, value] of Object.entries(files)) assert.equal(await readFile(path.join(directory, filename), 'utf8'), JSON.stringify(value));
    const firebasePath = path.join(directory, 'node_modules/firebase/package.json');
    await rm(firebasePath);
    await assert.rejects(() => checkFirebaseCompatibility(directory), /node_modules\/firebase\/package.json: ENOENT/);
    await writeFile(firebasePath, '{');
    await assert.rejects(() => checkFirebaseCompatibility(directory), /node_modules\/firebase\/package.json: SyntaxError/);
});
