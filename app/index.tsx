import Head from 'expo-router/head';
import {ScreenDisplay} from '@/instrumentation/ScreenDisplay';
import {
    canonicalUrl,
  HomeScreen,
    usePageMeta,
  useFeedViewModel,
  useHomeViewModel,
  useMovieRepository,
  useShowRepository,
  useShowsViewModel,
  useTmdbRepository,
} from '@/presentation';

export default function HomeRoute() {
  const movies = useMovieRepository();
  const shelves = useHomeViewModel(movies);
  const feed = useFeedViewModel(movies, {skipHero: true});
  const shows = useShowsViewModel(useShowRepository(), useTmdbRepository());
    usePageMeta({
        title: 'Yify — Discover Movies | Free on iPhone, Android & Web',
        description:
            'Discover popular and newly added movies, explore trailers and ratings, and find where to watch. Keep your favorites in a personal watchlist.',
        canonical: canonicalUrl('/'),
    });
  return (
    <>
      <Head>
        <title>Yify — Discover Movies | Free on iPhone, Android & Web</title>
        <meta
          name="description"
          content="Discover popular and newly added movies, explore trailers and ratings, and find where to watch. Keep your favorites in a personal watchlist."
        />
          <link rel="canonical" href={canonicalUrl('/')}/>
          <meta property="og:url" content={canonicalUrl('/')}/>
      </Head>
      <HomeScreen shelves={shelves} feed={feed} shows={shows} />
      <ScreenDisplay ready={!shelves.loading && !feed.loading}/>
    </>
  );
}
