import {ScrollViewStyleReset} from 'expo-router/html';
import type {PropsWithChildren} from 'react';
import {SITE_URL} from '@/presentation';

const BASE_URL = process.env.EXPO_WEB_BASE_URL ?? '';
const TITLE = 'Yify — Movie Discovery App for iPhone, Android & Web';
const DESCRIPTION =
    'Yify is a beautiful movie discovery app — browse a curated, Netflix-style home, ' +
    'filter thousands of films, watch trailers and build your list. Free on iPhone, ' +
    'Android and the web.';
const OG_IMAGE = `${SITE_URL}/og-card.png`;

const JSON_LD = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Yify',
    operatingSystem: 'ANDROID, IOS',
    applicationCategory: 'EntertainmentApplication',
    offers: {'@type': 'Offer', price: '0', priceCurrency: 'USD'},
    url: `${SITE_URL}/`,
    installUrl: 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify',
    author: {'@type': 'Person', name: 'Kunal Das', url: 'https://kunal26das.github.io/'},
    image: OG_IMAGE,
    description: DESCRIPTION,
});

export default function Root({children}: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport"
                      content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"/>
                <link rel="preconnect" href="https://wsrv.nl" crossOrigin="anonymous"/>
                <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous"/>
                <link rel="dns-prefetch" href="https://img.youtube.com"/>
                <title>{TITLE}</title>
                <meta name="description" content={DESCRIPTION} />
                <link rel="manifest" href={`${BASE_URL}/manifest.json`}/>
                <link rel="apple-touch-icon" sizes="180x180" href={`${BASE_URL}/icons/apple-touch-icon.png`}/>
                <meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)"/>
                <meta name="theme-color" content="#0F0F0F" media="(prefers-color-scheme: dark)"/>
                <meta name="apple-mobile-web-app-title" content="Yify"/>
                <meta name="apple-mobile-web-app-capable" content="yes"/>
                <meta name="mobile-web-app-capable" content="yes"/>
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
                <meta property="og:site_name" content="Yify"/>
                <meta property="og:title" content={TITLE} />
                <meta property="og:description" content={DESCRIPTION} />
                <meta property="og:type" content="website" />
                <meta property="og:image" content={OG_IMAGE}/>
                <meta property="og:image:width" content="1200"/>
                <meta property="og:image:height" content="630"/>
                <meta property="og:image:alt" content="Yify — movie discovery app"/>
                <meta name="twitter:card" content="summary_large_image"/>
                <meta name="twitter:title" content={TITLE} />
                <meta name="twitter:description" content={DESCRIPTION} />
                <meta name="twitter:image" content={OG_IMAGE}/>
                <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON_LD}} />
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
