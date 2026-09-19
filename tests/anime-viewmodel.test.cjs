const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {useAnimeViewModel} = loadTypeScript('presentation/anime/useAnimeViewModel.ts', {
    '../hooks/use-reload-on-catalog-access': {useReloadOnCatalogAccess: () => {}},
});
const result = (id = 1) => ({releases: id === null ? [] : [{
    id: `nyaa:${id}`, title: `Example anime ${id}`, category: 'english',
    uploadedAt: new Date('2026-09-19T00:00:00Z'), size: '200 MiB', seeds: 5, peers: 2, downloadCount: 9,
}], limit: 75});
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
    return {promise, resolve, reject};
};

async function mountHook(t, repository) {
    let current, renderer;
    function Hook() {current = useAnimeViewModel(repository); return null;}
    await act(async () => {renderer = create(React.createElement(Hook));});
    t.after(async () => {await act(async () => renderer.unmount());});
    return {
        get value() {return current;},
        run: async action => {await act(async () => action(current));},
        replace: async next => {repository = next; await act(async () => renderer.update(React.createElement(Hook)));},
        unmount: async () => {await act(async () => renderer.unmount());},
    };
}

test('anime distinguishes an unavailable source from a successful empty feed and retries', async t => {
    let fail = true;
    const retry = deferred();
    const hook = await mountHook(t, {listAnime: async () => {
        if (fail) throw new Error('offline');
        return retry.promise;
    }});
    assert.equal(hook.value.status, 'unavailable');
    fail = false;
    await hook.run(model => model.reload());
    assert.equal(hook.value.status, 'loading');
    await act(async () => retry.resolve(result(null)));
    assert.equal(hook.value.status, 'empty');
    assert.equal(hook.value.refreshing, false);
});

test('anime submits a bounded search and keeps it when switching category', async t => {
    const requests = [];
    const hook = await mountHook(t, {async listAnime(params) {requests.push(params); return result();}});
    assert.deepEqual(requests, [{query: '', category: 'all'}]);
    await hook.run(model => model.submitSearch('  Star\nSailor  '));
    assert.equal(hook.value.query, 'Star Sailor');
    await hook.run(model => model.selectCategory('english'));
    assert.deepEqual(requests.at(-1), {query: 'Star Sailor', category: 'english'});
    await hook.run(model => model.selectCategory('english'));
    assert.equal(requests.length, 3, 'selecting the current category does not request again');
    await hook.run(model => model.submitSearch('x'.repeat(250)));
    assert.equal(requests.at(-1).query.length, 200);
    await hook.run(model => model.submitSearch(''));
    assert.deepEqual(requests.at(-1), {query: '', category: 'english'});
});

test('anime filters clear old releases immediately and ignore late results and failures', async t => {
    const old = deferred();
    const english = deferred();
    const raw = deferred();
    let calls = 0;
    const signals = [];
    const hook = await mountHook(t, {listAnime: (_params, signal) => {
        signals.push(signal);
        return [old.promise, english.promise, raw.promise][calls++];
    }});
    assert.equal(signals[0].aborted, false);
    await hook.run(model => model.selectCategory('english'));
    assert.equal(signals[0].aborted, true, 'a category change cancels the previous upstream request');
    assert.equal(signals[1].aborted, false);
    await act(async () => old.resolve(result(1)));
    assert.deepEqual(hook.value.releases, []);
    assert.equal(hook.value.status, 'loading');
    await hook.run(model => model.selectCategory('raw'));
    assert.equal(signals[1].aborted, true);
    await act(async () => english.reject(new Error('outdated failure')));
    assert.equal(hook.value.status, 'loading');
    await act(async () => raw.resolve(result(3)));
    assert.deepEqual(hook.value.releases.map(item => item.id), ['nyaa:3']);
    assert.equal(hook.value.category, 'raw');
});

test('a failed anime refresh preserves visible releases and a retry clears the notice', async t => {
    let fail = false;
    const hook = await mountHook(t, {async listAnime() {
        if (fail) throw new Error('offline');
        return result();
    }});
    fail = true;
    await hook.run(model => model.reload());
    assert.equal(hook.value.status, 'ready');
    assert.equal(hook.value.refreshFailed, true);
    assert.equal(hook.value.releases[0].id, 'nyaa:1');
    fail = false;
    await hook.run(model => model.reload());
    assert.equal(hook.value.refreshFailed, false);
    assert.equal(hook.value.refreshing, false);
});

test('search failure cannot leave previous category results under the new query', async t => {
    const hook = await mountHook(t, {async listAnime({query}) {
        if (query) throw new Error('source unavailable');
        return result();
    }});
    assert.equal(hook.value.releases.length, 1);
    await hook.run(model => model.submitSearch('Another title'));
    assert.deepEqual(hook.value.releases, []);
    assert.equal(hook.value.status, 'unavailable');
    assert.equal(hook.value.refreshFailed, false);
});

test('an anime refresh supersedes an in-flight response without finishing its loading state', async t => {
    const first = deferred(), second = deferred();
    let calls = 0;
    const hook = await mountHook(t, {listAnime: () => ++calls === 1 ? first.promise : second.promise});
    await hook.run(model => model.reload());
    await act(async () => first.resolve(result(1)));
    assert.equal(hook.value.refreshing, true);
    assert.equal(hook.value.status, 'loading');
    await act(async () => second.resolve(result(2)));
    assert.equal(hook.value.refreshing, false);
    assert.equal(hook.value.releases[0].id, 'nyaa:2');
});

test('replacing the anime repository hides old data while retaining the submitted filters', async t => {
    const replacement = deferred();
    const hook = await mountHook(t, {async listAnime() {return result(1);}});
    await hook.run(model => model.submitSearch('Star Sailor'));
    const calls = [];
    await hook.replace({listAnime(params) {calls.push(params); return replacement.promise;}});
    assert.equal(hook.value.status, 'loading');
    assert.deepEqual(hook.value.releases, []);
    assert.deepEqual(calls, [{query: 'Star Sailor', category: 'all'}]);
    await act(async () => replacement.resolve(result(2)));
    assert.equal(hook.value.releases[0].id, 'nyaa:2');
});

test('unmounting an anime screen invalidates its pending request', async t => {
    const request = deferred();
    let signal;
    const hook = await mountHook(t, {listAnime: (_params, requestSignal) => {signal = requestSignal; return request.promise;}});
    await hook.unmount();
    assert.equal(signal.aborted, true);
    await act(async () => request.resolve(result(1)));
    assert.equal(hook.value.status, 'loading');
});
