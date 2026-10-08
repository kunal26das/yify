const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {SupporterNudgeImpl} = loadTypeScript('data/services/SupporterNudgeImpl.ts');
const {trackSubscriptionFunnel} = loadTypeScript('domain/policies/subscriptionFunnel.ts');
const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-10-09T20:00:00Z');

function fixture(values = new Map()) {
    const writes = [];
    const options = {analytics: {trackEvent() {}}, enabled: () => true,
        entitlement: () => ({ready: true, available: true, adsRemoved: false, offers: [{}]}),
        store: {getString: key => values.get(key), set: (key, value) => {
            writes.push([key, value]);
            values.set(key, value);
        }}};
    return {values, writes, options, nudge: new SupporterNudgeImpl(options)};
}

test('Home return eligibility records the first observation once and waits a full 24 hours across remounts', t => {
    t.mock.timers.enable({apis: ['Date'], now: START});
    const f = fixture();
    assert.equal(f.nudge.recordHomeVisit(), false);
    assert.equal(f.values.get('first_home_visit'), String(START));
    assert.equal(f.nudge.recordHomeVisit(), false);
    t.mock.timers.tick(5 * 60 * 60 * 1000);
    assert.equal(new SupporterNudgeImpl(f.options).recordHomeVisit(), false);
    t.mock.timers.tick(19 * 60 * 60 * 1000 - 1);
    assert.equal(f.nudge.recordHomeVisit(), false);
    t.mock.timers.tick(1);
    assert.deepEqual(f.writes, [['first_home_visit', String(START)]]);
    assert.equal(new SupporterNudgeImpl(f.options).recordHomeVisit(), true);
    t.mock.timers.tick(DAY_MS);
    assert.equal(f.nudge.recordHomeVisit(), true);
    assert.deepEqual(f.writes, [['first_home_visit', String(START)]]);
});

test('malformed and future Home observations restart the waiting period without qualifying', t => {
    t.mock.timers.enable({apis: ['Date'], now: START});
    for (const invalid of ['', 'invalid', 'NaN', 'Infinity', '-1', '0', '1.5', '1e3', ' 1',
        '9007199254740993', String(START + DAY_MS)]) {
        const f = fixture(new Map([['first_home_visit', invalid]]));
        assert.equal(f.nudge.recordHomeVisit(), false, invalid);
        assert.equal(f.values.get('first_home_visit'), String(START), invalid);
        assert.equal(f.nudge.recordHomeVisit(), false, invalid);
    }
    const f = fixture();
    assert.equal(f.nudge.recordHomeVisit(), false);
    t.mock.timers.setTime(START - DAY_MS);
    assert.equal(f.nudge.recordHomeVisit(), false);
    assert.equal(f.values.get('first_home_visit'), String(START - DAY_MS));
    t.mock.timers.tick(DAY_MS - 1);
    assert.equal(f.nudge.recordHomeVisit(), false);
    t.mock.timers.tick(1);
    assert.equal(f.nudge.recordHomeVisit(), true);
});

test('unreadable and unwritable Home observations cannot create return eligibility', t => {
    t.mock.timers.enable({apis: ['Date'], now: START});
    const unreadable = fixture(new Map([['first_home_visit', String(START - DAY_MS)]]));
    unreadable.options.store.getString = () => { throw new Error('storage unavailable'); };
    assert.equal(unreadable.nudge.recordHomeVisit(), false);
    assert.deepEqual(unreadable.writes, []);

    const unwritable = fixture();
    const write = unwritable.options.store.set;
    unwritable.options.store.set = () => { throw new Error('storage unavailable'); };
    assert.equal(unwritable.nudge.recordHomeVisit(), false);
    t.mock.timers.tick(DAY_MS);
    assert.equal(unwritable.nudge.recordHomeVisit(), false);
    assert.equal(unwritable.values.has('first_home_visit'), false);
    unwritable.options.store.set = write;
    assert.equal(unwritable.nudge.recordHomeVisit(), false);
    t.mock.timers.tick(DAY_MS);
    assert.equal(new SupporterNudgeImpl(unwritable.options).recordHomeVisit(), true);
});

test('Home observation and shared discovery dismissal preserve ad prompt limits', t => {
    t.mock.timers.enable({apis: ['Date'], now: START});
    const f = fixture();
    f.nudge.recordAdShown();
    f.nudge.recordAdShown();
    assert.equal(f.nudge.shouldPrompt(), true);
    const before = f.values.get('state');
    f.nudge.recordHomeVisit();
    f.nudge.dismissDiscovery();
    t.mock.timers.tick(DAY_MS);
    const restarted = new SupporterNudgeImpl(f.options);
    assert.equal(restarted.recordHomeVisit(), true);
    assert.equal(restarted.isDiscoveryDismissed(), true);
    assert.equal(restarted.shouldPrompt(), true);
    assert.equal(f.values.get('state'), before);
});

test('Home discovery and sign-in retain the bounded Home placement throughout the funnel', () => {
    const events = [];
    const sink = {trackEvent: (name, params) => events.push({name, params})};
    const placement = 'home_supporter';
    for (const step of ['discovery_view', 'discovery_opened', 'discovery_dismissed',
        'sign_in_started', 'sign_in_finished']) {
        trackSubscriptionFunnel(sink, {step, placement, outcome: 'signed_in'}, {platform: 'web', country: 'in'});
    }
    assert.deepEqual(events.map(event => event.name), ['supporter_discovery_view', 'supporter_discovery_opened',
        'supporter_discovery_dismissed', 'supporter_sign_in_started', 'supporter_sign_in_finished']);
    assert.ok(events.every(({params}) => params.placement === placement));
    assert.equal(events.at(-1).params.reason, 'signed_in');
});

test('the funnel report preserves Home placement and keeps unknown placements bounded', async () => {
    const {buildReportPlan, normalizeReportPage} = await import('../scripts/subscription-funnel-report.mjs');
    const plan = buildReportPlan({dimensions: [{apiName: 'customEvent:placement'}]},
        {startDate: '2026-10-01', endDate: '2026-10-09'});
    const rows = ['home_supporter', 'private placement'].map(placement => ({
        dimensionValues: ['20261009', 'web', 'IN', 'supporter_discovery_view', placement].map(value => ({value})),
        metricValues: [{value: '2'}, {value: '1'}],
    }));
    const report = normalizeReportPage({dimensionHeaders: plan.request.dimensions,
        metricHeaders: plan.request.metrics, rows}, plan);
    assert.deepEqual(report.map(row => row.placement), ['home_supporter', 'not_set']);
    assert.doesNotMatch(JSON.stringify(report), /private/);
});
