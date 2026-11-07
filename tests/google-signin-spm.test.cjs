const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const xcode = require('xcode');

const root = path.dirname(require.resolve('../package.json'));
const googleName = '@react-native-google-signin/google-signin';
const wrapper = require(`../node_modules/${googleName}/package.json`);
const {setIosDependencyManager} = require(`../node_modules/${googleName}/plugin/build/withGoogleSignIn.js`);
const policy = require('../scripts/firebase-compatibility.json');
const appConfig = require('../app.json');
const marker = '# @react-native-google-signin/google-signin iosDependencyManager';
const podfile = fs.readFileSync(path.join(root, 'ios', 'Podfile'), 'utf8');
const podspec = fs.readFileSync(path.join(root, 'node_modules', googleName, 'RNGoogleSignin.podspec'), 'utf8');
const resolved = JSON.parse(fs.readFileSync(path.join(root, 'ios', 'Yify.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'), 'utf8'));

function pluginName(plugin) {
    return Array.isArray(plugin) ? plugin[0] : plugin;
}

function values(section) {
    return Object.entries(section ?? {}).filter(([id]) => !id.endsWith('_comment'));
}

test('the reviewed wrapper selects its own SwiftPM integration', () => {
    assert.equal(wrapper.version, policy.googleSignInWrapper);
    assert.equal(wrapper.GoogleSignInPodVersion, policy.googleSignInAppleSdk);
    assert.equal(wrapper.swiftpmConfig?.name, 'RNGoogleSignin');
    const plugins = appConfig.expo.plugins.filter((plugin) => pluginName(plugin) === googleName);
    assert.equal(plugins.length, 1);
    assert.deepEqual(plugins[0][1], {iosDependencyManager: 'spm'});
    assert.equal(appConfig.expo.plugins.some((plugin) => pluginName(plugin) === './plugins/withGoogleSigninSpm'), false);
});

test('the Apple SDK requirement and resolution stay exact', () => {
    const requirements = podspec.match(/requirement: \{[^}]*\}/g);
    assert.deepEqual(requirements, ['requirement: { kind: "exactVersion", version: package["GoogleSignInPodVersion"] }']);
    const pins = Object.fromEntries(resolved.pins.map((pin) => [pin.identity, pin.state.version]));
    assert.equal(pins['googlesignin-ios'], policy.googleSignInAppleSdk);
    assert.equal(pins['firebase-ios-sdk'], policy.appleSdk);
});

test('the committed Podfile selects SwiftPM once, before the application target', () => {
    const lines = podfile.split('\n');
    const selections = lines.filter((line) => line.includes(marker));
    assert.deepEqual(selections, [`$RNGoogleSigninDependencyManager = 'spm' ${marker}`]);
    assert.ok(lines.indexOf(selections[0]) < lines.findIndex((line) => line.startsWith('target ')));
    assert.equal(setIosDependencyManager(podfile, 'spm'), podfile);
    assert.equal(setIosDependencyManager(podfile, 'cocoapods').includes(marker), false);
});

test('the application target leaves GoogleSignIn to the dynamic RNGoogleSignin framework', () => {
    const project = xcode.project(path.join(root, 'ios', 'Yify.xcodeproj', 'project.pbxproj')).parseSync();
    const objects = project.hash.project.objects;
    const packages = values(objects.XCRemoteSwiftPackageReference)
        .filter(([, value]) => String(value.repositoryURL).includes('GoogleSignIn-iOS'));
    const products = values(objects.XCSwiftPackageProductDependency)
        .filter(([, value]) => value.productName === 'GoogleSignIn');
    assert.equal(packages.length, 0);
    assert.equal(products.length, 0);
    assert.ok(values(objects.XCSwiftPackageProductDependency).some(([, value]) => value.productName === 'FirebaseCore'));
});
