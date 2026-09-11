import Head from 'expo-router/head';
import {ScreenDisplay} from '@/instrumentation/ScreenDisplay';
import {
    canonicalUrl,
  HomeScreen,
    usePageMeta,
  useFeedViewModel,
  useMovieRepository,
  useShowRepository,
  useShowsViewModel,
  useTmdbRepository,
} from '@/presentation';

export default function HomeRoute() {
  const movies = useMovieRepository();
  const featured = useFeedViewModel(movies, {skipHero: true, pageSize: 6});
  const feed = useFeedViewModel(movies, {skipHero: true, initialChip: 'new'});
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
      <HomeScreen featured={featured} feed={feed} shows={shows} />
      <ScreenDisplay ready={!featured.loading && !feed.loading}/>
    </>
  );
}
