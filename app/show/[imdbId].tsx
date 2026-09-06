import Head from 'expo-router/head';
import {useLocalSearchParams} from 'expo-router';
import {canonicalUrl, ShowDetailsScreen, usePageMeta, useShowRepository, useTmdbRepository} from '@/presentation';

export default function ShowDetailsRoute() {
  const {imdbId} = useLocalSearchParams<{imdbId: string}>();
    usePageMeta({
        title: 'Series — Yify',
        description: 'Browse episodes and download options for this series on Yify.',
        canonical: canonicalUrl(`show/${String(imdbId ?? '')}`),
    });
  return (
    <>
      <Head>
        <title>Series — Yify</title>
          <meta name="description" content="Browse episodes and download options for this series on Yify."/>
          <link rel="canonical" href={canonicalUrl(`show/${String(imdbId ?? '')}`)}/>
          <meta property="og:url" content={canonicalUrl(`show/${String(imdbId ?? '')}`)}/>
      </Head>
      <ShowDetailsScreen
        imdbId={String(imdbId ?? '')}
        shows={useShowRepository()}
        artwork={useTmdbRepository()}
      />
    </>
  );
}
