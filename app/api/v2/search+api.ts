import {searchRoute} from '@/server/endpoints/search';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return searchRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
