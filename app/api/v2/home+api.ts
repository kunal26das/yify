import {homeRoute} from '@/server/endpoints/home';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return homeRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
