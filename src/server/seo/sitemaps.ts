import {SITE_ORIGIN} from '@/core/config/app';

const NAMES = ['static', 'movie-1', 'tv-1', 'person-1'];

export function sitemapIndexXml(): string {
  const entries = NAMES.map((name) => `<sitemap><loc>${SITE_ORIGIN}/sitemaps/${name}.xml</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

export function sitemapResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800',
    },
  });
}
