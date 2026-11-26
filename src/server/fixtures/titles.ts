import type {PersonResponse, SeasonResponse, TitleResponse} from '@/core/domain/api';
import type {PersonDetails} from '@/core/domain/person';
import type {RegionCode} from '@/core/domain/providers';
import type {MovieDetails, SeasonDetails, TvDetails} from '@/core/domain/title';
import {emptyAvailability, fixtureAvailability} from './availability';
import person6384 from './v2/person.6384.json';
import season13991 from './v2/season.tv.1399.1.json';
import movie299536 from './v2/title.movie.299536.json';
import movie603 from './v2/title.movie.603.json';
import tv1399 from './v2/title.tv.1399.json';

function details(value: unknown): TitleResponse['title'] {
  return (value as TitleResponse).title;
}

const MOVIES: ReadonlyMap<number, MovieDetails> = new Map(
  [details(movie603), details(movie299536)].flatMap((title) => (title.type === 'movie' ? [[title.id, title] as const] : [])),
);
const SHOWS: ReadonlyMap<number, TvDetails> = new Map(
  [details(tv1399)].flatMap((title) => (title.type === 'tv' ? [[title.id, title] as const] : [])),
);
const SEASONS: ReadonlyMap<string, SeasonDetails> = new Map(
  [(season13991 as unknown as SeasonResponse).season].map((season) => [`${season.key}/${season.seasonNumber}`, season] as const),
);
const PEOPLE: ReadonlyMap<number, PersonDetails> = new Map(
  [(person6384 as unknown as PersonResponse).person].map((person) => [person.id, person] as const),
);

function withRegion<T extends MovieDetails | TvDetails>(title: T, region: RegionCode | null): T {
  return {...title, availability: fixtureAvailability(region, title.key) ?? emptyAvailability(region)};
}

export function fixtureMovie(id: number, region: RegionCode | null): MovieDetails | null {
  const movie = MOVIES.get(id);
  return movie === undefined ? null : withRegion(movie, region);
}

export function fixtureTv(id: number, region: RegionCode | null): TvDetails | null {
  const show = SHOWS.get(id);
  return show === undefined ? null : withRegion(show, region);
}

export function fixtureSeason(id: number, season: number): SeasonDetails | null {
  return SEASONS.get(`tv:${id}/${season}`) ?? null;
}

export function fixturePerson(id: number): PersonDetails | null {
  return PEOPLE.get(id) ?? null;
}
