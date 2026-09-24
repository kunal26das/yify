const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const fs = require('node:fs/promises');
const {tmpdir} = require('node:os');
const {createHash} = require('node:crypto');
const {test} = require('node:test');
const {transpileTypeScript} = require('./helpers/transpile-typescript.cjs');

const root = path.resolve(__dirname, '..');

test('Babel 8 preserves TypeScript values, CommonJS mocks and automatic JSX in test modules', () => {
    const source = `
        import type {MissingType} from './type-only';
        import dependency from './dependency';
        export enum State {Idle, Ready}
        export class Example {
            constructor(public state: State = State.Ready) {}
        }
        export const value: number = dependency(new Example().state);
        export const view = <span data-value={value} />;
    `;
    const code = transpileTypeScript(source, path.join(root, 'tests/fixture.tsx'));
    const result = {exports: {}};
    const imports = [];
    const mockRequire = specifier => {
        imports.push(specifier);
        if (specifier === './dependency') return value => value + 4;
        return require(specifier);
    };
    vm.runInThisContext(`(function(exports, require, module) {${code}\n})`)(result.exports, mockRequire, result);
    assert.equal(result.exports.value, 5);
    assert.equal(result.exports.State.Ready, 1);
    assert.equal(result.exports.view.type, 'span');
    assert.equal(result.exports.view.props['data-value'], 5);
    assert.equal(imports.includes('./type-only'), false);
});

test('test transforms reject invalid TypeScript instead of silently stripping it', () => {
    assert.throws(() => transpileTypeScript('export const value: = 1;', path.join(root, 'tests/invalid.ts')));
});

test('plain TypeScript generic functions are not parsed as JSX', () => {
    const code = transpileTypeScript('export const identity = <T>(value: T): T => value;', path.join(root, 'tests/generic.ts'));
    const result = {exports: {}};
    vm.runInThisContext(`(function(exports, require, module) {${code}\n})`)(result.exports, require, result);
    assert.equal(result.exports.identity(42), 42);
});

test('dynamic imports remain deferred and use the test loader mock boundary', async () => {
    const code = transpileTypeScript('export const load = () => import("./native-sdk");', path.join(root, 'tests/dynamic.ts'));
    const result = {exports: {}};
    const calls = [];
    const mockRequire = specifier => {
        calls.push(specifier);
        return {value: 42};
    };
    vm.runInThisContext(`(function(exports, require, module) {${code}\n})`)(result.exports, mockRequire, result);
    assert.deepEqual(calls, []);
    const loaded = result.exports.load();
    assert.deepEqual(calls, []);
    assert.equal((await loaded).value, 42);
    assert.deepEqual(calls, ['./native-sdk']);
});

test('native Worklets transform stays on Babel 7 while root tools use the requested majors', async t => {
    assert.match(require('@babel/core').version, /^8\./);
    assert.match(require('typescript/package.json').version, /^7\./);
    assert.match(require('eslint/package.json').version, /^10\./);
    const plugin = require('../tooling/babel.cjs');
    const babel = require('@yify/tooling/babel');
    assert.match(babel.version, /^7\./);
    assert.equal(plugin, require.resolve('react-native-worklets/plugin'));
    const temporary = await fs.mkdtemp(path.join(tmpdir(), 'yify-worklet-'));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    const filename = path.join(temporary, 'fixture.js');
    const source = 'export const square = (value) => { "worklet"; return value * value; };';
    await fs.writeFile(filename, source);
    const transformed = babel.transformSync(source, {
        filename,
        babelrc: false,
        configFile: false,
        plugins: [plugin],
    });
    const code = transpileTypeScript(transformed.code, path.join(temporary, 'compiled.ts'));
    const result = {exports: {}};
    vm.runInThisContext(`(function(exports, require, module) {${code}\n})`)(result.exports, require, result);
    assert.equal(result.exports.square(6), 36);
    assert.equal(typeof result.exports.square.__workletHash, 'number');
    assert.equal(vm.runInThisContext(result.exports.square.__initData.code)(7), 49);
});

