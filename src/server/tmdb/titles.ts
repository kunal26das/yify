import type {MediaType} from '@/core/domain/keys';
import type {PersonDetails, PersonSummary} from '@/core/domain/person';
import type {RegionCode} from '@/core/domain/providers';
import type {Paged} from '@/core/domain/search';
import type {MovieDetails, TitleSummary, TvDetails} from '@/core/domain/title';
import {fixtureDiscoverPage} from '@/server/fixtures/discover';
import {fixturePopularPeople} from '@/server/fixtures/people';
import {fixtureMovie, fixturePerson, fixtureTv} from '@/server/fixtures/titles';

export async function getMovie(id: number, region: RegionCode | null, signal: AbortSignal): Promise<MovieDetails | null> {
  signal.throwIfAborted();
  return fixtureMovie(id, region);
}

export async function getTv(id: number, region: RegionCode | null, signal: AbortSignal): Promise<TvDetails | null> {
  signal.throwIfAborted();
  return fixtureTv(id, region);
}

export async function getPerson(id: number, signal: AbortSignal): Promise<PersonDetails | null> {
  signal.throwIfAborted();
  return fixturePerson(id);
}

export async function discover(type: MediaType, page: number, signal: AbortSignal): Promise<Paged<TitleSummary>> {
  signal.throwIfAborted();
  return {...fixtureDiscoverPage(type), page};
}

export async function popularPeople(page: number, signal: AbortSignal): Promise<Paged<PersonSummary>> {
  signal.throwIfAborted();
  return {...fixturePopularPeople(), page};
}
