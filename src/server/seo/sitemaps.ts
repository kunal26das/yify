export const SITEMAP_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400, stale-if-error=604800';

const XML_TYPE = 'application/xml; charset=utf-8';
const EMPTY_INDEX = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>\n';

export function sitemapResponse(xml: string): Response {
  return new Response(xml, {headers: {'Content-Type': XML_TYPE, 'Cache-Control': SITEMAP_CACHE_CONTROL}});
}

export async function sitemapIndex(_request: Request): Promise<Response> {
  return sitemapResponse(EMPTY_INDEX);
}

export async function sitemapFile(_request: Request, _name: string): Promise<Response> {
  return new Response('Not found', {status: 404, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}});
}
