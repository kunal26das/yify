import {seasonRoute} from '@/server/endpoints/season';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return seasonRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
