import type {ImmutableRequest, Metadata} from 'expo-router/server';
import {isIndexableHost, titleDocumentTitle} from '@/core/config/seo';
import type {MediaType} from '@/core/domain/keys';
import {MAX_TMDB_ID} from '@/core/domain/keys';
import {getMovie, getTv} from '@/server/tmdb/titles';

export type PageParams = Record<string, string | string[]>;

const ID_PARAM = /^(\d{1,10})(?:-[a-z0-9-]*)?$/;

export function pageId(params: PageParams): number | null {
  const value = params.id;
  const match = ID_PARAM.exec(Array.isArray(value) ? value.join('/') : value ?? '');
  const id = match ? Number(match[1]) : 0;
  return id > 0 && id <= MAX_TMDB_ID ? id : null;
}

export function hostRobots(request: ImmutableRequest | undefined): Pick<Metadata, 'robots'> {
  return isIndexableHost(request?.headers.get('x-forwarded-host') ?? null) ? {} : {robots: {index: false, follow: false}};
}

export async function titleMetadata(type: MediaType, request: ImmutableRequest | undefined, params: PageParams): Promise<Metadata | null> {
  const id = pageId(params);
  if (id === null) return null;
  const signal = request?.signal ?? new AbortController().signal;
  const title = type === 'movie' ? await getMovie(id, null, signal) : await getTv(id, null, signal);
  if (title === null) return null;
  return {title: titleDocumentTitle({type, title: title.title, year: title.year}), ...hostRobots(request)};
}
