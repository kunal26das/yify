const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test} = require('node:test');

const root = path.resolve(__dirname, '../..');
const MAPPINGS = '@revenuecat/purchases-js-hybrid-mappings';

function loadConfig() {
    const file = require.resolve('../../metro.config.js');
    delete require.cache[file];
    return require(file);
}

test('Android resolves the RevenueCat web mappings to an empty module and delegates everything else', () => {
    const config = loadConfig();
    const calls = [];
    const context = {resolveRequest: (...args) => {
        calls.push(args);
        return {type: 'sourceFile', filePath: args[1]};
    }};
    assert.deepEqual(config.resolver.resolveRequest(context, MAPPINGS, 'android'), {type: 'empty'});
    assert.equal(calls.length, 0);
    for (const [name, platform] of [[MAPPINGS, 'web'], [MAPPINGS, 'ios'], ['react-native-purchases', 'android'], ['./entry', 'android']]) {
        const result = config.resolver.resolveRequest(context, name, platform);
        assert.notEqual(result.type, 'empty', `${name} on ${platform}`);
    }
    assert.deepEqual(calls.map(([, name, platform]) => `${name}@${platform}`), [
        `${MAPPINGS}@web`, `${MAPPINGS}@ios`, 'react-native-purchases@android', './entry@android',
    ]);
});

test('the native purchases SDK only dereferences the web mappings inside its browser functions', () => {
    const browser = path.join(root, 'node_modules/react-native-purchases/dist/browser');
    for (const file of ['nativeModule.js', 'utils.js', 'simulatedstore/offeringsLoader.js', 'simulatedstore/purchaseSimulatedPackageHelper.js']) {
        const source = fs.readFileSync(path.join(browser, file), 'utf8');
        const lines = source.split('\n');
        const binding = lines.findIndex((line) => line.includes(`require("${MAPPINGS}")`));
        assert.ok(binding >= 0, file);
        const uses = lines.map((line, index) => [line, index]).filter(([line, index]) => index !== binding && line.includes('purchases_js_hybrid_mappings_1'));
        assert.ok(uses.length > 0, file);
        for (const [line] of uses) assert.match(line, /^\s{4,}/, `${file}: ${line.trim()}`);
    }
});
