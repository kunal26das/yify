const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');

const script = import('../scripts/subscription-funnel-report.mjs');
const fixturePath = path.join(__dirname, 'fixtures/subscription-funnel-report.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const journalFixturePath = path.join(__dirname, 'fixtures/journal-funnel-report.json');
const journalFixture = JSON.parse(readFileSync(journalFixturePath, 'utf8'));
const dateRange = {startDate: '2026-09-01', endDate: '2026-09-30'};

test('report keeps event counts separate from per-row users and never invents totals or conversion', async () => {
    const {collectReport} = await script;
    const requests = [];
    const report = await collectReport({metadata: fixture.metadata, dateRange, source: 'offline_fixture', readPage: async request => {
        requests.push(request);
        return fixture.pages[0];
    }});
    assert.equal(report.source, 'offline_fixture');
    assert.equal(report.versionFilter, 1);
    assert.deepEqual(report.versionFilterValues, ['v1', '1']);
    assert.equal(report.countryMeaning, 'selected_viewing_country');
    assert.deepEqual(report.rows[0], {date: '2026-09-19', platform: 'android', country: 'IN',
        eventName: 'supporter_offers_visible', eventCount: 12, eventUsers: 8, placement: 'settings_supporter'});
    assert.equal('totalUsers' in report, false);
    assert.equal('conversionRate' in report, false);
    assert.match(report.interpretation.eventUsers, /do not sum/);
    assert.match(report.interpretation.cohortConversion, /Not calculated/);
    assert.deepEqual(requests[0].dimensionFilter.andGroup.expressions[1].filter,
        {fieldName: 'customEvent:funnel_version', inListFilter: {values: ['v1', '1'], caseSensitive: true}});
    assert.deepEqual(requests[0].metrics, [{name: 'eventCount'}, {name: 'totalUsers'}]);
    assert.ok(report.unobservedEvents.includes('remove_ads_purchase_done'));
});

test('unregistered fields use explicit GA4 platform/activity-country fallback and disclose legacy events', async () => {
    const {buildReportPlan, collectReport} = await script;
    const plan = buildReportPlan({dimensions: []}, dateRange);
    assert.deepEqual(plan.request.dimensions.map(value => value.name), ['date', 'platform', 'countryId', 'eventName']);
    assert.equal(plan.versionFiltered, false);
    const report = await collectReport({metadata: {dimensions: []}, dateRange, readPage: async () => ({
        dimensionHeaders: plan.request.dimensions, metricHeaders: plan.request.metrics, rowCount: 0,
        metadata: {subjectToThresholding: true},
    })});
    assert.equal(report.countryMeaning, 'ga4_activity_country');
    assert.equal(report.rows.length, 0);
    assert.equal(report.versionFilterValues, null);
    assert.ok(report.warnings.some(message => message.includes('legacy')));
    assert.ok(report.warnings.some(message => message.includes('not confirmed zeros')));
});

test('report preserves new and legacy categorical values without inventing missing app history', async () => {
    const {buildReportPlan, normalizeReportPage, collectReport} = await script;
    const metadata = {dimensions: [...fixture.metadata.dimensions,
        {apiName: 'customEvent:granted'}, {apiName: 'customEvent:saved_milestone'}]};
    const plan = buildReportPlan(metadata, dateRange);
    const values = [['true', 'one'], ['false', 'three'], ['1', '1'], ['0', '3'], ['private value', 'private milestone']];
    const page = {
        dimensionHeaders: plan.request.dimensions,
        metricHeaders: plan.request.metrics,
        rowCount: values.length,
        rows: values.map(([granted, milestone]) => ({
            dimensionValues: ['20260919', 'android', 'IN', 'watchlist_activation', 'settings_supporter', granted, milestone].map(value => ({value})),
            metricValues: [{value: '1'}, {value: '1'}],
        })),
    };
    assert.deepEqual(normalizeReportPage(page, plan).map(({granted, savedMilestone}) => [granted, savedMilestone]),
        [...values.slice(0, 4), ['not_set', 'not_set']]);
    const report = await collectReport({metadata, dateRange, readPage: async () => page});
    assert.ok(report.warnings.some(warning => /cannot recover unavailable history/.test(warning)));
    assert.doesNotMatch(JSON.stringify(report), /private value|private milestone/);
});

test('pagination is complete and never treats an omitted or changed page as a zero', async () => {
    const {collectReport} = await script;
    const first = {...fixture.pages[0], rowCount: 2, rows: fixture.pages[0].rows.slice(0, 1)};
    const last = {...fixture.pages[0], rowCount: 2, rows: fixture.pages[0].rows.slice(1, 2)};
    const offsets = [];
    const report = await collectReport({metadata: fixture.metadata, dateRange, readPage: async request => {
        offsets.push(request.offset); return request.offset === 0 ? first : last;
    }});
    assert.equal(report.rows.length, 2);
    assert.deepEqual(offsets, [0, 1]);
    await assert.rejects(collectReport({metadata: fixture.metadata, dateRange, readPage: async () => ({...first, rows: []})}), /incomplete/);
    await assert.rejects(collectReport({metadata: fixture.metadata, dateRange, readPage: async () => ({...first, rowCount: 100001})}), /row limit/);
});

test('report allowlists dimension values and rejects invalid counts, headers and fixture dates', async () => {
    const {buildReportPlan, normalizeReportPage} = await script;
    const plan = buildReportPlan(fixture.metadata, dateRange);
    const page = structuredClone(fixture.pages[0]);
    page.rows[0].dimensionValues[1].value = 'private user';
    page.rows[0].dimensionValues[2].value = 'private@example.test';
    page.rows[0].dimensionValues[4].value = 'private placement';
    assert.doesNotMatch(JSON.stringify(normalizeReportPage(page, plan)), /private/);
    page.rows[0].metricValues[0].value = 'NaN';
    assert.throws(() => normalizeReportPage(page, plan), /invalid count/);
    assert.throws(() => normalizeReportPage({...page, dimensionHeaders: []}, plan), /unexpected report columns/);
    assert.throws(() => normalizeReportPage(fixture.pages[0], buildReportPlan(fixture.metadata, {startDate: '2026-08-01', endDate: '2026-08-31'})), /outside/);
});

test('live reader sends a bearer only to the fixed GA4 property and redacts API and transport errors', async () => {
    const {ga4Reader} = await script;
    const token = 'private-short-lived-token';
    const requests = [];
    const reader = ga4Reader(token, async (url, options) => {
        requests.push({url, options});
        return {ok: true, json: async () => ({dimensions: []})};
    });
    await reader.metadata();
    await reader.readPage({limit: 10});
    assert.equal(requests[0].url, 'https://analyticsdata.googleapis.com/v1beta/properties/292918173/metadata');
    assert.equal(requests[1].url, 'https://analyticsdata.googleapis.com/v1beta/properties/292918173:runReport');
    assert.equal(requests[0].options.headers.Authorization, `Bearer ${token}`);
    assert.equal(requests[0].options.redirect, 'error');
    await assert.rejects(ga4Reader(token, async () => {throw new Error(token);}).metadata(), error => !error.message.includes(token));
    await assert.rejects(ga4Reader(token, async () => ({ok: false, status: 403, json: async () => ({error: {message: token}})})).metadata(),
        error => /HTTP 403/.test(error.message) && !error.message.includes(token));
    assert.throws(() => ga4Reader(''), /short-lived/);
});

test('offline CLI needs no credentials and clearly labels its fabricated fixture data', () => {
    const result = spawnSync(process.execPath, ['scripts/subscription-funnel-report.mjs', '--fixture', fixturePath,
        '--from', '2026-09-01', '--to', '2026-09-30'], {cwd: path.join(__dirname, '..'), env: {...process.env, GA4_ACCESS_TOKEN: ''}, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).source, 'offline_fixture');
    assert.equal(JSON.parse(result.stdout).rows.length, 3);
});

test('date defaults use completed UTC dates and invalid dates fail without echoing arguments', async () => {
    const {reportDateRange} = await script;
    assert.deepEqual(reportDateRange(undefined, undefined, new Date('2026-09-19T10:00:00Z')),
        {startDate: '2026-08-22', endDate: '2026-09-18'});
    assert.throws(() => reportDateRange('private@example.test', '2026-09-30'), error => !error.message.includes('private'));
    assert.throws(() => reportDateRange('2026-02-30', '2026-09-30'), /valid/);
});

test('journal query includes actions without filtering them through funnel_version or viewing country', async () => {
    const {buildJournalReportPlan, collectJournalReport} = await script;
    const plan = buildJournalReportPlan(journalFixture.metadata, dateRange);
    assert.deepEqual(plan.request.dimensions.map(({name}) => name),
        ['date', 'customEvent:app_platform', 'countryId', 'eventName', 'customEvent:action']);
    assert.deepEqual(plan.request.dimensionFilter,
        {filter: {fieldName: 'eventName', inListFilter: {values: ['journal_action'], caseSensitive: true}}});
    assert.doesNotMatch(JSON.stringify(plan.request), /funnel_version|viewing_country/);
    assert.equal(plan.request.limit, 10000);
    const report = await collectJournalReport({metadata: journalFixture.metadata, dateRange, source: 'offline_fixture',
        readPage: async () => journalFixture.journalPages[0]});
    assert.equal(report.versionFilter, null);
    assert.equal(report.countryMeaning, 'ga4_activity_country');
    assert.equal(report.actionBreakdown, 'available');
    assert.deepEqual(report.rows[2], {date: '2026-09-20', platform: 'android', country: 'IN', eventName: 'journal_action',
        action: 'entry_created', eventCount: 4, eventUsers: 3});
    assert.match(report.interpretation.firstEntry, /Not calculated/);
    assert.match(report.interpretation.laterDayUse, /Not calculated/);
    assert.match(report.interpretation.eventUsers, /do not sum/);
    assert.ok(report.warnings.some(warning => /entry_saved combines creates and edits/.test(warning)));
    assert.equal('conversionRate' in report, false);
    assert.equal('totalUsers' in report, false);
});

test('unregistered action reports aggregate activity with an explicit unknown breakdown, not fabricated actions', async () => {
    const {buildJournalReportPlan, collectJournalReport} = await script;
    const metadata = {dimensions: [{apiName: 'customEvent:funnel_version'}]};
    const plan = buildJournalReportPlan(metadata, dateRange);
    const report = await collectJournalReport({metadata, dateRange, readPage: async () => ({
        dimensionHeaders: plan.request.dimensions, metricHeaders: plan.request.metrics, rowCount: 1,
        rows: [{dimensionValues: [{value: '20260920'}, {value: 'ANDROID'}, {value: 'IN'}, {value: 'journal_action'}],
            metricValues: [{value: '30'}, {value: '10'}]}],
    })});
    assert.equal(report.actionDimension, null);
    assert.equal(report.actionBreakdown, 'unknown');
    assert.equal(report.unobservedActions, null);
    assert.equal(report.rows[0].action, 'unknown');
    assert.equal(report.rows[0].eventCount, 30);
    assert.equal(report.rows[0].eventUsers, 10);
    assert.ok(report.warnings.some(warning => /action is not registered/.test(warning)));
    assert.ok(!report.warnings.some(warning => /legacy prompt/.test(warning)));
    assert.ok(!plan.request.dimensions.some(({name}) => name === 'customEvent:action'));
});

test('journal values never echo unknown actions, personal notes, identifiers or extra source fields', async () => {
    const {buildJournalReportPlan, normalizeReportPage, collectJournalReport} = await script;
    const page = structuredClone(journalFixture.journalPages[0]);
    page.rows = [page.rows[0]]; page.rowCount = 1;
    page.rows[0].dimensionValues[1].value = 'PRIVATE_PLATFORM';
    page.rows[0].dimensionValues[2].value = 'PRIVATE_COUNTRY';
    page.rows[0].dimensionValues[4].value = 'PRIVATE_NOTE with personal@example.test';
    page.rows[0].accountId = 'PRIVATE_UID';
    const plan = buildJournalReportPlan(journalFixture.metadata, dateRange);
    const normalized = normalizeReportPage(page, plan);
    assert.equal(normalized[0].action, 'unknown');
    assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE_|personal@example/);
    const report = await collectJournalReport({metadata: journalFixture.metadata, dateRange, readPage: async () => page});
    assert.ok(report.warnings.some(warning => /missing or unrecognized/.test(warning)));
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE_|personal@example/);
    page.rows[0].dimensionValues[3].value = 'supporter_offers_visible';
    assert.throws(() => normalizeReportPage(page, plan), /unexpected event/);
    page.rows[0].dimensionValues[3].value = 'journal_action';
    page.rows[0].metricValues[0].value = '-1';
    assert.throws(() => normalizeReportPage(page, plan), /invalid count/);
    assert.throws(() => normalizeReportPage({...page, rows: 'PRIVATE_ROW'}, plan), error =>
        /invalid or oversized/.test(error.message) && !error.message.includes('PRIVATE_ROW'));
});

