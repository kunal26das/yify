import Head from 'expo-router/head';
import {SettingsScreen, useSettingsViewModel} from '@/presentation';

export default function SettingsRoute() {
  const viewModel = useSettingsViewModel();
  return (
    <>
      <Head>
        <title>Settings — Yify</title>
        <meta name="description" content="Theme, landing page, notifications and app information for Yify." />
      </Head>
      <SettingsScreen viewModel={viewModel} />
    </>
  );
}
