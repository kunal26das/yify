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
        description: 'Series and episode browsing is coming soon to Yify.',
        canonical: canonicalUrl('shows'),
    });
  return (
    <>
      <Head>
        <title>Shows — Yify</title>
        <meta name="description" content="Series and episode browsing is coming soon to Yify." />
          <link rel="canonical" href={canonicalUrl('shows')}/>
          <meta property="og:url" content={canonicalUrl('shows')}/>
      </Head>
      <ShowsScreen viewModel={viewModel} />
      <ScreenDisplay ready={viewModel.status !== 'loading'}/>
    </>
  );
}
