const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
const {DEFAULT_PRIVACY_CHOICES, PRIVACY_NOTICE_VERSION} = loadTypeScript('domain/entities/PrivacyChoices.ts');
const receipt = {adultConfirmed: true, analytics: true, noticeVersion: PRIVACY_NOTICE_VERSION,
    updatedAt: '2026-09-25T00:00:00.000Z'};
const fixture = raw => {
    const values = new Map(raw === undefined ? [] : [['choices', raw]]);
    const store = {getString: key => values.get(key), set: (key, value) => values.set(key, value), delete: key => values.delete(key)};
    return {values, store};
};

test('privacy choices fail closed for missing, malformed, old and incomplete receipts', () => {
    for (const raw of [undefined, 'nope', '[]', 'null', '{}', JSON.stringify({...receipt, noticeVersion: 'old'}),
        JSON.stringify({...receipt, analytics: 'true'}), JSON.stringify({...receipt, adultConfirmed: false}),
        JSON.stringify({...receipt, updatedAt: 'yesterday'}), JSON.stringify({...receipt, updatedAt: null})]) {
        const privacy = new PrivacyPreferencesImpl(fixture(raw).store);
        assert.deepEqual(privacy.getChoices(), DEFAULT_PRIVACY_CHOICES);
        assert.equal(privacy.getChoices(), privacy.getChoices());
        assert.equal(Object.isFrozen(privacy.getChoices()), true);
    }
    const privacy = new PrivacyPreferencesImpl({getString() { throw Error('private mode'); }});
    assert.deepEqual(privacy.getChoices(), DEFAULT_PRIVACY_CHOICES);
});

test('privacy choices persist a dated notice receipt and reload without syncing accounts', () => {
    const {store, values} = fixture();
    const privacy = new PrivacyPreferencesImpl(store);
    let notified = 0;
    const unsubscribe = privacy.subscribe(() => notified++);
    privacy.updateChoices({adultConfirmed: true, analytics: true});
    const saved = privacy.getChoices();
    assert.equal(saved.analytics, true);
    assert.equal(saved.adultConfirmed, true);
    assert.equal(saved.noticeVersion, PRIVACY_NOTICE_VERSION);
    assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
    assert.deepEqual(new PrivacyPreferencesImpl(store).getChoices(), saved);
    assert.deepEqual([...values.keys()], ['choices']);
    privacy.updateChoices({adultConfirmed: false, analytics: true});
    assert.equal(privacy.getChoices().analytics, false);
    assert.equal(notified, 2);
    unsubscribe();
    privacy.updateChoices({adultConfirmed: true, analytics: false});
    assert.equal(notified, 2);
});

test('a rejected or silently lost write revokes active in-memory consent and reports failure', () => {
    for (const set of [() => { throw Error('quota'); }, () => {}]) {
        const {store, values} = fixture(JSON.stringify(receipt));
        store.set = set;
        const privacy = new PrivacyPreferencesImpl(store);
        let notified = 0;
        privacy.subscribe(() => notified++);
        assert.throws(() => privacy.updateChoices({adultConfirmed: true, analytics: false}), /could not be saved/);
        assert.deepEqual(privacy.getChoices(), DEFAULT_PRIVACY_CHOICES);
        assert.equal(values.has('choices'), false);
        assert.equal(notified, 1);
    }
});

test('other-tab changes, deletion and storage failure immediately revoke consent', () => {
    const {store, values} = fixture(JSON.stringify(receipt));
    let changed;
    const privacy = new PrivacyPreferencesImpl(store, listener => { changed = listener; });
    let notified = 0;
    privacy.subscribe(() => notified++);
    changed();
    assert.equal(notified, 0);
    values.delete('choices');
    changed();
    assert.equal(privacy.getChoices().analytics, false);
    assert.equal(notified, 1);
    values.set('choices', JSON.stringify(receipt));
    changed();
    assert.equal(privacy.getChoices().analytics, true);
    store.getString = () => { throw Error('storage unavailable'); };
    changed();
    assert.equal(privacy.getChoices().analytics, false);
});

test('a browser that denies access to the storage object cannot crash the consent store', t => {
    const previous = Object.getOwnPropertyDescriptor(global, 'window');
    const windowStub = Object.defineProperty({}, 'localStorage', {get() {throw new Error('Storage blocked');}});
    Object.defineProperty(global, 'window', {value: windowStub, configurable: true});
    t.after(() => {
        if (previous) Object.defineProperty(global, 'window', previous);
        else delete global.window;
    });
    const {PersistentCache} = loadTypeScript('data/datasources/storage/PersistentCache.web.ts');
    const {PrivacyPreferencesImpl} = loadTypeScript('data/services/PrivacyPreferencesImpl.ts');
    const privacy = new PrivacyPreferencesImpl(new PersistentCache('privacy'));
    assert.equal(privacy.getChoices().analytics, false);
    assert.throws(() => privacy.updateChoices({adultConfirmed: true, analytics: true}), /could not be saved/);
    assert.equal(privacy.getChoices().adultConfirmed, false);
    assert.equal(privacy.getChoices().analytics, false);
});
