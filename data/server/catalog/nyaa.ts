import {DOMParser} from '@xmldom/xmldom';
import type {Document, Element, Node} from '@xmldom/xmldom';
import type {AnimeCategory, AnimeRelease} from '../../../domain/entities/AnimeRelease';
import type {AnimeRepository, ListAnimeParams, ListAnimeResult} from '../../../domain/repositories/AnimeRepository';
import {assertCatalogActive} from './cancellation';

const NYAA_NAMESPACE = 'https://nyaa.si/xmlns/nyaa';
export const NYAA_FEED_LIMIT = 75;
export const NYAA_MAX_BYTES = 1_000_000;
const CATEGORY_IDS: Record<AnimeCategory, string> = {
    all: '1_0', english: '1_2', 'non-english': '1_3', raw: '1_4', 'music-video': '1_1',
};
const CATEGORIES = new Map(Object.entries(CATEGORY_IDS).filter(([name]) => name !== 'all')
    .map(([name, id]) => [id, name as Exclude<AnimeCategory, 'all'>]));

/** Retained only while serving the request; never persisted or used as application state. */
export interface NyaaRecord {
    title: string;
    link: string;
    guid: string;
    pubDate: string;
    seeders: string;
    leechers: string;
    downloads: string;
    infoHash: string;
    categoryId: string;
    category: string;
    size: string;
    comments?: string;
    trusted?: string;
    remake?: string;
    description?: string;
}

export class NyaaFeedError extends Error {
    constructor(readonly code: 'invalid_feed' | 'http_error' | 'rate_limited' | 'response_type' | 'fetch_failed' | 'fetch_redirect' | 'fetch_cache' | 'fetch_context' | 'fetch_dns' | 'fetch_network' | 'fetch_runtime' | 'read_failed', readonly upstreamStatus?: number, readonly retryAfterSeconds?: number) {
        super('Anime releases are temporarily unavailable.');
        this.name = 'NyaaFeedError';
    }
}

export function nyaaRetryAfterSeconds(value: string | null, now: number): number {
    const header = value?.trim();
    if (!header || header.length > 128) return 60;
    if (/^\d+$/.test(header)) {
        const seconds = Number(header);
        return Number.isSafeInteger(seconds) ? seconds : 60;
    }
    // Only the HTTP-date format is accepted; permissive date parsing can treat bad headers as dates.
    if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(header)) return 60;
    const until = Date.parse(header);
    if (!Number.isFinite(until) || new Date(until).toUTCString() !== header) return 60;
    return Math.max(0, Math.ceil((until - now) / 1000));
}

function fetchFailure(error: unknown): NyaaFeedError {
    const message = error instanceof Error ? error.message : '';
    // Map known runtime failures to fixed codes without returning source text, URLs or query data.
    if (/redirect/i.test(message)) return new NyaaFeedError('fetch_redirect');
    if (/cache/i.test(message)) return new NyaaFeedError('fetch_cache');
    if (/I\/O|different request/i.test(message)) return new NyaaFeedError('fetch_context');
    if (/DNS|resolv/i.test(message)) return new NyaaFeedError('fetch_dns');
    if (/network|connection|TLS|SSL|certificate/i.test(message)) return new NyaaFeedError('fetch_network');
    if (/illegal invocation|unsupported|not implemented/i.test(message)) return new NyaaFeedError('fetch_runtime');
    return new NyaaFeedError('fetch_failed');
}

function invalid(): never {
    // Never include provider-controlled text in an exception or diagnostic.
    throw new NyaaFeedError('invalid_feed');
}

function children(parent: Node): Element[] {
    const result: Element[] = [];
    for (let node = parent.firstChild; node; node = node.nextSibling) {
        if (node.nodeType === 1) result.push(node as Element);
    }
    return result;
}

function isElement(element: Element, name: string, namespace = ''): boolean {
    return element.localName === name && (element.namespaceURI || '') === namespace;
}

function field(parent: Element, name: string, namespace = '', maximum = 2000, optional = false): string | undefined {
    const matches = children(parent).filter(element => isElement(element, name, namespace));
    if (optional && matches.length === 0) return undefined;
    if (matches.length !== 1 || children(matches[0]).length) return invalid();
    const value = matches[0].textContent?.trim() ?? '';
    if ((!optional && !value) || value.length > maximum) return invalid();
    return value;
}

function count(value: string): number {
    if (!/^(?:0|[1-9]\d*)$/.test(value)) return invalid();
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return invalid();
    return parsed;
}

export function nyaaFeedUrl(params: ListAnimeParams): string {
    const category = params.category ?? 'all';
    if (!Object.hasOwn(CATEGORY_IDS, category) || (params.query !== undefined
        && (typeof params.query !== 'string' || params.query.length > 200 || /[\u0000-\u001f\u007f]/.test(params.query)))) return invalid();
    const url = new URL('https://nyaa.si/');
    url.searchParams.set('page', 'rss');
    url.searchParams.set('c', CATEGORY_IDS[category]);
    const query = params.query?.trim();
    if (query) url.searchParams.set('q', query);
    return url.href;
}

