import {ScrollViewStyleReset} from 'expo-router/html';
import type {PropsWithChildren} from 'react';

const SITE_URL = 'https://kunal26das.github.io/yify/';
const TITLE = 'Yify — Movie Discovery App for iPhone, Android & Web';
const DESCRIPTION =
    'Yify is a beautiful movie discovery app — browse a curated, Netflix-style home, ' +
    'filter thousands of films, watch trailers and build your list. Free on iPhone, ' +
    'Android and the web.';

const JSON_LD = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Yify',
    operatingSystem: 'ANDROID, IOS',
    applicationCategory: 'EntertainmentApplication',
    offers: {'@type': 'Offer', price: '0', priceCurrency: 'USD'},
    url: SITE_URL,
    installUrl: 'https://play.google.com/store/apps/details?id=io.github.kunal26das.yify',
    author: {'@type': 'Person', name: 'Kunal Das', url: 'https://kunal26das.github.io/'},
    description: DESCRIPTION,
});

export default function Root({children}: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
                <title>{TITLE}</title>
                <meta name="description" content={DESCRIPTION} />
                <link rel="canonical" href={SITE_URL} />
                <meta property="og:title" content={TITLE} />
                <meta property="og:description" content={DESCRIPTION} />
                <meta property="og:type" content="website" />
                <meta property="og:url" content={SITE_URL} />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content={TITLE} />
                <meta name="twitter:description" content={DESCRIPTION} />
                <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON_LD}} />
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
