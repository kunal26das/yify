const ENFORCED_CSP = "frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

function sentryReportUri(dsn) {
    const url = new URL(dsn);
    const projectNumber = url.pathname.replace(/^\//, '');
    return `https://${url.host}/api/${projectNumber}/security/?sentry_key=${url.username}`;
}

function reportOnlyPolicy({webCheckout, sentryDsn}) {
    const stripeScript = webCheckout ? ' https://js.stripe.com' : '';
    const stripeConnect = webCheckout ? ' https://api.stripe.com' : '';
    return [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.googletagmanager.com https://apis.google.com${stripeScript}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://lh3.googleusercontent.com https://www.googletagmanager.com https://*.google-analytics.com",
        "font-src 'self' data:",
        `connect-src 'self' https://*.ingest.us.sentry.io https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://api.revenuecat.com${stripeConnect}`,
        `frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://accounts.google.com${stripeScript}`,
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
        "form-action 'self'",
        `report-uri ${sentryReportUri(sentryDsn)}`,
    ].join('; ');
}

function webHeaders({webCheckout, sentryDsn}) {
    return {
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': webCheckout ? 'camera=(), microphone=(), geolocation=()' : 'camera=(), microphone=(), geolocation=(), payment=()',
        'Content-Security-Policy': ENFORCED_CSP,
        'Content-Security-Policy-Report-Only': reportOnlyPolicy({webCheckout, sentryDsn}),
    };
}

const HTML_CACHE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=600';

const pageHeaders = ['/title/movie/[id]', '/title/tv/[id]', '/person/[id]']
    .map((source) => ({source, headers: {'Cache-Control': HTML_CACHE}}));

module.exports = {ENFORCED_CSP, HTML_CACHE, pageHeaders, reportOnlyPolicy, webHeaders};
