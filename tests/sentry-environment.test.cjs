const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const {sentryEnvironment} = loadTypeScript('instrumentation/sentry-environment.ts');

test('release-mode local and temporary web previews remain observable outside production', () => {
    for (const hostname of ['localhost', 'yify.localhost', '127.0.0.1', '[::1]', '::1', '10.0.0.5', '192.168.1.10', '172.16.0.1', '172.31.255.1', 'yify--preview123.expo.app']) {
        assert.equal(sentryEnvironment({native: false, configured: 'production', hostname}), 'preview', hostname);
    }
    for (const hostname of ['yify.expo.app', 'kunal26das.github.io', '172.32.0.1']) {
        assert.equal(sentryEnvironment({native: false, hostname}), 'production', hostname);
        assert.equal(sentryEnvironment({native: false, configured: 'preview', hostname}), 'preview', hostname);
    }
});

test('native environment follows its actual channel regardless of web export settings', () => {
    for (const channel of ['Staging', 'staging', 'STAGING']) {
        assert.equal(sentryEnvironment({native: true, channel, configured: 'production'}), 'preview');
    }
    for (const channel of ['Production', 'production', null]) {
        assert.equal(sentryEnvironment({native: true, channel, configured: 'preview'}), 'production');
    }
});
