export type FirebaseProxyArea = 'auth' | 'firebase';

export async function proxyFirebase(_request: Request, _area: FirebaseProxyArea, _path: string): Promise<Response> {
  return new Response(JSON.stringify({error: 'rebuilding'}), {
    status: 501,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
