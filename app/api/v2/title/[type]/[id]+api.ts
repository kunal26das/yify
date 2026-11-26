import {titleRoute} from '@/server/endpoints/title';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return titleRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