test('journal pagination fails closed on truncation, changed counts and excessive pages', async () => {
    const {collectJournalReport, buildJournalReportPlan, normalizeReportPage} = await script;
    const first = {...journalFixture.journalPages[0], rowCount: 2, rows: journalFixture.journalPages[0].rows.slice(0, 1)};
    const last = {...first, rows: journalFixture.journalPages[0].rows.slice(1, 2)};
    const offsets = [];
    const report = await collectJournalReport({metadata: journalFixture.metadata, dateRange, readPage: async request => {
        offsets.push(request.offset); return request.offset === 0 ? first : last;
    }});
    assert.deepEqual(offsets, [0, 1]);
    assert.equal(report.rows.length, 2);
    await assert.rejects(collectJournalReport({metadata: journalFixture.metadata, dateRange,
        readPage: async request => request.offset === 0 ? first : {...last, rowCount: 3}}), /changed during pagination/);
    await assert.rejects(collectJournalReport({metadata: journalFixture.metadata, dateRange,
        readPage: async () => ({...first, rows: []})}), /incomplete/);
    await assert.rejects(collectJournalReport({metadata: journalFixture.metadata, dateRange,
        readPage: async () => ({...first, rowCount: 100001})}), /row limit/);
    assert.throws(() => normalizeReportPage({...first, rows: Array(10001).fill(first.rows[0])},
        buildJournalReportPlan(journalFixture.metadata, dateRange)), /oversized/);
});

