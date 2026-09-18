import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const PROPERTY_ID = '292918173';
export const FUNNEL_EVENTS = Object.freeze([
    'watchlist_activation', 'streaming_country_selected', 'streaming_services_saved',
    'watch_option_opened', 'availability_alert_changed', 'supporter_prompt',
    'supporter_offers_visible', 'remove_ads_purchase_start', 'remove_ads_purchase_done',
    'remove_ads_purchase_failed', 'supporter_paywall_closed',
]);
const MAX_ROWS = 100000;
const PAGE_SIZE = 10000;
const API = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}`;
const PLACEMENTS = new Set(['settings_supporter', 'post_ad_supporter']);
const REASONS = new Set(['cancelled', 'already_purchased', 'pending', 'not_granted', 'offer_unavailable', 'restore_failed', 'unknown']);

function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function reportDateRange(from, to, now = new Date()) {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const endDate = to ?? yesterday.toISOString().slice(0, 10);
    if (!validDate(endDate)) throw new Error('Use valid YYYY-MM-DD dates.');
    const start = new Date(endDate);
    start.setUTCDate(start.getUTCDate() - 27);
    const startDate = from ?? start.toISOString().slice(0, 10);
    if (!validDate(startDate) || startDate > endDate) throw new Error('Use a valid date range with from before or equal to to.');
    return {startDate, endDate};
}

export function buildReportPlan(metadata, dateRange) {
    const available = new Set((metadata?.dimensions ?? []).map(dimension => dimension.apiName));
    const platform = available.has('customEvent:app_platform') ? 'customEvent:app_platform' : 'platform';
    const country = available.has('customEvent:viewing_country') ? 'customEvent:viewing_country' : 'countryId';
    const dimensions = ['date', platform, country, 'eventName'];
    const optional = ['placement', 'granted', 'reason', 'saved_milestone'];
    for (const parameter of optional) {
        if (available.has(`customEvent:${parameter}`)) dimensions.push(`customEvent:${parameter}`);
    }
    const versionFiltered = available.has('customEvent:funnel_version');
    const expressions = [{filter: {fieldName: 'eventName', inListFilter: {values: [...FUNNEL_EVENTS], caseSensitive: true}}}];
    if (versionFiltered) expressions.push({filter: {
        fieldName: 'customEvent:funnel_version', stringFilter: {matchType: 'EXACT', value: '1', caseSensitive: true},
    }});
    return {
        platformDimension: platform,
        countryDimension: country,
        versionFiltered,
        request: {
            dateRanges: [dateRange],
            dimensions: dimensions.map(name => ({name})),
            metrics: [{name: 'eventCount'}, {name: 'totalUsers'}],
            dimensionFilter: {andGroup: {expressions}},
            orderBys: dimensions.map(dimensionName => ({dimension: {dimensionName}})),
            keepEmptyRows: false,
            limit: PAGE_SIZE,
        },
    };
}

function integer(value) {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('GA4 returned an invalid count.');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error('GA4 returned a count outside the supported range.');
    return parsed;
}

function bounded(value, allowed) {
    return allowed.has(value) ? value : 'not_set';
}

export function normalizeReportPage(response, plan) {
    const dimensionNames = response?.dimensionHeaders?.map(header => header.name) ?? [];
    const metricNames = response?.metricHeaders?.map(header => header.name) ?? [];
    const expected = plan.request.dimensions.map(dimension => dimension.name);
    if (JSON.stringify(dimensionNames) !== JSON.stringify(expected) || JSON.stringify(metricNames) !== JSON.stringify(['eventCount', 'totalUsers'])) {
        throw new Error('GA4 returned unexpected report columns.');
    }
    return (response.rows ?? []).map(row => {
        const dimensions = Object.fromEntries(dimensionNames.map((name, index) => [name, row.dimensionValues?.[index]?.value]));
        const date = dimensions.date;
        const eventName = dimensions.eventName;
        if (!/^\d{8}$/.test(date ?? '') || !FUNNEL_EVENTS.includes(eventName)) throw new Error('GA4 returned an unexpected event or date.');
        const country = dimensions[plan.countryDimension];
        const platform = String(dimensions[plan.platformDimension] ?? '').toLowerCase();
        const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        const range = plan.request.dateRanges[0];
        if (!validDate(formattedDate) || formattedDate < range.startDate || formattedDate > range.endDate) throw new Error('The report contains dates outside the requested range.');
        const normalized = {
            date: formattedDate,
            platform: bounded(platform, new Set(['android', 'ios', 'web', 'other'])),
            country: /^[A-Z]{2}$/.test(country ?? '') ? country : 'not_set',
            eventName,
            eventCount: integer(row.metricValues?.[0]?.value),
            eventUsers: integer(row.metricValues?.[1]?.value),
        };
        if (dimensionNames.includes('customEvent:placement')) normalized.placement = bounded(dimensions['customEvent:placement'], PLACEMENTS);
        if (dimensionNames.includes('customEvent:granted')) normalized.granted = bounded(dimensions['customEvent:granted'], new Set(['true', 'false', '1', '0']));
        if (dimensionNames.includes('customEvent:reason')) normalized.reason = bounded(dimensions['customEvent:reason'], REASONS);
        if (dimensionNames.includes('customEvent:saved_milestone')) normalized.savedMilestone = bounded(dimensions['customEvent:saved_milestone'], new Set(['1', '3']));
        return normalized;
    });
}

export async function collectReport({metadata, readPage, dateRange, source = 'ga4'}) {
    const plan = buildReportPlan(metadata, dateRange);
    const rows = [];
    const warnings = new Set();
    if (!plan.versionFiltered) warnings.add('funnel_version is not registered: legacy prompt/checkout events may be included. This is not a version-1 funnel baseline.');
    if (plan.countryDimension === 'countryId') warnings.add('viewing_country is not registered: country is GA4 activity country, not viewing country or billing country.');
    let expectedRows;
    let timezone = null;
    do {
        const response = await readPage({...plan.request, offset: rows.length});
        const count = Number(response.rowCount ?? 0);
        if (!Number.isSafeInteger(count) || count < 0 || count > MAX_ROWS) throw new Error('Report row limit exceeded or invalid; request a shorter date range.');
        if (expectedRows !== undefined && count !== expectedRows) throw new Error('GA4 rows changed during pagination; rerun for completed dates.');
        expectedRows = count;
        const page = normalizeReportPage(response, plan);
        if (page.length === 0 && rows.length < expectedRows) throw new Error('GA4 returned an incomplete report.');
        rows.push(...page);
        if (rows.length > expectedRows) throw new Error('GA4 returned inconsistent row counts.');
        if (response.metadata?.subjectToThresholding) warnings.add('GA4 privacy thresholds may suppress rows; absent events are not confirmed zeros.');
        if (response.metadata?.dataLossFromOtherRow) warnings.add('GA4 grouped some data into an other row; this report is not complete.');
        if (response.metadata?.samplingMetadatas?.length) warnings.add('GA4 sampled this report; counts are estimates.');
        const reportedTimezone = response.metadata?.timeZone;
        if (typeof reportedTimezone === 'string' && /^[A-Za-z_+\-/0-9]{1,80}$/.test(reportedTimezone)) timezone = reportedTimezone;
    } while (rows.length < expectedRows);
    return {
        source,
        propertyId: PROPERTY_ID,
        dateRange,
        timezone,
        versionFilter: plan.versionFiltered ? 1 : null,
        countryMeaning: plan.countryDimension === 'customEvent:viewing_country' ? 'selected_viewing_country' : 'ga4_activity_country',
        dimensions: plan.request.dimensions.map(dimension => dimension.name),
        interpretation: {
            eventCount: 'Number of observed events in this row.',
            eventUsers: 'Distinct GA4 users for this row only; do not sum across dates, events or segments.',
            cohortConversion: 'Not calculated: these rows do not establish user-level order, cohort conversion or paid subscriptions.',
            subscriptions: 'Use RevenueCat production cohorts for paid subscriptions, renewals, revenue and refunds.',
        },
        warnings: [...warnings],
        unobservedEvents: FUNNEL_EVENTS.filter(name => !rows.some(row => row.eventName === name)),
        rows,
    };
}

export function ga4Reader(accessToken, fetcher = fetch) {
    if (typeof accessToken !== 'string' || !accessToken.trim() || /[\r\n]/.test(accessToken)) throw new Error('Supply a short-lived GA4_ACCESS_TOKEN with analytics.readonly scope and access to property 292918173.');
    async function request(suffix, body) {
        let response;
        try {
            response = await fetcher(API + suffix, {
                method: body ? 'POST' : 'GET',
                headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
                ...(body ? {body: JSON.stringify(body)} : {}),
                redirect: 'error',
                signal: AbortSignal.timeout(30000),
            });
        } catch {
            throw new Error('GA4 request could not complete; check connectivity and retry.');
        }
        if (!response.ok) throw new Error(`GA4 request failed (HTTP ${response.status}); check token scope, property access and API availability.`);
        try { return await response.json(); }
        catch { throw new Error('GA4 returned an unreadable response.'); }
    }
    return {metadata: () => request('/metadata'), readPage: body => request(':runReport', body)};
}

export async function main(argv = process.argv.slice(2), env = process.env) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const flag = argv[index];
        if (flag === '--help') {
            process.stdout.write('node scripts/subscription-funnel-report.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--fixture path.json]\nLive reads use GA4_ACCESS_TOKEN; no token is accepted on the command line.\n');
            return;
        }
        if (!['--from', '--to', '--fixture'].includes(flag) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('Use --help for supported report arguments.');
        options[flag.slice(2)] = argv[++index];
    }
    const dateRange = reportDateRange(options.from, options.to);
    let report;
    if (options.fixture) {
        let fixture;
        try { fixture = JSON.parse(await readFile(options.fixture, 'utf8')); }
        catch { throw new Error('The offline fixture could not be read.'); }
        let page = 0;
        report = await collectReport({metadata: fixture.metadata, dateRange, source: 'offline_fixture',
            readPage: async () => {
                const next = fixture.pages?.[page++];
                if (!next) throw new Error('The offline fixture has no report page.');
                return next;
            }});
    } else {
        const reader = ga4Reader(env.GA4_ACCESS_TOKEN);
        report = await collectReport({metadata: await reader.metadata(), readPage: reader.readPage, dateRange});
    }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        process.stderr.write(error instanceof Error ? error.message + '\n' : 'The report failed.\n');
        process.exitCode = 1;
    });
}
