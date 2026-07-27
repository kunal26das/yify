import Head from 'expo-router/head';
import {SettingsScreen} from '@/presentation';

export default function SettingsRoute() {
  return (
    <>
      <Head>
        <title>Settings — Yify</title>
        <meta name="description" content="Theme, notifications and app information for Yify." />
      </Head>
      <SettingsScreen />
    </>
  );
}
