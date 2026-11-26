import {availabilityRoute} from '@/server/endpoints/availability';
import {preflight} from '@/server/http/respond';

export function POST(request: Request, params: Record<string, string>) {
  return availabilityRoute(request, params);
}

export function OPTIONS() {
  return preflight('POST');
}
