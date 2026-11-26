import {titleRoute} from '@/server/endpoints/title';

export function GET(request: Request, params: Record<string, string>) {
  return titleRoute(request, params);
}
