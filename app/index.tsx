import {useEffect, useMemo} from 'react';
import Head from 'expo-router/head';
import {router} from 'expo-router';
import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import {HomeScreen, destinationHref, useHomeViewModel} from '@/presentation';
import {getApiBaseUrl} from '@/lib/remote-config';
import {getLandingPage} from '@/lib/settings';

// Applied once per launch. Without the flag, tapping Home in the nav would bounce straight back to
// the chosen landing page and the viewer could never reach the home screen.
let landingApplied = false;

export default function HomeRoute() {
  useEffect(() => {
    if (landingApplied) return;
    landingApplied = true;
    const landing = getLandingPage();
    if (landing !== 'home') router.replace(destinationHref(landing) as never);
  }, []);

  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const viewModel = useHomeViewModel(repository);
  return (
    <>
      <Head>
        <title>Yify — Discover Movies | Free on iPhone, Android & Web</title>
        <meta
          name="description"
          content="Browse a curated, Netflix-style home of movies — trailers, ratings and a personal list. Free on iPhone, Android and the web."
        />
      </Head>
      <HomeScreen viewModel={viewModel} />
    </>
  );
}
