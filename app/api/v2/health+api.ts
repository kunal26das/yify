import {healthRoute} from '@/server/endpoints/health';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return healthRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
