const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const {sdkVersions} = require('@react-native-firebase/app/package.json');
const withGoogleServicesVersion = require('../plugins/withGoogleServicesVersion');

const repoRoot = path.resolve(__dirname, '..');
const fixture = `buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.4'
    classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.8'
    classpath('com.android.tools.build:gradle')
  }
}
`;

async function apply(contents, language = 'groovy') {
    const config = withGoogleServicesVersion({name: 'Yify', slug: 'yify'});
    const result = await config.mods.android.projectBuildGradle({
        ...config,
        modRequest: {
            platform: 'android',
            modName: 'projectBuildGradle',
            projectRoot: repoRoot,
            platformProjectRoot: path.join(repoRoot, 'android'),
        },
        modResults: {language, contents},
    });
    return result.modResults.contents;
}

test('Google Services follows the installed Firebase recommendation without changing other build plugins', async () => {
    const result = await apply(fixture);
    assert.equal(result, fixture.replace('google-services:4.4.4', `google-services:${sdkVersions.android.gmsGoogleServicesGradle}`));
    assert.equal(await apply(result), result);
});

test('parenthesized quoted classpaths remain valid and stable across regeneration', async () => {
    const input = fixture.replace("classpath 'com.google.gms:google-services:4.4.4'", 'classpath("com.google.gms:google-services:4.4.4")');
    const result = await apply(input);
    assert.ok(result.includes(`classpath("com.google.gms:google-services:${sdkVersions.android.gmsGoogleServicesGradle}")`));
    assert.equal(await apply(result), result);
});

test('missing or duplicated Google Services anchors fail explicitly', async () => {
    await assert.rejects(apply(fixture.replace(/^.*google-services.*\n/m, '')), /requires exactly one Google Services classpath/);
    await assert.rejects(apply(`${fixture}\nclasspath 'com.google.gms:google-services:4.4.4'\n`), /requires exactly one Google Services classpath/);
});

test('unsupported Gradle languages fail before modifying the project', async () => {
    await assert.rejects(apply(fixture, 'kt'), /requires a Groovy project build.gradle/);
});
