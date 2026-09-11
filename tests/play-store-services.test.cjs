const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function setup({platform = 'android', checkForUpdate, startUpdate = async () => true}) {
    const updates = [];
    const logs = [];
    let reviewSdkLoads = 0;
    const mocks = {
        'react-native': {Platform: {OS: platform}},
        'expo-in-app-updates': {
            checkForUpdate,
            startUpdate: async (immediate) => {
                updates.push(immediate);
                return startUpdate(immediate);
            },
        },
        '@react-native-firebase/crashlytics': {
            getCrashlytics: () => ({}),
            log: (_, message) => logs.push(message),
        },
        get 'expo-store-review'() {
            reviewSdkLoads += 1;
            return {hasAction: async () => true, requestReview: async () => {}};
        },
    };
    const {PlayStoreServices} = loadTypeScript('data/services/PlayStoreServices.ts', mocks);
    return {service: new PlayStoreServices(), updates, logs, reviewSdkLoads: () => reviewSdkLoads};
}

test('a delayed startup update check never loads or invokes the native review flow', async () => {
    let finishCheck;
    const pendingCheck = new Promise(resolve => {finishCheck = resolve;});
    const {service, updates, logs, reviewSdkLoads} = setup({checkForUpdate: () => pendingCheck});
    const started = service.start();
    finishCheck({updateAvailable: false, updateInProgress: false});
    await started;
    assert.deepEqual(updates, []);
    assert.deepEqual(logs, ['in_app_update none']);
    assert.equal(reviewSdkLoads(), 0);
});

test('available Play updates retain their supported immediate or flexible flow', async () => {
    for (const [immediateAllowed, flexibleAllowed, expected] of [[true, true, true], [false, true, false], [false, false, undefined]]) {
        const {service, updates, reviewSdkLoads} = setup({
            checkForUpdate: async () => ({updateAvailable: true, immediateAllowed, flexibleAllowed, storeVersion: 82}),
        });
        await service.start();
        assert.deepEqual(updates, [expected]);
        assert.equal(reviewSdkLoads(), 0);
    }
});

test('a Play update already in progress still resumes', async () => {
    const {service, updates} = setup({
        checkForUpdate: async () => ({updateAvailable: false, updateInProgress: true, immediateAllowed: true}),
    });
    await service.start();
    assert.deepEqual(updates, [true]);
});

test('Play update failures settle without starting a review', async () => {
    for (const stage of ['check', 'start']) {
        const {service, reviewSdkLoads, logs} = setup({
            checkForUpdate: async () => {
                if (stage === 'check') throw new Error('Store unavailable');
                return {updateAvailable: true};
            },
            startUpdate: async () => {throw new Error('Store unavailable');},
        });
        await assert.doesNotReject(service.start());
        assert.equal(reviewSdkLoads(), 0);
        assert.equal(logs.at(-1), 'in_app_update failed Store unavailable');
    }
});

test('other platforms do not start Android store operations', async () => {
    for (const platform of ['ios', 'web']) {
        const {service, updates, logs, reviewSdkLoads} = setup({
            platform,
            checkForUpdate: async () => {throw new Error('Unexpected Android store request');},
        });
        await service.start();
        assert.deepEqual(updates, []);
        assert.deepEqual(logs, []);
        assert.equal(reviewSdkLoads(), 0);
    }
});
