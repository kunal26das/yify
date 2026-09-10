import Head from 'expo-router/head';
import {ScreenDisplay} from '@/instrumentation/ScreenDisplay';
import {useLocalSearchParams} from 'expo-router';
import {
    canonicalUrl,
    useMovieDetailsViewModel,
    useMovieRepository,
    usePageMeta,
    WatchScreen,
} from '@/presentation';

export default function MovieDetailsRoute() {
    const {id} = useLocalSearchParams<{ id: string }>();
    const viewModel = useMovieDetailsViewModel(useMovieRepository(), Number(id));
    const details = viewModel.details;
    const href = /^\d+$/.test(String(id ?? '')) ? canonicalUrl(`movie/${id}`) : null;
    const title = details ? `${details.title} (${details.year}) — Yify` : 'Yify';
    const description = details
        ? (details.summary || details.synopsis || details.descriptionFull || '').slice(0, 200)
        : 'Watch the trailer, read the synopsis and save this film to your list on Yify.';
    const poster = details?.posterUrls?.[details.posterUrls.length - 1];
    usePageMeta({title, description, canonical: href, image: poster, type: 'video.movie'});
    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content={description}/>
                {href ? <link rel="canonical" href={href}/> : null}
                <meta property="og:title" content={title}/>
                <meta property="og:description" content={description}/>
                {href ? <meta property="og:url" content={href}/> : null}
                <meta property="og:type" content="video.movie"/>
                {poster ? <meta property="og:image" content={poster}/> : null}
                {poster ? <meta name="twitter:image" content={poster}/> : null}
            </Head>
            <WatchScreen viewModel={viewModel}/>
            <ScreenDisplay ready={!viewModel.loading}/>
        </>
    );
}
