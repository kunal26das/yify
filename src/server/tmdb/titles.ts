import type {PersonDetails} from '@/core/domain/person';
import type {RegionCode} from '@/core/domain/providers';
import type {MovieDetails, TvDetails} from '@/core/domain/title';
import {fixturesEnabled, tmdbApiBaseUrl, traceEnabled} from '@/server/env';
import {getServerState} from '@/server/http/state';
import movie603 from '@/server/fixtures/v2/title.movie.603.json';
import tv1399 from '@/server/fixtures/v2/title.tv.1399.json';
import person6384 from '@/server/fixtures/v2/person.6384.json';

const MOVIES: Readonly<Record<number, unknown>> = {603: movie603};
const SHOWS: Readonly<Record<number, unknown>> = {1399: tv1399};
const PEOPLE: Readonly<Record<number, unknown>> = {6384: person6384};

function upstream<T>(path: string, fixture: unknown, signal: AbortSignal): T | null {
  signal.throwIfAborted();
  const state = getServerState();
  if (state.cache.has(path)) return state.cache.get(path) as T | null;
  if (!fixturesEnabled()) throw new Error(`S1 stand-in has no TMDB client for ${tmdbApiBaseUrl()}${path}`);
  const counterKey = `s1:upstream:${path}`;
  const count = ((state.cache.get(counterKey) as number | undefined) ?? 0) + 1;
  state.cache.set(counterKey, count);
  if (traceEnabled()) console.log(JSON.stringify({t: 's1', upstream: path, count}));
  const value = (fixture ?? null) as T | null;
  state.cache.set(path, value);
  return value;
}

export async function getMovie(id: number, region: RegionCode | null, signal: AbortSignal): Promise<MovieDetails | null> {
  return upstream<MovieDetails>(`/movie/${id}${region ? `?region=${region}` : ''}`, MOVIES[id], signal);
}

export async function getTv(id: number, region: RegionCode | null, signal: AbortSignal): Promise<TvDetails | null> {
  return upstream<TvDetails>(`/tv/${id}${region ? `?region=${region}` : ''}`, SHOWS[id], signal);
}

export async function getPerson(id: number, signal: AbortSignal): Promise<PersonDetails | null> {
  return upstream<PersonDetails>(`/person/${id}`, PEOPLE[id], signal);
}
