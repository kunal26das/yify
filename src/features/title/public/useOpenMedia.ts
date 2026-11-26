import {useQueryClient} from '@tanstack/react-query';
import {useCallback} from 'react';
import type {TitleSummary} from '@/core/domain/title';
import {titleQueryOptions, titleSummaryKey} from './titleQuery';

export function useOpenMedia(): (summary: TitleSummary) => void {
  const queryClient = useQueryClient();
  return useCallback((summary: TitleSummary) => {
    queryClient.setQueryData(titleSummaryKey(summary.key), summary);
    void queryClient.prefetchQuery(titleQueryOptions(summary.type, summary.id));
  }, [queryClient]);
}
