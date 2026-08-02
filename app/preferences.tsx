import Head from 'expo-router/head';
import {PreferencesScreen, usePreferencesViewModel} from '@/presentation';

export default function PreferencesRoute() {
  const viewModel = usePreferencesViewModel();
  return (
    <>
      <Head>
        <title>Preferences — Yify</title>
        <meta name="description" content="Theme, landing page, notifications and app information for Yify." />
      </Head>
      <PreferencesScreen viewModel={viewModel} />
    </>
  );
}
