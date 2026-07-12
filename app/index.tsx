import {useMemo} from 'react';
import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import {HomeScreen, useHomeViewModel} from '@/presentation';
import {getApiBaseUrl} from '@/lib/remote-config';

export default function HomeRoute() {
  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const viewModel = useHomeViewModel(repository);
  return <HomeScreen viewModel={viewModel} />;
}
