import { useMemo } from 'react';
import { YtsApiDataSource, MovieRepositoryImpl } from '@/data';
import { MoviesScreen, useMoviesViewModel } from '@/presentation';

export default function HomeScreen() {
  const api = useMemo(() => new YtsApiDataSource(), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const viewModel = useMoviesViewModel(repository);
  return <MoviesScreen viewModel={viewModel} />;
}
