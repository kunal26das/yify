import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import {Platform} from 'react-native';
import {sanitizeBreadcrumb, sanitizeErrorEvent} from './sentry-privacy';

// Static web exports evaluate app modules without a browser.
if (!__DEV__ && (Platform.OS !== 'web' || typeof window !== 'undefined')) {
    Sentry.init({
        dsn: 'https://ab0c10fbe49dc5a4e4f0c9ab3c7a0386@o4512058491338752.ingest.us.sentry.io/4512058497695744',
        environment: Platform.OS !== 'web' && Updates.channel === 'Staging' ? 'preview' : 'production',
        sendDefaultPii: false,
        integrations: [Sentry.breadcrumbsIntegration({console: false})],
        beforeBreadcrumb: sanitizeBreadcrumb,
        beforeSend: sanitizeErrorEvent,
    });
}
