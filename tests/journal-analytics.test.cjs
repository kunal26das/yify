const assert = require('node:assert/strict');
const {test} = require('node:test');
const {loadTypeScript} = require('./helpers/load-typescript.cjs');

test('journal analytics only emit allowlisted actions, never journal contents', () => {
    const {Analytics, installAnalyticsSink} = loadTypeScript('presentation/analytics/events.ts', {
        'react-native': {Platform: {OS: 'android'}}, '@/domain': {},
    });
    const events = [];
    installAnalyticsSink({trackEvent: (name, params) => events.push({name, params})});
    for (const action of ['opened', 'picker_opened', 'entry_created', 'entry_updated', 'entry_saved', 'entry_deleted', 'insights_opened', 'upgrade_opened']) {
        Analytics.journal(action, {note: 'private note', rating: 9, movie: {title: 'private title'}, watchedOn: '2026-09-19'});
    }
    for (const action of ['private note', null, {note: 'private note'}]) Analytics.journal(action);
    assert.equal(events.length, 8);
    for (const event of events) {
        assert.equal(event.name, 'journal_action');
        assert.deepEqual(Object.keys(event.params).sort(), ['action', 'app_platform']);
        assert.equal(event.params.app_platform, 'android');
    }
    assert.doesNotMatch(JSON.stringify(events), /private|watchedOn|rating|movie/);
    installAnalyticsSink({trackEvent() {throw new Error('offline analytics');}});
    assert.doesNotThrow(() => Analytics.journal('entry_saved'));
});