export function parseNyaaFeed(xml: string, category: AnimeCategory = 'all'): {releases: AnimeRelease[]; records: NyaaRecord[]} {
    if (typeof xml !== 'string' || !xml.trim() || xml.length > NYAA_MAX_BYTES
        || new TextEncoder().encode(xml).byteLength > NYAA_MAX_BYTES || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml)) return invalid();
    let document: Document;
    try {
        // Reject warnings as well as errors instead of accepting the parser's repaired XML.
        document = new DOMParser({onError: invalid})
            .parseFromString(xml, 'application/xml');
    } catch { return invalid(); }
    const roots = children(document);
    const root = document.documentElement;
    if (document.doctype || roots.length !== 1 || !root || !isElement(root, 'rss')
        || root.getAttribute('version') !== '2.0') return invalid();
    const channels = children(root);
    if (channels.length !== 1 || !isElement(channels[0], 'channel')) return invalid();
    const items = children(channels[0]).filter(element => isElement(element, 'item'));
    if (items.length > NYAA_FEED_LIMIT) return invalid();
    const releases: AnimeRelease[] = [];
    const records: NyaaRecord[] = [];
    const seen = new Set<string>();
    for (const item of items) {
        const categoryId = field(item, 'categoryId', NYAA_NAMESPACE, 10)!;
        const itemCategory = CATEGORIES.get(categoryId);
        if (!itemCategory || (category !== 'all' && itemCategory !== category)) continue;
        const required = (name: string, namespace = '', maximum = 2000) => field(item, name, namespace, maximum)!;
        const record: NyaaRecord = {
            title: required('title'), link: required('link'), guid: required('guid'), pubDate: required('pubDate', '', 100),
            seeders: required('seeders', NYAA_NAMESPACE, 20), leechers: required('leechers', NYAA_NAMESPACE, 20),
            downloads: required('downloads', NYAA_NAMESPACE, 20), infoHash: required('infoHash', NYAA_NAMESPACE, 40),
            categoryId, category: required('category', NYAA_NAMESPACE, 100), size: required('size', NYAA_NAMESPACE, 60),
        };
        const id = record.guid.match(/^https:\/\/nyaa\.si\/view\/([1-9]\d{0,14})$/)?.[1];
        if (!id || !Number.isSafeInteger(Number(id)) || record.link !== `https://nyaa.si/download/${id}.torrent`
            || !/^[a-f\d]{40}$/i.test(record.infoHash) || !/^\d+(?:\.\d+)? (?:Bytes?|[KMGTPE]i?B)$/.test(record.size)) return invalid();
        const uploadedAt = new Date(record.pubDate);
        if (!/^[A-Z][a-z]{2}, \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} (?:[+-]\d{4}|GMT|UTC)$/.test(record.pubDate)
            || !Number.isFinite(uploadedAt.getTime())) return invalid();
        const seeds = count(record.seeders);
        const peers = count(record.leechers);
        const downloadCount = count(record.downloads);
        const comments = field(item, 'comments', NYAA_NAMESPACE, 20, true);
        if (comments !== undefined) { count(comments); record.comments = comments; }
        for (const name of ['trusted', 'remake'] as const) {
            const value = field(item, name, NYAA_NAMESPACE, 3, true);
            if (value !== undefined) {
                if (!['Yes', 'No'].includes(value)) return invalid();
                record[name] = value;
            }
        }
        const description = field(item, 'description', '', 20_000, true);
        if (description !== undefined) record.description = description;
        if (seen.has(id)) continue;
        seen.add(id);
        records.push(record);
        releases.push({id: `nyaa:${Number(id)}`, title: record.title, category: itemCategory, uploadedAt,
            size: record.size, seeds, peers, downloadCount});
    }
    return {releases, records};
}

function cancelled<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
    assertCatalogActive(signal);
    return new Promise((resolve, reject) => {
        const abort = () => { try { assertCatalogActive(signal); } catch (error) { reject(error); } };
        signal.addEventListener('abort', abort, {once: true});
        work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
        if (signal.aborted) abort();
    });
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
    assertCatalogActive(signal);
    if (ms <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await cancelled(new Promise<void>(resolve => { timer = setTimeout(resolve, ms); }), signal); }
    finally { if (timer !== undefined) clearTimeout(timer); }
}

async function readFeed(response: Response, signal: AbortSignal, now: number): Promise<string> {
    if (response.status === 429) {
        void response.body?.cancel().catch(() => {});
        throw new NyaaFeedError('rate_limited', 429, nyaaRetryAfterSeconds(response.headers.get('retry-after'), now));
    }
    if (!response.ok || response.redirected) {
        void response.body?.cancel().catch(() => {});
        throw new NyaaFeedError('http_error', response.status);
    }
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > NYAA_MAX_BYTES)) {
        void response.body?.cancel().catch(() => {});
        return invalid();
    }
    const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (type && !['application/rss+xml', 'application/xml', 'text/xml'].includes(type)) {
        void response.body?.cancel().catch(() => {});
        throw new NyaaFeedError('response_type', response.status);
    }
    if (!response.body) return invalid();
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', {fatal: true});
    let total = 0;
    let result = '';
    try {
        while (true) {
            const {done, value} = await cancelled(reader.read(), signal);
            if (done) break;
            total += value.byteLength;
            if (total > NYAA_MAX_BYTES) return invalid();
            result += decoder.decode(value, {stream: true});
        }
        return result + decoder.decode();
    } finally {
        void reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}

