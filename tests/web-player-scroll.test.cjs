const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

function scrollQueue() {
    const pending = [];
    return {
        enqueue: callback => pending.push(callback),
        next() {
            assert.ok(pending.length > 0, 'expected a pending scroll notification');
            pending.shift()();
        },
        drain() {
            let delivered = 0;
            while (pending.length) {
                assert.ok(delivered++ < 30, 'scroll notifications must settle without a feedback loop');
                pending.shift()();
            }
        },
        get length() {return pending.length;},
    };
}

function scrollElement(queue, {scrollTop = 0, clientHeight = 600, scrollHeight = 1800} = {}) {
    const listeners = new Map();
    const writes = [];
    let position = scrollTop;
    const element = {
        clientHeight,
        scrollHeight,
        writes,
        get scrollTop() {return position;},
        set scrollTop(value) {
            writes.push(value);
            if (position === value) return;
            position = value;
            queue.enqueue(() => element.emit('scroll'));
        },
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(callback);
        },
        removeEventListener(name, callback) {listeners.get(name)?.delete(callback);},
        emit(name) {
            for (const callback of [...(listeners.get(name) ?? [])]) callback({target: element});
        },
        userScroll(value) {
            position = value;
            queue.enqueue(() => element.emit('scroll'));
        },
        callbacks: () => [...listeners.values()].flatMap(callbacks => [...callbacks]),
    };
    return element;
}

function fixture(t, {position = 0, clientHeight = 600, scrollHeight = 1800, height = 320} = {}) {
    const queue = scrollQueue();
    const viewport = scrollElement(queue, {clientHeight: height});
    const target = scrollElement(queue, {scrollTop: position, clientHeight, scrollHeight});
    const track = {style: {height: ''}};
    const {createPlayerScrollRelay} = loadTypeScript('presentation/player/playerScrollRelay.ts');
    const relay = createPlayerScrollRelay({viewport, track, target, height});
    t.after(() => relay.dispose());
    return {queue, viewport, target, track, relay};
}

test('connecting preserves the page position and sizes the proxy for the full page scroll range', t => {
    const f = fixture(t, {position: 275, height: 360});
    assert.equal(f.track.style.height, '1560px');
    assert.equal(f.viewport.scrollTop, 275);
    assert.equal(f.target.scrollTop, 275);
    f.queue.drain();
    assert.equal(f.viewport.scrollTop, 275);
    assert.equal(f.target.scrollTop, 275);
});

test('scrolling the player proxy moves the page and its programmatic notification settles', t => {
    const f = fixture(t);
    f.viewport.userScroll(410);
    f.queue.drain();
    assert.equal(f.target.scrollTop, 410);
    assert.equal(f.viewport.scrollTop, 410);
    assert.equal(f.queue.length, 0);
});

test('page scrolling updates the player proxy and its programmatic notification settles', t => {
    const f = fixture(t);
    f.target.userScroll(730);
    f.queue.drain();
    assert.equal(f.viewport.scrollTop, 730);
    assert.equal(f.target.scrollTop, 730);
    assert.equal(f.queue.length, 0);
});

for (const source of ['viewport', 'target']) {
    test(`${source} overscroll clamps both surfaces to the page boundaries`, t => {
        const f = fixture(t, {position: 200});
        f.queue.drain();
        f[source].userScroll(-80);
        f.queue.drain();
        assert.equal(f.target.scrollTop, 0);
        assert.equal(f.viewport.scrollTop, 0);
        f[source].userScroll(1600);
        f.queue.drain();
        assert.equal(f.target.scrollTop, 1200);
        assert.equal(f.viewport.scrollTop, 1200);
    });
}

test('refresh expands the range after content growth and keeps the current page position', t => {
    const f = fixture(t, {position: 900});
    f.queue.drain();
    f.target.scrollHeight = 2600;
    f.relay.refresh();
    assert.equal(f.track.style.height, '2320px');
    assert.equal(f.viewport.scrollTop, 900);
    f.viewport.userScroll(1850);
    f.queue.drain();
    assert.equal(f.target.scrollTop, 1850);
    assert.equal(f.viewport.scrollTop, 1850);
});

