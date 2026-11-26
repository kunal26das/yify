import {sitemapFile} from '@/server/seo/sitemaps';

export function GET(request: Request, params: Record<string, string>) {
  return sitemapFile(request, params.name);
}
