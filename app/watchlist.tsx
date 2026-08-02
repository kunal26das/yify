import Head from 'expo-router/head';
import {WatchlistScreen} from '@/presentation';

export default function WatchlistRoute() {
  return (
    <>
      <Head>
        <title>Watchlist — Yify</title>
        <meta name="description" content="The movies you saved to watch later on Yify." />
      </Head>
      <WatchlistScreen />
    </>
  );
}
