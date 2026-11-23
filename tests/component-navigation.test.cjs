const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readdirSync, readFileSync, statSync} = require('node:fs');
const path = require('node:path');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.join(__dirname, '..');
const unbound = () => {
    throw new Error('The imperative router is unavailable before the first render has finished.');
};

function sources(directory) {
    return readdirSync(directory).flatMap(name => {
        const file = path.join(directory, name);
        if (statSync(file).isDirectory()) return sources(file);
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
    });
}

test('destination navigation keeps working while the global imperative router is unbound', async () => {
    const calls = [];
    const scoped = {
        push: href => calls.push(['push', href]),
        dismissTo: href => calls.push(['dismissTo', href]),
        setParams: params => calls.push(['setParams', params]),
    };
    let routes = [];
    const {useGoTo} = loadTypeScript('presentation/movies/constants/destinations.ts', {
        'react-native': {Platform: {OS: 'android'}},
        'expo-router': {
            router: {push: unbound, dismissTo: unbound, setParams: unbound},
            useRouter: () => scoped,
            usePathname: () => '/movies',
            useNavigation: () => ({getState: () => ({routes})}),
        },
    });
    let goTo;
    function Probe() {
        goTo = useGoTo();
        return null;
    }
    await act(async () => { create(React.createElement(Probe)); });

    goTo('/shows');
    routes = [{name: 'index'}, {name: 'watchlist'}];
    goTo('/watchlist');
    goTo('/movies?genre=Drama');

    assert.deepEqual(calls, [
        ['push', '/shows'],
        ['dismissTo', '/watchlist'],
        ['setParams', {query: undefined, genre: 'Drama', quality: undefined, minimum_rating: undefined,
            sort_by: undefined, order_by: undefined, focus: undefined}],
    ]);
});

test('screens and components never import the global imperative router', () => {
    const offenders = [];
    for (const file of [...sources(path.join(root, 'app')), ...sources(path.join(root, 'presentation'))]) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'expo-router'/g)) {
            if (match[1].split(',').some(name => name.trim() === 'router')) offenders.push(path.relative(root, file));
        }
    }
    assert.deepEqual(offenders, []);
});
