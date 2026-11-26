import {imageRoute} from '@/server/endpoints/image';
import {preflight} from '@/server/http/respond';

export function GET(request: Request, params: Record<string, string>) {
  return imageRoute(request, params);
}

export function OPTIONS() {
  return preflight('GET');
}
