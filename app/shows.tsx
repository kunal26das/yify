import Head from 'expo-router/head';
import {
  ShowsScreen,
  useShowRepository,
  useShowsViewModel,
  useTmdbRepository,
} from '@/presentation';

export default function ShowsRoute() {
  const viewModel = useShowsViewModel(useShowRepository(), useTmdbRepository());
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
