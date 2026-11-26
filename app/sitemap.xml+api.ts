import {sitemapIndex} from '@/server/seo/sitemaps';

export function GET(request: Request) {
  return sitemapIndex(request);
}
