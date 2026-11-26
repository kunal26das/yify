import {handleCatalogRequest} from '@/server/legacy/catalog/handler';

export function GET(request: Request, params: Record<string, string>) {
  return handleCatalogRequest(request, params.operation);
}

export const HEAD = GET;
export const OPTIONS = GET;
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
