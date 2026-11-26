import type {FindResponse, LegacyMovieResponse} from '@/core/domain/api';
import find from './v2/find.json';
import legacyMovie from './v2/legacyMovie.json';

const FIND = find as unknown as Readonly<Record<string, FindResponse>>;
const LEGACY = legacyMovie as unknown as Readonly<Record<string, LegacyMovieResponse>>;

export function fixtureFind(imdbId: string): FindResponse | null {
  return Object.hasOwn(FIND, imdbId) ? FIND[imdbId] : null;
}

export function fixtureLegacyMovie(v1Id: number): LegacyMovieResponse | null {
  const key = String(v1Id);
  return Object.hasOwn(LEGACY, key) ? LEGACY[key] : null;
}
