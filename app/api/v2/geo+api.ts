import {geoRoute} from '@/server/endpoints/geo';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return geoRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