test('refresh clamps the existing position after content or viewport dimensions shrink the range', t => {
    const f = fixture(t, {position: 1100});
    f.queue.drain();
    f.target.scrollHeight = 1000;
    f.relay.refresh();
    f.queue.drain();
    assert.equal(f.track.style.height, '720px');
    assert.equal(f.target.scrollTop, 400);
    assert.equal(f.viewport.scrollTop, 400);
    f.target.clientHeight = 1200;
    f.relay.refresh();
    f.queue.drain();
    assert.equal(f.track.style.height, '320px');
    assert.equal(f.target.scrollTop, 0);
    assert.equal(f.viewport.scrollTop, 0);
});

test('a page shorter than its viewport has no proxy scroll range', t => {
    const f = fixture(t, {clientHeight: 800, scrollHeight: 300});
    assert.equal(f.track.style.height, '320px');
    f.viewport.userScroll(200);
    f.queue.drain();
    assert.equal(f.viewport.scrollTop, 0);
    assert.equal(f.target.scrollTop, 0);
});

test('an initial delayed proxy notification cannot overwrite a newer page position', t => {
    const f = fixture(t, {position: 120});
    f.target.userScroll(420);
    f.queue.next();
    assert.equal(f.target.scrollTop, 420);
    f.queue.drain();
    assert.equal(f.target.scrollTop, 420);
    assert.equal(f.viewport.scrollTop, 420);
});

test('a delayed proxy echo after page scrolling cannot rewind a newer page scroll', t => {
    const f = fixture(t);
    f.target.userScroll(200);
    f.queue.next();
    assert.equal(f.viewport.scrollTop, 200);
    f.target.userScroll(650);
    f.queue.next();
    assert.equal(f.target.scrollTop, 650);
    f.queue.drain();
    assert.equal(f.target.scrollTop, 650);
    assert.equal(f.viewport.scrollTop, 650);
});

test('a delayed page echo does not discard a newer player-proxy gesture', t => {
    const f = fixture(t);
    f.viewport.userScroll(240);
    f.queue.next();
    assert.equal(f.target.scrollTop, 240);
    f.viewport.userScroll(510);
    f.queue.next();
    assert.equal(f.viewport.scrollTop, 510);
    f.queue.drain();
    assert.equal(f.target.scrollTop, 510);
    assert.equal(f.viewport.scrollTop, 510);
});

test('dispose removes listeners and makes queued callbacks and refresh inert', t => {
    const f = fixture(t, {position: 120});
    const callbacks = [...f.viewport.callbacks(), ...f.target.callbacks()];
    assert.ok(f.viewport.callbacks().length > 0);
    assert.ok(f.target.callbacks().length > 0);
    f.relay.dispose();
    assert.deepEqual(f.viewport.callbacks(), []);
    assert.deepEqual(f.target.callbacks(), []);
    f.viewport.userScroll(400);
    f.target.userScroll(700);
    f.target.scrollHeight = 2600;
    const viewportWrites = f.viewport.writes.length;
    const targetWrites = f.target.writes.length;
    for (const callback of callbacks) callback({target: f.viewport});
    f.queue.drain();
    f.relay.refresh();
    f.relay.dispose();
    assert.equal(f.viewport.scrollTop, 400);
    assert.equal(f.target.scrollTop, 700);
    assert.equal(f.track.style.height, '1520px');
    assert.equal(f.viewport.writes.length, viewportWrites);
    assert.equal(f.target.writes.length, targetWrites);
});

