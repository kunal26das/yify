import type {SeasonResponse} from '@/core/domain/api';
import type {SeasonDetails} from '@/core/domain/title';
import season13991 from './v2/season.tv.1399.1.json';

const SEASONS: ReadonlyMap<string, SeasonDetails> = new Map(
  [(season13991 as unknown as SeasonResponse).season].map((season) => [`${season.key}/${season.seasonNumber}`, season] as const),
);

export function fixtureSeason(id: number, season: number): SeasonDetails | null {
  return SEASONS.get(`tv:${id}/${season}`) ?? null;
}
