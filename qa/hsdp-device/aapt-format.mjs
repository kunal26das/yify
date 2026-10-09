import assert from 'node:assert/strict';
export function normalizeBadging(text) {
    const minimum = text.split('\n').filter(line => /^(?:minSdkVersion|sdkVersion):/.test(line));
    assert.equal(minimum.length, 1, 'Missing or ambiguous minimum SDK in aapt output');
    const targets = text.split('\n').filter(line => /^targetSdkVersion:/.test(line));
    assert.equal(targets.length, 1, 'Missing or ambiguous target SDK in aapt output');
    return text.replace(/^minSdkVersion:/m, 'sdkVersion:');
}
export function normalizeManifest(text) {
    return text.replace(/^(\s*A:\s+[^\n]*android:exported(?:\([^)]*\))?)=(true|false)\s*$/gm,
        (_, attribute, value) => `${attribute}=(type 0x12)${value === 'true' ? '0xffffffff' : '0x0'}`);
}
