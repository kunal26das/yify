import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const PROPERTY_ID = '292918173';
export const FUNNEL_EVENTS = Object.freeze([
    'watchlist_activation', 'streaming_country_selected', 'streaming_services_saved',
    'watch_option_opened', 'availability_alert_changed', 'supporter_prompt',
    'supporter_offers_visible', 'remove_ads_purchase_start', 'remove_ads_purchase_done',
    'remove_ads_purchase_failed', 'supporter_paywall_closed',
]);
export const JOURNAL_ACTIONS = Object.freeze([
    'opened', 'picker_opened', 'entry_created', 'entry_updated', 'entry_saved',
    'entry_deleted', 'insights_opened', 'upgrade_opened',
]);
const JOURNAL_EVENTS = Object.freeze(['journal_action']);
const MAX_ROWS = 100000;
const PAGE_SIZE = 10000;
const API = `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}`;
const PLACEMENTS = new Set(['settings_supporter', 'post_ad_supporter', 'journal_insights', 'watchlist_supporter', 'supporter_page']);
const REASONS = new Set(['cancelled', 'already_purchased', 'pending', 'not_granted', 'offer_unavailable', 'restore_failed', 'unknown']);
const FUNNEL_VERSION_VALUES = Object.freeze(['v1', '1']);

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
        fieldName: 'customEvent:funnel_version', inListFilter: {values: [...FUNNEL_VERSION_VALUES], caseSensitive: true},
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

