const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const flush = async () => {
    for (let index = 0; index < 6; index++) await Promise.resolve();
};

function fixture(t, {url = 'https://kunal26das.github.io/yify/', ready = true, adsRemoved = false, width = 728,
    dev = false, preview = false, electron = false, desktop = false, sdkThrows = false} = {}) {
    t.mock.timers.enable({apis: ['setTimeout']});
    const originals = new Map(['window', 'document', 'ResizeObserver', 'MutationObserver', '__DEV__']
        .map(key => [key, Object.getOwnPropertyDescriptor(global, key)]));
    const environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = preview ? 'preview' : 'production';
    t.after(() => {
        for (const [key, original] of originals) {
            if (original) Object.defineProperty(global, key, original);
            else delete global[key];
        }
        if (environment === undefined) delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
        else process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = environment;
    });
    const mutationObservers = [];
    const resizeObservers = [];
    const calls = {scripts: [], pushes: 0};
    class Element {
        constructor(tagName, ownerDocument) {
            this.tagName = tagName;
            this.ownerDocument = ownerDocument;
            this.children = [];
            this.style = {};
            this.attributes = new Map();
            this.listeners = new Map();
            this.width = width;
            this.isConnected = true;
        }
        setAttribute(name, value) {
            this.attributes.set(name, value);
            for (const observer of mutationObservers) {
                if (observer.target === this && observer.active && observer.options.attributeFilter.includes(name)) {
                    observer.callback();
                }
            }
        }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        appendChild(child) {
            this.children.push(child);
            child.parent = this;
            if (child.tagName === 'script') calls.scripts.push(child);
            return child;
        }
        remove() {
            if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
            this.isConnected = false;
        }
        getBoundingClientRect() { return {width: this.width}; }
        addEventListener(event, callback) {
            const callbacks = this.listeners.get(event) ?? new Set();
            callbacks.add(callback);
            this.listeners.set(event, callbacks);
        }
        removeEventListener(event, callback) { this.listeners.get(event)?.delete(callback); }
        emit(event) { for (const callback of this.listeners.get(event) ?? []) callback(); }
    }
    const containers = new Map();
    const document = {
        createElement: tag => new Element(tag, document),
        getElementById: id => containers.get(id) ?? null,
    };
    document.head = new Element('head', document);
    const addContainer = (id = 'ad-slot') => {
        const container = new Element('div', document);
        containers.set(id, container);
        return container;
    };
    const container = addContainer();
    global.document = document;
    global.window = {
        document,
        location: new URL(url),
        navigator: {userAgent: electron ? 'Yify Electron/44' : 'Mozilla/5.0'},
        yifyDesktop: {isDesktop: desktop},
        adsbygoogle: {push() {
            if (sdkThrows) throw new Error('ad request rejected');
            calls.pushes++;
        }},
    };
    global.__DEV__ = dev;
    global.MutationObserver = class {
        constructor(callback) { this.callback = callback; mutationObservers.push(this); }
        observe(target, options) { this.target = target; this.options = options; this.active = true; }
        disconnect() { this.active = false; }
    };
    global.ResizeObserver = class {
        constructor(callback) { this.callback = callback; resizeObservers.push(this); }
        observe(target) { this.target = target; this.active = true; }
        disconnect() { this.active = false; }
    };
    let state = {ready, adsRemoved};
    const subscribers = new Set();
    const purchases = {
        getState: () => state,
        subscribe: callback => { subscribers.add(callback); return () => subscribers.delete(callback); },
    };
    const {AdSenseDisplayAds} = loadTypeScript('data/services/AdSenseDisplayAds.web.ts');
    const gateway = new AdSenseDisplayAds(purchases);
    const states = [];
    const attach = (id = 'ad-slot') => gateway.attach(id, state => states.push(state));
    return {
        gateway, purchases, calls, container, document, states, subscribers, attach, addContainer,
        mutationObservers, resizeObservers,
        changeState(update) {
            state = {...state, ...update};
            for (const subscriber of [...subscribers]) subscriber();
        },
        resize(nextWidth) {
            container.width = nextWidth;
            for (const observer of resizeObservers) if (observer.active) observer.callback();
        },
        async loaded() { calls.scripts[0].emit('load'); await flush(); },
    };
}

