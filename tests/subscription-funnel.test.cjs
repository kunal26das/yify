const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

const {trackSubscriptionFunnel} = loadTypeScript('domain/policies/subscriptionFunnel.ts');
const {WatchlistRepositoryImpl} = loadTypeScript('data/repositories/WatchlistRepositoryImpl.ts');
const movie = id => ({id, title: 'private title', titleLong: 'private title', imdbCode: `tt${id}`,
    year: 2026, rating: 7, runtimeMinutes: 90, genres: ['Drama'], summary: '', language: 'en', posterUrls: []});

function fixture() {
    const events = [];
    const analytics = {trackEvent: (name, params) => events.push({name, params})};
    const values = new Map();
    const store = {getString: key => values.get(key), set: (key, value) => values.set(key, value)};
    const context = () => ({platform: 'android', country: 'in'});
    return {events, analytics, store, values, context, repository: new WatchlistRepositoryImpl(store, analytics, context)};
}

test('checkout events preserve existing event names and safe placement without money or identity fields', () => {
    const f = fixture();
    const offer = {placement: 'post_ad_supporter', recurring: true, billingPeriod: 'P1M',
        id: 'private-package', title: 'private title', priceLabel: '₹99', email: 'private@example.test'};
    trackSubscriptionFunnel(f.analytics, {step: 'checkout_started', offer, rawUid: 'private-user'}, f.context());
    trackSubscriptionFunnel(f.analytics, {step: 'checkout_finished', offer, outcome: 'granted'}, f.context());
    trackSubscriptionFunnel(f.analytics, {step: 'checkout_finished', offer, outcome: 'pending'}, f.context());
    assert.deepEqual(f.events, [
        {name: 'remove_ads_purchase_start', params: {funnel_version: 1, app_platform: 'android', viewing_country: 'IN', placement: 'post_ad_supporter', plan_kind: 'monthly'}},
        {name: 'remove_ads_purchase_done', params: {funnel_version: 1, app_platform: 'android', viewing_country: 'IN', placement: 'post_ad_supporter', plan_kind: 'monthly', granted: true}},
        {name: 'remove_ads_purchase_failed', params: {funnel_version: 1, app_platform: 'android', viewing_country: 'IN', placement: 'post_ad_supporter', plan_kind: 'monthly', reason: 'pending'}},
    ]);
    assert.doesNotMatch(JSON.stringify(f.events), /private|price|revenue|currency|transaction|email|uid|renewal/);
});

test('runtime metadata is allowlisted and malformed payloads cannot leak or fabricate funnel events', () => {
    const f = fixture();
    trackSubscriptionFunnel(f.analytics, {step: 'checkout_finished', outcome: 'private server message',
        offer: {placement: 'private-user-id', recurring: true, billingPeriod: 'private-title'}}, {platform: 'private-browser', country: 'private@example.test'});
    assert.deepEqual(f.events[0], {name: 'remove_ads_purchase_failed', params: {
        funnel_version: 1, app_platform: 'other', placement: 'unknown', plan_kind: 'recurring', reason: 'unknown',
    }});
    for (const event of [{step: 'purchase', revenue: 99}, {step: 'offers_visible', placement: 'settings_supporter', offerCount: 0},
        {step: 'watchlist_milestone', milestone: 2}, {step: 'streaming_services_saved', selectedCount: Infinity},
        {step: 'watch_option_opened', mediaType: 'private title', source: 'details'}]) {
        trackSubscriptionFunnel(f.analytics, event, f.context());
    }
    assert.equal(f.events.length, 1);
});

test('service selection counts are coarse and analytics failures cannot block the user action', () => {
    const f = fixture();
    for (const selectedCount of [0, 1, 3, 50]) trackSubscriptionFunnel(f.analytics,
        {step: 'streaming_services_saved', selectedCount, services: ['private-service-id']}, f.context());
    assert.deepEqual(f.events.map(event => event.params.service_count), ['none', 'one', 'two_to_three', 'four_plus']);
    assert.doesNotMatch(JSON.stringify(f.events), /private/);
    assert.doesNotThrow(() => trackSubscriptionFunnel({trackEvent() {throw new Error('unavailable analytics');}},
        {step: 'watchlist_milestone', milestone: 1}, f.context()));
});

test('watchlist activation records first and third local saves once across removal and restart', () => {
    const f = fixture();
    f.repository.add(movie(1));
    f.repository.add(movie(1));
    f.repository.add(movie(2));
    f.repository.add(movie(3));
    f.repository.remove(3);
    f.repository.add(movie(3));
    f.repository.clear();
    const restarted = new WatchlistRepositoryImpl(f.store, f.analytics, f.context);
    restarted.add(movie(4));
    restarted.add(movie(5));
    restarted.add(movie(6));
    assert.deepEqual(f.events.map(event => [event.name, event.params.saved_milestone]),
        [['watchlist_activation', 1], ['watchlist_activation', 3]]);
    assert.doesNotMatch(JSON.stringify(f.events), /private|tt[0-9]|movie_id|title/);
});

test('sync and cached watchlists do not manufacture activation milestones', () => {
    const f = fixture();
    f.repository.applyRemote([movie(1), movie(2), movie(3)]);
    f.repository.getAll();
    f.repository.add(movie(4));
    assert.deepEqual(f.events, []);
    assert.equal(f.repository.getAll().length, 4);
});

test('failed analytics and marker writes leave a successfully saved title intact', () => {
    const f = fixture();
    const repository = new WatchlistRepositoryImpl({
        ...f.store, set(key, value) {if (key === 'funnel_saved_milestones_v1') throw new Error('storage full'); f.store.set(key, value);},
    }, f.analytics, f.context);
    assert.doesNotThrow(() => repository.add(movie(1)));
    assert.equal(repository.contains(1), true);
    assert.deepEqual(f.events, []);
});