type Feed = ReturnType<typeof parseNyaaFeed>;
interface PendingFeed {controller: AbortController; promise: Promise<Feed>; readers: number;}
export interface NyaaTransport {load(params: ListAnimeParams, signal?: AbortSignal): Promise<Feed>;}

/** Coalesces only in-flight work. Completed RSS responses are never cached. */
export function createNyaaTransport(options: {
    fetch?: typeof fetch; spacingMs?: number; timeoutMs?: number; now?: () => number;
} = {}): NyaaTransport {
    const fetcher = options.fetch ?? ((input, init) => fetch(input, init));
    const spacingMs = options.spacingMs ?? 5000;
    const timeoutMs = options.timeoutMs ?? 12_000;
    const now = options.now ?? Date.now;
    const pending = new Map<string, PendingFeed>();
    let nextStart = 0;
    let rateLimitedUntil = 0;
    const assertOutsideCooldown = () => {
        const seconds = Math.ceil((rateLimitedUntil - now()) / 1000);
        if (seconds > 0) throw new NyaaFeedError('rate_limited', 429, seconds);
    };
    let queue: Promise<void> = Promise.resolve();
    return {async load(params, signal) {
        assertCatalogActive(signal);
        const url = nyaaFeedUrl(params);
        assertOutsideCooldown();
        let current = pending.get(url);
        if (!current || current.controller.signal.aborted) {
            const controller = new AbortController();
            const start = queue.then(async () => {
                assertOutsideCooldown();
                await wait(Math.max(0, nextStart - now()), controller.signal);
                assertCatalogActive(controller.signal);
                assertOutsideCooldown();
                nextStart = now() + spacingMs;
            });
            queue = start.catch(() => {});
            const promise = start.then(async () => {
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    assertCatalogActive(controller.signal);
                    assertOutsideCooldown();
                    const response = await cancelled(fetcher(url, {
                        // The Request.cache option is unavailable on older Workers compatibility dates.
                        headers: {Accept: 'application/rss+xml, application/xml, text/xml', 'Cache-Control': 'no-store'},
                        // Workers supports manual redirects; readFeed rejects every non-2xx response.
                        redirect: 'manual', signal: controller.signal,
                    }), controller.signal).catch(error => { assertCatalogActive(controller.signal); throw fetchFailure(error); });
                    const xml = await readFeed(response, controller.signal, now()).catch(error => {
                        assertCatalogActive(controller.signal);
                        if (error instanceof NyaaFeedError) throw error;
                        throw new NyaaFeedError('read_failed');
                    });
                    assertCatalogActive(controller.signal);
                    return parseNyaaFeed(xml, params.category ?? 'all');
                } catch (error) {
                    if (error instanceof NyaaFeedError && error.code === 'rate_limited') {
                        // Keep the source's full cooldown, including waits longer than a minute.
                        rateLimitedUntil = Math.max(rateLimitedUntil, now() + (error.retryAfterSeconds ?? 60) * 1000);
                    }
                    throw error;
                } finally { clearTimeout(timer); }
            });
            current = {controller, promise, readers: 0};
            pending.set(url, current);
            const entry = current;
            const clear = () => { if (pending.get(url) === entry) pending.delete(url); };
            void promise.then(clear, clear);
        }
        current.readers += 1;
        try { return await (signal ? cancelled(current.promise, signal) : current.promise); }
        finally { if (--current.readers === 0) current.controller.abort(); }
    }};
}

const defaultFetch: typeof fetch = (input, init) => fetch(input, init);
const transports = new WeakMap<typeof fetch, NyaaTransport>();
function sharedTransport(fetcher: typeof fetch = defaultFetch): NyaaTransport {
    let transport = transports.get(fetcher);
    if (!transport) { transport = createNyaaTransport({fetch: fetcher}); transports.set(fetcher, transport); }
    return transport;
}

export class NyaaAnimeRepository implements AnimeRepository {
    private readonly transport: NyaaTransport;
    constructor(private readonly options: {
        signal?: AbortSignal; fetch?: typeof fetch; onResponse?: (body: unknown) => void; transport?: NyaaTransport;
    } = {}) { this.transport = options.transport ?? sharedTransport(options.fetch); }

    async listAnime(params: ListAnimeParams): Promise<ListAnimeResult> {
        const feed = await this.transport.load(params, this.options.signal);
        assertCatalogActive(this.options.signal);
        this.options.onResponse?.({source: 'nyaa', items: feed.records});
        return {releases: feed.releases, limit: NYAA_FEED_LIMIT};
    }
}
