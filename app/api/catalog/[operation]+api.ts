import {handleCatalogRequest} from '@/data/di/catalogServer';

export function GET(request: Request, {operation}: Record<string, string>): Promise<Response> {
    return handleCatalogRequest(request, operation);
}

export const OPTIONS = GET;
export const POST = GET;
export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const HEAD = GET;
