import * as Sentry from '@sentry/react-native';
import * as Updates from 'expo-updates';
import {Platform} from 'react-native';
import {createSentryOptions} from './sentry-config';

if (!__DEV__ && (Platform.OS !== 'web' || typeof window !== 'undefined')) {
    const native = Platform.OS === 'android' || Platform.OS === 'ios';
    Sentry.init(createSentryOptions({
        native,
        environment: (Platform.OS === 'web'
            ? process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT === 'preview'
            : Updates.channel === 'Staging') ? 'preview' : 'production',
    }));
}
