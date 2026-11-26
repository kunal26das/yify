import {providersRoute} from '@/server/endpoints/providers';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return providersRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
