import {sitemapResponse} from '@/server/seo/sitemaps';

export function GET(_request: Request, params: Record<string, string>) {
  if (params.name !== 'static.xml') return new Response('Not found', {status: 404});
  return sitemapResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://yify.expo.app/</loc></url></urlset>');
}
