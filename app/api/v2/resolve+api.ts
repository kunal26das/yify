import {resolveRoute} from '@/server/endpoints/resolve';
import {preflight} from '@/server/http/respond';

export function POST(request: Request, params: Record<string, string>) {
  return resolveRoute(request, params);
}

export function OPTIONS() {
  return preflight('POST');
}
