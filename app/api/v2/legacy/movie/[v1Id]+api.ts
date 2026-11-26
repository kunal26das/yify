import {legacyMovieRoute} from '@/server/endpoints/legacyMovie';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return legacyMovieRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
