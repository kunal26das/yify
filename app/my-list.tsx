import Head from 'expo-router/head';
import {MyListScreen} from '@/presentation';

export default function MyListRoute() {
  return (
    <>
      <Head>
        <title>My List — Yify</title>
        <meta name="description" content="The movies you saved to watch later on Yify." />
      </Head>
      <MyListScreen />
    </>
  );
}
