import {getMovie, getTv} from '@/server/tmdb/titles';

const ID = /^[1-9]\d{0,8}$/;

export async function titleRoute(request: Request, params: Record<string, string>): Promise<Response> {
  const type = params.type;
  const raw = params.id ?? '';
  if ((type !== 'movie' && type !== 'tv') || !ID.test(raw)) {
    return Response.json({error: {code: 'invalid_request', message: 'Invalid title'}}, {status: 400});
  }
  const id = Number(raw);
  const title = type === 'movie' ? await getMovie(id, null, request.signal) : await getTv(id, null, request.signal);
  if (!title) return Response.json({error: {code: 'not_found', message: 'Not found'}}, {status: 404});
  return Response.json({v: 2, title}, {headers: {'Cache-Control': 'public, max-age=300', 'X-Yify-Source': 'fixture'}});
}
