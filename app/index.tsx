import {useMemo} from 'react';
import Head from 'expo-router/head';
import {router} from 'expo-router';
import {
  EztvApiDataSource,
  MovieRepositoryImpl,
  ShowRepositoryImpl,
  TmdbApiDataSource,
  TmdbRepositoryImpl,
  YtsApiDataSource,
} from '@/data';
import {HomeScreen, useFeedViewModel, useHomeViewModel, useShowsViewModel} from '@/presentation';
import {getApiBaseUrl, getTmdbApiKey, remoteConfigReady} from '@/lib/remote-config';


export default function HomeRoute() {
  const api = useMemo(() => new YtsApiDataSource(getApiBaseUrl), []);
  const repository = useMemo(() => new MovieRepositoryImpl(api), [api]);
  const shelves = useHomeViewModel(repository);
  const feed = useFeedViewModel(repository, {skipHero: true});
  const showRepository = useMemo(() => new ShowRepositoryImpl(new EztvApiDataSource()), []);
  const showArtwork = useMemo(
    () =>
      new TmdbRepositoryImpl(
        new TmdbApiDataSource(async () => {
          await remoteConfigReady();
          return getTmdbApiKey();
        })
      ),
    []
  );
  const shows = useShowsViewModel(showRepository, showArtwork);
  return (
    <>
      <Head>
        <title>Yify — Discover Movies | Free on iPhone, Android & Web</title>
        <meta
          name="description"
          content="Browse a curated, Netflix-style home of movies — trailers, ratings and a personal list. Free on iPhone, Android and the web."
        />
      </Head>
      <HomeScreen shelves={shelves} feed={feed} shows={shows} />
    </>
  );
}
