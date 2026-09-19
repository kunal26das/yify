import Head from 'expo-router/head';
import {canonicalUrl, usePageMeta} from '@/presentation';
import {SubscriberAnimeScreen} from '@/presentation/anime/SubscriberAnimeScreen';

export default function AnimeRoute() {
    usePageMeta({
        title: 'Anime — Yify',
        description: 'Explore recent anime uploads and search release listings on Yify.',
        canonical: canonicalUrl('anime'),
        robots: 'noindex,nofollow',
    });
    return <>
        <Head>
            <title>Anime — Yify</title>
            <meta name="robots" content="noindex,nofollow"/>
            <meta name="description" content="Explore recent anime uploads and search release listings on Yify."/>
            <link rel="canonical" href={canonicalUrl('anime')}/>
            <meta property="og:url" content={canonicalUrl('anime')}/>
        </Head>
        <SubscriberAnimeScreen/>
    </>;
}
