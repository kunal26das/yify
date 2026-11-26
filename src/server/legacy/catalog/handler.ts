export async function handleCatalogRequest(_request: Request, _operation: string): Promise<Response> {
  return new Response(JSON.stringify({error: 'rebuilding'}), {
    status: 501,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
      'X-Yify-Legacy': '1',
    },
  });
}
