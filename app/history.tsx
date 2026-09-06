import Head from 'expo-router/head';
import {canonicalUrl, HistoryScreen, usePageMeta} from '@/presentation';

export default function HistoryRoute() {
    usePageMeta({
        title: 'History — Yify',
        description: 'The movies and shows you opened on Yify.',
        canonical: canonicalUrl('history'),
    });
    return (
        <>
            <Head>
                <title>History — Yify</title>
                <meta name="description" content="The movies and shows you opened on Yify."/>
                <link rel="canonical" href={canonicalUrl('history')}/>
                <meta property="og:url" content={canonicalUrl('history')}/>
            </Head>
            <HistoryScreen/>
        </>
    );
}
