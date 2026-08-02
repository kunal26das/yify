import {useMemo} from 'react';
import Head from 'expo-router/head';
import {router} from 'expo-router';
import {MovieRepositoryImpl, YtsApiDataSource} from '@/data';
import {HomeScreen, useFeedViewModel, useHomeViewModel} from '@/presentation';
import {getApiBaseUrl} from '@/lib/remote-config';


export default function HomeRoute() {
  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const shelves = useHomeViewModel(repository);
  const feed = useFeedViewModel(repository, {skipHero: true});
  return (
    <>
      <Head>
        <title>Yify — Discover Movies | Free on iPhone, Android & Web</title>
        <meta
          name="description"
          content="Browse a curated, Netflix-style home of movies — trailers, ratings and a personal list. Free on iPhone, Android and the web."
        />
      </Head>
      <HomeScreen shelves={shelves} feed={feed} />
    </>
  );
}
