import {SITE_ORIGIN} from '@/core/config/app';
import type {EntryKey, MediaType, PersonKey, TitleKey} from '@/core/domain/keys';
import {MAX_TMDB_ID, parseTitleKey} from '@/core/domain/keys';
import type {TitleSnapshot} from '@/core/domain/library';
import type {SearchUrlState} from '@/core/domain/search';
import {searchPath} from '@/core/domain/search';
import {slugify} from '@/core/domain/slug';
import type {TitleSummary} from '@/core/domain/title';
import {normalizeSearchUrlState} from './searchUrl';

export type MediaCardItem =
  | {kind: 'title'; title: TitleSummary}
  | {kind: 'entry'; key: EntryKey; snapshot: TitleSnapshot};

export type MediaTarget =
  | {kind: 'title'; key: TitleKey; type: MediaType; id: number; slug: string; title: string; posterPath: string | null}
  | {kind: 'legacy'; title: string};

const PERSON_KEY = /^person:([1-9]\d{0,9})$/;
const LIST_ID = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_SEASON = 999;

function pathSegment(id: number, slug: string): string {
  const clean = slugify(slug);
  return clean ? `${id}-${clean}` : String(id);
}

function titleParts(key: TitleKey): {type: MediaType; id: number} {
  const parsed = parseTitleKey(key);
  if (parsed === null) throw new RangeError(`Invalid title key: ${key}`);
  return parsed;
}

export function titleHref(key: TitleKey, slug: string): string {
  const {type, id} = titleParts(key);
  return `/title/${type}/${pathSegment(id, slug)}`;
}

export function seasonHref(key: TitleKey, slug: string, season: number): string {
  const {type, id} = titleParts(key);
  if (type !== 'tv') throw new RangeError(`Seasons belong to TV titles: ${key}`);
  if (!Number.isInteger(season) || season < 0 || season > MAX_SEASON) throw new RangeError(`Invalid season: ${season}`);
  return `/title/tv/${pathSegment(id, slug)}/season/${season}`;
}

export function personHref(key: PersonKey, slug: string): string {
  const match = PERSON_KEY.exec(key);
  if (match === null || Number(match[1]) > MAX_TMDB_ID) throw new RangeError(`Invalid person key: ${key}`);
  return `/person/${pathSegment(Number(match[1]), slug)}`;
}

export function listHref(id: string): string {
  if (!LIST_ID.test(id)) throw new RangeError(`Invalid list id: ${id}`);
  return `/list/${id}`;
}

export function searchHref(state: Partial<SearchUrlState>): string {
  return searchPath(normalizeSearchUrlState(state));
}

export function shareUrl(href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) throw new RangeError(`Share links need an app path: ${href}`);
  return `${SITE_ORIGIN}${href}`;
}

export function mediaTarget(item: MediaCardItem): MediaTarget {
  const key = item.kind === 'title' ? item.title.key : item.key;
  const snapshot = item.kind === 'title' ? item.title : item.snapshot;
  const parsed = parseTitleKey(key);
  if (parsed === null) return {kind: 'legacy', title: snapshot.title};
  return {
    kind: 'title',
    key: parsed.key,
    type: parsed.type,
    id: parsed.id,
    slug: snapshot.slug,
    title: snapshot.title,
    posterPath: snapshot.posterPath,
  };
}

export function mediaHref(item: MediaCardItem): string {
  const target = mediaTarget(item);
  return target.kind === 'title' ? titleHref(target.key, target.slug) : searchHref({q: target.title});
}
