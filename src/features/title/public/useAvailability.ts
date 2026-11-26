import {skipToken, useQuery} from '@tanstack/react-query';
import type {TitleKey} from '@/core/domain/keys';
import type {RegionAvailability, RegionCode} from '@/core/domain/providers';
import {availabilityQueryOptions} from '@/core/query/options';
import {useEffectiveRegion} from '@/features/settings/public/region';

export interface AvailabilityState {
  availability: RegionAvailability | null;
  status: 'loading' | 'ready' | 'error';
  updatedAt: number | null;
  retry(): void;
}

const NO_TITLE: TitleKey = 'movie:0';

export function useAvailability(key: TitleKey | null, region?: RegionCode): AvailabilityState {
  const effectiveRegion = useEffectiveRegion();
  const options = availabilityQueryOptions(region ?? effectiveRegion, key ?? NO_TITLE);
  const query = useQuery({...options, queryFn: key === null ? skipToken : options.queryFn});
  let status: AvailabilityState['status'] = 'loading';
  if (query.data !== undefined) status = 'ready';
  else if (query.isError) status = 'error';
  return {
    availability: query.data ?? null,
    status,
    updatedAt: query.data === undefined ? null : query.dataUpdatedAt,
    retry: () => {
      if (key !== null) void query.refetch();
    },
  };
}
