import type {Metadata} from 'expo-router/server';
import type {PersonDetails} from '@/core/domain/person';
import {getPerson} from '@/server/tmdb/titles';
import {personJsonLd} from './jsonLd';
import {buildPersonMetadata, personPath} from './metadata';
import {
  type PageParams, type PageRequest, isLoaderDataRequest, loaderDataResponse, notFoundResponse, parseIdParam,
  publicHost, redirectResponse, signalOf, trace,
} from './page';

export interface PersonPageData {
  person: PersonDetails;
  jsonLd: string;
}

async function resolvePersonDocument(request: PageRequest, params: PageParams): Promise<PersonDetails> {
  const parsed = parseIdParam(params);
  if (!parsed) throw notFoundResponse('person');
  const person = await getPerson(parsed.id, signalOf(request));
  if (!person) throw notFoundResponse('person');
  const canonical = personPath(person);
  if (`/person/${parsed.raw}` !== canonical) throw redirectResponse(canonical);
  return person;
}

export async function personLoader(request: PageRequest, params: PageParams): Promise<PersonPageData | Response> {
  trace('loader', request, {type: 'person', params});
  if (isLoaderDataRequest(request)) return loaderDataResponse();
  const person = await resolvePersonDocument(request, params);
  return {person, jsonLd: personJsonLd(person)};
}

export async function personMetadata(request: PageRequest, params: PageParams): Promise<Metadata | null> {
  trace('generateMetadata', request, {type: 'person', params});
  if (isLoaderDataRequest(request)) return null;
  const person = await resolvePersonDocument(request, params);
  return buildPersonMetadata(person, publicHost(request));
}
