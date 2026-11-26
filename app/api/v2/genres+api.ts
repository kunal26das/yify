import {genresRoute} from '@/server/endpoints/genres';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return genresRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