test('journal report retains privacy, sampling and data-loss warnings instead of claiming missing actions are zero', async () => {
    const {collectJournalReport} = await script;
    const report = await collectJournalReport({metadata: journalFixture.metadata, dateRange, readPage: async () => ({
        ...journalFixture.journalPages[0], rows: [], rowCount: 0,
        metadata: {subjectToThresholding: true, dataLossFromOtherRow: true, samplingMetadatas: [{}], timeZone: 'PRIVATE invalid'},
    })});
    assert.ok(report.warnings.some(warning => /not confirmed zeros/.test(warning)));
    assert.ok(report.warnings.some(warning => /not complete/.test(warning)));
    assert.ok(report.warnings.some(warning => /estimates/.test(warning)));
    assert.equal(report.timezone, null);
    assert.doesNotMatch(JSON.stringify(report), /PRIVATE/);
});

test('journal paywall placement is preserved in the existing funnel report', async () => {
    const {collectReport} = await script;
    const report = await collectReport({metadata: journalFixture.metadata, dateRange, readPage: async () => journalFixture.pages[0]});
    assert.equal(report.rows[0].placement, 'journal_insights');
    assert.equal(report.rows[1].placement, 'journal_insights');
    assert.equal(report.versionFilter, 1);
    assert.equal(report.actionBreakdown, undefined);
});

