import {findRoute} from '@/server/endpoints/find';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return findRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
