import Head from 'expo-router/head';
import {canonicalUrl, usePageMeta, WatchlistScreen} from '@/presentation';

export default function WatchlistRoute() {
    usePageMeta({
        title: 'Watchlist — Yify',
        description: 'The movies you saved to watch later on Yify.',
        canonical: canonicalUrl('watchlist'),
    });
  return (
    <>
      <Head>
        <title>Watchlist — Yify</title>
        <meta name="description" content="The movies you saved to watch later on Yify." />
          <link rel="canonical" href={canonicalUrl('watchlist')}/>
          <meta property="og:url" content={canonicalUrl('watchlist')}/>
      </Head>
      <WatchlistScreen />
    </>
  );
}