test('ESLint 10 still rejects architecture violations and invalid React lists', async () => {
    const {ESLint} = require('eslint');
    const eslint = new ESLint({cwd: root});
    const [architecture] = await eslint.lintText(
        "import {createDependencies} from '../../data';\nexport const value = createDependencies;\n",
        {filePath: 'domain/services/tooling-probe.ts'},
    );
    assert.ok(architecture.messages.some(message => message.ruleId === 'import/no-restricted-paths'));
    const [react] = await eslint.lintText('export const nodes = [<span />];\n', {
        filePath: 'presentation/tooling-probe.tsx',
    });
    assert.ok(react.messages.some(message => message.ruleId === 'react/jsx-key'));
    assert.equal(architecture.fatalErrorCount, 0);
    assert.equal(react.fatalErrorCount, 0);
});

test('isolated tooling dependencies retain exact version enforcement', async () => {
    const {checkPins} = await import('../scripts/check-dependency-pins.mjs');
    const manifest = require('../tooling/package.json');
    assert.doesNotThrow(() => checkPins(manifest, 'tooling/package.json'));
    assert.throws(() => checkPins({devDependencies: {typescript: '^6.0.3'}}, 'tooling/package.json'), /must use an exact version/);
});

test('tooling import patches are idempotent and reject unreviewed source or anchors', async () => {
    const {preparePatch} = await import('../scripts/apply-tooling-compatibility.mjs');
    const hash = value => createHash('sha256').update(value).digest('hex');
    const source = "const compiler = require('compiler');";
    const updated = "const compiler = require('@yify/tooling/compiler');";
    const patch = {
        package: 'test', file: 'index.js', before: hash(source), after: hash(updated),
        find: "require('compiler')", replace: "require('@yify/tooling/compiler')", count: 1,
    };
    assert.equal(preparePatch(source, patch), updated);
    assert.equal(preparePatch(updated, patch), updated);
    assert.throws(() => preparePatch(`${source}\n`, patch), /source hash changed/);
    assert.throws(() => preparePatch(source, {...patch, count: 2}), /anchor count changed/);
    assert.throws(() => preparePatch(source, {...patch, replace: 'different'}), /output hash changed/);
});

test('tooling patches verify every package version before writing any source', async t => {
    const {applyToolingCompatibility} = await import('../scripts/apply-tooling-compatibility.mjs');
    const temporary = await fs.mkdtemp(path.join(tmpdir(), 'yify-tooling-patch-'));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    const hash = value => createHash('sha256').update(value).digest('hex');
    const source = 'before';
    const updated = 'after';
    const patches = ['first', 'second'].map(name => ({
        package: `node_modules/${name}`, version: '1.0.0', file: 'index.js',
        before: hash(source), after: hash(updated), find: source, replace: updated, count: 1,
    }));
    await fs.mkdir(path.join(temporary, 'tooling'), {recursive: true});
    await fs.writeFile(path.join(temporary, 'tooling/compatibility-patches.json'), JSON.stringify(patches));
    for (const patch of patches) {
        const directory = path.join(temporary, patch.package);
        await fs.mkdir(directory, {recursive: true});
        await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({
            name: patch.package, version: patch.package.endsWith('second') ? '2.0.0' : '1.0.0',
        }));
        await fs.writeFile(path.join(directory, 'index.js'), source);
    }
    await assert.rejects(applyToolingCompatibility(temporary), /expected 1.0.0, installed 2.0.0/);
    assert.equal(await fs.readFile(path.join(temporary, patches[0].package, 'index.js'), 'utf8'), source);
    await fs.writeFile(path.join(temporary, patches[1].package, 'package.json'), JSON.stringify({name: 'second', version: '1.0.0'}));
    assert.equal(await applyToolingCompatibility(temporary), 2);
    assert.equal(await applyToolingCompatibility(temporary), 0);
});
