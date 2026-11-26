import {queryOptions} from '@tanstack/react-query';
import type {TitleResponse} from '@/core/domain/api';
import type {MediaType, TitleKey} from '@/core/domain/keys';
import type {TitleDetails, TitleSummary} from '@/core/domain/title';
import {DEFAULT_STALE_MS} from '@/core/query/client';

export interface TitleLoaderData {
  title: TitleDetails;
  jsonLd: string;
}

export function titleSummaryKey(key: TitleKey) {
  return ['title-summary', key] as const;
}

export function titleQueryOptions(type: MediaType, id: number) {
  return queryOptions({
    queryKey: ['title', `${type}:${id}`] as const,
    queryFn: async ({signal}): Promise<TitleDetails> => {
      const response = await fetch(`/api/v2/title/${type}/${id}`, {signal});
      if (!response.ok) throw new Error(`Title request failed: ${response.status}`);
      const body = (await response.json()) as TitleResponse;
      return body.title;
    },
    staleTime: DEFAULT_STALE_MS,
  });
}

export function titleHref(summary: Pick<TitleSummary, 'type' | 'id' | 'slug'>): string {
  return `/title/${summary.type}/${summary.id}${summary.slug ? `-${summary.slug}` : ''}`;
}
