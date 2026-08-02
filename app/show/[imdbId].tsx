import Head from 'expo-router/head';
import {useLocalSearchParams} from 'expo-router';
import {useMemo} from 'react';
import {
  EztvApiDataSource,
  ShowRepositoryImpl,
  TmdbApiDataSource,
  TmdbRepositoryImpl,
} from '@/data';
import {getTmdbApiKey, remoteConfigReady} from '@/lib/remote-config';
import {ShowDetailsScreen} from '@/presentation';

export default function ShowDetailsRoute() {
  const {imdbId} = useLocalSearchParams<{imdbId: string}>();
  const shows = useMemo(() => new ShowRepositoryImpl(new EztvApiDataSource()), []);
  const artwork = useMemo(
    () =>
      new TmdbRepositoryImpl(
        new TmdbApiDataSource(async () => {
          await remoteConfigReady();
          return getTmdbApiKey();
        })
      ),
    []
  );
  return (
    <>
      <Head>
        <title>Series — Yify</title>
      </Head>
      <ShowDetailsScreen imdbId={String(imdbId ?? '')} shows={shows} artwork={artwork} />
    </>
  );
}