test('offline CLI can output separate journal and funnel reports without combining users or requiring credentials', () => {
    const run = report => spawnSync(process.execPath, ['scripts/subscription-funnel-report.mjs', '--report', report,
        '--fixture', journalFixturePath, '--from', '2026-09-01', '--to', '2026-09-30'],
    {cwd: path.join(__dirname, '..'), env: {...process.env, GA4_ACCESS_TOKEN: ''}, encoding: 'utf8'});
    const journal = run('journal');
    assert.equal(journal.status, 0, journal.stderr);
    const journalResult = JSON.parse(journal.stdout);
    assert.equal(journalResult.source, 'offline_fixture');
    assert.equal(journalResult.report, 'journal');
    assert.equal(journalResult.rows.length, 8);
    const combined = run('all');
    assert.equal(combined.status, 0, combined.stderr);
    const result = JSON.parse(combined.stdout);
    assert.equal(result.source, 'offline_fixture');
    assert.equal(result.reports.funnel.versionFilter, 1);
    assert.deepEqual(result.reports.journal, journalResult);
    assert.equal('rows' in result, false);
    assert.equal('totalUsers' in result, false);
    const invalid = run('PRIVATE_REPORT_VALUE');
    assert.equal(invalid.status, 1);
    assert.doesNotMatch(invalid.stderr, /PRIVATE_REPORT_VALUE/);
});
