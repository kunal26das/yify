import { useMemo } from 'react';
import { YtsApiDataSource } from '@/data/datasources/YtsApiDataSource';
import { MovieRepositoryImpl } from '@/data/repositories/MovieRepositoryImpl';
import { MoviesScreen } from '@/presentation/movies/MoviesScreen';
import { useMoviesViewModel } from '@/presentation/movies/useMoviesViewModel';

export default function HomeScreen() {
  const api = useMemo(() => new YtsApiDataSource(), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const viewModel = useMoviesViewModel(repository);
  return <MoviesScreen viewModel={viewModel} />;
}
