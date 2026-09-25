const assert = require('node:assert/strict');
const {test} = require('node:test');
const React = require('react');
const {act, create} = require('react-test-renderer');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('web trailer waits for playback permission and ad completion without reloading on play or pause', async t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const messages = [];
    const listeners = new Map();
    const intervals = new Map();
    let nextInterval = 0;
    let renderer;
    const contentWindow = {postMessage: (value, origin) => messages.push({value: JSON.parse(value), origin})};
    globalThis.window = {location: {origin: 'https://yify.expo.app'},
        setInterval(callback) {const id = ++nextInterval; intervals.set(id, callback); return id;},
        clearInterval: id => intervals.delete(id),
        addEventListener: (event, callback) => listeners.set(event, callback),
        removeEventListener: event => listeners.delete(event)};
    t.after(async () => {
        await act(async () => renderer?.unmount());
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else delete globalThis.window;
    });
    const {PlayerSurface} = loadTypeScript('presentation/player/PlayerSurface.web.tsx', {
        'react-native': {View: 'View', StyleSheet: {create: value => value}},
    });
    const props = {videoId: 'permitted', width: 320, height: 180, muted: false, playing: false, captions: false};
    await act(async () => {renderer = create(React.createElement(PlayerSurface, props), {
        createNodeMock: element => element.type === 'iframe' ? {contentWindow} : null,
    });});
    const src = renderer.root.findByType('iframe').props.src;
    assert.equal(new URL(src).searchParams.get('autoplay'), '0');
    await act(async () => listeners.get('message')({source: contentWindow, origin: 'https://www.youtube-nocookie.com',
        data: JSON.stringify({event: 'infoDelivery', info: {playerState: 2, currentTime: 0}})}));
    assert.equal(messages.some(message => message.value.func === 'playVideo'), false);
    await act(async () => renderer.update(React.createElement(PlayerSurface, {...props, playing: true})));
    assert.equal(messages.filter(message => message.value.func === 'playVideo').length, 1);
    await act(async () => listeners.get('message')({source: contentWindow, origin: 'https://www.youtube-nocookie.com',
        data: JSON.stringify({event: 'infoDelivery', info: {playerState: 1, currentTime: 1}})}));
    await act(async () => renderer.update(React.createElement(PlayerSurface, props)));
    assert.equal(messages.filter(message => message.value.func === 'pauseVideo').length, 1);
    assert.equal(renderer.root.findByType('iframe').props.src, src);
    await act(async () => renderer.unmount());
    assert.equal(listeners.size, 0);
    assert.equal(intervals.size, 0);
});
