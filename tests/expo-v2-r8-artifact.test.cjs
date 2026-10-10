const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {readFileSync, readdirSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');

const aab = process.env.EXPO_V2_R8_AAB;
const apk = process.env.EXPO_V2_R8_APK;
const dexDirectory = process.env.EXPO_V2_R8_DEX_DIR;
const expected = process.env.EXPO_V2_R8_EXPECT ?? 'present';

function command(args) {
    const result = spawnSync('unzip', args, {encoding: args[0] === '-Z1' ? 'utf8' : null, maxBuffer: 64 * 1024 * 1024});
    assert.equal(result.status, 0, String(result.stderr));
    return result.stdout;
}

function dexFiles() {
    if (aab || apk) {
        const artifact = aab ?? apk;
        const pattern = aab ? /^base\/dex\/classes[0-9]*\.dex$/ : /^classes[0-9]*\.dex$/;
        const names = command(['-Z1', artifact]).trim().split('\n').filter(name => pattern.test(name));
        assert.ok(names.length > 0, 'Android artifact has no DEX files');
        return names.map(name => command(['-p', artifact, name]));
    }
    const names = readdirSync(dexDirectory).filter(name => /^classes[0-9]*\.dex$/.test(name));
    assert.ok(names.length > 0, 'R8 output has no DEX files');
    return names.map(name => readFileSync(join(dexDirectory, name)));
}

function definitions(bytes) {
    assert.equal(bytes.toString('ascii', 0, 4), 'dex\n');
    const number = (offset, size = 4) => {
        assert.ok(offset >= 0 && offset + size <= bytes.length, 'Invalid DEX offset');
        return size === 1 ? bytes.readUInt8(offset) : size === 2 ? bytes.readUInt16LE(offset) : bytes.readUInt32LE(offset);
    };
    const leb = state => {
        let result = 0;
        for (let shift = 0; shift <= 28; shift += 7) {
            const value = number(state.offset++, 1);
            result |= (value & 127) << shift;
            if (!(value & 128)) return result >>> 0;
        }
        throw new Error('Invalid DEX integer');
    };
    const strings = [];
    const stringCount = number(56);
    const stringOffset = number(60);
    for (let index = 0; index < stringCount; index++) {
        const state = {offset: number(stringOffset + index * 4)};
        leb(state);
        const end = bytes.indexOf(0, state.offset);
        assert.ok(end >= state.offset, 'Unterminated DEX string');
        strings.push(bytes.toString('utf8', state.offset, end));
    }
    const types = [];
    const typeCount = number(64);
    const typeOffset = number(68);
    for (let index = 0; index < typeCount; index++) types.push(strings[number(typeOffset + index * 4)]);
    const methods = [];
    const methodCount = number(88);
    const methodOffset = number(92);
    for (let index = 0; index < methodCount; index++) methods.push(strings[number(methodOffset + index * 8 + 4)]);
    const classes = new Map();
    const classCount = number(96);
    const classOffset = number(100);
    for (let index = 0; index < classCount; index++) {
        const entry = classOffset + index * 32;
        const descriptor = types[number(entry)];
        const dataOffset = number(entry + 24);
        const names = new Set();
        if (dataOffset) {
            const state = {offset: dataOffset};
            const staticFields = leb(state);
            const instanceFields = leb(state);
            const directMethods = leb(state);
            const virtualMethods = leb(state);
            for (let field = 0; field < staticFields + instanceFields; field++) {
                leb(state);
                leb(state);
            }
            for (const count of [directMethods, virtualMethods]) {
                let methodIndex = 0;
                for (let method = 0; method < count; method++) {
                    methodIndex += leb(state);
                    leb(state);
                    leb(state);
                    names.add(methods[methodIndex]);
                }
            }
        }
        classes.set(descriptor, names);
    }
    return classes;
}

test('minified Android artifact retains reflected Expo v2 class definitions and constructors', {
    skip: !aab && !apk && !dexDirectory,
}, () => {
    assert.ok(expected === 'present' || expected === 'absent');
    assert.equal([aab, apk, dexDirectory].filter(Boolean).length, 1, 'Supply one artifact source');
    const classes = new Map(dexFiles().flatMap(bytes => [...definitions(bytes)]));
    const required = new Map([
        ['Lexpo/modules/ExpoModulesV2ModuleList;', ['<init>', 'getModules']],
        ['Lexpo/modules/application/ApplicationModule;', ['<init>', 'define$ExpoModulesV2']],
        ['Lexpo/modules/haptics/HapticsModule;', ['<init>', 'define$ExpoModulesV2']],
    ]);
    for (const [descriptor, methods] of required) {
        const found = classes.get(descriptor);
        if (expected === 'absent') assert.equal(found, undefined, `Unexpected old-candidate class ${descriptor}`);
        else {
            assert.ok(found, `Missing R8 class ${descriptor}`);
            for (const method of methods) assert.ok(found.has(method), `Missing R8 method ${descriptor}.${method}`);
        }
    }
});