test('web ads accept only managed production websites', async t => {
    const f = fixture(t);
    for (const url of [
        'https://kunal26das.github.io/yify', 'https://kunal26das.github.io/yify/',
        'https://kunal26das.github.io/yify/movie/12', 'https://yify.expo.app/',
    ]) {
        window.location = new URL(url);
        assert.equal(f.gateway.supported, true, url);
    }
    for (const url of [
        'https://kunal26das.github.io/', 'https://kunal26das.github.io/yify-other',
        'https://yify--preview.expo.app/', 'http://yify.expo.app/', 'https://yify.expo.app:8080/',
        'https://yify.expo.app.example.test/', 'http://localhost:8081/', 'file:///yify/index.html',
    ]) {
        window.location = new URL(url);
        assert.equal(f.gateway.supported, false, url);
        f.attach()();
    }
    await flush();
    assert.equal(f.calls.scripts.length, 0);
    assert.equal(f.subscribers.size, 0);
});

for (const option of ['dev', 'preview', 'electron', 'desktop']) {
    test(`web ads stay disabled in ${option}`, async t => {
        const f = fixture(t, {[option]: true});
        assert.equal(f.gateway.supported, false);
        f.attach()();
        await flush();
        assert.equal(f.calls.scripts.length, 0);
        assert.deepEqual(f.states, ['disabled']);
    });
}

test('web adapter is SSR-safe and native adapter never requests ads', t => {
    const f = fixture(t);
    delete global.window;
    delete global.document;
    assert.equal(f.gateway.supported, false);
    assert.doesNotThrow(() => f.attach()());
    const {AdSenseDisplayAds} = loadTypeScript('data/services/AdSenseDisplayAds.ts');
    const native = new AdSenseDisplayAds(f.purchases);
    assert.equal(native.supported, false);
    assert.doesNotThrow(() => native.attach('ad-slot')());
    assert.equal(f.subscribers.size, 0);
});

test('unknown entitlements wait without loading Google and supporters remain ad-free', async t => {
    const f = fixture(t, {ready: false});
    const dispose = f.attach();
    await flush();
    assert.equal(f.calls.scripts.length, 0);
    f.changeState({ready: true, adsRemoved: true});
    await flush();
    assert.equal(f.calls.scripts.length, 0);
    f.changeState({adsRemoved: false});
    await flush();
    assert.equal(f.calls.scripts.length, 1);
    await f.loaded();
    assert.equal(f.calls.pushes, 1);
    dispose();
});

test('duplicate attachments share a single request until their last cleanup', async t => {
    const f = fixture(t);
    const firstStates = [];
    const secondStates = [];
    const first = f.gateway.attach('ad-slot', state => firstStates.push(state));
    const second = f.gateway.attach('ad-slot', state => secondStates.push(state));
    await flush();
    assert.equal(f.calls.scripts.length, 1);
    assert.equal(f.calls.pushes, 0);
    await f.loaded();
    assert.equal(f.calls.pushes, 1);
    assert.equal(f.container.children.length, 1);
    const ad = f.container.children[0];
    assert.equal(ad.getAttribute('data-ad-client'), 'ca-pub-2292299294214510');
    assert.equal(ad.getAttribute('data-ad-slot'), '8399492432');
    assert.equal(ad.getAttribute('data-ad-format'), 'auto');
    assert.equal(ad.getAttribute('data-full-width-responsive'), 'true');
    ad.setAttribute('data-ad-status', 'filled');
    assert.equal(firstStates.at(-1), 'filled');
    assert.equal(secondStates.at(-1), 'filled');
    first();
    first();
    assert.equal(f.container.children.length, 1);
    assert.equal(f.subscribers.size, 1);
    second();
    assert.equal(f.container.children.length, 0);
    assert.equal(f.subscribers.size, 0);
    assert.equal(f.mutationObservers.some(observer => observer.active), false);
    assert.equal(f.resizeObservers.some(observer => observer.active), false);
});

test('different slots and adapter instances share one script without sharing requests', async t => {
    const f = fixture(t);
    const other = f.addContainer('other-slot');
    const secondGateway = new f.gateway.constructor(f.purchases);
    const first = f.attach();
    const second = secondGateway.attach('other-slot');
    await flush();
    assert.equal(f.calls.scripts.length, 1);
    await f.loaded();
    assert.equal(f.calls.pushes, 2);
    assert.equal(f.container.children.length, 1);
    assert.equal(other.children.length, 1);
    first();
    second();
});

test('immediate effect cleanup issues no script or ad request', async t => {
    const f = fixture(t);
    f.attach()();
    await flush();
    assert.equal(f.calls.scripts.length, 0);
    assert.equal(f.calls.pushes, 0);
    assert.equal(f.subscribers.size, 0);
});

test('cleanup while Google loads prevents the later ad request', async t => {
    const f = fixture(t);
    const dispose = f.attach();
    await flush();
    dispose();
    await f.loaded();
    assert.equal(f.calls.pushes, 0);
    assert.equal(f.container.children.length, 0);
    assert.equal(f.subscribers.size, 0);
});

