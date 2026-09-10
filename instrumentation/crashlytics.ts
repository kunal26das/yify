import type {Crashlytics} from '@react-native-firebase/crashlytics';
import * as Updates from 'expo-updates';
import {ExceptionsManagerLike, installCrashlyticsHandler} from './crashlytics-handler';

function firebaseApi(): typeof import('@react-native-firebase/crashlytics') {
    return require('@react-native-firebase/crashlytics');
}

if (!__DEV__) {
    const {default: exceptionsManager} = require('react-native/Libraries/Core/ExceptionsManager') as {
        default: ExceptionsManagerLike;
    };
    installCrashlyticsHandler<Crashlytics>(ErrorUtils, () => {
        const firebase = firebaseApi();
        const client = firebase.getCrashlytics();
        try {
            void firebase.setAttributes(client, {
                react_native_runtime: Updates.runtimeVersion || 'unknown',
                expo_update_id: Updates.updateId || 'embedded',
                expo_update_channel: Updates.channel || 'unknown',
            }).catch(() => {});
        } catch {}
        return client;
    }, (client, error) => firebaseApi().recordError(client, error), exceptionsManager);
}
