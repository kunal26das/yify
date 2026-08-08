import Head from 'expo-router/head';
import {PreferencesScreen, usePreferencesViewModel} from '@/presentation';

export default function PreferencesRoute() {
  const viewModel = usePreferencesViewModel();
  return (
    <>
      <Head>
        <title>Preferences — Yify</title>
        <meta name="description" content="Sign in to sync, pick a theme, set browse defaults, manage notifications, and clear your watchlist and searches." />
      </Head>
      <PreferencesScreen viewModel={viewModel} />
    </>
  );
}
