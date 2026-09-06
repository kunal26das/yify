import {useEffect} from 'react';

export interface PageMeta {
    title: string;
    description?: string;
    canonical?: string | null;
    image?: string | null;
    type?: string;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null | undefined): void {
    const selector = `meta[${attr}="${key}"]`;
    const existing = document.head.querySelector<HTMLMetaElement>(selector);
    if (content == null) {
        return;
    }
    if (existing) {
        existing.content = content;
        return;
    }
    const node = document.createElement('meta');
    node.setAttribute(attr, key);
    node.content = content;
    document.head.appendChild(node);
}

function upsertCanonical(href: string | null | undefined): void {
    const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (href == null) {
        existing?.remove();
        return;
    }
    if (existing) {
        existing.href = href;
        return;
    }
    const node = document.createElement('link');
    node.rel = 'canonical';
    node.href = href;
    document.head.appendChild(node);
}

export function usePageMeta({title, description, canonical, image, type}: PageMeta): void {
    useEffect(() => {
        if (typeof document === 'undefined') return;
        document.title = title;
        upsertMeta('property', 'og:title', title);
        upsertMeta('name', 'twitter:title', title);
        if (description) {
            upsertMeta('name', 'description', description);
            upsertMeta('property', 'og:description', description);
            upsertMeta('name', 'twitter:description', description);
        }
        if (type) upsertMeta('property', 'og:type', type);
        if (image) {
            upsertMeta('property', 'og:image', image);
            upsertMeta('name', 'twitter:image', image);
        }
        upsertCanonical(canonical);
        upsertMeta('property', 'og:url', canonical);
    }, [title, description, canonical, image, type]);
}
