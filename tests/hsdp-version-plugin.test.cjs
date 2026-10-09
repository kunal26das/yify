const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const withHsdpVersion = require('../plugins/withHsdpVersion');

const projectRoot = path.resolve(__dirname, '..');
const fixture = `plugins {
    id 'com.android.application'
}

dependencies {
    implementation('com.facebook.react:react-android')
}
`;

async function apply(contents, language = 'groovy') {
    const config = withHsdpVersion({name: 'Yify', slug: 'yify'});
    const result = await config.mods.android.appBuildGradle({
        ...config,
        modRequest: {
            platform: 'android',
            modName: 'appBuildGradle',
            projectRoot,
            platformProjectRoot: path.join(projectRoot, 'android'),
        },
        modResults: {language, contents},
    });
    return result.modResults.contents;
}

test('pins the HSDP transitive dependency strictly to the shim crash fix', async () => {
    const result = await apply(fixture);
    assert.match(result, /implementation\('com\.google\.android\.play:hsdp'\) \{\s+version \{ strictly '2\.2\.0' \}\s+\}/);
    assert.match(result, /implementation\('com\.facebook\.react:react-android'\)/);
    assert.equal(await apply(result), result);
});

test('tracked Android Gradle source matches the registered Expo plugin', async () => {
    const app = require('../app.json');
    const contents = fs.readFileSync(path.join(projectRoot, 'android/app/build.gradle'), 'utf8');
    assert.ok(app.expo.plugins.includes('./plugins/withHsdpVersion'));
    assert.equal((contents.match(/com\.google\.android\.play:hsdp/g) ?? []).length, 1);
    assert.equal(await apply(contents), contents);
});

test('fails closed if the generated Gradle shape or an HSDP declaration changes', async () => {
    await assert.rejects(apply(fixture.replace('dependencies {', 'otherDependencies {')), /exactly one dependencies block/);
    await assert.rejects(apply(`${fixture}\ndependencies {\n}\n`), /exactly one dependencies block/);
    await assert.rejects(apply(fixture.replace("implementation('com.facebook.react:react-android')", "implementation('com.google.android.play:hsdp:2.0.1')")), /existing HSDP dependency/);
    const pinned = await apply(fixture);
    const pinBlock = pinned.slice(pinned.indexOf('    constraints {'), pinned.indexOf("    implementation('com.facebook.react:react-android')"));
    await assert.rejects(apply(pinned.replace(pinBlock, `${pinBlock}${pinBlock}`)), /existing HSDP dependency/);
    await assert.rejects(apply(`${pinned}\nimplementation('com.google.android.play:hsdp:2.0.1')\n`), /existing HSDP dependency/);
    await assert.rejects(apply(pinned.replace('dependencies {\n', 'dependencies {\n    implementation("com.google.android.play:hsdp:2.0.1")\n')), /existing HSDP dependency/);
    await assert.rejects(apply(pinned.replace('dependencies {\n', 'dependencies {\n    implementation("com.google.android.play:hsdp:2.2.0")\n')), /existing HSDP dependency/);
    await assert.rejects(apply(fixture, 'kt'), /requires a Groovy app build.gradle/);
});
