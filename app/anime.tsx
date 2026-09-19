import Head from 'expo-router/head';
import {ScreenDisplay} from '@/instrumentation/ScreenDisplay';
import {canonicalUrl, usePageMeta} from '@/presentation';
import {AnimeScreen} from '@/presentation/anime/AnimeScreen';
import {useAnimeViewModel} from '@/presentation/anime/useAnimeViewModel';
import {useAnimeRepository} from '@/presentation/di/DependenciesContext';

export default function AnimeRoute() {
    const viewModel = useAnimeViewModel(useAnimeRepository());
    usePageMeta({
        title: 'Anime — Yify',
        description: 'Explore recent anime uploads and search release listings on Yify.',
        canonical: canonicalUrl('anime'),
    });
    return <>
        <Head>
            <title>Anime — Yify</title>
            <meta name="description" content="Explore recent anime uploads and search release listings on Yify."/>
            <link rel="canonical" href={canonicalUrl('anime')}/>
            <meta property="og:url" content={canonicalUrl('anime')}/>
        </Head>
        <AnimeScreen viewModel={viewModel}/>
        <ScreenDisplay ready={viewModel.status !== 'loading'}/>
    </>;
}