async function bridgeFixture(t) {
    const queue = scrollQueue();
    const resizeObservers = [];
    const mutationObservers = [];
    const previousGlobals = new Map();
    const installGlobal = (name, value) => {
        previousGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
    };
    const observerClass = instances => class {
        constructor(callback) {
            this.callback = callback;
            this.observed = new Set();
            this.disconnected = false;
            instances.push(this);
        }
        observe(element) {this.observed.add(element);}
        unobserve(element) {this.observed.delete(element);}
        disconnect() {this.disconnected = true; this.observed.clear();}
        notify() {this.callback([], this);}
    };
    installGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    installGlobal('ResizeObserver', observerClass(resizeObservers));
    installGlobal('MutationObserver', observerClass(mutationObservers));
    installGlobal('CSS', {escape: value => value});
    const makeTarget = options => Object.assign(scrollElement(queue, options), {
        isConnected: true,
        children: [{}],
        getClientRects: () => [{}],
        closest: () => null,
        getBoundingClientRect: () => ({top: 0, left: 0, bottom: 600, right: 1000}),
    });
    const target = makeTarget({scrollTop: 120});
    let candidates = [target];
    const window = Object.assign(scrollElement(queue), {
        innerHeight: 800,
        innerWidth: 1200,
        getComputedStyle: () => ({visibility: 'visible'}),
    });
    const document = {
        body: {},
        defaultView: window,
        querySelectorAll(selector) {
            assert.equal(selector, '[id="page-scroll"]');
            return [...candidates];
        },
    };
    const viewport = Object.assign(scrollElement(queue, {clientHeight: 320}), {ownerDocument: document});
    const track = {style: {height: '320px'}};
    const {PlayerScrollBridge} = loadTypeScript('presentation/player/PlayerScrollBridge.web.tsx');
    let mounts = 0;
    let unmounts = 0;
    function Player() {
        React.useEffect(() => {
            mounts++;
            return () => {unmounts++;};
        }, []);
        return React.createElement('iframe', {src: 'https://www.youtube.com/embed/example'});
    }
    let active = true;
    let renderer;
    let unmounted = false;
    const render = nextActive => {
        active = nextActive;
        return React.createElement(PlayerScrollBridge, {
            active, targetId: 'page-scroll', width: 640, height: 320,
        }, React.createElement(Player));
    };
    const unmount = async () => {
        if (unmounted) return;
        unmounted = true;
        await act(async () => renderer?.unmount());
    };
    t.after(async () => {
        try {
            await unmount();
        } finally {
            for (const [name, descriptor] of previousGlobals) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor);
                else delete globalThis[name];
            }
        }
    });
    await act(async () => {
        renderer = create(render(active), {
            createNodeMock: element => {
                if (element.type !== 'div') return null;
                if (element.props.style.overflowY) return viewport;
                if (element.props.style.position === 'relative') return track;
                return {};
            },
        });
    });
    queue.drain();
    return {
        queue, viewport, target, track, window, document, resizeObservers, mutationObservers,
        renderer, makeTarget, unmount,
        get mounts() {return mounts;},
        get unmounts() {return unmounts;},
        setCandidates: value => {candidates = value;},
        async setActive(value) {
            await act(async () => renderer.update(render(value)));
            queue.drain();
        },
    };
}

test('bridge detaches a removed page and reconnects when it reappears or is replaced', async t => {
    const f = await bridgeFixture(t);
    const resizeObserver = f.resizeObservers[0];
    const mutationObserver = f.mutationObservers[0];
    assert.equal(f.track.style.height, '1520px');
    assert.equal(f.viewport.scrollTop, 120);
    f.target.isConnected = false;
    f.setCandidates([]);
    mutationObserver.notify();
    f.queue.drain();
    assert.equal(f.track.style.height, '320px');
    assert.equal(f.viewport.scrollTop, 0);
    assert.deepEqual(f.target.callbacks(), []);
    assert.deepEqual(f.viewport.callbacks(), []);
    assert.equal(resizeObserver.observed.size, 0);

    f.target.isConnected = true;
    f.setCandidates([f.target]);
    mutationObserver.notify();
    f.queue.drain();
    assert.equal(f.viewport.scrollTop, 120);
    assert.equal(f.target.callbacks().length, 1);
    assert.ok(resizeObserver.observed.has(f.target.children[0]));

    const replacement = f.makeTarget({scrollTop: 460, scrollHeight: 2400});
    f.setCandidates([replacement]);
    mutationObserver.notify();
    f.queue.drain();
    assert.deepEqual(f.target.callbacks(), []);
    assert.equal(replacement.callbacks().length, 1);
    assert.equal(f.track.style.height, '2120px');
    assert.equal(f.viewport.scrollTop, 460);
    assert.ok(!resizeObserver.observed.has(f.target));
    assert.ok(resizeObserver.observed.has(replacement));
    f.target.userScroll(700);
    f.queue.drain();
    assert.equal(f.viewport.scrollTop, 460);
});

