import {proxyFirebase} from '@/server/auth/firebaseProxy';

export function GET(request: Request, params: Record<string, string>) {
  return proxyFirebase(request, 'auth', params.path);
}

export const POST = GET;
