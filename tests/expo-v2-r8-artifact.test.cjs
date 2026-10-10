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
    const fields = [];
    const fieldCount = number(80);
    const fieldOffset = number(84);
    for (let index = 0; index < fieldCount; index++) {
        fields.push({type: types[number(fieldOffset + index * 8 + 2, 2)], name: strings[number(fieldOffset + index * 8 + 4)]});
    }
    const protos = [];
    const protoCount = number(72);
    const protoOffset = number(76);
    for (let index = 0; index < protoCount; index++) {
        const entry = protoOffset + index * 12;
        const parametersOffset = number(entry + 8);
        const parameters = [];
        if (parametersOffset) {
            const count = number(parametersOffset);
            for (let parameter = 0; parameter < count; parameter++) {
                parameters.push(types[number(parametersOffset + 4 + parameter * 2, 2)]);
            }
        }
        protos.push(`(${parameters.join('')})${types[number(entry + 4)]}`);
    }
    const methods = [];
    const methodCount = number(88);
    const methodOffset = number(92);
    for (let index = 0; index < methodCount; index++) {
        methods.push({name: strings[number(methodOffset + index * 8 + 4)], signature: protos[number(methodOffset + index * 8 + 2, 2)]});
    }
    const classes = new Map();
    const classCount = number(96);
    const classOffset = number(100);
    for (let index = 0; index < classCount; index++) {
        const entry = classOffset + index * 32;
        const descriptor = types[number(entry)];
        const dataOffset = number(entry + 24);
        const definition = {fields: new Map(), methods: new Map()};
        if (dataOffset) {
            const state = {offset: dataOffset};
            const staticFields = leb(state);
            const instanceFields = leb(state);
            const directMethods = leb(state);
            const virtualMethods = leb(state);
            for (const count of [staticFields, instanceFields]) {
                let fieldIndex = 0;
                for (let field = 0; field < count; field++) {
                    fieldIndex += leb(state);
                    leb(state);
                    const entry = fields[fieldIndex];
                    definition.fields.set(entry.name, entry.type);
                }
            }
            for (const count of [directMethods, virtualMethods]) {
                let methodIndex = 0;
                for (let method = 0; method < count; method++) {
                    methodIndex += leb(state);
                    leb(state);
                    leb(state);
                    const entry = methods[methodIndex];
                    if (!definition.methods.has(entry.name)) definition.methods.set(entry.name, new Set());
                    definition.methods.get(entry.name).add(entry.signature);
                }
            }
        }
        classes.set(descriptor, definition);
    }
    return classes;
}

function assertJniContract(classes) {
    const descriptors = [
        'io/github/expo/kolibri/NativeObject',
        'io/github/expo/kolibri/binary/BinaryBuffer',
        'io/github/expo/modules/v2/ExpoObject',
        'io/github/expo/modules/v2/SharedObject',
        'io/github/expo/modules/v2/args/Trampoline',
        'io/github/expo/modules/v2/async/AsyncContext',
        'io/github/expo/modules/v2/async/Promise',
        'io/github/expo/modules/v2/errors/ThrowableHelper',
        'io/github/expo/modules/v2/events/EventNatives',
        'io/github/expo/modules/v2/events/EventSupport',
        'io/github/expo/modules/v2/jsi/AttachedRuntime',
        'io/github/expo/modules/v2/jsi/JavaScriptObject',
        'io/github/expo/modules/v2/jsi/JavaScriptRuntime',
        'io/github/expo/modules/v2/jsi/JavaScriptValue',
        'io/github/expo/modules/v2/modules/ModuleRegistry',
        'io/github/expo/modules/v2/react/ReactRuntime',
        'io/github/expo/modules/v2/records/RecordRegistry',
        'io/github/expo/modules/v2/records/RecordSchemaData',
        'io/github/expo/modules/v2/sharedobjects/SharedObjectRegistry',
        'io/github/expo/modules/v2/types/DynamicTypes',
    ];
    const fields = new Map([
        ['io/github/expo/kolibri/NativeObject', {nativePointer: 'J'}],
        ['io/github/expo/modules/v2/ExpoObject', {objectId: 'J'}],
        ['io/github/expo/modules/v2/records/RecordSchemaData', {
            name: 'Ljava/lang/String;',
            jniDescriptor: 'Ljava/lang/String;',
            bufferSafe: 'Z',
            fieldNames: '[Ljava/lang/String;',
            fieldTypes: '[I',
            fieldOptional: '[Z',
        }],
    ]);
    for (const [name, members] of fields) {
        const definition = classes.get(`L${name};`);
        assert.ok(definition, `Missing JNI class L${name};`);
        const declared = definition.fields;
        for (const [member, type] of Object.entries(members)) {
            assert.equal(declared.get(member), type, `Missing JNI field ${name}.${member}:${type}`);
        }
    }
    for (const name of descriptors) assert.ok(classes.has(`L${name};`), `Missing JNI class L${name};`);

    const methods = new Map([
        ['io/github/expo/kolibri/NativeObject', {nativeDestroy: '(J)V'}],
        ['io/github/expo/kolibri/binary/BinaryBuffer', {nativeGetBuffer: '()Ljava/nio/ByteBuffer;'}],
        ['io/github/expo/modules/v2/modules/ModuleRegistry', {
            encodeModule: '(Ljava/lang/String;)Ljava/lang/Object;',
            encodeModuleNames: '()I',
        }],
        ['io/github/expo/modules/v2/async/AsyncContext', {
            createPromise: '(J)Lio/github/expo/modules/v2/async/Promise;',
            invalidate: '()V',
            drainInlineSettles: '()V',
            nativeResolveBuffered: '(JJI)V',
            nativeResolve: '(JJLjava/lang/Object;)V',
            nativeReject: '(JJLjava/lang/String;Ljava/lang/String;Ljava/lang/String;)V',
        }],
        ['io/github/expo/modules/v2/args/Trampoline', {
            takeOverflowResult: '()Ljava/lang/Object;',
            prepareOverflowArguments: '()[Ljava/lang/Object;',
        }],
        ['io/github/expo/modules/v2/react/ReactRuntime', {
            nativeCreate: '(JLio/github/expo/modules/v2/modules/ModuleRegistry;Lio/github/expo/modules/v2/async/AsyncContext;Ljava/lang/String;)J',
        }],
    ]);
    for (const [name, members] of methods) {
        const declared = classes.get(`L${name};`).methods;
        for (const [member, signature] of Object.entries(members)) {
            assert.ok(declared.get(member)?.has(signature), `Missing JNI method ${name}.${member}${signature}`);
        }
    }
}

test('minified Android artifact retains reflected Expo and Kolibri JNI contract', {
    skip: !aab && !apk && !dexDirectory,
}, () => {
    assert.ok(['present', 'absent', 'missing-jni'].includes(expected));
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
            for (const method of methods) assert.ok(found.methods.has(method), `Missing R8 method ${descriptor}.${method}`);
        }
    }
    if (expected === 'present') assertJniContract(classes);
    if (expected === 'missing-jni') {
        assert.throws(() => assertJniContract(classes), /Missing JNI field io\/github\/expo\/kolibri\/NativeObject\.nativePointer:J/);
    }
});
