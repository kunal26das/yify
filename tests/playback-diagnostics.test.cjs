const assert = require('node:assert/strict');
const test = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');
const {PlaybackDiagnostics} = loadTypeScript('presentation/player/PlaybackDiagnostics.ts');

function fixture(t) {
    const spans = [];
    const events = [];
    const errors = [];
    const diagnostics = {
        start(operation, attributes) {
            const record = {operation, attributes, finishes: []};
            spans.push(record);
            return {finish: (outcome = 'ok', attributes) => record.finishes.push({outcome, attributes})};
        },
        event: (...args) => events.push(args),
        capture: (...args) => errors.push(args),
    };
    const player = new PlaybackDiagnostics(diagnostics);
    t.after(() => player.stop());
    return {player, spans, events, errors};
}

test('playback starts timing after the ad and closes startup on first playing only', (t) => {
    const {player, spans, events} = fixture(t);
    player.prepare();
    player.ready();
    player.ready();
    player.state('playing');
    assert.equal(spans.length, 1);
    assert.equal(spans[0].finishes.length, 0);
    assert.equal(events.length, 1);
    player.begin();
    player.begin();
    player.state('buffering');
    assert.equal(spans.length, 2);
    player.state('playing');
    player.state('playing');
    assert.deepEqual(spans.map(s => s.finishes.map(f => f.outcome)), [['ok'], ['ok']]);
    player.state('buffering');
    player.state('buffering');
    player.state('playing');
    assert.equal(spans.length, 3);
    assert.equal(spans[2].operation, 'player.buffer');
    assert.equal(spans[2].finishes.length, 1);
});

test('closing or replacing a video cancels pending measurements once', (t) => {
    const {player, spans} = fixture(t);
    player.prepare();
    player.begin();
    player.prepare();
    player.stop();
    player.stop();
    player.state('buffering');
    assert.deepEqual(spans.map(s => s.finishes.map(f => f.outcome)), [['ok'], ['cancelled'], ['cancelled']]);
});

test('startup timeout is an outcome, does not create an issue, and leaves no hanging span', (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const {player, spans, errors} = fixture(t);
    player.prepare();
    player.begin();
    t.mock.timers.tick(30_000);
    player.state('playing');
    assert.equal(errors.length, 0);
    assert.deepEqual(spans[1].finishes.map(f => f.outcome), ['timeout']);
});

test('unavailable content is an outcome and raw error text never enters diagnostics', (t) => {
    const {player, spans, events, errors} = fixture(t);
    player.prepare();
    player.begin();
    player.error('100');
    assert.equal(errors.length, 0);
    assert.equal(spans[1].finishes[0].outcome, 'unavailable');
    player.prepare();
    player.begin();
    player.error('private@example.com videoId=secret');
    player.error('HTML5_error');
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0].message, 'Player failed: unknown');
    assert.equal(JSON.stringify({events, spans, errors}).includes('private@example.com'), false);
});

test('an ad activity pause preserves playback intent without running a background startup timer', (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const {player, spans} = fixture(t);
    player.prepare();
    player.suspend();
    player.begin();
    t.mock.timers.tick(60_000);
    assert.equal(spans.length, 1);
    player.resume();
    player.state('playing');
    assert.equal(spans[1].operation, 'player.start');
    assert.deepEqual(spans[1].finishes.map(f => f.outcome), ['ok']);
    player.suspend();
    player.resume();
    player.state('buffering');
    player.state('playing');
    assert.equal(spans[2].operation, 'player.buffer');
    assert.deepEqual(spans[2].finishes.map(f => f.outcome), ['ok']);
});

test('backgrounding during startup cancels its timer and measures the foreground retry', (t) => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const {player, spans} = fixture(t);
    player.prepare();
    player.begin();
    player.suspend();
    t.mock.timers.tick(60_000);
    player.resume();
    player.state('playing');
    assert.deepEqual(spans.map(s => s.finishes.map(f => f.outcome)), [['ok'], ['cancelled'], ['ok']]);
});
