import type {ImmutableRequest, Metadata} from 'expo-router/server';
import {personDocumentTitle} from '@/core/config/seo';
import {getPerson} from '@/server/tmdb/titles';
import type {PageParams} from './titlePage';
import {hostRobots, pageId} from './titlePage';

export async function personMetadata(request: ImmutableRequest | undefined, params: PageParams): Promise<Metadata | null> {
  const id = pageId(params);
  if (id === null) return null;
  const person = await getPerson(id, request?.signal ?? new AbortController().signal);
  if (person === null) return null;
  return {title: personDocumentTitle(person.name), ...hostRobots(request)};
}
