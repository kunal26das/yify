import Head from 'expo-router/head';
import {useMemo} from 'react';
import {EztvApiDataSource, ShowRepositoryImpl} from '@/data';
import {ShowsScreen, useShowsViewModel} from '@/presentation';

export default function ShowsRoute() {
  const api = useMemo(() => new EztvApiDataSource(), []);
  const repository = useMemo(() => new ShowRepositoryImpl(api), [api]);
  const viewModel = useShowsViewModel(repository);
  return (
    <>
      <Head>
        <title>Shows — Yify</title>
        <meta name="description" content="Series and episode browsing is coming soon to Yify." />
      </Head>
      <ShowsScreen viewModel={viewModel} />
    </>
  );
}
