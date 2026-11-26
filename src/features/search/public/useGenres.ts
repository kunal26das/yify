import {useQuery} from '@tanstack/react-query';
import type {Genre} from '@/core/domain/title';
import {genresQueryOptions} from '@/core/query/options';

const NO_GENRES: readonly Genre[] = [];

export function useGenres(): {genres: readonly Genre[]; status: 'loading' | 'ready' | 'error'; retry(): void} {
  const query = useQuery(genresQueryOptions());
  let status: 'loading' | 'ready' | 'error' = 'loading';
  if (query.data !== undefined) status = 'ready';
  else if (query.isError) status = 'error';
  return {
    genres: query.data ?? NO_GENRES,
    status,
    retry: () => {
      void query.refetch();
    },
  };
}
