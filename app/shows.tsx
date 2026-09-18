import Head from 'expo-router/head';
import {ScreenDisplay} from '@/instrumentation/ScreenDisplay';
import {
    canonicalUrl,
  ShowsScreen,
    usePageMeta,
  useShowRepository,
  useShowsViewModel,
  useTmdbRepository,
} from '@/presentation';

export default function ShowsRoute() {
  const viewModel = useShowsViewModel(useShowRepository(), useTmdbRepository());
    usePageMeta({
        title: 'Shows — Yify',
        description: 'Explore TV shows and browse their episodes on Yify.',
        canonical: canonicalUrl('shows'),
    });
  return (
    <>
      <Head>
        <title>Shows — Yify</title>
        <meta name="description" content="Explore TV shows and browse their episodes on Yify." />
          <link rel="canonical" href={canonicalUrl('shows')}/>
          <meta property="og:url" content={canonicalUrl('shows')}/>
      </Head>
      <ShowsScreen viewModel={viewModel} />
      <ScreenDisplay ready={viewModel.status !== 'loading'}/>
    </>
  );
}
