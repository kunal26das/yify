import type {DiscoverResponse} from '@/core/domain/api';
import type {MediaType} from '@/core/domain/keys';
import type {Paged} from '@/core/domain/search';
import type {TitleSummary} from '@/core/domain/title';
import discoverMovie from './v2/discover.movie.json';
import discoverTv from './v2/discover.tv.json';

const DISCOVER: Readonly<Record<MediaType, DiscoverResponse>> = {
  movie: discoverMovie as unknown as DiscoverResponse,
  tv: discoverTv as unknown as DiscoverResponse,
};

export function fixtureDiscover(type: MediaType): DiscoverResponse {
  return DISCOVER[type];
}

export function fixtureDiscoverPage(type: MediaType): Paged<TitleSummary> {
  const {page, totalPages, totalResults, results} = DISCOVER[type];
  return {page, totalPages, totalResults, results};
}
