import type {StreamingCatalog, StreamingOffer, StreamingOfferType} from '@/domain';

export class InvalidStreamingData extends Error {}

export interface StreamingCatalogData {
    catalog: StreamingCatalog;
    hosts: Map<string, string>;
}

const TYPES: StreamingOfferType[] = ['subscription', 'addon', 'free', 'rent', 'buy'];

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InvalidStreamingData();
    return value as Record<string, unknown>;
}

function text(value: unknown, maximum = 160): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) throw new InvalidStreamingData();
    return value.trim();
}

function identifier(value: unknown): string {
    const result = text(value, 120);
    if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(result)) throw new InvalidStreamingData();
    return result;
}

function list(value: unknown, maximum: number): unknown[] {
    if (!Array.isArray(value) || value.length > maximum) throw new InvalidStreamingData();
    return value;
}

export function safeStreamingUrl(value: unknown): URL {
    const source = text(value, 2048);
    const url = new URL(source);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port
        || !/^[a-z0-9.-]+\.[a-z]{2,63}$/.test(hostname)
        || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(hostname)
        || source.includes('\\') || /%0[ad]/i.test(source)) throw new InvalidStreamingData();
    return url;
}

function host(value: unknown): string {
    return safeStreamingUrl(value).hostname.replace(/^www\./, '');
}

export function normalizeStreamingCatalog(value: unknown): StreamingCatalogData {
    const entries = Object.entries(record(value));
    if (entries.length === 0 || entries.length > 250) throw new InvalidStreamingData();
    const hosts = new Map<string, string>();
    const countries = entries.map(([key, raw]) => {
        const country = record(raw);
        const code = text(country.countryCode, 2).toUpperCase();
        if (!/^[A-Z]{2}$/.test(code) || key.toUpperCase() !== code) throw new InvalidStreamingData();
        const selections = new Set<string>();
        const services = list(country.services, 500).flatMap(rawService => {
            const service = record(rawService);
            const id = identifier(service.id);
            const name = text(service.name);
            if (selections.has(id)) throw new InvalidStreamingData();
            selections.add(id);
            const serviceHost = host(service.homePage);
            hosts.set(`${code}:${id}`, serviceHost);
            const addons = list(service.addons, 500).map(rawAddon => {
                const addon = record(rawAddon);
                const addonId = `${id}:${identifier(addon.id)}`;
                if (selections.has(addonId)) throw new InvalidStreamingData();
                selections.add(addonId);
                hosts.set(`${code}:${addonId}`, host(addon.homePage));
                return {id: addonId, name: text(addon.name), parentName: name};
            });
            return [{id, name}, ...addons];
        });
        if (services.length > 2000) throw new InvalidStreamingData();
        return {code, name: text(country.name), services};
    });
    if (new Set(countries.map(country => country.code)).size !== countries.length) throw new InvalidStreamingData();
    countries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return {catalog: {status: 'ready', countries}, hosts};
}

export function normalizeStreamingOffers(value: unknown, country: string, catalog: StreamingCatalogData): StreamingOffer[] {
    const show = record(value);
    const options = record(show.streamingOptions);
    const entries = options[country.toLowerCase()];
    if (entries === undefined) return [];
    const known = new Map(catalog.catalog.countries.find(item => item.code === country)?.services.map(service => [service.id, service]));
    const seen = new Set<string>();
    return list(entries, 500).flatMap(raw => {
        const option = record(raw);
        const service = record(option.service);
        const serviceId = identifier(service.id);
        const type = option.type as StreamingOfferType;
        if (!TYPES.includes(type)) throw new InvalidStreamingData();
        const addon = type === 'addon' ? record(option.addon) : undefined;
        const selectionId = addon ? `${serviceId}:${identifier(addon.id)}` : serviceId;
        const selected = known.get(selectionId);
        const base = known.get(serviceId);
        if (!base || !selected) throw new InvalidStreamingData();
        const url = safeStreamingUrl(option.link);
        const allowedHosts = [catalog.hosts.get(`${country}:${serviceId}`), catalog.hosts.get(`${country}:${selectionId}`)].filter((item): item is string => Boolean(item));
        if (!allowedHosts.some(allowed => url.hostname === allowed || url.hostname.endsWith(`.${allowed}`))) throw new InvalidStreamingData();
        const key = `${selectionId}:${type}:${url.href}`;
        if (seen.has(key)) return [];
        seen.add(key);
        const price = option.price === null || option.price === undefined ? undefined : text(record(option.price).formatted, 80);
        const quality = option.quality === undefined ? undefined : text(option.quality, 8);
        if (quality && !['sd', 'hd', 'qhd', 'uhd'].includes(quality)) throw new InvalidStreamingData();
        return [{serviceId, serviceName: base.name, selectionId, ...(addon ? {addonName: selected.name} : {}), type, url: url.href,
            ...(price ? {price} : {}), ...(quality ? {quality} : {})}];
    });
}
