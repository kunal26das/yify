const assert = require('node:assert/strict');
const {test} = require('node:test');
const {mkdtemp, mkdir, readFile, writeFile, rm} = require('node:fs/promises');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const plugin = require('../plugins/withUmpMetricsGuard');

async function fixture(t) {
    const root = await mkdtemp(path.join(tmpdir(), 'yify-ump-plugin-'));
    t.after(() => rm(root, {recursive: true, force: true}));
    const android = path.join(root, 'android');
    const config = plugin({name: 'Yify', slug: 'yify', _internal: {projectRoot: root}});
    const apply = (name, modResults) => config.mods.android[name]({...config, modResults, modRequest: {platform: 'android', modName: name, projectRoot: root, platformProjectRoot: android}});
    return {root, android, apply};
}

test('instruments dependency classes in every variant and recomputes only affected method frames', async t => {
    const f = await fixture(t);
    const result = (await f.apply('appBuildGradle', {language: 'groovy', contents: 'android {}\n'})).modResults;
    assert.match(result.contents, /onVariants\(selector\(\)\.all\(\)\)/);
    assert.match(result.contents, /InstrumentationScope\.ALL/);
    assert.match(result.contents, /COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS/);
    assert.match(result.contents, /component\.group == 'com.google.android.ump'/);
    assert.match(result.contents, /component\.module == 'user-messaging-platform'/);
    assert.match(result.contents, /component\.version != '4.0.0'/);
    assert.doesNotMatch(result.contents, /force|useVersion|3\.2\.0/);
    assert.equal((await f.apply('appBuildGradle', result)).modResults.contents, result.contents);
});

test('rejects changed or unsupported Gradle instrumentation instead of stacking transforms', async t => {
    const f = await fixture(t);
    await assert.rejects(f.apply('appBuildGradle', {language: 'kotlin', contents: ''}), /requires Groovy/);
    await assert.rejects(f.apply('appBuildGradle', {language: 'groovy', contents: 'other.UmpMetricsFactory'}), /differs/);
});

test('generates identical build logic on repeated prebuilds and retains unrelated files', async t => {
    const f = await fixture(t);
    await mkdir(path.join(f.android, 'buildSrc'), {recursive: true});
    const unrelated = path.join(f.android, 'buildSrc/untouched.txt');
    await writeFile(unrelated, 'keep');
    await f.apply('dangerous', {});
    const paths = ['build.gradle', ...['UmpMetricsFactory.java', 'UmpMetricsVisitor.java'].map(name => `src/main/java/io/github/kunal26das/yify/ump/${name}`)];
    const first = await Promise.all(paths.map(name => readFile(path.join(f.android, 'buildSrc', name), 'utf8')));
    await f.apply('dangerous', {});
    assert.deepEqual(await Promise.all(paths.map(name => readFile(path.join(f.android, 'buildSrc', name), 'utf8'))), first);
    assert.equal(await readFile(unrelated, 'utf8'), 'keep');
    for (let index = 0; index < paths.length; index++) assert.equal(first[index], await readFile(path.join(__dirname, '../plugins/ump', path.basename(paths[index])), 'utf8'));
});

test('refuses to overwrite an unrelated existing buildSrc configuration', async t => {
    const f = await fixture(t);
    const file = path.join(f.android, 'buildSrc/build.gradle');
    await mkdir(path.dirname(file), {recursive: true});
    await writeFile(file, 'plugins { id "custom" }');
    await assert.rejects(f.apply('dangerous', {}), /reviewed merge/);
    assert.equal(await readFile(file, 'utf8'), 'plugins { id "custom" }');
});

test('generated source paths are included by Git and the production Expo plugin is registered once', async () => {
    const plugins = require('../app.json').expo.plugins;
    assert.equal(plugins.filter(item => item === './plugins/withUmpMetricsGuard').length, 1);
    assert.equal(plugins.some(item => String(item).includes('withUmpSdk')), false);
    const files = ['android/buildSrc/build.gradle', ...['UmpMetricsFactory.java', 'UmpMetricsVisitor.java'].map(name => `android/buildSrc/src/main/java/io/github/kunal26das/yify/ump/${name}`)];
    const result = spawnSync('git', ['check-ignore', '--no-index', ...files], {cwd: path.resolve(__dirname, '..'), encoding: 'utf8'});
    assert.equal(result.status, 1, result.stdout + result.stderr);
});