test('supporter activation while the script loads cancels the pending request', async t => {
    const f = fixture(t);
    const dispose = f.attach();
    await flush();
    f.changeState({adsRemoved: true});
    await f.loaded();
    assert.equal(f.calls.pushes, 0);
    assert.equal(f.states.at(-1), 'disabled');
    assert.equal(f.container.children.length, 0);
    dispose();
});

test('supporter activation removes the owned ad without touching other page content', async t => {
    const f = fixture(t);
    const content = f.document.createElement('div');
    f.container.appendChild(content);
    const dispose = f.attach();
    await flush();
    await f.loaded();
    f.changeState({adsRemoved: true});
    assert.deepEqual(f.container.children, [content]);
    assert.equal(f.states.at(-1), 'disabled');
    f.changeState({adsRemoved: false});
    await flush();
    assert.equal(f.calls.pushes, 1);
    dispose();
});

test('requests wait for a visible width and resize notifications never refresh an ad', async t => {
    const f = fixture(t, {width: 0});
    const dispose = f.attach();
    await flush();
    assert.equal(f.calls.scripts.length, 0);
    f.resize(320);
    await flush();
    await f.loaded();
    assert.equal(f.calls.pushes, 1);
    f.resize(728);
    await flush();
    assert.equal(f.calls.pushes, 1);
    dispose();
});

for (const status of ['filled', 'unfilled', 'unfill-optimized']) {
    test(`Google ${status} status is preserved without invented revenue or extra requests`, async t => {
        const f = fixture(t);
        const dispose = f.attach();
        await flush();
        await f.loaded();
        const ad = f.container.children[0];
        ad.setAttribute('data-adsbygoogle-status', 'done');
        assert.equal(f.states.at(-1), 'loading');
        ad.setAttribute('data-ad-status', status);
        assert.equal(f.states.at(-1), status);
        assert.equal(f.container.getAttribute('data-display-ad-state'), status);
        assert.equal(ad.style.display, status === 'unfilled' ? 'none' : 'block');
        assert.equal(f.container.children[0], ad);
        t.mock.timers.tick(60000);
        await flush();
        assert.equal(f.calls.pushes, 1);
        assert.equal(f.container.children[0], ad);
        dispose();
    });
}

test('a pending consent or creative response is not torn down by a timer', async t => {
    const f = fixture(t);
    const dispose = f.attach();
    await flush();
    await f.loaded();
    t.mock.timers.tick(120000);
    await flush();
    assert.equal(f.states.at(-1), 'loading');
    assert.equal(f.container.children.length, 1);
    f.container.children[0].setAttribute('data-ad-status', 'filled');
    assert.equal(f.states.at(-1), 'filled');
    dispose();
});

test('Google can optimize a previously unfilled slot without another app request', async t => {
    const f = fixture(t);
    const dispose = f.attach();
    await flush();
    await f.loaded();
    const ad = f.container.children[0];
    ad.setAttribute('data-ad-status', 'unfilled');
    assert.equal(ad.style.display, 'none');
    ad.setAttribute('data-ad-status', 'unfill-optimized');
    assert.equal(f.states.at(-1), 'unfill-optimized');
    assert.equal(ad.style.display, 'block');
    assert.equal(f.calls.pushes, 1);
    dispose();
});

for (const failure of ['error', 'timeout']) {
    test(`a script ${failure} clears the slot and never loops ad requests`, async t => {
        const f = fixture(t);
        const dispose = f.attach();
        await flush();
        if (failure === 'error') f.calls.scripts[0].emit('error');
        else t.mock.timers.tick(15000);
        await flush();
        assert.equal(f.states.at(-1), 'blocked');
        assert.equal(f.calls.pushes, 0);
        assert.equal(f.container.children.length, 0);
        f.resize(400);
        f.changeState({ready: true});
        await flush();
        assert.equal(f.calls.scripts.length, 1);
        dispose();
    });
}

test('SDK rejection is contained and cleans up the empty slot', async t => {
    const f = fixture(t, {sdkThrows: true});
    const dispose = f.attach();
    await flush();
    await f.loaded();
    assert.equal(f.states.at(-1), 'blocked');
    assert.equal(f.container.children.length, 0);
    assert.equal(f.mutationObservers.some(observer => observer.active), false);
    dispose();
});

test('a failing state listener cannot stop ad initialization', async t => {
    const f = fixture(t);
    const dispose = f.gateway.attach('ad-slot', () => { throw new Error('presentation failed'); });
    await flush();
    await f.loaded();
    assert.equal(f.calls.pushes, 1);
    dispose();
});
