import { useCallback, useEffect, useState } from 'react';
import type { Movie, MovieDetails, MovieRepository } from '@/domain';

export function useMovieDetailsViewModel(repository: MovieRepository, movieId: number) {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    repository
      .getMovieDetails(movieId)
      .then((d) => {
        if (!active) return;
        setDetails(d);
        setError(null);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load movie');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });

    repository
      .getMovieSuggestions(movieId)
      .then((s) => {
        if (active) setSuggestions(s);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [repository, movieId, reloadKey]);

  const reload = useCallback(() => {
    setDetails(null);
    setSuggestions([]);
    setError(null);
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  }, []);

  return { details, suggestions, loading, refreshing, error, reload, refresh };
}

export type MovieDetailsViewModel = ReturnType<typeof useMovieDetailsViewModel>;
