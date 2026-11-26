import {regionsRoute} from '@/server/endpoints/regions';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return regionsRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
