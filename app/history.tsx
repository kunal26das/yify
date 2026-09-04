import Head from 'expo-router/head';
import {HistoryScreen} from '@/presentation';

export default function HistoryRoute() {
    return (
        <>
            <Head>
                <title>History — Yify</title>
                <meta name="description" content="The movies and shows you opened on Yify."/>
            </Head>
            <HistoryScreen/>
        </>
    );
}
