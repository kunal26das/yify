import assert from 'node:assert/strict';
import test from 'node:test';

import {YOUTUBE_WEB_VIEW_PROPS} from './youtubeWebView.ts';

class FakeMessageEvent extends Event {
    data: unknown;

    constructor(type: string, init?: {data?: unknown}) {
        super(type);
        this.data = init?.data;
    }
}

function embedPage() {
    const win = new EventTarget();
    const doc = new EventTarget();
    const calls: string[] = [];
    win.addEventListener('message', (event) => {
        switch ((event as FakeMessageEvent).data) {
            case 'playVideo':
                calls.push('playVideo');
                break;
            case 'pauseVideo':
                calls.push('pauseVideo');
                break;
            case 'muteVideo':
                calls.push('mute');
                break;
            case 'unMuteVideo':
                calls.push('unMute');
                break;
        }
    });
    const scope = globalThis as unknown as Record<string, unknown>;
    scope.window = win;
    scope.document = doc;
    scope.MessageEvent = FakeMessageEvent;
    new Function(YOUTUBE_WEB_VIEW_PROPS.injectedJavaScript)();
    return {win, doc, calls};
}

const command = (eventName: string) => JSON.stringify({eventName, meta: {}});

const deliver = (target: EventTarget, data: unknown) =>
    target.dispatchEvent(new FakeMessageEvent('message', {data}));

test('a command delivered on window reaches the player exactly once', () => {
    const {win, calls} = embedPage();
    deliver(win, command('playVideo'));
    assert.deepEqual(calls, ['playVideo']);
});

test('a command delivered on document reaches the player exactly once', () => {
    const {doc, calls} = embedPage();
    deliver(doc, command('playVideo'));
    assert.deepEqual(calls, ['playVideo']);
});

test('every command the embed understands survives either delivery target', () => {
    for (const target of ['win', 'doc'] as const) {
        const page = embedPage();
        for (const name of ['playVideo', 'pauseVideo', 'muteVideo', 'unMuteVideo']) {
            deliver(page[target], command(name));
        }
        assert.deepEqual(page.calls, ['playVideo', 'pauseVideo', 'mute', 'unMute'], target);
    }
});

test('the bare string the bridge re-dispatches does not feed back into itself', () => {
    const {win, calls} = embedPage();
    deliver(win, 'playVideo');
    assert.deepEqual(calls, ['playVideo']);
});

test('malformed payloads are dropped rather than forwarded', () => {
    const {win, doc, calls} = embedPage();
    for (const junk of ['not json', '', '[]', '{}', '{"meta":{}}', '{"eventName":123}', 'null']) {
        deliver(win, junk);
        deliver(doc, junk);
    }
    deliver(win, {eventName: 'playVideo'});
    assert.deepEqual(calls, []);
});

test('commands the embed has no handler for stay inert', () => {
    const {win, calls} = embedPage();
    deliver(win, JSON.stringify({eventName: 'setVolume', meta: {volume: 50}}));
    deliver(win, JSON.stringify({eventName: 'setPlaybackRate', meta: {playbackRate: 2}}));
    assert.deepEqual(calls, []);
});

test('re-injecting the bridge does not double-fire', () => {
    const {win, calls} = embedPage();
    new Function(YOUTUBE_WEB_VIEW_PROPS.injectedJavaScript)();
    new Function(YOUTUBE_WEB_VIEW_PROPS.injectedJavaScript)();
    deliver(win, command('playVideo'));
    assert.deepEqual(calls, ['playVideo']);
});
