import {sitemapIndexXml, sitemapResponse} from '@/server/seo/sitemaps';

export function GET() {
  return sitemapResponse(sitemapIndexXml());
}
