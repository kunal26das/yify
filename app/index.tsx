import {useMemo} from 'react';
import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import {MoviesScreen, useMoviesViewModel} from '@/presentation';
import {getApiBaseUrl} from '@/lib/remote-config';

export default function HomeScreen() {
  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const viewModel = useMoviesViewModel(repository);
  return <MoviesScreen viewModel={viewModel} />;
}
