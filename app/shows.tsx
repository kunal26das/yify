import Head from 'expo-router/head';
import {ShowsScreen} from '@/presentation';

export default function ShowsRoute() {
  return (
    <>
      <Head>
        <title>Shows — Yify</title>
        <meta name="description" content="Series and episode browsing is coming soon to Yify." />
      </Head>
      <ShowsScreen />
    </>
  );
}
