import {discoverRoute} from '@/server/endpoints/discover';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return discoverRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