test('disabling the bridge releases observers and listeners while preserving its iframe', async t => {
    const f = await bridgeFixture(t);
    const iframe = f.renderer.root.findByType('iframe');
    const resizeObserver = f.resizeObservers[0];
    const mutationObserver = f.mutationObservers[0];
    assert.equal(f.window.callbacks().length, 1);
    await f.setActive(false);
    assert.equal(resizeObserver.disconnected, true);
    assert.equal(mutationObserver.disconnected, true);
    assert.equal(resizeObserver.observed.size, 0);
    assert.equal(mutationObserver.observed.size, 0);
    assert.deepEqual(f.window.callbacks(), []);
    assert.deepEqual(f.target.callbacks(), []);
    assert.deepEqual(f.viewport.callbacks(), []);
    assert.equal(f.track.style.height, '320px');
    assert.equal(f.viewport.scrollTop, 0);
    assert.equal(f.renderer.root.findByType('iframe'), iframe);
    assert.equal(f.mounts, 1);
    assert.equal(f.unmounts, 0);

    f.target.scrollHeight = 2600;
    f.target.userScroll(450);
    resizeObserver.notify();
    mutationObserver.notify();
    f.window.emit('resize');
    f.queue.drain();
    assert.equal(f.track.style.height, '320px');
    assert.equal(f.viewport.scrollTop, 0);
    await f.setActive(true);
    assert.equal(f.track.style.height, '2320px');
    assert.equal(f.viewport.scrollTop, 450);
    assert.equal(f.window.callbacks().length, 1);
    assert.equal(f.target.callbacks().length, 1);
    assert.equal(f.renderer.root.findByType('iframe'), iframe);
    assert.equal(f.mounts, 1);
    assert.equal(f.unmounts, 0);
});

test('bridge observes content changes and refreshes its range on content and window resize', async t => {
    const f = await bridgeFixture(t);
    const resizeObserver = f.resizeObservers[0];
    assert.ok(resizeObserver.observed.has(f.target));
    assert.ok(resizeObserver.observed.has(f.target.children[0]));
    assert.ok(f.mutationObservers[0].observed.has(f.document.body));
    f.target.scrollHeight = 2800;
    resizeObserver.notify();
    assert.equal(f.track.style.height, '2520px');
    f.viewport.userScroll(2000);
    f.queue.drain();
    assert.equal(f.target.scrollTop, 2000);

    const oldChild = f.target.children[0];
    const newChild = {};
    f.target.children = [newChild];
    f.mutationObservers[0].notify();
    assert.ok(!resizeObserver.observed.has(oldChild));
    assert.ok(resizeObserver.observed.has(newChild));
    f.target.clientHeight = 1000;
    f.window.emit('resize');
    f.queue.drain();
    assert.equal(f.track.style.height, '2120px');
    assert.equal(f.target.scrollTop, 1800);
    assert.equal(f.viewport.scrollTop, 1800);
});

test('unmounting the bridge releases all subscriptions and ignores callbacks already queued', async t => {
    const f = await bridgeFixture(t);
    const resizeObserver = f.resizeObservers[0];
    const mutationObserver = f.mutationObservers[0];
    const resizeCallback = f.window.callbacks()[0];
    await f.unmount();
    assert.equal(f.unmounts, 1);
    assert.equal(resizeObserver.disconnected, true);
    assert.equal(mutationObserver.disconnected, true);
    assert.deepEqual(f.window.callbacks(), []);
    assert.deepEqual(f.target.callbacks(), []);
    assert.deepEqual(f.viewport.callbacks(), []);
    f.target.scrollHeight = 4000;
    f.target.userScroll(550);
    resizeObserver.notify();
    mutationObserver.notify();
    resizeCallback();
    f.queue.drain();
    assert.equal(f.track.style.height, '320px');
    assert.equal(f.viewport.scrollTop, 0);
});
