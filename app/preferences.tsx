import Head from 'expo-router/head';
import {canonicalUrl, PreferencesScreen, usePageMeta, usePreferencesViewModel} from '@/presentation';

export default function PreferencesRoute() {
  const viewModel = usePreferencesViewModel();
    usePageMeta({
        title: 'Preferences — Yify',
        description:
            'Sign in to sync, pick a theme, set browse defaults, manage notifications, and clear your watchlist and searches.',
        canonical: canonicalUrl('preferences'),
    });
  return (
    <>
      <Head>
        <title>Preferences — Yify</title>
        <meta name="description" content="Sign in to sync, pick a theme, set browse defaults, manage notifications, and clear your watchlist and searches." />
          <link rel="canonical" href={canonicalUrl('preferences')}/>
          <meta property="og:url" content={canonicalUrl('preferences')}/>
      </Head>
      <PreferencesScreen viewModel={viewModel} />
    </>
  );
}
