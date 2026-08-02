import Head from 'expo-router/head';
import {useLocalSearchParams} from 'expo-router';
import {ShowDetailsScreen, useShowRepository, useTmdbRepository} from '@/presentation';

export default function ShowDetailsRoute() {
  const {imdbId} = useLocalSearchParams<{imdbId: string}>();
  return (
    <>
      <Head>
        <title>Series — Yify</title>
      </Head>
      <ShowDetailsScreen
        imdbId={String(imdbId ?? '')}
        shows={useShowRepository()}
        artwork={useTmdbRepository()}
      />
    </>
  );
}
