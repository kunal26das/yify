export type MediaType = 'movie' | 'tv';
export type TitleKey = `movie:${number}` | `tv:${number}`;
export type PersonKey = `person:${number}`;
export type LegacyKey = `v1:${number}` | `imdb:tt${string}`;
export type EntryKey = TitleKey | LegacyKey;

export const TITLE_KEY_PATTERN = /^(movie|tv):([1-9]\d{0,9})$/;
export const LEGACY_KEY_PATTERN = /^(?:v1:[1-9]\d{0,9}|imdb:tt\d{7,10})$/;
export const MAX_TMDB_ID = 2147483647;

function assertId(id: number): void {
  if (!Number.isSafeInteger(id) || id < 1 || id > MAX_TMDB_ID) throw new RangeError(`Invalid TMDB id: ${id}`);
}

export function titleKey(type: MediaType, id: number): TitleKey {
  assertId(id);
  return `${type}:${id}`;
}

export function parseTitleKey(value: string): {type: MediaType; id: number; key: TitleKey} | null {
  const match = TITLE_KEY_PATTERN.exec(value);
  if (!match) return null;
  const type = match[1] === 'tv' ? 'tv' : 'movie';
  const id = Number(match[2]);
  if (id > MAX_TMDB_ID) return null;
  return {type, id, key: `${type}:${id}`};
}

export function isLegacyKey(value: string): value is LegacyKey {
  return LEGACY_KEY_PATTERN.test(value);
}

export function isEntryKey(value: string): value is EntryKey {
  return parseTitleKey(value) !== null || isLegacyKey(value);
}

export function personKey(id: number): PersonKey {
  assertId(id);
  return `person:${id}`;
}
