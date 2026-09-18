const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readFileSync} = require('node:fs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');

const script = import('../scripts/subscription-funnel-report.mjs');
const fixturePath = path.join(__dirname, 'fixtures/subscription-funnel-report.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
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
    assert.equal(report.countryMeaning, 'selected_viewing_country');
    assert.deepEqual(report.rows[0], {date: '2026-09-19', platform: 'android', country: 'IN',
        eventName: 'supporter_offers_visible', eventCount: 12, eventUsers: 8, placement: 'settings_supporter'});
    assert.equal('totalUsers' in report, false);
    assert.equal('conversionRate' in report, false);
    assert.match(report.interpretation.eventUsers, /do not sum/);
    assert.match(report.interpretation.cohortConversion, /Not calculated/);
    assert.equal(requests[0].dimensionFilter.andGroup.expressions[1].filter.stringFilter.value, '1');
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
    assert.ok(report.warnings.some(message => message.includes('legacy')));
    assert.ok(report.warnings.some(message => message.includes('not confirmed zeros')));
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
