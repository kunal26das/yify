const assert = require('node:assert/strict');
const {test} = require('node:test');
const {mkdtemp, mkdir, readFile, writeFile, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const path = require('node:path');
const withGradleWrapper = require('../plugins/withGradleWrapper');

const URL = 'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.4.1-bin.zip';
const CHECKSUM = 'distributionSha256Sum=2ab2958f2a1e51120c326cad6f385153bb11ee93b3c216c5fccebfdfbb7ec6cb';

async function fixture(t, contents) {
    const root = await mkdtemp(path.join(tmpdir(), 'yify-gradle-wrapper-'));
    t.after(() => rm(root, {recursive: true, force: true}));
    const android = path.join(root, 'android');
    const file = path.join(android, 'gradle/wrapper/gradle-wrapper.properties');
    await mkdir(path.dirname(file), {recursive: true});
    await writeFile(file, contents);
    const config = withGradleWrapper({name: 'Yify', slug: 'yify', _internal: {projectRoot: root}});
    return {
        file,
        apply: () => config.mods.android.dangerous({...config, modResults: {}, modRequest: {
            platform: 'android', modName: 'dangerous', projectRoot: root, platformProjectRoot: android,
        }}),
    };
}

test('prebuild selects the AGP9.2-compatible distribution and verifies its official checksum', async (t) => {
    const f = await fixture(t, 'distributionBase=GRADLE_USER_HOME\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-9.3.1-bin.zip\nnetworkTimeout=10000\n');
    await f.apply();
    assert.equal(await readFile(f.file, 'utf8'), `distributionBase=GRADLE_USER_HOME\n${URL}\n${CHECKSUM}\nnetworkTimeout=10000\n`);
    await f.apply();
    assert.equal(await readFile(f.file, 'utf8'), `distributionBase=GRADLE_USER_HOME\n${URL}\n${CHECKSUM}\nnetworkTimeout=10000\n`);
});

test('replaces an old checksum while preserving CRLF and unrelated wrapper settings', async (t) => {
    const f = await fixture(t, 'distributionUrl=old.zip\r\ndistributionSha256Sum=old\r\nvalidateDistributionUrl=true\r\n');
    await f.apply();
    assert.equal(await readFile(f.file, 'utf8'), `${URL}\r\n${CHECKSUM}\r\nvalidateDistributionUrl=true\r\n`);
});

for (const contents of ['networkTimeout=10000\n', 'distributionUrl=one\ndistributionUrl=two\n', 'distributionUrl=one\ndistributionSha256Sum=one\ndistributionSha256Sum=two\n']) {
    test(`rejects ambiguous wrapper properties without modifying them: ${JSON.stringify(contents)}`, async (t) => {
        const f = await fixture(t, contents);
        await assert.rejects(() => f.apply(), /requires one distributionUrl/);
        assert.equal(await readFile(f.file, 'utf8'), contents);
    });
}

test('the production Expo configuration registers the wrapper fix exactly once', () => {
    const plugins = require('../app.json').expo.plugins;
    assert.equal(plugins.filter((plugin) => plugin === './plugins/withGradleWrapper').length, 1);
});

test('prebuild preserves the explicit Kotlin plugin and legacy DSL until the Expo migration is complete', async () => {
    const root = path.resolve(__dirname, '..');
    const config = withGradleWrapper({name: 'Yify', slug: 'yify', _internal: {projectRoot: root}});
    const apply = (modResults) => config.mods.android.gradleProperties({...config, modResults, modRequest: {
        platform: 'android', modName: 'gradleProperties', projectRoot: root, platformProjectRoot: path.join(root, 'android'),
    }});
    const original = [{type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx6144m'},
        {type: 'property', key: 'android.newDsl', value: 'true'},
        {type: 'property', key: 'android.builtInKotlin', value: 'true'},
        {type: 'property', key: 'android.newDsl', value: 'true'}];
    const result = (await apply(original)).modResults;
    assert.deepEqual(result, [{type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx6144m'},
        {type: 'property', key: 'android.newDsl', value: 'false'},
        {type: 'property', key: 'android.builtInKotlin', value: 'false'}]);
    assert.deepEqual((await apply(result)).modResults, result);
});
