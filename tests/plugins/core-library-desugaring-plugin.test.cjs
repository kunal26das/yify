const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');
const withCoreLibraryDesugaring = require('../../plugins/withCoreLibraryDesugaring');

const projectRoot = path.resolve(__dirname, '../..');
const fixture = `plugins {
    id 'com.android.application'
}

android {
    namespace 'io.github.kunal26das.yify'
}

dependencies {
    implementation('com.facebook.react:react-android')
}
`;

async function apply(contents, language = 'groovy') {
    const config = withCoreLibraryDesugaring({name: 'Yify', slug: 'yify'});
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

test('enables core library desugaring with the exact NIO library so java.nio.file resolves on API 24 and 25', async () => {
    const result = await apply(fixture);
    assert.match(result, /android \{\n {4}compileOptions \{\n {8}coreLibraryDesugaringEnabled true\n {4}\}\n\n {4}namespace/);
    assert.match(result, /dependencies \{\n {4}coreLibraryDesugaring\('com\.android\.tools:desugar_jdk_libs_nio:2\.1\.5'\)\n\n {4}implementation/);
    const reordered = result.replace('dependencies {\n', "dependencies {\n    constraints {\n        implementation('com.google.android.play:hsdp') {\n            version { strictly '2.2.0' }\n        }\n    }\n");
    assert.equal(await apply(reordered), reordered);
    assert.equal(await apply(result), result);
});

test('tracked Android Gradle source matches the registered Expo plugin', async () => {
    const app = require('../../app.json');
    const contents = fs.readFileSync(path.join(projectRoot, 'android/app/build.gradle'), 'utf8');
    const gradle = fs.readFileSync(path.join(projectRoot, 'android/gradle.properties'), 'utf8');
    assert.ok(app.expo.plugins.includes('./plugins/withCoreLibraryDesugaring'));
    assert.equal(Number(gradle.match(/^android\.minSdkVersion=(\d+)$/m)?.[1]), 24);
    assert.equal((contents.match(/coreLibraryDesugaringEnabled true/g) ?? []).length, 1);
    assert.equal((contents.match(/desugar_jdk_libs_nio:2\.1\.5/g) ?? []).length, 1);
    assert.equal(await apply(contents), contents);
});

test('fails closed if the generated Gradle shape or a desugaring declaration changes', async () => {
    await assert.rejects(apply(fixture, 'kt'), /requires a Groovy app build.gradle/);
    await assert.rejects(apply(fixture.replace('android {', 'androidx {')), /exactly one android block/);
    await assert.rejects(apply(`${fixture}\nandroid {\n}\n`), /exactly one android block/);
    await assert.rejects(apply(fixture.replace('dependencies {', 'otherDependencies {')), /exactly one dependencies block/);
    await assert.rejects(apply(fixture.replace("    namespace", "    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n    }\n    namespace")), /existing Android compile options/);
    await assert.rejects(apply(fixture.replace("    implementation(", "    coreLibraryDesugaring('com.android.tools:desugar_jdk_libs:2.1.5')\n    implementation(")), /existing core library desugaring/);
    const enabled = await apply(fixture);
    await assert.rejects(apply(enabled.replace('desugar_jdk_libs_nio:2.1.5', 'desugar_jdk_libs_nio:2.1.4')), /existing core library desugaring/);
    await assert.rejects(apply(enabled.replace('coreLibraryDesugaringEnabled true', 'coreLibraryDesugaringEnabled false')), /existing core library desugaring/);
    await assert.rejects(apply(`${enabled}\ndependencies {\n}\n`), /exactly one dependencies block/);
});
