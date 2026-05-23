import { useCallback, useEffect, useState } from 'react';
import type { MovieDetails, MovieRepository } from '@/domain';

export function useMovieDetailsViewModel(repository: MovieRepository, movieId: number) {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    repository
      .getMovieDetails(movieId)
      .then((d) => {
        if (active) setDetails(d);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load movie');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, movieId, reloadKey]);

  const reload = useCallback(() => {
    setDetails(null);
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  return { details, loading, error, reload };
}

export type MovieDetailsViewModel = ReturnType<typeof useMovieDetailsViewModel>;
