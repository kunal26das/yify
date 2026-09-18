import Head from 'expo-router/head';
import {canonicalUrl, JournalScreen, usePageMeta} from '@/presentation';

export default function JournalRoute() {
    usePageMeta({title: 'Journal — Yify', description: 'Your private movie journal and viewing insights.',
        canonical: canonicalUrl('journal'), robots: 'noindex,follow'});
    return <>
        <Head><title>Journal — Yify</title><meta name="robots" content="noindex,follow"/>
            <link rel="canonical" href={canonicalUrl('journal')}/></Head>
        <JournalScreen/>
    </>;
}
