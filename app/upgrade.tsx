import Head from 'expo-router/head';
import {canonicalUrl, UpgradeScreen, usePageMeta} from '@/presentation';

export default function UpgradeRoute() {
    usePageMeta({title: 'Plus options — Yify', description: 'Explore Yify Plus with regional prices and clear billing terms.',
        canonical: canonicalUrl('upgrade'), robots: 'noindex,follow'});
    return <>
        <Head><title>Plus options — Yify</title><meta name="robots" content="noindex,follow"/>
            <link rel="canonical" href={canonicalUrl('upgrade')}/></Head>
        <UpgradeScreen/>
    </>;
}
