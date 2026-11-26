import type {Metadata} from 'expo-router/server';
import type {MediaType} from '@/core/domain/keys';
import type {TitleDetails} from '@/core/domain/title';
import {getMovie, getTv} from '@/server/tmdb/titles';
import {titleJsonLd} from './jsonLd';
import {buildTitleMetadata, titlePath} from './metadata';
import {
  type PageParams, type PageRequest, isLoaderDataRequest, loaderDataResponse, notFoundResponse, parseIdParam,
  publicHost, redirectResponse, signalOf, trace,
} from './page';

export interface TitlePageData {
  title: TitleDetails;
  jsonLd: string;
}

async function resolveTitleDocument(type: MediaType, request: PageRequest, params: PageParams): Promise<TitleDetails> {
  const parsed = parseIdParam(params);
  if (!parsed) throw notFoundResponse('title');
  const signal = signalOf(request);
  const title = type === 'movie' ? await getMovie(parsed.id, null, signal) : await getTv(parsed.id, null, signal);
  if (!title) throw notFoundResponse('title');
  const canonical = titlePath(title);
  if (`/title/${type}/${parsed.raw}` !== canonical) throw redirectResponse(canonical);
  return title;
}

export async function titleLoader(type: MediaType, request: PageRequest, params: PageParams): Promise<TitlePageData | Response> {
  trace('loader', request, {type, params});
  if (isLoaderDataRequest(request)) return loaderDataResponse();
  const title = await resolveTitleDocument(type, request, params);
  return {title, jsonLd: titleJsonLd(title)};
}

export async function titleMetadata(type: MediaType, request: PageRequest, params: PageParams): Promise<Metadata | null> {
  trace('generateMetadata', request, {type, params});
  if (isLoaderDataRequest(request)) return null;
  const title = await resolveTitleDocument(type, request, params);
  return buildTitleMetadata(title, publicHost(request));
}