export function buildJournalReportPlan(metadata, dateRange) {
    const available = new Set((metadata?.dimensions ?? []).map(dimension => dimension.apiName));
    const platform = available.has('customEvent:app_platform') ? 'customEvent:app_platform' : 'platform';
    // Journal events intentionally contain no viewing country or funnel_version.
    const dimensions = ['date', platform, 'countryId', 'eventName'];
    const actionDimension = available.has('customEvent:action') ? 'customEvent:action' : null;
    if (actionDimension) dimensions.push(actionDimension);
    return {
        kind: 'journal',
        platformDimension: platform,
        countryDimension: 'countryId',
        versionFiltered: false,
        actionDimension,
        request: {
            dateRanges: [dateRange],
            dimensions: dimensions.map(name => ({name})),
            metrics: [{name: 'eventCount'}, {name: 'totalUsers'}],
            dimensionFilter: {filter: {fieldName: 'eventName', inListFilter: {values: [...JOURNAL_EVENTS], caseSensitive: true}}},
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
    const events = plan.kind === 'journal' ? JOURNAL_EVENTS : FUNNEL_EVENTS;
    if (!Array.isArray(response.rows ?? []) || (response.rows?.length ?? 0) > PAGE_SIZE) {
        throw new Error('GA4 returned an invalid or oversized report page.');
    }
    return (response.rows ?? []).map(row => {
        const dimensions = Object.fromEntries(dimensionNames.map((name, index) => [name, row.dimensionValues?.[index]?.value]));
        const date = dimensions.date;
        const eventName = dimensions.eventName;
        if (!/^\d{8}$/.test(date ?? '') || !events.includes(eventName)) throw new Error('GA4 returned an unexpected event or date.');
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
        if (dimensionNames.includes('customEvent:saved_milestone')) normalized.savedMilestone = bounded(dimensions['customEvent:saved_milestone'], new Set(['one', 'three', '1', '3']));
        if (plan.kind === 'journal') {
            const action = plan.actionDimension ? dimensions[plan.actionDimension] : undefined;
            normalized.action = JOURNAL_ACTIONS.includes(action) ? action : 'unknown';
        }
        return normalized;
    });
}

export async function collectReport({metadata, readPage, dateRange, source = 'ga4'}) {
    return collectPlannedReport({plan: buildReportPlan(metadata, dateRange), readPage, dateRange, source});
}

export async function collectJournalReport({metadata, readPage, dateRange, source = 'ga4'}) {
    return collectPlannedReport({plan: buildJournalReportPlan(metadata, dateRange), readPage, dateRange, source});
}

async function collectPlannedReport({plan, readPage, dateRange, source}) {
    const journal = plan.kind === 'journal';
    const rows = [];
    const warnings = new Set();
    if (!journal && !plan.versionFiltered) warnings.add('funnel_version is not registered: legacy prompt/checkout events may be included. This is not a version-1 funnel baseline.');
    if (!journal) warnings.add('Earlier clients sent numeric funnel_version and saved_milestone values and boolean checkout/access values. App custom dimensions may omit these values; accepted legacy values cannot recover unavailable history. Establish a baseline after string-valued events and custom definitions are validated.');
    if (!journal && plan.countryDimension === 'countryId') warnings.add('viewing_country is not registered: country is GA4 activity country, not viewing country or billing country.');
    if (journal && !plan.actionDimension) warnings.add('action is not registered: journal action breakdown, first-entry activity and later-day use are unknown; aggregate journal events cannot substitute for them.');
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
    if (journal && plan.actionDimension && rows.some(row => row.action === 'unknown')) {
        warnings.add('Some journal actions are missing or unrecognized and are reported as unknown, not attributed to a known action.');
    }
    if (journal && rows.some(row => row.action === 'entry_saved')) {
        warnings.add('Legacy entry_saved combines creates and edits; do not treat it as entry_created or a first journal entry.');
    }
    return {
        source,
        propertyId: PROPERTY_ID,
        dateRange,
        timezone,
        versionFilter: plan.versionFiltered ? 1 : null,
        ...(!journal ? {versionFilterValues: plan.versionFiltered ? [...FUNNEL_VERSION_VALUES] : null} : {}),
        countryMeaning: plan.countryDimension === 'customEvent:viewing_country' ? 'selected_viewing_country' : 'ga4_activity_country',
        dimensions: plan.request.dimensions.map(dimension => dimension.name),
        ...(journal ? {report: 'journal', actionDimension: plan.actionDimension,
            actionBreakdown: plan.actionDimension ? 'available' : 'unknown',
            unobservedActions: plan.actionDimension ? JOURNAL_ACTIONS.filter(action => !rows.some(row => row.action === action)) : null} : {}),
        interpretation: {
            eventCount: 'Number of observed events in this row.',
            eventUsers: 'Distinct GA4 users for this row only; do not sum across dates, events or segments.',
            cohortConversion: 'Not calculated: these rows do not establish user-level order, cohort conversion or paid subscriptions.',
            subscriptions: 'Use RevenueCat production cohorts for paid subscriptions, renewals, revenue and refunds.',
            ...(journal ? {
                action: 'Only allowlisted journal_action values; unknown means missing, unregistered or unrecognized action, not zero activity.',
                firstEntry: 'Not calculated: entry_created counts successful creates, including repeat entries; per-row users are not first-ever journal users.',
                laterDayUse: 'Not calculated: daily aggregate users cannot establish that the same user returned on a later day. Use a dated user-level cohort analysis.',
                country: 'GA4 activity country; journal events do not send viewing or billing country.',
            } : {}),
        },
        warnings: [...warnings],
        unobservedEvents: (journal ? JOURNAL_EVENTS : FUNNEL_EVENTS).filter(name => !rows.some(row => row.eventName === name)),
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
            process.stdout.write('node scripts/subscription-funnel-report.mjs [--report funnel|journal|all] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--fixture path.json]\nDefaults to the existing funnel report. Journal uses a separate query without funnel_version.\nLive reads use GA4_ACCESS_TOKEN; no token is accepted on the command line.\n');
            return;
        }
        if (!['--from', '--to', '--fixture', '--report'].includes(flag) || !argv[index + 1] || argv[index + 1].startsWith('--')) throw new Error('Use --help for supported report arguments.');
        options[flag.slice(2)] = argv[++index];
    }
    const dateRange = reportDateRange(options.from, options.to);
    const reportNames = options.report === 'all' ? ['funnel', 'journal'] : [options.report ?? 'funnel'];
    if (reportNames.some(name => !['funnel', 'journal'].includes(name))) throw new Error('Choose report funnel, journal or all.');
    let metadata, source, readPageFor;
    if (options.fixture) {
        let fixture;
        try { fixture = JSON.parse(await readFile(options.fixture, 'utf8')); }
        catch { throw new Error('The offline fixture could not be read.'); }
        metadata = fixture.metadata;
        source = 'offline_fixture';
        readPageFor = name => {
            let page = 0;
            const pages = name === 'journal' ? fixture.journalPages : fixture.pages;
            return async () => {
                const next = pages?.[page++];
                if (!next) throw new Error('The offline fixture has no report page.');
                return next;
            };
        };
    } else {
        const reader = ga4Reader(env.GA4_ACCESS_TOKEN);
        metadata = await reader.metadata();
        source = 'ga4';
        readPageFor = () => reader.readPage;
    }
    const reports = {};
    for (const name of reportNames) {
        reports[name] = await (name === 'journal' ? collectJournalReport : collectReport)({metadata,
            readPage: readPageFor(name), dateRange, source});
    }
    const report = reportNames.length === 1 ? reports[reportNames[0]] : {source, propertyId: PROPERTY_ID, dateRange, reports};
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        process.stderr.write(error instanceof Error ? error.message + '\n' : 'The report failed.\n');
        process.exitCode = 1;
    });
}
