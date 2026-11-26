import {personRoute} from '@/server/endpoints/person';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return personRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
