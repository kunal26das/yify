const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const withAndroidRelease = require('../plugins/withAndroidRelease');

const projectRoot = path.resolve(__dirname, '..');
const fixture = `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()
android {
    signingConfigs {
        debug {
            keyPassword 'android'
        }
    }
    buildTypes {
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}
`;

async function apply(contents) {
    const config = withAndroidRelease({name: 'Yify', slug: 'yify'});
    const result = await config.mods.android.appBuildGradle({
        ...config,
        modRequest: {
            platform: 'android',
            modName: 'appBuildGradle',
            projectRoot,
            platformProjectRoot: path.join(projectRoot, 'android'),
        },
        modResults: {language: 'groovy', contents},
    });
    return result.modResults.contents;
}

test('Android release uses AGP 9 optimized defaults while preserving shrinking and release signing', async () => {
    const result = await apply(fixture);
    assert.match(result, /proguardFiles getDefaultProguardFile\("proguard-android-optimize\.txt"\), "proguard-rules\.pro"/);
    assert.doesNotMatch(result, /getDefaultProguardFile\("proguard-android\.txt"\)/);
    assert.match(result, /minifyEnabled true\n\s+shrinkResources true/);
    assert.match(result, /signingConfig keystorePropertiesFile\.exists\(\) \? signingConfigs\.release : signingConfigs\.debug/);
    assert.match(result, /storePassword keystoreProperties\['storePassword'\]/);
    assert.doesNotMatch(result, /-dontoptimize/);
});

test('Android release accepts single-quoted and already optimized template defaults', async () => {
    for (const defaults of ["'proguard-android.txt'", '"proguard-android-optimize.txt"']) {
        const result = await apply(fixture.replace('"proguard-android.txt"', defaults));
        assert.match(result, /getDefaultProguardFile\("proguard-android-optimize\.txt"\)/);
    }
});

test('Android release fails if the template drops the expected Proguard defaults', async () => {
    await assert.rejects(apply(fixture.replace('proguard-android.txt', 'unexpected.txt')), /optimized Proguard defaults anchor/);
});
