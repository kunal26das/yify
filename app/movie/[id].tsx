import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { MovieRepositoryImpl, YtsApiDataSource } from '@/data';
import { WatchScreen, useMovieDetailsViewModel } from '@/presentation';
import { getApiBaseUrl } from '@/lib/remote-config';

export default function MovieDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const viewModel = useMovieDetailsViewModel(repository, Number(id));
  return <WatchScreen viewModel={viewModel} />;
}
