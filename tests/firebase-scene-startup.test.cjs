const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const withFirebaseSceneStartup = require('../plugins/withFirebaseSceneStartup');

const fixture = `internal import Expo
import React

@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

async function apply(contents, language = 'swift') {
    const projectRoot = path.resolve(__dirname, '..');
    const config = withFirebaseSceneStartup({name: 'Yify', slug: 'yify'});
    const result = await config.mods.ios.appDelegate({
        ...config,
        modRequest: {platform: 'ios', modName: 'appDelegate', projectRoot,
            platformProjectRoot: path.join(projectRoot, 'ios')},
        modResults: {language, contents},
    });
    return result.modResults.contents;
}

test('Firebase initializes before React creation under the scene lifecycle and stays idempotent', async () => {
    const result = await apply(fixture);
    assert.match(result, /^import FirebaseCore\ninternal import Expo/);
    assert.match(result, /\) -> Bool \{\n    if FirebaseApp\.app\(\) == nil \{\n      FirebaseApp\.configure\(\)\n    \}/);
    assert.ok(result.indexOf('FirebaseApp.configure()') < result.indexOf('let delegate'));
    assert.match(result, /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/);
    assert.equal(await apply(result), result);
});

test('existing upstream Firebase initialization and CRLF imports are preserved', async () => {
    const existing = fixture.replace('import React', 'import FirebaseCore\nimport React')
        .replace('    let delegate', '    FirebaseApp.configure()\n    let delegate').replaceAll('\n', '\r\n');
    assert.equal(await apply(existing), existing);
    const added = await apply(fixture.replaceAll('\n', '\r\n'));
    assert.doesNotMatch(added, /(?<!\r)\n/);
    assert.equal(added.match(/FirebaseApp\.configure\(\)/g).length, 1);
});

test('unexpected or ambiguous launch methods fail instead of leaving Firebase uninitialized', async () => {
    await assert.rejects(apply(fixture.replace('didFinishLaunchingWithOptions launchOptions', 'otherOptions launchOptions')),
        /requires one didFinishLaunchingWithOptions/);
    await assert.rejects(apply(fixture + fixture), /requires one didFinishLaunchingWithOptions/);
    await assert.rejects(apply(fixture, 'objc'), /requires a Swift AppDelegate/);
});

test('the Firebase startup plugin is registered exactly once after the native Firebase app plugin', () => {
    const plugins = require('../app.json').expo.plugins.map(plugin => Array.isArray(plugin) ? plugin[0] : plugin);
    assert.equal(plugins.filter(plugin => plugin === './plugins/withFirebaseSceneStartup').length, 1);
    assert.ok(plugins.indexOf('./plugins/withFirebaseSceneStartup') > plugins.indexOf('@react-native-firebase/app'));
});
