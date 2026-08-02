import Head from 'expo-router/head';
import {useMemo} from 'react';
import {
  EztvApiDataSource,
  ShowRepositoryImpl,
  TmdbApiDataSource,
  TmdbRepositoryImpl,
} from '@/data';
import {getTmdbApiKey, remoteConfigReady} from '@/lib/remote-config';
import {ShowsScreen, useShowsViewModel} from '@/presentation';

export default function ShowsRoute() {
  const api = useMemo(() => new EztvApiDataSource(), []);
  const repository = useMemo(() => new ShowRepositoryImpl(api), [api]);
  const artwork = useMemo(
    () => new TmdbRepositoryImpl(new TmdbApiDataSource(async () => {
        await remoteConfigReady();
        return getTmdbApiKey();
      })),
    []
  );
  const viewModel = useShowsViewModel(repository, artwork);
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
